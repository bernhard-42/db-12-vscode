import * as vscode from 'vscode';
import { window } from 'vscode';

import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import username from 'username';
import Table from 'cli-table';

import { RemoteCommand } from '../rest/RemoteCommand';
import { Clusters } from '../rest/Clusters';
import { Json } from '../rest/utils';

import { createVariableExplorer, VariableExplorerProvider } from '../explorers/variables/VariableExplorer';
import { createLibraryExplorer, LibraryExplorerProvider } from '../explorers/libraries/LibraryExplorer';
import { createClusterExplorer, ClusterExplorerProvider } from '../explorers/clusters/ClusterExplorer';
import { createDatabaseExplorer, DatabaseExplorerProvider } from '../explorers/databases/DatabaseExplorer';
import { Library } from '../explorers/libraries/Library';

import { getEditor, getCurrentFilename, getWorkspaceRoot } from '../databricks/utils';

import { createBuildWheelTasks } from '../tasks/BuildWheelTask';

import { executionContexts } from './ExecutionContext';
import { DatabricksConfig } from './Config';
import * as output from './Output';

export let resourcesFolder = "";


export class DatabricksRun {
    private databricksConfig = <DatabricksConfig>{};
    private variableExplorer: VariableExplorerProvider | undefined;
    private libraryExplorer: LibraryExplorerProvider | undefined;
    private databaseExplorer: DatabaseExplorerProvider | undefined;

    private clusterApi: Clusters | undefined;

    private workspaceRoot: string;

    private clusterExplorer: ClusterExplorerProvider | undefined;
    private lastFilename = "";

    constructor(resources: string, private statusBar: vscode.StatusBarItem) {
        resourcesFolder = resources;
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

        this.databricksConfig = new DatabricksConfig();

        let profile = "";
        let cluster = "";
        let clusterName = "";
        let language = "";
        let libFolder = "";
        let remoteFolder = "";

        // Get config
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        const profiles = Object.keys(dbConfig);

        remoteFolder = this.databricksConfig.getRemoteFolder();
        if (remoteFolder === undefined) {
            let name = await username() || "<username>";
            remoteFolder = await window.showInputBox({
                prompt: 'Provide a remote working folder',
                value: `dbfs:/home/${name}`
            }) || "";
            if (remoteFolder) {
                this.databricksConfig.setRemoteFolder(remoteFolder, true);
            }
            output.info(`Using '${remoteFolder}' as remote work folder`);
        }

        // Use workspace settings?
        let useSettings: string;
        if (force) {
            useSettings = "yes";
        } else {
            useSettings = await window.showQuickPick(["yes", "no"], {
                placeHolder: 'To (re)start the extension, use the stored settings?'
            }) || "";
        }

        if (useSettings === "yes") {
            // avoid duplicate file watchers
            profile = this.databricksConfig.getProfile() || "";
            let clusterInfo = this.databricksConfig.getCluster();
            if (clusterInfo) {
                const sep = clusterInfo.indexOf(" ");
                cluster = clusterInfo.substring(0, sep) || "";
                clusterName = clusterInfo.substring(sep + 2, clusterInfo.length - 1) || "";
            }
            libFolder = this.databricksConfig.getPythonLibFolder() || "";
        } else if (useSettings !== "no") {
            vscode.window.showErrorMessage(`Cancelled`);
            return;
        }

        // in case of restart stop the current context
        await this.stop();

        // Select profile
        if (profile === "") {
            profile = await window.showQuickPick(
                profiles,
                { placeHolder: 'Select Databricks CLI profile' }
            ) || "";
            if (profile === "") {
                vscode.window.showErrorMessage(`Selection of profile cancelled`);
                return;
            } else {
                this.databricksConfig.setProfile(profile, true);
            }
        }

        const host = dbConfig[profile]["host"];
        const token = dbConfig[profile]["token"];

        // Select cluster
        if (cluster === "") {
            let clusters = [];
            this.clusterApi = new Clusters(host, token);
            let response = await this.clusterApi.names();
            if (response["status"] === "success") {
                clusters = response["data"];
            } else {
                const error = response["data"];
                window.showErrorMessage(`ERROR: ${error}\n`);
                return;
            }

            let clusterList: { [key: string]: [string, string] } = {};
            clusters.forEach((row: [string, string]) => {
                clusterList[`${row[0]} (${row[1]})`] = row;
            });
            let clusterInfo = await window.showQuickPick(
                Object.keys(clusterList),
                { placeHolder: 'Select Databricks cluster' }
            ) || "";
            if (clusterInfo === "") {
                vscode.window.showErrorMessage(`Selection of cluster cancelled`);
                return;
            } else {
                [cluster, clusterName] = clusterList[clusterInfo];
                this.databricksConfig.setCluster(clusterInfo, true);
            }
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

        // Create Databricks Execution Context
        var remoteCommand = new RemoteCommand();

        executionContexts.setContext(fileName, language, remoteCommand, host, token, cluster, clusterName);

        // Register Cluster Explorer
        this.clusterExplorer = createClusterExplorer(cluster, host, token);

        // Create remote execution context
        var result = await remoteCommand.createContext(profile, host, token, language, cluster) as Json;
        if (result["status"] === "success") {
            output.info(`Created execution context for cluster '${cluster}' on host '${host}'`);
        } else {
            if (result["data"].startsWith("ClusterNotReadyException")) {
                if (await window.showQuickPick(["yes", "no"], { placeHolder: `Cluster not running, start it?` }) === "yes") {
                    let clusterApi = new Clusters(host, token);
                    result = await clusterApi.start(cluster);
                }
                for (let dummy of [0, 2]) {
                    setTimeout(() => {
                        console.log('Test');
                        this.refreshClusterAttributes();
                    }, 1000);
                }
                output.write("Please re-initialize the extension once the cluster is started");
            } else {
                vscode.window.showErrorMessage(`Could not create Databricks Execution Context: ${result["data"]}`);
            }
            return;
        }

        if (language === "python") {
            if (libFolder === "") {
                // const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName))?.uri.path || ".";
                const folders = fs.readdirSync(this.workspaceRoot, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .filter(dirent => ![".vscode", ".git"].includes(dirent.name))
                    .map(dirent => dirent.name);
                if (folders.length > 0) {
                    libFolder = await window.showQuickPick(
                        folders,
                        { placeHolder: 'Select local library folder' }
                    ) || "";
                    if (libFolder === "") {
                        vscode.window.showErrorMessage(`Selection of library folder cancelled`);
                        return;
                    }
                }
                this.databricksConfig.setPythonLibFolder(libFolder, false);
            }

            // Add Build wheel task
            createBuildWheelTasks();

            // Register Variable explorer
            this.variableExplorer = createVariableExplorer(language, remoteCommand);
            this.variableExplorer?.refresh();

            // Register Library explorer
            this.libraryExplorer = createLibraryExplorer(remoteCommand);
            this.libraryExplorer?.refresh();


            // Register Database explorer
            this.databaseExplorer = createDatabaseExplorer(remoteCommand);
            this.databaseExplorer?.refresh();
        }

        this.clusterExplorer?.refresh();
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
        code.split("\n").forEach((line) => {
            output.write(line);
        });
        output.thinBorder();

        // Send code as a command
        var result = await context.remoteCommand.execute(code) as Json;
        if (result["status"] === "success") {
            var data = result["data"];

            if (isR) {
                // strip R output HTML tags
                data = data.replace(/<pre[^>]+>/g, "").replace(/<\/pre>/g, "");
                data.forEach((line: string) => {
                    output.write(line);
                });
            } else if (isPython) {
                if (result["schema"]) {
                    let columns = result["schema"].map((col: Json) => col.name);
                    const table = new Table({ head: columns });
                    data.forEach((line: string[]) => {
                        table.push(line);
                    });
                    table.toString().split("\n").forEach(line => output.write(line));
                } else {
                    data.split("\n").forEach((line: string) => {
                        if (line.search(/^Out\[\d+\]:\s/) === 0) {
                            // "In" and "Out" numbers are out of sync because of the variable explorer execution
                            // So patch "Out" number to match "In" number
                            line = line.replace(/^Out\[\d+\]:\s/, outPrompt);
                        }
                        output.write(line);
                    });
                }
            } else if (isSQL) {
                let columns = result["schema"].map((col: Json) => col.name);
                const table = new Table({ head: columns });
                data.forEach((line: string[]) => {
                    table.push(line);
                });
                table.toString().split("\n").forEach(line => output.write(line));
            } else {
                data.split("\n").forEach((line: string) => {
                    output.write(line);
                });
            }
        } else {
            output.write("Error: " + result["data"]);
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
        var result = await context.remoteCommand.cancel() as Json;
        if (result["status"] === "success") {
            output.write("Command cancelled");
        } else {
            output.write(result["data"]);
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
            output.info(`No Databricks context available`);
            return;
        }

        var result = await context.remoteCommand.stop() as Json;
        if (result["status"] === "success") {
            vscode.window.showInformationMessage(`Context stopped for ${filename}`);
            executionContexts.clearContext(filename);
        } else {
            output.write(result["data"]);
        }

        this.refreshVariables(filename);
        this.refreshDatabases();
        this.refreshLibraries();
        this.updateStatus(filename, true);
    };

    refreshClusterAttributes() {
        if (this.clusterExplorer) {
            this.clusterExplorer.refresh();
        }
    }

    private async manageCluster(command: string) {
        if (await window.showQuickPick(["yes", "no"], { placeHolder: `${command} cluster?` }) !== "yes") { return; }

        let context = executionContexts.getContext();
        let result: Json;
        if (context?.cluster) {
            let clusterApi = new Clusters(context.host, context.token);
            if (command === "start") {
                result = await clusterApi.start(context.cluster);
            } else if (command === "restart") {
                result = await clusterApi.restart(context.cluster);
            } else if (command === "stop") {
                result = await clusterApi.stop(context.cluster);
            } else {
                return;
            }
            if (result["status"] === "success") {
                vscode.window.showInformationMessage(`Triggered cluster ${command}`);
            } else {
                vscode.window.showErrorMessage(`Couldn't ${command} cluster`);
                output.info(result["data"]);
            }
            for (let dummy of [0, 2]) {
                setTimeout(() => {
                    console.log('Test');
                    this.refreshClusterAttributes();
                }, 1000);
            }
        }
    }

    async startCluster() {
        this.manageCluster("start");
    }

    async restartCluster() {
        this.manageCluster("restart");
    }

    async stopCluster() {
        this.manageCluster("stop");
    }

    refreshVariables(filename?: string) {
        if (this.variableExplorer) {
            this.variableExplorer.refresh(filename);
        }
    }

    refreshDatabases(filename?: string) {
        if (this.databaseExplorer) {
            this.databaseExplorer.refresh(filename);
        }
    }

    refreshLibraries(filename?: string) {
        if (this.libraryExplorer) {
            this.libraryExplorer.refresh(filename);
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

    dispose() {
        // this.unregisterFileWatcher();
    }
}
