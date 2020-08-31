import * as vscode from 'vscode';

import { DatabricksRun } from './databricks/DatabricksRun';
import { DatabricksConfig } from './databricks/Config';
import { DatabricksRunTaskProvider } from './tasks/DatabricksRunTaskProvider';
import { DatabricksRunPanel } from './viewers/DatabricksRunPanel';

import * as output from './databricks/Output';

let pythonLibTaskProvider: vscode.Disposable;
let databricksRun: DatabricksRun;

export function activate(context: vscode.ExtensionContext) {

	let statusBar: vscode.StatusBarItem;
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'databricks-run.set-connection-status';

	databricksRun = new DatabricksRun(context, statusBar);

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
		"databricks-run.install-library", library => databricksRun.installLibrary(library)
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.create-env-file', () => databricksRun.createEnvFile()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-variables', () => databricksRun.refreshVariables()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.paste-from-dataframe", (dataframe) => databricksRun.pasteFromDataframe(dataframe)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-databases', () => databricksRun.refreshDatabases()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.paste-from-database', (database) => databricksRun.pasteFromDatabase(database)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.set-connection-status', () => databricksRun.updateStatus()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-secrets', () => databricksRun.refreshSecrets()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.paste-from-secrets", (secret) => databricksRun.pasteFromSecrets(secret)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-contexts', () => databricksRun.refreshContexts()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.select-context", (context) => databricksRun.openFile(context)
	));

	/*
	 *	Register Web view
	 */

	vscode.window.registerWebviewPanelSerializer(DatabricksRunPanel.viewType, {
		async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
			DatabricksRunPanel.revive(webviewPanel, context.extensionUri);
		}
	});

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
			if (editor && editor.document.fileName.startsWith("/")) {
				output.debug(`window.onDidChangeActiveTextEditor: ${editor.document.fileName}`);
				databricksRun.refreshVariables(editor.document.fileName);
				databricksRun.refreshDatabases(editor.document.fileName);
				databricksRun.refreshLibraries(editor.document.fileName);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => {
			if (doc.fileName.startsWith("/")) {
				output.debug(`workspace.onDidCloseTextDocument ${doc.fileName}`);
				databricksRun.stop(doc.fileName);
			}
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
