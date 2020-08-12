import * as vscode from 'vscode';

export class DatabricksRunOutput {
    output: vscode.OutputChannel;

    constructor() {
        this.output = vscode.window.createOutputChannel("Databricks");
    }

    write(msg: string) {
        const editor = vscode.window.activeTextEditor;
        let prefix = "[unknown]";
        const fileName = editor?.document.fileName;
        if (fileName) {
            const parts = fileName.split("/");
            prefix = `[${parts[parts.length - 1]}] `;
        }
        this.output.show(true);
        this.output.appendLine(prefix + msg);
    }
}