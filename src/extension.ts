import * as vscode from 'vscode';
import { window, OutputChannel } from 'vscode';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import url from 'url';
import axios from 'axios';
import { Rest12, Response } from './rest';
import { DatabricksVariableExplorerProvider } from './explorer';
import { explorerCode } from "./python-template";

export interface ExecutionContext {
	language: string;
	rest: Rest12;
	commandId: string;
	host: string;
	token: string;
	cluster: string;
	editorPrefix: string;
	executionId: number;
}

let executionContexts = new Map<string, ExecutionContext>();
let variableExplorer = new DatabricksVariableExplorerProvider();

function headers(token: string) {
	return { headers: { "Authorization": `Bearer ${token}` } };
};

function getEditor() {
	const editor = window.activeTextEditor;
	if (!editor) {
		window.showErrorMessage("No editor widow open");
	}
	return editor;
}

function getContext(editor: vscode.TextEditor) {
	let context = executionContexts.get(editor.document.fileName);
	if (context === undefined) {
		window.showErrorMessage("No Databricks context available");
	}
	return context;
}

function clearContext(editor: vscode.TextEditor) {
	executionContexts.delete(editor.document.fileName);
}

function getEditorPrefix(fileName: string) {
	const parts = fileName.split("/");
	return `[${parts[parts.length - 1]}] `;
}

export function activate(context: vscode.ExtensionContext) {
	let homedir = os.homedir();
	let databrickscfg = fs.readFileSync(path.join(homedir, '.databrickscfg'), 'utf8');
	let config = ini.parse(databrickscfg);
	let profiles = Object.keys(config);
	let languages: Array<string> = ["Python", "SQL", "Scala", "R"];
	let output: vscode.OutputChannel;
	let rest: Rest12;

	function format(editorPrefix: string, msg: string) {
		return `${editorPrefix} ${msg}`;
	}

	let initialize = vscode.commands.registerCommand('db-12-vscode.initialize', async () => {
		let language = "";
		let contextId = "";
		let host = "";
		let token = "";
		let cluster = "";
		let editorPrefix = "";

		// Get editor

		const editor = getEditor();
		if (!editor) { return; }
		editorPrefix = getEditorPrefix(editor.document.fileName);

		// Create output if not exists

		if (output === undefined) {
			output = window.createOutputChannel("Databricks");
			output.show(true);
		}

		// Select Databricks CLI Profile

		const profile = await window.showQuickPick(profiles, {
			placeHolder: 'Select Databricks CLI profile'
		}) || "";

		if (profile === "") {
			output.appendLine(format(editorPrefix, "Profile selection cancelled"));
			return;
		}

		host = config[profile]["host"];
		token = config[profile]["token"];

		// Get clusters for profile

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

		// Select cluster

		cluster = await window.showQuickPick(clusters, {
			placeHolder: 'Select Databricks cluster'
		}) || "";
		if (cluster === "") {
			output.appendLine(format(editorPrefix, "Cluster selection cancelled"));
			return;
		}

		// Select language

		language = await window.showQuickPick(languages, {
			placeHolder: 'Select language'
		}) || "";
		if (language === "") {
			output.appendLine("Language selection cancelled");
			return;
		}
		language = language.toLowerCase();

		// Create Execution Context
		var rest = new Rest12(output);
		var result = await rest.createContext(profile, host, token, language, cluster) as Response;
		output.appendLine(format(editorPrefix, result["data"]));
		if (result["status"] !== "success") {
			return;
		}

		executionContexts.set(editor.document.fileName, {
			language: language,
			rest: rest,
			commandId: "",
			host: host,
			token: token,
			cluster: cluster,
			editorPrefix: editorPrefix,
			executionId: 1
		});

		// Register Variable explorer

		vscode.window.registerTreeDataProvider(
			'databricksVariableExplorer',
			new DatabricksVariableExplorerProvider()
		);

		vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

		if (language === "python") {
			var result = await rest.execute(explorerCode) as Response;
			if (result["status"] === "success") {
				output.appendLine(format(editorPrefix, result["data"]));
			} else {
				output.append(format(editorPrefix, result["data"]));
			}
		}
		output.appendLine(format(editorPrefix, "= = = = = = = = = = ="));
		variableExplorer.refresh(rest, language);
	});

	let stop = vscode.commands.registerCommand('db-12-vscode.stop', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
		if (!context) { return; }

		var result = await context.rest.stop() as Response;
		if (result["status"] === "success") {
			clearContext(editor);
			output.append(format(context.editorPrefix, "Context stopped"));
		} else {
			output.append(format(context.editorPrefix, result["data"]));
		}
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('db-12-vscode.sendSelectionOrLine', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
		if (!context) { return; }

		// Prepare and print the input code

		context.executionId++;
		const editorPrefix = getEditorPrefix(editor.document.fileName);
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

	let cancel = vscode.commands.registerCommand('db-12-vscode.cancel', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
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

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendSelectionOrLine);
	context.subscriptions.push(cancel);
	context.subscriptions.push(stop);
}

export function deactivate() {
	console.log("deactivate");
}
