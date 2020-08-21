import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/DatabricksConfig';
import * as output from './databricks/DatabricksOutput';


export function activate(context: vscode.ExtensionContext) {

	const execLocation = context.asAbsolutePath("resources");

	let statusBar: vscode.StatusBarItem;
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'databricks-run.set-connection-status';
	statusBar.tooltip = "Connection to Databricks cluster";

	let databricksRun = new DatabricksRun(execLocation, statusBar);

	/*
	 *	Commands
	 */
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
		'databricks-run.set-connection-status', () => databricksRun.updateStatus()
	));

	/*
	 *	Event handlers
	 */

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(doc => {
			const workspaceConfig = new DatabricksConfig();
			const pythonConfig = workspaceConfig.getObject("python");
			const libFolder = pythonConfig["lib-folder"];
			const remoteFolder = pythonConfig["remote-folder"];
			const file = vscode.workspace.asRelativePath(doc.fileName);

			if ((libFolder !== "") && (remoteFolder !== "") && file.startsWith(libFolder)) {
				output.info("vscode.workspace.onDidSaveTextDocument");
				vscode.commands.executeCommand("workbench.action.tasks.runTask", "Upload library");
			}
		})
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			databricksRun.updateStatus(editor?.document.fileName || "");
		})
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				output.info(`window.onDidChangeActiveTextEditor: ${editor.document.fileName}`);
				databricksRun.refreshVariables(editor.document.fileName);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => {
			output.info(`workspace.onDidCloseTextDocument ${doc.fileName}`);
			databricksRun.stop(doc.fileName);
		})
	);
}

export function deactivate() {
	console.log("deactivate");
}
