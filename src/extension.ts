import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/DatabricksConfig';
import * as output from './databricks/DatabricksOutput';

let statusBar: vscode.StatusBarItem;

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

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.get-connection-status', () => databricksRun.getConnectionStatus()
	));

	// create a new status bar item that we can now manage
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'databricks-run.get-connection-status';

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
	);
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem)
	);

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			const workspaceConfig = new DatabricksConfig();
			const pythonConfig = workspaceConfig.getObject("python");
			const libFolder = pythonConfig["lib-folder"];
			const remoteFolder = pythonConfig["remote-folder"];
			const file = vscode.workspace.asRelativePath(document.fileName);

			if ((libFolder !== "") && (remoteFolder !== "") && file.startsWith(libFolder)) {
				output.info("vscode.workspace.onDidSaveTextDocument");
				vscode.commands.executeCommand("workbench.action.tasks.runTask", "Upload library");
			}
		})
	);

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			output.info("window.onDidChangeActiveTextEditor");
			databricksRun.refreshVariables();
		}
	}));

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => {
			output.info("workspace.onDidCloseTextDocument");
			databricksRun.stop(doc.fileName);

		})
	);

	function updateStatusBarItem(): void {
		statusBar.text = `(${databricksRun.getConnectionStatus()})`;
		statusBar.tooltip = "Connection to Databricks cluster";
		statusBar.show();
	}
}

export function deactivate() {
	console.log("deactivate");
}
