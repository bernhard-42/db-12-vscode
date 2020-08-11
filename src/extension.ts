import * as vscode from 'vscode';
import { window, OutputChannel, WorkspaceConfiguration, ConfigurationTarget } from 'vscode';

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

export function activate(context: vscode.ExtensionContext) {
	const output = window.createOutputChannel("Databricks");
	output.show(true);

	let variableExplorer = new DatabricksVariableExplorerProvider();

	let editorPrefix = "";
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

	function format(editorPrefix: string, msg: string) {
		return `${editorPrefix} ${msg}`;
	}

	function updateConfig(value: string, name: string) {
		userConfig.update(name, value, ConfigurationTarget.Workspace).then(
			() => {
				output.appendLine(format(editorPrefix, `Added ${name} to workspace config .vscode/settings.json`));
			},
			(error) => {
				output.appendLine(format(editorPrefix, error));
			}
		);
		return value;
	}

	let initialize = vscode.commands.registerCommand('databricks-run.initialize', async () => {

		const editor = executionContexts.getEditor();
		if (!editor) { return; }

		editorPrefix = executionContexts.getEditorPrefix();

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
			output.appendLine(format(editorPrefix, `Cancelled`));
			return;
		}

		// Select profile

		if (profile === "") {
			profile = await window.showQuickPick(profiles, { placeHolder: 'Select Databricks CLI profile' }) || "";
			if (profile === "") {
				output.appendLine(format(editorPrefix, `Selection of profile cancelled`));
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
				output.appendLine(format(editorPrefix, `Selection of cluster cancelled`));
				return;
			} else {
				updateConfig(cluster, "cluster");
			}
		}

		// Select language

		if (editor.document.fileName.endsWith(".py")) {
			language = "python";
		} else if (editor.document.fileName.endsWith(".sql")) {
			language = "sql";
		} else if (editor.document.fileName.toLowerCase().endsWith(".r")) {
			language = "r";
		} else if (editor.document.fileName.endsWith(".scala")) {
			language = "scala";
		} else {
			output.appendLine(format(editorPrefix, `Language of current file not supported`));
			return;
		}
		output.appendLine(format(editorPrefix, `Language: ${language}`));

		// Create Execution Context

		var rest = new RemoteCommand(output);
		var result = await rest.createContext(profile, host, token, language, cluster) as Response;
		output.appendLine(format(editorPrefix, result["data"]));
		if (result["status"] !== "success") {
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
						output.appendLine(format(editorPrefix, `Selection of library folder cancelled`));
						return;
					} else {
						updateConfig(libFolder, "lib-folder");
					}
				}
			}

			if ((libFolder !== "") && (remoteFolder === "")) {
				remoteFolder = await window.showInputBox({ prompt: "Remote folder on DBFS", placeHolder: 'dbfs:/home/' }) || "";
				if (remoteFolder === "") {
					output.appendLine(format(editorPrefix, `Selection of library folder cancelled`));
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

			output.appendLine(format(editorPrefix, "Register variable explorer"));
			var result = await rest.execute(explorerCode()) as Response;
			if (result["status"] === "success") {
				output.appendLine(format(editorPrefix, result["data"]));
			} else {
				output.append(format(editorPrefix, result["data"]));
				return;
			}

			variableExplorer.refresh(rest, language);

			// Set import path

			const importPath = remoteFolder.replace("dbfs:", "/dbfs");
			const code = importCode(importPath, libFolder);
			output.appendLine(format(editorPrefix, "Added import path: " + importPath + "/" + libFolder + ".zip"));
			var result = await rest.execute(code) as Response;
			if (result["status"] === "success") {
				output.appendLine(format(editorPrefix, result["data"]));
			} else {
				output.append(format(editorPrefix, result["data"]));
			}


			// create tasks.json

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
					output.appendLine(format(editorPrefix, `Updated ${taskJson}`));
				}
			} else {
				fs.writeFileSync(taskJson, JSON.stringify(dbTasks, null, 2));
				output.appendLine(format(editorPrefix, `Created ${taskJson}`));
			}
		}

		output.appendLine(format(editorPrefix, "= = = = = = = = = = ="));

		executionContexts.setContext(language, rest, host, token, cluster, editorPrefix);
	});

	let stop = vscode.commands.registerCommand('databricks-run.stop', async () => {
		let context = executionContexts.getContext();
		if (!context) { return; }

		var result = await context.rest.stop() as Response;
		if (result["status"] === "success") {
			executionContexts.clearContext();
			output.append(format(context.editorPrefix, "Context stopped"));
		} else {
			output.append(format(context.editorPrefix, result["data"]));
		}
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('databricks-run.sendSelectionOrLine', async () => {
		const editor = executionContexts.getEditor();
		if (!editor) { return; }

		const context = executionContexts.getContext();
		if (!context) { return; }

		// Prepare and print the input code

		context.executionId++;
		const editorPrefix = context.editorPrefix;
		const isPython = (context.language === "python");
		const isR = (context.language === "r");

		output.show(true);

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
			inPrompt = format(editorPrefix, `In[${context.executionId}]:`);
			outPrompt = `Out[${context.executionId}]: `;
			output.appendLine(inPrompt);
		}
		code.split("\n").forEach((line) => {
			output.appendLine(format(editorPrefix, line));
		});
		output.appendLine(format(editorPrefix, "- - - - - - - - - - -"));

		// Send code as a command
		var result = await context.rest.execute(code) as Response;
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
				output.appendLine(format(editorPrefix, line));
			});
		} else {
			output.appendLine(format(editorPrefix, result["data"]));
		}
		output.appendLine(format(editorPrefix, "= = = = = = = = = = ="));
		variableExplorer.refresh(context.rest, context.language);
	});

	let cancel = vscode.commands.registerCommand('databricks-run.cancel', async () => {
		const context = executionContexts.getContext();
		if (!context) { return; }

		// Send cancel command
		var result = await context.rest.cancel() as Response;
		if (result["status"] === "success") {
			output.appendLine(format(context.editorPrefix, "Command cancelled"));
		} else {
			output.appendLine(format(context.editorPrefix, result["data"]));
		}
		variableExplorer.refresh(context.rest, context.language);
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
