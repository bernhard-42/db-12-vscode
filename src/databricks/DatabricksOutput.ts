import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel("Databricks");

export function write(msg: string, nl?: boolean) {
    // eslint-disable-next-line eqeqeq
    let newLine = (nl == null) ? true : nl;

    const editor = vscode.window.activeTextEditor;
    let prefix = "[unknown]";
    const fileName = editor?.document.fileName;
    if (fileName) {
        const parts = fileName.split("/");
        prefix = `[${parts[parts.length - 1]}] `;
    }
    output.show(true);
    if (newLine) {
        output.appendLine(prefix + msg);
    } else {
        output.append(msg);
    }
}

export function thinBorder() {
    write("⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅", false);
}
export function thickBorder() {
    write("================================================\n", false);
}
