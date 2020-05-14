import * as vscode from 'vscode';
import { window, OutputChannel } from 'vscode';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import url from 'url';
import axios from 'axios';
import { Rest12 } from './rest';
import { DatabricksVariableExplorerProvider } from './explorer';
import { explorerCode } from "./python-template";

interface Response {
	[key: string]: any;
}
export interface ExecutionContext {
	language: string;
	rest: Rest12;
	commandId: string;
	host: string;
	token: string;
	cluster: string;
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
			output.appendLine("Profile selection cancelled");
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
			output.appendLine("Cluster selection cancelled");
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
		var rest = new Rest12(output, editorPrefix);
		var result: boolean = await rest.createContext(profile, host, token, language, cluster);
		if (!result) { return; }

		// Create Execution Context

		executionContexts.set(editor.document.fileName, {
			language: language,
			rest: rest,
			commandId: "",
			host: host,
			token: token,
			cluster: cluster,
			executionId: 0
		});

		// Register Variable explorer

		vscode.window.registerTreeDataProvider(
			'databricksVariableExplorer',
			new DatabricksVariableExplorerProvider()
		);

		vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

		rest.execute(explorerCode);
		variableExplorer.refresh(rest);
	});

	let stop = vscode.commands.registerCommand('db-12-vscode.stop', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
		if (!context) { return; }

		context.rest.stop();
		clearContext(editor);
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('db-12-vscode.sendSelectionOrLine', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
		if (!context) { return; }

		// Prepare and print the input code

		context.executionId++;
		const editorPrefix = getEditorPrefix(editor.document.fileName);

		output.show(true);

		let code = "";
		let selection = editor.selection;
		if (selection.isEmpty) {
			code = editor.document.lineAt(editor.selection.active.line).text;
		} else {
			code = editor.document.getText(selection);
		}
		const prompt1 = `In[${context.executionId}]: `;
		const prompt2 = " ".repeat(prompt1.length - 5) + "...: ";
		code.split("\n").forEach((line, index) => {
			if (index === 0) {
				output.append("\n" + editorPrefix + prompt1);
			} else {
				output.append(editorPrefix + prompt2);
			}
			output.appendLine(line);
		});

		// Send code as a command
		context.rest.execute(code);
		variableExplorer.refresh(context.rest);
	});

	let cancel = vscode.commands.registerCommand('db-12-vscode.cancel', async () => {
		const editor = getEditor();
		if (!editor) { return; }

		let context = getContext(editor);
		if (!context) { return; }

		// Send cancel command
		context.rest.cancel();
		variableExplorer.refresh(context.rest);
	});

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendSelectionOrLine);
	context.subscriptions.push(cancel);
	context.subscriptions.push(stop);
}

export function deactivate() {
	console.log("deactivate");
}
