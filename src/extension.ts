import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/DatabricksConfig';

export function activate(context: vscode.ExtensionContext) {

	const execLocation = context.asAbsolutePath("resources");
	let databricksRun = new DatabricksRun(execLocation);

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

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-libraries', () => databricksRun.refreshLibraries()
	));

	vscode.workspace.onDidSaveTextDocument((document) => {
		const workspaceConfig = new DatabricksConfig();
		const pythonConfig = workspaceConfig.getObject("python");
		const libFolder = pythonConfig["lib-folder"];
		const remoteFolder = pythonConfig["remote-folder"];
		const file = vscode.workspace.asRelativePath(document.fileName);

		if ((libFolder !== "") && (remoteFolder !== "") && file.startsWith(libFolder)) {
			vscode.commands.executeCommand("workbench.action.tasks.runTask", "Upload library");
		}

	});
}

export function deactivate() {
	console.log("deactivate");
}
