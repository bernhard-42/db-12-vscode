import * as vscode from 'vscode';
import { executionContexts } from '../databricks/ExecutionContext';
import { RemoteCommand } from '../rest/RemoteCommand';
import { Response, Json } from '../rest/Rest';
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
        this._onDidChangeTreeData.fire(undefined);
    }

    async execute(command: string, code?: string): Promise<Response> {
        let result = await this.remoteCommand.execute(command);
        if (result.isSuccess()) {
            return Promise.resolve(result);
        }
        if (code) {
            result = await this.remoteCommand.execute(code);
            if (result.isSuccess()) {
                output.info("Successfully registered Variable Explorer");
                return this.execute(command);
            }
        }
        vscode.window.showErrorMessage("Failed to retrieve remote variables");
        return Response.failure("Failed to retrieve remote variables");
    }
}