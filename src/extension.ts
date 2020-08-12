import * as vscode from 'vscode';
import { window, WorkspaceConfiguration, ConfigurationTarget } from 'vscode';

import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import url from 'url';
import axios from 'axios';
import decomment from 'decomment';

import { Response, headers } from './rest/Helpers';
import { RemoteCommand } from './rest/RemoteCommand';
import { DatabricksVariableExplorerProvider } from './variableExplorer/VariableExplorer';
import { explorerCode, importCode } from "./python/PythonTemplate";
import { tasks } from "./python/Tasks";
import { ExecutionContexts } from './context/ExecutionContext';

let executionContexts = new ExecutionContexts();
let variableExplorer = new DatabricksVariableExplorerProvider();

export function activate(context: vscode.ExtensionContext) {
	const homedir = os.homedir();
	let databrickscfg: string;
	let dbConfig: { [key: string]: any };
	let userConfig: WorkspaceConfiguration;
	let profiles: Array<string>;

	let profile = "";
	let cluster = "";
	let language = "";
	let libFolder = "";
	let remoteFolder = "";

	function updateConfig(value: string, name: string) {
		userConfig.update(name, value, ConfigurationTarget.Workspace).then(
			() => {
				executionContexts.write(`Added ${name} to workspace config .vscode/settings.json`);
			},
			(error) => {
				executionContexts.write(error);
			}
		);
		return value;
	}

	let initialize = vscode.commands.registerCommand('databricks-run.initialize', async () => {
		const editor = executionContexts.getEditor();
		if (!editor) { return; }

		// Get config
		databrickscfg = fs.readFileSync(path.join(homedir, '.databrickscfg'), 'utf8');
		dbConfig = ini.parse(databrickscfg);
		userConfig = vscode.workspace.getConfiguration("databricks-run");
		profiles = Object.keys(dbConfig);

		// Use workspace settings?
		let useSettings = await window.showQuickPick(["yes", "no"], {
			placeHolder: 'Use stored settings from .vscode/settings.json?'
		}) || "";

		if (useSettings === "yes") {
			if (vscode.workspace.workspaceFolders !== undefined) {
				profile = userConfig.get("profile") || "";
				cluster = userConfig.get("cluster") || "";
				libFolder = userConfig.get("lib-folder") || "";
				remoteFolder = userConfig.get("remote-folder") || "";
			}
		} else if (useSettings === "no") {
			profile = "";
			cluster = "";
			libFolder = "";
			remoteFolder = "";
		} else {
			executionContexts.write(`Cancelled`);
			return;
		}

		// Select profile
		if (profile === "") {
			profile = await window.showQuickPick(profiles, { placeHolder: 'Select Databricks CLI profile' }) || "";
			if (profile === "") {
				executionContexts.write(`Selection of profile cancelled`);
				return;
			} else {
				updateConfig(profile, "profile");
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
				executionContexts.write(`Selection of cluster cancelled`);
				return;
			} else {
				updateConfig(cluster, "cluster");
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
			executionContexts.write(`Language of current file not supported`);
			return;
		}
		executionContexts.write(`Language: ${language}`);

		// Create Databricks Execution Context
		var remoteCommand = new RemoteCommand();
		var result = await remoteCommand.createContext(profile, host, token, language, cluster) as Response;
		executionContexts.write(result["data"]);
		if (result["status"] !== "success") {
			executionContexts.write("Could not create Databricks Execution Context");
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
						executionContexts.write(`Selection of library folder cancelled`);
						return;
					} else {
						updateConfig(libFolder, "lib-folder");
					}
				}
			}

			if ((libFolder !== "") && (remoteFolder === "")) {
				remoteFolder = await window.showInputBox({ prompt: "Remote folder on DBFS", placeHolder: 'dbfs:/home/' }) || "";
				if (remoteFolder === "") {
					executionContexts.write(`Selection of library folder cancelled`);
					return;
				} else {
					updateConfig(remoteFolder, "remote-folder");
				}
			}

			// Register Variable explorer
			vscode.window.registerTreeDataProvider(
				'databricksVariableExplorer',
				new DatabricksVariableExplorerProvider()
			);

			vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

			executionContexts.write("Register variable explorer");
			var result = await remoteCommand.execute(explorerCode()) as Response;
			if (result["status"] === "success") {
				executionContexts.write(result["data"]);
			} else {
				executionContexts.write(result["data"]);
				return;
			}

			variableExplorer.refresh(remoteCommand, language);

			// Set import path
			const importPath = remoteFolder.replace("dbfs:", "/dbfs");
			const code = importCode(importPath, libFolder);
			executionContexts.write("Added import path: " + importPath + "/" + libFolder + ".zip");
			var result = await remoteCommand.execute(code) as Response;
			if (result["status"] === "success") {
				executionContexts.write(result["data"]);
			} else {
				executionContexts.write(result["data"]);
			}


			// create VS Code tasks.json
			let vscodeFolder = (vscode.workspace.rootPath || ".") + "/.vscode";
			let taskJson = vscodeFolder + "/tasks.json";
			const dbTasks = tasks();
			if (!fs.existsSync(vscodeFolder)) {
				fs.mkdirSync(vscodeFolder);
			}
			if (fs.existsSync(taskJson)) {
				const tasksStr = decomment(fs.readFileSync(taskJson, "utf8"));
				const exTaskJson = JSON.parse(tasksStr);
				let addZip = true;
				let addUpload = true;
				for (const task of exTaskJson["tasks"]) {
					let label = ("label" in task) ? task["label"] as string : "";
					if (label === "Zip library") {
						addZip = false;
					} else if (label === "Upload library") {
						addUpload = false;
					}
				}
				if (addZip) {
					exTaskJson["tasks"].push(dbTasks["tasks"][0]);
				}
				if (addUpload) {
					exTaskJson["tasks"].push(dbTasks["tasks"][1]);
				}
				if (addZip || addUpload) {
					fs.writeFileSync(taskJson, JSON.stringify(exTaskJson, null, 2));
					executionContexts.write(`Updated ${taskJson}`);
				}
			} else {
				fs.writeFileSync(taskJson, JSON.stringify(dbTasks, null, 2));
				executionContexts.write(`Created ${taskJson}`);
			}
		}
		executionContexts.setContext(language, remoteCommand, host, token, cluster);
		executionContexts.write("= = = = = = = = = = =");
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('databricks-run.sendSelectionOrLine', async () => {
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
			executionContexts.write(inPrompt);
		}
		code.split("\n").forEach((line) => {
			executionContexts.write(line);
		});
		executionContexts.write("- - - - - - - - - - -");

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
				executionContexts.write(line);
			});
		} else {
			executionContexts.write(result["data"]);
		}
		executionContexts.write("= = = = = = = = = = =");
		variableExplorer.refresh(context.remoteCommand, context.language);
	});

	let cancel = vscode.commands.registerCommand('databricks-run.cancel', async () => {
		const context = executionContexts.getContext();
		if (!context) { return; }

		// Send cancel command
		var result = await context.remoteCommand.cancel() as Response;
		if (result["status"] === "success") {
			executionContexts.write("Command cancelled");
		} else {
			executionContexts.write(result["data"]);
		}
		variableExplorer.refresh(context.remoteCommand, context.language);
	});

	let stop = vscode.commands.registerCommand('databricks-run.stop', async () => {
		let context = executionContexts.getContext();
		if (!context) { return; }

		var result = await context.remoteCommand.stop() as Response;
		if (result["status"] === "success") {
			executionContexts.clearContext();
			executionContexts.write("Context stopped");
		} else {
			executionContexts.write(result["data"]);
		}
	});

	vscode.workspace.onDidSaveTextDocument((document) => {
		const userConfig = vscode.workspace.getConfiguration("databricks-run");
		const libFolder: string = userConfig.get("lib-folder") || "";
		const remoteFolder: string = userConfig.get("remote-folder") || "";
		const file = vscode.workspace.asRelativePath(document.fileName);

		if ((libFolder !== "") && (remoteFolder !== "") && file.startsWith(libFolder)) {
			vscode.commands.executeCommand("workbench.action.tasks.runTask", "Upload library");
		}
	});

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendSelectionOrLine);
	context.subscriptions.push(cancel);
	context.subscriptions.push(stop);
}

export function deactivate() {
	console.log("deactivate");
}
