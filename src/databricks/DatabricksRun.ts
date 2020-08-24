import * as vscode from 'vscode';
import { window } from 'vscode';

import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import username from 'username';

import { RemoteCommand } from '../rest/RemoteCommand';
import { Clusters } from '../rest/Clusters';
import { Response } from '../rest/Helpers';

import { createVariableExplorer, VariableExplorerProvider } from '../explorers/VariableExplorer';
import { createLibraryExplorer, LibraryExplorerProvider } from '../explorers/LibraryExplorer';
import { createClusterExplorer, ClusterExplorerProvider } from '../explorers/ClusterExplorer';

import { getEditor, getCurrentFilename, getWorkspaceRoot } from '../databricks/utils';

import { setImportPath } from '../python/ImportPath';

import { executionContexts } from './ExecutionContext';
import { DatabricksConfig } from './DatabricksConfig';
import * as output from './DatabricksOutput';

export let resourcesFolder = "";

export class DatabricksRun {
    private databricksConfig = <DatabricksConfig>{};
    private variableExplorer: VariableExplorerProvider | undefined;
    private libraryExplorer: LibraryExplorerProvider | undefined;
    private clusterApi: Clusters | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private workspaceRoot: string;

    private clusterExplorer: ClusterExplorerProvider | undefined;
    private lastFilename = "";

    constructor(resources: string, private statusBar: vscode.StatusBarItem) {
        resourcesFolder = resources;
        this.workspaceRoot = getWorkspaceRoot() || "";
    }

    async initialize() {
        const editor = getEditor();
        if (!editor) { return; }

        const fileName = getCurrentFilename();
        if (!fileName) { return; }

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
        if (!remoteFolder) {
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
        let useSettings = await window.showQuickPick(["yes", "no"], {
            placeHolder: 'Use stored settings from .databricks-run.json?'
        }) || "";

        if (useSettings === "yes") {
            // avoid duplicate file watchers
            this.unregisterFileWatcher();
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
        var result = await remoteCommand.createContext(profile, host, token, language, cluster) as Response;
        if (result["status"] === "success") {
            output.info(`Created execution context for cluster '${cluster}' on host '${host}'`);
        } else {
            vscode.window.showErrorMessage(`Could not create Databricks Execution Context: ${result["data"]}`);
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


            // Register Variable explorer
            this.variableExplorer = await createVariableExplorer(language, remoteCommand);

            // Register Library explorer
            this.libraryExplorer = createLibraryExplorer(remoteCommand);

            // Register file watcher
            this.registerFileWatcher(libFolder);

            // Set import path
            await setImportPath(remoteFolder, libFolder, remoteCommand);
        }

        if (language === "python") {
            this.variableExplorer?.refresh();
            this.libraryExplorer?.refresh();
        }
        this.clusterExplorer?.refresh();

        this.updateStatus(fileName, true);
        output.write("Ready");
        output.thickBorder();
    };

    async sendSelectionOrLine() {
        const editor = getEditor();
        if (!editor) { return; }

        const context = executionContexts.getContext();
        if (!context) { return; }

        // Prepare and print the input code

        context.executionId++;
        const isPython = (context.language === "python");
        const isR = (context.language === "r");

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
        var result = await context.remoteCommand.execute(code) as Response;
        if (result["status"] === "success") {
            var data = result["data"];

            // strip R output HTML tags
            if (isR) {
                data = data.replace(/<pre[^>]+>/g, "").replace(/<\/pre>/g, "");
            }
            data.split("\n").forEach((line: string) => {
                if (isPython && (line.search(/^Out\[\d+\]:\s/) === 0)) {
                    // "In" and "Out" numbers are out of sync because of the variable explorer execution
                    // So patch "Out" number to match "In" number
                    line = line.replace(/^Out\[\d+\]:\s/, outPrompt);
                }
                output.write(line);
            });
        } else {
            output.write("Error: " + result["data"]);
        }
        output.thickBorder();

        this.variableExplorer?.refresh(editor.document.fileName);
    };

    async cancel() {
        const context = executionContexts.getContext();
        if (!context) { return; }

        // Send cancel command
        var result = await context.remoteCommand.cancel() as Response;
        if (result["status"] === "success") {
            output.write("Command cancelled");
        } else {
            output.write(result["data"]);
        }
        this.variableExplorer?.refresh(getCurrentFilename());
    };

    async stop(filename?: string) {
        if (filename && !filename?.startsWith("/")) { return; }

        let context = executionContexts.getContext(filename);
        if (!context) { return; }

        let fileName = getCurrentFilename();
        if (!fileName) { return; }

        output.info(`DatabricksRun stop for ${fileName}`);

        var result = await context.remoteCommand.stop() as Response;
        if (result["status"] === "success") {
            executionContexts.clearContext(filename);
            vscode.window.showInformationMessage("Context stopped");
        } else {
            output.write(result["data"]);
        }

        this.refreshVariables(fileName);
        this.updateStatus(fileName, true);
        this.unregisterFileWatcher();
    };

    refreshClusterAttributes() {
        if (this.clusterExplorer) {
            this.clusterExplorer.refresh();
        }
    }

    private async manageCluster(command: string) {
        if (await window.showQuickPick(["yes", "no"], { placeHolder: `${command} cluster?` }) !== "yes") { return; }

        let context = executionContexts.getContext();
        let result: Response;
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

    refreshLibraries() {
        if (this.libraryExplorer) {
            this.libraryExplorer.refresh();
        }
    }

    createEnvFile() {
        if (this.libraryExplorer) {
            this.libraryExplorer.downloadEnvFile();
        }
    }

    refreshVariables(filename?: string) {
        if (filename && this.variableExplorer) {
            this.variableExplorer.refresh(filename);
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

    registerFileWatcher(libFolder: string) {
        output.info("Registering file watcher");
        const pattern = path.join(this.workspaceRoot, libFolder, '**/*.py');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.fileWatcher.onDidChange(() => {
            output.write("change");
            vscode.commands.executeCommand("workbench.action.tasks.runTask", "Databricks Run: Upload Python Library")
        });
        this.fileWatcher.onDidCreate(() => {
            output.write("create");
            vscode.commands.executeCommand("workbench.action.tasks.runTask", "Databricks Run: Upload Python Library")
        });
        this.fileWatcher.onDidDelete(() => {
            output.write("delete");
            vscode.commands.executeCommand("workbench.action.tasks.runTask", "Databricks Run: Upload Python Library")
        });
    }

    unregisterFileWatcher() {
        if (this.fileWatcher) {
            output.info("Disposing file watcher");
            this.fileWatcher.dispose();
        }
    }
}
