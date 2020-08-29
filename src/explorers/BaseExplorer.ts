import * as vscode from 'vscode';
import { executionContexts } from '../databricks/ExecutionContext';
import { RemoteCommand } from '../rest/RemoteCommand';
import { Json } from '../rest/utils';
import * as output from '../databricks/Output';


export abstract class BaseExplorer<T> implements vscode.TreeDataProvider<T>  {
    hasContext = false;
    remoteCommand: RemoteCommand = <RemoteCommand>{};

    constructor(private languages: string[], private error: (msg: string) => T) { }

    getTreeItem(item: T): vscode.TreeItem {
        return item;
    }

    getChildren(element?: T): Thenable<T[]> {
        if (this.hasContext) {
            if (element) {
                return Promise.resolve(this.getNextLevel(element));
            } else {
                return Promise.resolve(this.getTopLevel());
            }
        } else {
            return Promise.resolve([this.error("No context")]);
        }
    }

    abstract async getTopLevel(): Promise<T[]>;

    abstract async getNextLevel(level: T): Promise<T[]>;

    protected _onDidChangeTreeData: vscode.EventEmitter<T | undefined> = new vscode.EventEmitter<T | undefined>();

    readonly onDidChangeTreeData: vscode.Event<T | undefined> = this._onDidChangeTreeData.event;

    refresh(filename?: string): void {
        if (filename && !filename?.startsWith("/")) {
            return;
        }
        let context = executionContexts.getContext(filename);
        if (context && this.languages.includes(context.language)) {
            this.remoteCommand = context.remoteCommand;
            this.hasContext = true;
        } else {
            this.hasContext = false;
        }
        this._onDidChangeTreeData.fire();
    }

    async execute(command: string, code?: string): Promise<Json> {
        let result = await this.remoteCommand.execute(command);
        if (result["status"] === "success") {
            return result;
        }
        if (code) {
            result = await this.remoteCommand.execute(code) as Json;
            if (result["status"] === "success") {
                output.info("Successfully registered Variable Explorer");
                return this.execute(command);
            }
        }
        vscode.window.showErrorMessage("Failed to retrieve remote variables");
        return { "error": "Failed to retrieve remote variables" };
    }
}