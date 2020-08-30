import * as vscode from 'vscode';

// taken from https://github.com/microsoft/vscode-extension-samples/blob/master/webview-sample/src/extension.ts

export class DatabricksRunPanel {

    public static currentPanel: DatabricksRunPanel | undefined;

    public static readonly viewType = 'databricksRun';

    private readonly _panel: vscode.WebviewPanel;
    // private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.Two;

        if (DatabricksRunPanel.currentPanel) {
            DatabricksRunPanel.currentPanel._panel.reveal(column);
        } else {
            const panel = vscode.window.createWebviewPanel(
                DatabricksRunPanel.viewType,
                'Databricks Run Viewer',
                column,
                { enableScripts: true }
            );
            DatabricksRunPanel.currentPanel = new DatabricksRunPanel(panel, extensionUri);
        }
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        DatabricksRunPanel.currentPanel = new DatabricksRunPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        // this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this.update("");

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this.update("");
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        DatabricksRunPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    update(div: string) {
        if (div !== "") {
            const webview = this._panel.webview;
            this._panel.title = "Databricks Run Viewer";
            webview.html = div;
        }
    }
}