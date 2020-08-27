import * as vscode from 'vscode';
import * as output from './Output';

export function getEditor() {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        output.info("No editor window open");
    }
    return editor;
}

export function getCurrentFilename() {
    const editor = getEditor();
    if (editor) {
        return editor.document.fileName;
    }
    return;
}

export function getWorkspaceRoot() {
    let filename = getCurrentFilename();
    if (filename) {
        return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filename))?.uri.path;
    }
    return;
}