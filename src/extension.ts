import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/DatabricksConfig';
import * as output from './databricks/DatabricksOutput';

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

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-variables', () => databricksRun.refreshVariables()
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

	vscode.window.onDidChangeActiveTextEditor(e => {
		output.write("window.onDidChangeActiveTextEditor");
		databricksRun.refreshVariables();
	});

	vscode.workspace.onDidCloseTextDocument(e => {
		output.write("workspace.onDidCloseTextDocument");
		databricksRun.stop(e.fileName);
	});
}

export function deactivate() {
	console.log("deactivate");
}
