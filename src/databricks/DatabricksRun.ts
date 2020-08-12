import * as vscode from 'vscode';
import { window, ConfigurationTarget } from 'vscode';

import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import url from 'url';
import axios from 'axios';

import { Response, headers } from '../rest/Helpers';
import { RemoteCommand } from '../rest/RemoteCommand';
import { updateTasks } from "../python/Tasks";
import { createVariableExplorer, DatabricksVariableExplorerProvider } from '../python/VariableExplorer';
import { setImportPath } from '../python/ImportPath';

import { ExecutionContexts } from './DatabricksExecutionContext';
import { DatabricksRunConfig } from './DatabricksConfig';
import { DatabricksRunOutput } from './DatabricksOutput';

export class DatabricksRun {
    private workspaceConfig: DatabricksRunConfig;
    private executionContexts: ExecutionContexts;
    private variableExplorer: DatabricksVariableExplorerProvider | undefined;

    constructor() {
        this.executionContexts = new ExecutionContexts();
        this.workspaceConfig = new DatabricksRunConfig();
    }

    async initialize() {
        const editor = this.executionContexts.getEditor();
        if (!editor) { return; }

        const output = new DatabricksRunOutput();

        let profile = "";
        let cluster = "";
        let language = "";
        let libFolder = "";
        let remoteFolder = "";

        // Get config
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        const profiles = Object.keys(dbConfig);
        this.workspaceConfig = new DatabricksRunConfig();

        // Use workspace settings?
        let useSettings = await window.showQuickPick(["yes", "no"], {
            placeHolder: 'Use stored settings from .vscode/settings.json?'
        }) || "";

        if (useSettings === "yes") {
            if (vscode.workspace.workspaceFolders !== undefined) {
                profile = this.workspaceConfig.get("profile");
                cluster = this.workspaceConfig.get("cluster");
                libFolder = this.workspaceConfig.get("lib-folder");
                remoteFolder = this.workspaceConfig.get("remote-folder");
            }
        } else if (useSettings !== "no") {
            output.write(`Cancelled`);
            return;
        }

        // Select profile
        if (profile === "") {
            profile = await window.showQuickPick(profiles, { placeHolder: 'Select Databricks CLI profile' }) || "";
            if (profile === "") {
                output.write(`Selection of profile cancelled`);
                return;
            } else {
                this.workspaceConfig.update(profile, "profile");
            }
        }

        const host = dbConfig[profile]["host"];
        const token = dbConfig[profile]["token"];

        // Select cluster
        if (cluster === "") {
            let clusters: string[] = [];
            try {
                const uri = url.resolve(host, 'api/2.0/clusters/list');
                const response = await axios.get(uri, headers(token));
                const clusterConfig: Response[] = response["data"]["clusters"];
                clusterConfig.forEach(cluster => {
                    clusters.push(cluster["cluster_id"]);
                });
            } catch (error) {
                window.showErrorMessage(`ERROR[1]: ${error}\n`);
                return;
            }

            cluster = await window.showQuickPick(clusters, { placeHolder: 'Select Databricks cluster' }) || "";
            if (cluster === "") {
                output.write(`Selection of cluster cancelled`);
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
            output.write(`Language of current file not supported`);
            return;
        }
        output.write(`Language: ${language}`);

        // Create Databricks Execution Context
        var remoteCommand = new RemoteCommand();
        var result = await remoteCommand.createContext(profile, host, token, language, cluster) as Response;

        if (result["status"] === "success") {
            output.write(`Created execution context for cluster '${cluster}' on host '${host}'`);
        } else {
            output.write("Could not create Databricks Execution Context");
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
                        output.write(`Selection of library folder cancelled`);
                        return;
                    } else {
                        this.workspaceConfig.update(libFolder, "lib-folder");
                    }
                }
            }

            if ((libFolder !== "") && (remoteFolder === "")) {
                remoteFolder = await window.showInputBox({ prompt: "Remote folder on DBFS", placeHolder: 'dbfs:/home/' }) || "";
                if (remoteFolder === "") {
                    output.write(`Selection of library folder cancelled`);
                    return;
                } else {
                    this.workspaceConfig.update(remoteFolder, "remote-folder");
                }
            }

            // Register Variable explorer
            this.variableExplorer = await createVariableExplorer(language, remoteCommand);

            // Set import path
            await setImportPath(remoteFolder, libFolder, remoteCommand);

            // create VS Code tasks.json
            updateTasks();
        }

        this.executionContexts.setContext(language, remoteCommand, host, token, cluster);
        output.write("= = = = = = = = = = =");
    };

    async sendSelectionOrLine() {
        const editor = this.executionContexts.getEditor();
        if (!editor) { return; }

        const output = new DatabricksRunOutput();

        const context = this.executionContexts.getContext();
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
        output.write("- - - - - - - - - - -");

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
            output.write(result["data"]);
        }
        output.write("= = = = = = = = = = =");
        this.variableExplorer?.refresh(context.remoteCommand, context.language);
    };

    async cancel() {
        const context = this.executionContexts.getContext();
        if (!context) { return; }

        const output = new DatabricksRunOutput();

        // Send cancel command
        var result = await context.remoteCommand.cancel() as Response;
        if (result["status"] === "success") {
            output.write("Command cancelled");
        } else {
            output.write(result["data"]);
        }
        this.variableExplorer?.refresh(context.remoteCommand, context.language);
    };

    async stop() {
        let context = this.executionContexts.getContext();
        if (!context) { return; }

        const output = new DatabricksRunOutput();

        var result = await context.remoteCommand.stop() as Response;
        if (result["status"] === "success") {
            this.executionContexts.clearContext();
            output.write("Context stopped");
        } else {
            output.write(result["data"]);
        }
    };

}
