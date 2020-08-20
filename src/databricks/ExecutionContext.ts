import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from './DatabricksOutput';

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
            // vscode.window.showErrorMessage("No editor window open");
            output.write("No editor window open");
        }
        return editor;
    }

    getFilename() {
        return this.getEditor()?.document.fileName;
    }

    getContext(filename?: string) {
        let fname = "";
        if (filename) {
            fname = filename;
        } else {
            const editor = this.getEditor();
            if (editor) {
                fname = editor.document.fileName;
            }
        }
        let context = this.executionContexts.get(fname);
        output.write(`Getting context for file ${fname}: ${context !== undefined}`);
        if (context === undefined) {
            // vscode.window.showErrorMessage("No Databricks context available");
            output.write("No Databricks context available");
        }
        return context;
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
        }
    }

    clearContext(filename: string | undefined) {
        let fname = "";
        if (filename) {
            fname = filename;
        } else {
            const editor = this.getEditor();
            if (editor) {
                fname = editor.document.fileName;
            }
        }
        output.write(`Clearing context for file ${fname}`);
        this.executionContexts.delete(fname);
    }
}

export const executionContexts = new ExecutionContexts();
