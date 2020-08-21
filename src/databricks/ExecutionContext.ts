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
            output.info("No editor window open");
        }
        return editor;
    }

    getFilename(filename?: string) {
        let fname: string | undefined = undefined;
        if (filename) {
            fname = filename;
        } else {
            const editor = this.getEditor();
            if (editor) {
                fname = editor.document.fileName;
            }
        }
        return fname;
    }

    getContext(filename?: string) {
        let fname = this.getFilename(filename);
        if (fname) {
            let context = this.executionContexts.get(fname);
            if (context) {
                output.info(`Retrieved context for file ${fname}`);
            } else {
                output.info(`No Databricks context available for file ${fname}`);
            }
            return context;
        }
        return;
    }

    setContext(fileName: string, language: string, remoteCommand: RemoteCommand, host: string, token: string, cluster: string) {
        const editor = this.getEditor();
        if (editor) {
            this.executionContexts.set(fileName, {
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

    clearContext(filename?: string) {
        let fname = this.getFilename(filename);
        if (fname) {
            output.info(`Clearing context for file ${fname}`);
            this.executionContexts.delete(fname);
        }
    }
}

export const executionContexts = new ExecutionContexts();
