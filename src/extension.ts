import * as vscode from 'vscode';
import { window } from 'vscode';
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
	let context_id = "";
	let command_id = "";
	let host = "";
	let token = "";
	let cluster = "";
	let http_config: any;
	let execution_id = 0;

	console.log('Extension "db-12-vscode" is now active');

	let initialize = vscode.commands.registerCommand('db-12-vscode.initialize', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const profile = await window.showQuickPick(profiles, {
			placeHolder: 'Select Databricks CLI profile'
		});
		if (profile !== undefined) {
			host = config[profile]["host"];
			token = config[profile]["token"];
			http_config = { headers: { "Authorization": `Bearer ${token}` } };

			try {
				const uri = url.resolve(host, 'api/2.0/clusters/list');
				const response = await axios.get(uri, http_config);
				const clusterConfig: Response[] = response["data"]["clusters"];
				let clusters: string[] = [];
				clusterConfig.forEach(cluster => {
					clusters.push(cluster["cluster_id"]);
				});
				cluster = await window.showQuickPick(clusters, {
					placeHolder: 'Select Databricks cluster'
				}) || "";
			} catch (error) {
				window.showErrorMessage(`ERROR received: ${error}\n`);
			}

			const lang = await window.showQuickPick(languages, {
				placeHolder: 'Select language'
			}) || "python";
			language = (lang || "Python").toLowerCase();

			try {
				const uri = url.resolve(host, 'api/1.2/contexts/create');
				const data = { "language": language, "clusterId": cluster };
				const response = await axios.post(uri, data, http_config);
				context_id = (response as Response)["data"].id;
			} catch (error) {
				window.showErrorMessage(`ERROR received: ${error}\n`);
			}

			try {
				const path = `api/1.2/contexts/status?clusterId=${cluster}&contextId=${context_id}`;
				const uri = url.resolve(host, path);
				const condition = (value: string) => value === "PENDING";
				let response = await poll(uri, http_config, condition, 1000);
				console.info(`Execution Context created`);
			} catch (error) {
				console.error(`ERROR received: ${error}\n`);
			}

			execution_id = 0;
		} else {
			console.error("Wrong profile selected");
		}
	});

	let sendCode = vscode.commands.registerCommand('db-12-vscode.sendCode', () => {
		console.info('db-12-vscode: sendCode');
	});

	let sendSelectionOrLine = vscode.commands.registerCommand('db-12-vscode.sendSelectionOrLine', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		execution_id++;
		let code = "";
		let selection = editor.selection;
		if (selection.isEmpty) {
			code = editor.document.lineAt(editor.selection.active.line).text;
		} else {
			code = editor.document.getText(selection);
		}
		console.log(`In[${execution_id}]:\n` + code);

		try {
			const uri = url.resolve(host, 'api/1.2/commands/execute');
			const data = { "language": language, "clusterId": cluster, "contextId": context_id, "command": code };
			const response = await axios.post(uri, data, http_config);
			command_id = (response as Response)["data"].id;
		} catch (error) {
			window.showErrorMessage(`ERROR received: ${error}\n`);
		}

		try {
			const path = `api/1.2/commands/status?clusterId=${cluster}&contextId=${context_id}&commandId=${command_id}`;
			const uri = url.resolve(host, path);
			const condition = (value: string) => ["Queued", "Running", "Cancelling"].indexOf(value) !== -1;
			let response = await poll(uri, http_config, condition, 1000) as Response;

			if (response["data"].status === "Finished") {
				let resultType = (response["data"] as Response)["results"]["resultType"];
				if (resultType === "error") {
					const out = response["data"]["results"]["cause"];
					window.showErrorMessage("Out (ERROR):\n" + out);
				} else {
					const out = response["data"]["results"]["data"];
					console.log(out);
				}
			} else if (response["data"].status === "Cancelled") {
				window.showErrorMessage("Command execution cancelled");
			} else {
				window.showErrorMessage("Command execution failed");
			}
		} catch (error) {
			window.showErrorMessage(`ERROR received: ${error}\n`);
		}
	});

	context.subscriptions.push(initialize);
	context.subscriptions.push(sendCode);
	context.subscriptions.push(sendSelectionOrLine);
}

async function poll(
	uri: string,
	http_config: any,
	condition: (value: string) => boolean,
	ms: number) {

	const fn = () => axios.get(uri, http_config);
	let response = await fn();
	while (condition((response as Response)["data"].status)) {
		process.stdout.write(".");
		await wait(ms);
		response = await fn();
	}
	process.stdout.write("\n");
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
