import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel("Databricks Run");
const log = vscode.window.createOutputChannel("Databricks Run Log");

function getPrefix(withTimestamp: boolean) {
    let timestamp = "";
    if (withTimestamp) {
        const d = new Date();
        timestamp = `${d.toISOString().substr(11, 12)} `;
    }
    const d = new Date();
    let prefix = "unknown";
    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.fileName;
    if (fileName) {
        const parts = fileName.split("/");
        prefix = `${parts[parts.length - 1]}`;
    }
    return `[${timestamp}${prefix}] `;
}

export function write(msg: string, nl?: boolean) {
    // eslint-disable-next-line eqeqeq
    let newLine = (nl == null) ? true : nl;

    const prefix = getPrefix(false);
    if (newLine) {
        output.appendLine(prefix + msg);
    } else {
        output.append(msg);
    }
    output.show(true);
}

export function thinBorder() {
    write("⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅\n", false);
}
export function thickBorder() {
    write("================================================\n", false);
}

export function info(msg: string) {
    const prefix = getPrefix(true)
    log.appendLine(prefix + msg);
}
