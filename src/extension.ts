import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/Config';
import { DatabricksRunTaskProvider } from './tasks/DatabricksRunTaskProvider';

import * as output from './databricks/Output';

let pythonLibTaskProvider: vscode.Disposable;
let databricksRun: DatabricksRun;

export function activate(context: vscode.ExtensionContext) {

	const execLocation = context.asAbsolutePath("resources");

	let statusBar: vscode.StatusBarItem;
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'databricks-run.set-connection-status';

	databricksRun = new DatabricksRun(execLocation, statusBar);

	/*
	 *	Commands
	 */
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.initialize', (force?: boolean) => databricksRun.initialize(force)
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
		'databricks-run.refresh-cluster-attributes', () => databricksRun.refreshClusterAttributes()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.start-cluster', () => databricksRun.startCluster()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.restart-cluster', () => databricksRun.restartCluster()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.stop-cluster', () => databricksRun.stopCluster()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-libraries', () => databricksRun.refreshLibraries()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.create-env-file', () => databricksRun.createEnvFile()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-variables', () => databricksRun.refreshVariables()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-databases', () => databricksRun.refreshDatabases()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.set-connection-status', () => databricksRun.updateStatus()
	));

	/*
	 *	Event handlers
	 */

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
				databricksRun.refreshDatabases(editor.document.fileName);
				databricksRun.refreshLibraries(editor.document.fileName);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => {
			output.info(`workspace.onDidCloseTextDocument ${doc.fileName}`);
			databricksRun.stop(doc.fileName);
		})
	);

	/*
	 *  Task Provider
	 */
	pythonLibTaskProvider = vscode.tasks.registerTaskProvider(
		DatabricksRunTaskProvider.type,
		new DatabricksRunTaskProvider()
	);
}

export function deactivate() {
	console.log("deactivate");
	if (pythonLibTaskProvider) {
		pythonLibTaskProvider.dispose();
	}
	databricksRun.dispose();
}
