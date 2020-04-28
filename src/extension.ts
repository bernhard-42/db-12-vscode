import * as vscode from 'vscode';
import { window, OutputChannel } from 'vscode';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ini from 'ini';
import url from 'url';
import axios from 'axios';

interface Response {
	[key: string]: any;
}
interface ExecutionContext {
	language: string;
	contextId: string;
	commandId: string;
	host: string;
	token: string;
	cluster: string;
	executionId: number;
}

let executionContexts = new Map<string, ExecutionContext>();

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

	let initialize = vscode.commands.registerCommand('db-12-vscode.initialize', async () => {
		let language = "";
		let contextId = "";
		let host = "";
		let token = "";
		let cluster = "";

		// Get editor

		const editor = getEditor();
		if (!editor) { return; }

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

		try {
			const uri = url.resolve(host, 'api/1.2/contexts/create');
			const data = {
				"language": language,
				"clusterId": cluster
			};
			const response = await axios.post(uri, data, headers(token));
			contextId = (response as Response)["data"].id;
		} catch (error) {
			window.showErrorMessage(`ERROR[2]: ${error}\n`);
			return;
		}

		// Poll context until it is created

		try {
			const path = `api/1.2/contexts/status?clusterId=${cluster}&contextId=${contextId}`;
			const uri = url.resolve(host, path);
			const condition = (value: string) => value === "PENDING";
			let response = await poll(uri, token, condition, 1000, output);
			output.appendLine(`Execution Context created for profile '${profile}' and cluster '${cluster}'`);
		} catch (error) {
			window.showErrorMessage(`ERROR[3]: ${error}\n`);
			return;
		}

		// Create Execution Context

		executionContexts.set(editor.document.fileName, {
			language: language,
			contextId: contextId,
			commandId: "",
			host: host,
			token: token,
			cluster: cluster,
			executionId: 0
		});
	});

	let stop = vscode.commands.registerCommand('db-12-vscode.stop', async () => {
		// Get editor

		const editor = getEditor();
		if (!editor) { return; }

		// Verify execution context exists

		let context = getContext(editor);
		if (!context) { return; }

		const editorPrefix = getEditorPrefix(editor.document.fileName);

		// Send cancel command
		try {
			const uri = url.resolve(context.host, 'api/1.2/contexts/destroy');
			const data = {
				"clusterId": context.cluster,
				"contextId": context.contextId
			};
			await axios.post(uri, data, headers(context.token));
			output.appendLine(editorPrefix + "Execution context stopped");
			clearContext(editor);
		} catch (error) {
			output.appendLine(editorPrefix + ` ERROR[4]: ${error}\n`);
		}
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('db-12-vscode.sendSelectionOrLine', async () => {
		// Get editor

		const editor = getEditor();
		if (!editor) { return; }

		// Verify execution context exists

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

		try {
			const uri = url.resolve(context.host, 'api/1.2/commands/execute');
			const data = {
				"language": context.language,
				"clusterId": context.cluster,
				"contextId": context.contextId,
				"command": code
			};
			const response = await axios.post(uri, data, headers(context.token));
			context.commandId = (response as Response)["data"].id;
		} catch (error) {
			output.appendLine(editorPrefix + ` ERROR[5]: ${error}\n`);
		}

		// Poll command until it is finished

		try {
			const path = `api/1.2/commands/status?clusterId=${context.cluster}&contextId=${context.contextId}&commandId=${context.commandId}`;
			const uri = url.resolve(context.host, path);
			const condition = (value: string) => ["Queued", "Running", "Cancelling"].indexOf(value) !== -1;
			let response = await poll(uri, context.token, condition, 1000, output) as Response;

			if (response["data"].status === "Finished") {
				let resultType = (response["data"] as Response)["results"]["resultType"];
				if (resultType === "error") {
					const out = response["data"]["results"]["cause"];
					if (out.indexOf("CommandCancelledException") === -1) {
						output.appendLine(editorPrefix + " ERROR[6]:\n" + out);
					}
				} else {
					const out = response["data"]["results"]["data"] as string;
					out.split("\n").forEach((line) => {
						output.append(editorPrefix);
						output.appendLine(line);
					});
				}
			} else if (response["data"].status === "Cancelled") {
				output.appendLine("Error: Command execution cancelled");
			} else {
				output.appendLine("Error: Command execution failed");
			}
		} catch (error) {
			output.appendLine(`ERROR7: ${error}\n`);
		}
	});

	let cancel = vscode.commands.registerCommand('db-12-vscode.cancel', async () => {
		// Get editor

		const editor = getEditor();
		if (!editor) { return; }

		// Verify execution context exists

		let context = getContext(editor);
		if (!context) { return; }

		const editorPrefix = getEditorPrefix(editor.document.fileName);

		// Send cancel command
		try {
			const uri = url.resolve(context.host, 'api/1.2/commands/cancel');
			const data = {
				"clusterId": context.cluster,
				"contextId": context.contextId,
				"commandId": context.commandId
			};
			await axios.post(uri, data, headers(context.token));
			output.appendLine("\n" + editorPrefix + "=> Command cancelled");
		} catch (error) {
			output.appendLine(editorPrefix + ` ERROR8: ${error}\n`);
		}
	});

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendSelectionOrLine);
	context.subscriptions.push(cancel);
	context.subscriptions.push(stop);
}

async function poll(
	uri: string,
	token: string,
	condition: (value: string) => boolean,
	ms: number,
	output: OutputChannel) {

	const fn = () => axios.get(uri, headers(token));
	let response = await fn();
	while (condition((response as Response)["data"].status)) {
		output.append("»");
		await wait(ms);
		response = await fn();
	}
	output.append("\n");
	return response;
}

function wait(ms = 1000) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function deactivate() {
	console.log("deactivate");
}
