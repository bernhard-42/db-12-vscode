import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksRunConfig } from './databricks/DatabricksConfig';

let databricksRun = new DatabricksRun();

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.initialize', () => databricksRun.initialize()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.sendSelectionOrLine', () => databricksRun.sendSelectionOrLine()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.stop', () => databricksRun.stop()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.cancel', () => databricksRun.cancel()
	));

	vscode.workspace.onDidSaveTextDocument((document) => {
		const userConfig = new DatabricksRunConfig();
		const libFolder: string = userConfig.get("lib-folder");
		const remoteFolder: string = userConfig.get("remote-folder");
		const file = vscode.workspace.asRelativePath(document.fileName);

		if ((libFolder !== "") && (remoteFolder !== "") && file.startsWith(libFolder)) {
			vscode.commands.executeCommand("workbench.action.tasks.runTask", "Upload library");
		}
	});
}

export function deactivate() {
	console.log("deactivate");
}
