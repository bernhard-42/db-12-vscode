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

export function activate(context: vscode.ExtensionContext) {
	let homedir = os.homedir();
	let databrickscfg = fs.readFileSync(path.join(homedir, '.databrickscfg'), 'utf8');
	let config = ini.parse(databrickscfg);
	let profiles = Object.keys(config);
	let languages: Array<string> = ["Python", "SQL", "Scala", "R"];
	let language = "";
	let contextId = "";
	let commandId = "";
	let host = "";
	let token = "";
	let cluster = "";
	let httpConfig: any;
	let executionId = 0;
	let output: vscode.OutputChannel;

	let initialize = vscode.commands.registerCommand('db-12-vscode.initialize', async () => {
		const editor = window.activeTextEditor;
		if (!editor) {
			return;
		}

		if (output === undefined) {
			output = window.createOutputChannel("Databricks");
			output.show(true);
		}

		const profile = await window.showQuickPick(profiles, {
			placeHolder: 'Select Databricks CLI profile'
		});
		if (profile !== undefined) {
			host = config[profile]["host"];
			token = config[profile]["token"];
			httpConfig = { headers: { "Authorization": `Bearer ${token}` } };

			try {
				const uri = url.resolve(host, 'api/2.0/clusters/list');
				const response = await axios.get(uri, httpConfig);
				const clusterConfig: Response[] = response["data"]["clusters"];
				let clusters: string[] = [];
				clusterConfig.forEach(cluster => {
					clusters.push(cluster["cluster_id"]);
				});
				cluster = await window.showQuickPick(clusters, {
					placeHolder: 'Select Databricks cluster'
				}) || "";
			} catch (error) {
				output.appendLine(`ERROR: ${error}\n`);
			}

			const lang = await window.showQuickPick(languages, {
				placeHolder: 'Select language'
			}) || "python";
			language = (lang || "Python").toLowerCase();

			try {
				const uri = url.resolve(host, 'api/1.2/contexts/create');
				const data = { "language": language, "clusterId": cluster };
				const response = await axios.post(uri, data, httpConfig);
				contextId = (response as Response)["data"].id;
			} catch (error) {
				output.appendLine(`ERROR: ${error}\n`);
			}

			try {
				const path = `api/1.2/contexts/status?clusterId=${cluster}&contextId=${contextId}`;
				const uri = url.resolve(host, path);
				const condition = (value: string) => value === "PENDING";
				let response = await poll(uri, httpConfig, condition, 1000, output);
				output.appendLine(`Execution Context created for profile '${profile}' and cluster '${cluster}'`);
			} catch (error) {
				output.appendLine(`ERROR: ${error}\n`);
			}

			executionId = 0;
		} else {
			output.appendLine("Error: Wrong profile selected");
		}
	});

	// let sendCode = vscode.commands.registerCommand('db-12-vscode.sendCode', () => {
	// 	console.info('db-12-vscode: sendCode');
	// });

	let sendSelectionOrLine = vscode.commands.registerCommand('db-12-vscode.sendSelectionOrLine', async () => {
		const editor = window.activeTextEditor;
		if (!editor) {
			return;
		}

		executionId++;
		let code = "";
		let selection = editor.selection;
		if (selection.isEmpty) {
			code = editor.document.lineAt(editor.selection.active.line).text;
		} else {
			code = editor.document.getText(selection);
		}
		const prompt1 = `In[${executionId}]: `;
		const prompt2 = " ".repeat(prompt1.length - 5) + "...: ";
		code.split("\n").forEach((line, index) => {
			if (index === 0) {
				output.append("\n" + prompt1);
			} else {
				output.append(prompt2);
			}
			output.appendLine(line);
		});

		try {
			const uri = url.resolve(host, 'api/1.2/commands/execute');
			const data = { "language": language, "clusterId": cluster, "contextId": contextId, "command": code };
			const response = await axios.post(uri, data, httpConfig);
			commandId = (response as Response)["data"].id;
		} catch (error) {
			output.appendLine(`ERROR: ${error}\n`);
		}

		try {
			const path = `api/1.2/commands/status?clusterId=${cluster}&contextId=${contextId}&commandId=${commandId}`;
			const uri = url.resolve(host, path);
			const condition = (value: string) => ["Queued", "Running", "Cancelling"].indexOf(value) !== -1;
			let response = await poll(uri, httpConfig, condition, 1000, output) as Response;

			if (response["data"].status === "Finished") {
				let resultType = (response["data"] as Response)["results"]["resultType"];
				if (resultType === "error") {
					const out = response["data"]["results"]["cause"];
					output.appendLine("ERROR:\n" + out);
				} else {
					const out = response["data"]["results"]["data"];
					output.appendLine(out);
				}
			} else if (response["data"].status === "Cancelled") {
				output.appendLine("Error: Command execution cancelled");
			} else {
				output.appendLine("Error: Command execution failed");
			}
		} catch (error) {
			output.appendLine(`ERROR: ${error}\n`);
		}
	});

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendCode);
	context.subscriptions.push(sendSelectionOrLine);
}

async function poll(
	uri: string,
	httpConfig: any,
	condition: (value: string) => boolean,
	ms: number,
	output: OutputChannel) {

	const fn = () => axios.get(uri, httpConfig);
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
