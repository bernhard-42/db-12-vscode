import * as vscode from 'vscode';
import { window, ConfigurationTarget } from 'vscode';

import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';

import { RemoteCommand } from '../rest/RemoteCommand';
import { Clusters } from '../rest/Clusters';
import { Response } from '../rest/Helpers';

import { updateTasks } from "../tasks/Tasks";
import { createVariableExplorer, VariableExplorerProvider } from '../explorers/VariableExplorer';
import { createLibraryExplorer, LibraryExplorerProvider } from '../explorers/LibraryExplorer';
import { setImportPath } from '../python/ImportPath';

import { executionContexts } from './ExecutionContext';
import { DatabricksConfig } from './DatabricksConfig';
import * as output from './DatabricksOutput';

export let RESOURCES = "";

export class DatabricksRun {
    private workspaceConfig: DatabricksConfig;
    private variableExplorer: VariableExplorerProvider | undefined;
    private libraryExplorer: LibraryExplorerProvider | undefined;

    constructor(resources: string) {
        RESOURCES = resources;
        this.workspaceConfig = new DatabricksConfig();
    }

    async initialize() {
        const editor = executionContexts.getEditor();
        if (!editor) { return; }

        let profile = "";
        let cluster = "";
        let language = "";
        let libFolder = "";
        let remoteFolder = "";

        // Get config
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        const profiles = Object.keys(dbConfig);
        this.workspaceConfig = new DatabricksConfig();

        // Use workspace settings?
        let useSettings = await window.showQuickPick(["yes", "no"], {
            placeHolder: 'Use stored settings from .vscode/settings.json?'
        }) || "";

        if (useSettings === "yes") {
            if (vscode.workspace.workspaceFolders !== undefined) {
                profile = this.workspaceConfig.getString("profile");
                cluster = this.workspaceConfig.getString("cluster");
                let pythonConfig = this.workspaceConfig.getObject("python");
                libFolder = pythonConfig["lib-folder"];
                remoteFolder = pythonConfig["remote-folder"];
            }
        } else if (useSettings !== "no") {
            vscode.window.showErrorMessage(`Cancelled`);
            return;
        }

        // Select profile
        if (profile === "") {
            profile = await window.showQuickPick(profiles, { placeHolder: 'Select Databricks CLI profile' }) || "";
            if (profile === "") {
                vscode.window.showErrorMessage(`Selection of profile cancelled`);
                return;
            } else {
                this.workspaceConfig.update(profile, "profile");
            }
        }


        const host = dbConfig[profile]["host"];
        const token = dbConfig[profile]["token"];

        // Select cluster
        if (cluster === "") {
            let clusters = [];
            const clusterApi = new Clusters(host, token);
            let response = await clusterApi.names();
            if (response["status"] === "success") {
                clusters = response["data"];
            } else {
                const error = response["data"];
                window.showErrorMessage(`ERROR: ${error}\n`);
                return;
            }

            cluster = await window.showQuickPick(clusters, { placeHolder: 'Select Databricks cluster' }) || "";
            if (cluster === "") {
                vscode.window.showErrorMessage(`Selection of cluster cancelled`);
                return;
            } else {
                this.workspaceConfig.update(cluster, "cluster");
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
        var result = await remoteCommand.createContext(profile, host, token, language, cluster) as Response;

        executionContexts.setContext(language, remoteCommand, host, token, cluster);

        if (result["status"] === "success") {
            output.info(`Created execution context for cluster '${cluster}' on host '${host}'`);
        } else {
            output.info(`Could not create Databricks Execution Context: ${result["data"]}`);
            return;
        }

        if (language === "python") {
            if (libFolder === "") {
                const wsFolder = vscode.workspace.rootPath || ".";
                const folders = fs.readdirSync(wsFolder, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .filter(dirent => ![".vscode", ".git"].includes(dirent.name))
                    .map(dirent => dirent.name);
                if (folders.length > 0) {
                    libFolder = await window.showQuickPick(folders, { placeHolder: 'Select local library folder' }) || "";
                    if (libFolder === "") {
                        vscode.window.showErrorMessage(`Selection of library folder cancelled`);
                        return;
                    }
                }
            }

            if ((libFolder !== "") && (remoteFolder === "")) {
                remoteFolder = await window.showInputBox({ prompt: "Remote folder on DBFS", placeHolder: 'dbfs:/home/' }) || "";
                if (remoteFolder === "") {
                    vscode.window.showErrorMessage(`Selection of library folder cancelled`);
                    return;
                }
            }
            this.workspaceConfig.update({ "lib-folder": libFolder, "remote-folder": remoteFolder }, "python");

            // Register Variable explorer
            this.variableExplorer = await createVariableExplorer(language, remoteCommand);

            // Register Library explorer
            this.libraryExplorer = createLibraryExplorer();

            // Set import path
            await setImportPath(remoteFolder, libFolder, remoteCommand);

            // create VS Code tasks.json
            updateTasks();
        }

        if (language === "python") {
            this.variableExplorer?.refresh();
            this.libraryExplorer?.refresh();
        }
        output.write("Ready");
        output.thickBorder();
    };

    async sendSelectionOrLine() {
        const editor = executionContexts.getEditor();
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

        this.variableExplorer?.refresh();
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
        this.variableExplorer?.refresh();
    };

    async stop(filename?: string) {

        let context = executionContexts.getContext(filename);
        output.info(`DatabricksRun stop: ${context !== undefined}`);
        if (!context) { return; }

        var result = await context.remoteCommand.stop() as Response;
        if (result["status"] === "success") {
            executionContexts.clearContext(filename);
            output.write("Context stopped");
        } else {
            output.write(result["data"]);
        }
        this.refreshVariables();
    };

    refreshLibraries() {
        if (this.libraryExplorer) {
            this.libraryExplorer.refresh();
        }
    }

    refreshVariables() {
        if (this.variableExplorer) {
            this.variableExplorer.refresh();
        }
    }

    getConnectionStatus() {
        const context = executionContexts.getContext();
        if (context) {
            return context.cluster;
        } else {
            return "--";
        }
    }
}
