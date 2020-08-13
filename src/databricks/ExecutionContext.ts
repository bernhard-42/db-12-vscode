import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';

interface IExecutionContext {
    language: string;
    remoteCommand: RemoteCommand;
    commandId: string;
    host: string;
    token: string;
    cluster: string;
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

    setContext(language: string, remoteCommand: RemoteCommand, host: string, token: string, cluster: string) {
        const editor = this.getEditor();
        if (editor) {
            this.executionContexts.set(editor.document.fileName, {
                language: language,
                remoteCommand: remoteCommand,
                commandId: "",
                host: host,
                token: token,
                cluster: cluster,
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