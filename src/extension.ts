import * as vscode from 'vscode';
import path from 'path';

import { DatabricksRun } from './databricks/DatabricksRun';
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
		'databricks-run.initialize', (resolve?: (value?: void) => void) => databricksRun.initialize(resolve)
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.sendLine', () => databricksRun.sendLine()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.sendSelectionOrBlock', () => databricksRun.sendSelectionOrBlock()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.stop', () => databricksRun.stop()
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.cancel', () => databricksRun.cancel()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-cluster-attributes', () => databricksRun.refreshClusters()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.start-cluster', (cluster) => databricksRun.startCluster(cluster)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.restart-cluster', (cluster) => databricksRun.restartCluster(cluster)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.open-sparkui', (cluster) => databricksRun.openSparkUi(cluster)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.stop-cluster', (cluster) => databricksRun.stopCluster(cluster)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		'databricks-run.refresh-secrets', () => databricksRun.refreshSecrets()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.paste-from-secrets", (secret) => databricksRun.pasteFromSecret(secret)
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
		'databricks-run.refresh-mlflow', () => databricksRun.refreshMlflow()
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.paste-from-dataframe", (dataframe) => databricksRun.pasteFromDataframe(dataframe)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.open-experiment", (experiment) => databricksRun.openMlflowExperiment(experiment)
	));

	context.subscriptions.push(vscode.commands.registerCommand(
		"databricks-run.open-model", (model) => databricksRun.openMlflowModel(model)
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
			if (editor && path.isAbsolute(editor.document.fileName)) {
				output.debug(`window.onDidChangeActiveTextEditor: ${editor.document.fileName}`);
				databricksRun.refreshVariables(editor.document.fileName);
				databricksRun.refreshMlflow(editor.document.fileName);
				databricksRun.refreshDatabases(editor.document.fileName);
				databricksRun.refreshLibraries(editor.document.fileName);
			}
		}));

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => {
			if (path.isAbsolute(doc.fileName)) {
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
