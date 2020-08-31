import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel("Databricks Run");
const log = vscode.window.createOutputChannel("Databricks Run Log");

function getPrefix(logLevel?: string) {
    let timestamp = "";
    let level = "";
    if (logLevel) {
        const d = new Date();
        timestamp = `${d.toISOString().substr(11, 12)} `;
        level = `${logLevel} `;
    }
    let prefix = "unknown";
    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.fileName;
    if (fileName) {
        const parts = fileName.split("/");
        prefix = `${parts[parts.length - 1]}`;
    }
    return `[${timestamp}${level}${prefix}] `;
}

export function write(msg: string, nl?: boolean) {
    // eslint-disable-next-line eqeqeq
    let newLine = (nl == null) ? true : nl;

    const prefix = getPrefix();
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
    const prefix = getPrefix("INFO ");
    log.appendLine(prefix + msg);
}

export function error(msg: string) {
    const prefix = getPrefix("ERROR");
    log.appendLine(prefix + msg);
}

export function debug(msg: string) {
    const prefix = getPrefix("DEBUG");
    log.appendLine(prefix + msg);
}