import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';

interface IExecutionContext {
    language: string;
    rest: RemoteCommand;
    commandId: string;
    host: string;
    token: string;
    cluster: string;
    editorPrefix: string;
    executionId: number;
}

export class ExecutionContexts {
    executionContexts: Map<string, IExecutionContext>;

    constructor() {
        this.executionContexts = new Map<string, IExecutionContext>();
    }

    getEditor() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No editor window open");
        }
        return editor;
    }

    getEditorPrefix() {
        const fileName = this.getEditor()?.document.fileName;
        if (!fileName) {
            return "[unknown]";
        } else {
            const parts = fileName.split("/");
            return `[${parts[parts.length - 1]}] `;
        }
    }

    getContext() {
        const editor = this.getEditor();
        if (editor) {
            let context = this.executionContexts.get(editor.document.fileName);
            if (context === undefined) {
                vscode.window.showErrorMessage("No Databricks context available");
            }
            return context;
        } else {
            return undefined;
        }
    }

    setContext(language: string, rest: RemoteCommand, host: string, token: string, cluster: string, editorPrefix: string) {
        const editor = this.getEditor();
        if (editor) {
            this.executionContexts.set(editor.document.fileName, {
                language: language,
                rest: rest,
                commandId: "",
                host: host,
                token: token,
                cluster: cluster,
                editorPrefix: editorPrefix,
                executionId: 1
            });
        } else {

        }
    }
    clearContext() {
        const editor = this.getEditor();
        if (editor) {
            this.executionContexts.delete(editor.document.fileName);
        }
    }
}