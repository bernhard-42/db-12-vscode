import * as vscode from 'vscode';
import { window } from 'vscode';

import fs from 'fs';
import path from 'path';

import username from 'username';
import Table from 'cli-table';

import { RemoteCommand } from '../rest/RemoteCommand';
import { Clusters } from '../rest/Clusters';
import { Json } from '../rest/Rest';

import { createVariableExplorer, VariableExplorerProvider } from '../explorers/variables/VariableExplorer';
import { createLibraryExplorer, LibraryExplorerProvider } from '../explorers/libraries/LibraryExplorer';
import { createClusterExplorer, ClusterExplorerProvider } from '../explorers/clusters/ClusterExplorer';
import { createSecretsExplorer, SecretsExplorerProvider } from '../explorers/secrets/SecretsExplorer';
import { createDatabaseExplorer, DatabaseExplorerProvider } from '../explorers/databases/DatabaseExplorer';
import { createContextExplorer, ContextExplorerProvider } from '../explorers/contexts/ContextExplorer';

import { Library } from '../explorers/libraries/Library';
import { Secret } from '../explorers/secrets/Secret';
import { ClusterAttribute } from '../explorers/clusters/ClusterAttribute';

import { DatabricksRunPanel } from '../viewers/DatabricksRunPanel';

import { getEditor, getCurrentFilename, getWorkspaceRoot, inquiry } from '../databricks/utils';

import { createBuildWheelTasks } from '../tasks/BuildWheelTask';

import { executionContexts } from './ExecutionContext';
import { DatabricksConfig, NOLIB } from './Config';
import * as output from './Output';
import { DatabaseItem } from '../explorers/databases/Database';
import { Variable } from '../explorers/variables/Variable';
import { Context } from 'mocha';


export let resourcesFolder = "";


export class DatabricksRun {
    private databricksConfig = <DatabricksConfig>{};
    private variableExplorer: VariableExplorerProvider | undefined;
    private libraryExplorer: LibraryExplorerProvider | undefined;
    private databaseExplorer: DatabaseExplorerProvider | undefined;
    private clusterExplorer: ClusterExplorerProvider | undefined;
    private secretsExplorer: SecretsExplorerProvider | undefined;
    private contextEplorer: ContextExplorerProvider | undefined;

    private clusterApi: Clusters | undefined;
    private workspaceRoot: string;
    private lastFilename = "";

    constructor(private context: vscode.ExtensionContext, private statusBar: vscode.StatusBarItem) {
        resourcesFolder = context.asAbsolutePath("resources");
        this.workspaceRoot = getWorkspaceRoot() || "";
    }

    async initialize(force?: boolean) {
        const editor = getEditor();
        if (editor === undefined) {
            vscode.window.showErrorMessage(`No VS Code editor open`);
            return;
        }

        const fileName = getCurrentFilename();
        if (fileName === undefined) {
            vscode.window.showErrorMessage(`No file open in VS Code`);
            return;
        }

        let profile = "";
        let cluster = "";
        let clusterName = "";
        let language = "";
        let libFolder = "";
        let remoteFolder = "";

        // Use workspace settings?
        let useSettings = "yes";
        if (!force) {
            useSettings = await inquiry(
                'To (re)start the extension, use the stored settings?',
                ["yes", "no"]);
        }

        this.databricksConfig = new DatabricksConfig();
        this.databricksConfig.init();
        const profiles = this.databricksConfig.getProfiles();

        if (useSettings === "yes") {
            profile = this.databricksConfig.getProfile() || "";
            [cluster, clusterName] = this.databricksConfig.getClusterInfo();
            libFolder = this.databricksConfig.getPythonLibFolder() || "";
            remoteFolder = this.databricksConfig.getRemoteFolder() || "";
        } else if (useSettings !== "no") {
            vscode.window.showErrorMessage(`Cancelled`);
            return;
        }

        // in case of restart stop the current context
        await this.stop();

        // Select profile
        if (profile === "") {
            profile = await inquiry('Select Databricks CLI profile', profiles);
            if (profile === "") {
                vscode.window.showErrorMessage(`Selection of profile cancelled`);
                return;
            } else {
                this.databricksConfig.setProfile(profile);
            }
        }

        const [host, token] = this.databricksConfig.getHostAndToken();

        // Select cluster
        if (cluster === "") {
            let clusters = [];
            this.clusterApi = new Clusters(host, token);
            let response = await this.clusterApi.names();
            if (response.isSuccess()) {
                clusters = (response.toJson() as [string, string][]);
            } else {
                const error = response.toString();
                window.showErrorMessage(`${error}\n`);
                return;
            }

            let clusterList: { [key: string]: [string, string] } = {};
            clusters.forEach((row: [string, string]) => {
                clusterList[`${row[0]} (${row[1]})`] = row;
            });
            let clusterInfo = await inquiry('Select Databricks cluster', Object.keys(clusterList));
            if (clusterInfo === "") {
                vscode.window.showErrorMessage(`Selection of cluster cancelled`);
                return;
            } else {
                [cluster, clusterName] = clusterList[clusterInfo];
                this.databricksConfig.setCluster(clusterInfo);
            }
        }

        if (remoteFolder === "") {
            let name = this.databricksConfig.getUsername();
            if (name === "") {
                name = await username() || "<username>";
            }
            remoteFolder = await window.showInputBox({
                prompt: 'Provide a remote working folder',
                value: `dbfs:/home/${name}`
            }) || "";
            if (remoteFolder) {
                this.databricksConfig.setRemoteFolder(remoteFolder);
            }
            output.info(`Using '${remoteFolder}' as remote work folder`);
        }

        // Detect language
        if (editor.document.fileName.endsWith(".py")) {
            language = "python";
        } else if (editor.document.fileName.endsWith(".sql")) {
            language = "sql";
        } else if (editor.document.fileName.toLowerCase().endsWith(".r")) {
            language = "r";
        } else if (editor.document.fileName.endsWith(".scala")) {
            language = "scala";
        } else {
            vscode.window.showErrorMessage(`Language of current file not supported`);
            return;
        }
        output.info(`Language: ${language}`);

        // Register Cluster Explorer
        this.clusterExplorer = createClusterExplorer(cluster, host, token);

        // Register Cluster Explorer
        this.secretsExplorer = createSecretsExplorer(host, token);

        // Create Databricks Execution Context
        var remoteCommand = new RemoteCommand(host, token, profile, language, cluster);

        executionContexts.setContext(fileName, language, remoteCommand, host, token, cluster, clusterName);

        // Create remote execution context
        var result = await remoteCommand.createContext();
        if (result.isSuccess()) {
            output.info(`Created execution context for cluster '${cluster}' on host '${host}'`);
        } else {
            const error = result.toString();
            if (error.startsWith("ClusterNotReadyException")) {
                if (error.indexOf("currently Pending") >= 0) {
                    vscode.window.showErrorMessage("Cluster is currently starting");
                } else {
                    const answer = await inquiry(`Cluster not running, start it?`, ["yes", "no"]);
                    if (answer === "yes") {
                        let clusterApi = new Clusters(host, token);
                        result = await clusterApi.start(cluster);
                        if (result.isFailure()) {
                            output.error(result.toString());
                        }
                    }
                    for (let dummy of [0, 2]) {
                        setTimeout(() => {
                            console.log('Test');
                            this.refreshClusters();
                        }, 1000);
                    }
                    output.write("Please re-initialize the extension once the cluster is started");
                }
            } else {
                vscode.window.showErrorMessage(`Could not create Databricks Execution Context: ${result.toString()}`);
            }
            return;
        }

        if (language === "python") {
            if (libFolder === "") {
                let folders = fs.readdirSync(this.workspaceRoot, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .filter(dirent => ![".vscode", ".git", "__pycache__"].includes(dirent.name))
                    .map(dirent => dirent.name);
                if (folders.length > 0) {
                    folders = [NOLIB].concat(folders);
                    libFolder = await inquiry('Select local library folder', folders);
                }
                this.databricksConfig.setPythonLibFolder(libFolder);
            }

            // Add Build wheel task
            createBuildWheelTasks();

            // Register Variable explorer
            this.variableExplorer = createVariableExplorer(language, remoteCommand);
            this.variableExplorer?.refresh();

            // Register Library explorer
            this.libraryExplorer = createLibraryExplorer(remoteCommand);
            this.libraryExplorer?.refresh();
        }

        if (language !== "r") {
            // Register Database explorer
            this.databaseExplorer = createDatabaseExplorer(remoteCommand);
            this.databaseExplorer?.refresh();
        }

        this.contextEplorer = createContextExplorer();
        this.contextEplorer?.refresh();

        this.clusterExplorer?.refresh();
        this.secretsExplorer.refresh();
        this.updateStatus(fileName, true);

        output.write("Ready");
        output.thickBorder();
    };

    async sendSelectionOrLine() {
        const editor = getEditor();
        if (editor === undefined) {
            vscode.window.showErrorMessage(`No VS Code editor open`);
            return;
        }

        const context = executionContexts.getContext();
        if (context === undefined) {
            vscode.window.showErrorMessage(`No Databricks context available`);
            return;
        }

        // Prepare and print the input code

        context.executionId++;
        const isPython = (context.language === "python");
        const isR = (context.language === "r");
        const isSQL = (context.language === "sql");

        let code = "";
        let selection = editor.selection;
        if (selection.isEmpty) {
            code = editor.document.lineAt(editor.selection.active.line).text;
        } else {
            code = editor.document.getText(selection);
        }

        var inPrompt = "";
        var outPrompt = "";
        if (isPython) {
            inPrompt = `In[${context.executionId}]:`;
            outPrompt = `Out[${context.executionId}]: `;
            output.write(inPrompt);
        }
        code.split(/\r?\n/).forEach((line) => {
            output.write(line);
        });
        output.thinBorder();

        let renderTable = (result: Json) => {
            let columns = result["schema"].map((col: Json) => col.name);
            const table = new Table({ head: columns });
            result["data"].forEach((line: string[]) => {
                // eslint-disable-next-line eqeqeq
                table.push(line.map(col => (col == null) ? "null" : col));
            });
            let tableStr = table.toString();
            let tableLines = tableStr.split(/\r?\n/);
            tableLines.forEach(line => output.write(line));
        };

        let renderHtml = (div: string) => {
            DatabricksRunPanel.createOrShow(this.context.extensionUri);
            DatabricksRunPanel.currentPanel?.update(div);
        };

        // Send code as a command
        let result = await context.remoteCommand.execute(code);
        if (result.isSuccess()) {
            let result2 = result.toJson()["result"];
            var data = result2["data"];

            if (result2["type"] === "table") {
                renderTable(result2);
            } else if (data.startsWith("<div>")) {
                renderHtml(data);
            } else if (isR) {
                // strip R output HTML tags
                data = data.replace(/<pre[^>]+>/g, "").replace(/<\/pre>/g, "");
                data.forEach((line: string) => {
                    output.write(line);
                });
            } else if (isPython) {
                data.split("\n").forEach((line: string) => {
                    if (line.search(/^Out\[\d+\]:\s/) === 0) {
                        // "In" and "Out" numbers are out of sync because of the variable explorer execution
                        // So patch "Out" number to match "In" number
                        line = line.replace(/^Out\[\d+\]:\s/, outPrompt);
                    }
                    output.write(line);
                });
            } else {
                data.split("\n").forEach((line: string) => {
                    output.write(line);
                });
            }
        } else {
            output.write(result.toString());
        }
        output.thickBorder();

        this.variableExplorer?.refresh(editor.document.fileName);
    };

    async cancel() {
        const context = executionContexts.getContext();
        if (context === undefined) {
            vscode.window.showErrorMessage(`No Databricks context available`);
            return;
        }
        // Send cancel command
        var result = await context.remoteCommand.cancel();
        if (result.isSuccess()) {
            output.write("Command cancelled");
        } else {
            output.write(result.toString());
        }
        this.variableExplorer?.refresh(getCurrentFilename());
    };

    async stop(filename?: string) {
        if (filename) {
            if (!filename?.startsWith("/")) {
                // ignore artificial files like extension-#10
                return;
            }
        } else {
            filename = getCurrentFilename();
            if (filename === undefined) {
                return;
            }
        }

        let context = executionContexts.getContext(filename);
        if (context === undefined) {
            output.error(`No Databricks context available`);
            return;
        }

        var result = await context.remoteCommand.stop();
        if (result.isSuccess()) {
            vscode.window.showInformationMessage(`Context stopped for ${filename}`);
            executionContexts.clearContext(filename);
        } else {
            output.write(result.toString());
        }

        this.refreshVariables(filename);
        this.refreshDatabases();
        this.refreshLibraries();
        this.refreshContexts();
        this.refreshClusters();
        this.updateStatus(filename, true);
    };

    refreshClusters() {
        if (this.clusterExplorer) {
            this.clusterExplorer.refresh();
        }
    }

    async startCluster(cluster: ClusterAttribute) {
        if (await inquiry(`Start cluster?`, ["yes", "no"]) !== "yes") { return; }
        this.clusterExplorer?.manageCluster(cluster, "start");
    }

    async restartCluster(cluster: ClusterAttribute) {
        if (await inquiry(`Restart cluster?`, ["yes", "no"]) !== "yes") { return; }
        this.clusterExplorer?.manageCluster(cluster, "restart");
    }

    async stopCluster(cluster: ClusterAttribute) {
        if (await inquiry(`Stop cluster?`, ["yes", "no"]) !== "yes") { return; }
        this.clusterExplorer?.manageCluster(cluster, "stop");
    }

    refreshSecrets() {
        this.secretsExplorer?.refresh();
    }

    refreshVariables(filename?: string) {
        if (this.variableExplorer) {
            this.variableExplorer.refresh(filename);
        }
    }

    pasteFromSecrets(secret: Secret) {
        if (this.secretsExplorer) {
            let snippet = new vscode.SnippetString(this.secretsExplorer.getSnippet(secret));
            const editor = getEditor();
            editor?.insertSnippet(snippet);
        }
    }

    pasteFromDataframe(variable: Variable) {
        if (this.variableExplorer) {
            let snippet = new vscode.SnippetString(this.variableExplorer.getSnippet(variable));
            const editor = getEditor();
            editor?.insertSnippet(snippet);
        }
    }

    refreshDatabases(filename?: string) {
        if (this.databaseExplorer) {
            this.databaseExplorer.refresh(filename);
        }
    }

    pasteFromDatabase(database: DatabaseItem) {
        if (this.databaseExplorer) {
            let snippet = new vscode.SnippetString(this.databaseExplorer.getSnippet(database));
            const editor = getEditor();
            editor?.insertSnippet(snippet);
        }
    }
    refreshLibraries(filename?: string) {
        if (this.libraryExplorer) {
            this.libraryExplorer.refresh(filename);
        }
    }

    refreshContexts() {
        if (this.contextEplorer) {
            this.contextEplorer.refresh();
        }
    }

    installLibrary(library: Library) {
        this.libraryExplorer?.install(library);
    }

    createEnvFile() {
        if (this.libraryExplorer) {
            this.libraryExplorer.downloadEnvFile();
        }
    }

    updateStatus(filename?: string, force?: boolean) {
        if ((filename !== "") && (force || (filename !== this.lastFilename))) {
            const context = executionContexts.getContext();
            if (context) {
                let status = context.clusterName;
                this.statusBar.tooltip = `Connection to Databricks cluster ${context.cluster}`;
                this.statusBar.text = `(${status})`;
                this.statusBar.show();
            } else {
                this.statusBar.hide();
            }
        }
    }

    openFile(context: Context) {
        vscode.workspace.openTextDocument(context.value).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    dispose() {
    }
}
