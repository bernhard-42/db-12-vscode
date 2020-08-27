import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/utils';
import { executionContexts } from '../../databricks/ExecutionContext';
import { DatabaseItem } from './Database';
import { getDatabases, getTables, getSchema } from './DatabaseTemplate';

export class DatabaseExplorerProvider implements vscode.TreeDataProvider<DatabaseItem> {
    remoteCommand: RemoteCommand = <RemoteCommand>{};
    hasContext = false;
    temp: Json = { "0": "temporary", "1": "persistent" };

    getTreeItem(database: DatabaseItem): vscode.TreeItem {
        return database;
    }

    parse(list: string, type: string, parent: string) {
        var objs = list.split(";");
        return objs.map(key => new DatabaseItem(
            key.split(":")[0],
            type,
            (type === "table") ? this.temp[key.split(":")[1]] : key.split(":")[1],
            (type === "database") ? key.split(":")[0] : parent,
            (type === "column") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    getChildren(database?: DatabaseItem): Thenable<DatabaseItem[]> {
        if (this.hasContext) {
            if (Object.keys(this.remoteCommand).length > 0) {
                if (database) {
                    return Promise.resolve(this.getTables(database));
                } else {
                    return Promise.resolve(this.getDatabases());
                }
            } else {
                return Promise.resolve([this.errorResponse("No remote command available")]);
            }
        } else {
            return Promise.resolve([this.errorResponse("No context")]);
        }
    }

    private errorResponse(msg: string) {
        return new DatabaseItem(msg, "", "", "", vscode.TreeItemCollapsibleState.None);
    }

    private async getDatabases(): Promise<DatabaseItem[]> {
        const command = getDatabases();
        let result = await this.execute(command, true);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"], "database", ""));
        } else {
            return Promise.resolve([this.errorResponse("missing")]);
        }
    }

    private async getTables(databaseObj: DatabaseItem): Promise<DatabaseItem[]> {
        let command: string;
        let key: string;
        let type: string;
        if (databaseObj.type === "database") {
            type = "table";
            command = getTables(databaseObj.name);
        } else {
            type = "column";
            command = getSchema(databaseObj.parent, databaseObj.name);
        }
        let result = await this.execute(command, true);
        if (result["status"] === "success") {
            const objs = this.parse(result["data"], type, databaseObj.parent);
            return Promise.resolve(objs);
        } else {
            return Promise.resolve([this.errorResponse("Missing")]);
        }
    }

    private async execute(command: string, init: boolean): Promise<Json> {
        let result = await this.remoteCommand.execute(command);
        if (result["status"] === "success") {
            return result;
        }
        vscode.window.showErrorMessage("Failed to retrieve remote databases");
        return { "error": result["data"] };
    }

    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseItem | undefined> = new vscode.EventEmitter<DatabaseItem | undefined>();

    readonly onDidChangeTreeData: vscode.Event<DatabaseItem | undefined> = this._onDidChangeTreeData.event;

    refresh(filename?: string): void {
        if (filename && !filename?.startsWith("/")) {
            return;
        }
        output.info("DatabaseExplorer refresh");
        let context = executionContexts.getContext(filename);
        if (context) {
            this.remoteCommand = context.remoteCommand;
            this.hasContext = true;
        } else {
            this.hasContext = false;
        }
        this._onDidChangeTreeData.fire();
    }
}


export function createDatabaseExplorer(remoteCommand: RemoteCommand) {
    const databaseExplorer = new DatabaseExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksDatabaseExplorer', databaseExplorer);
    vscode.window.createTreeView('databricksDatabaseExplorer', { treeDataProvider: databaseExplorer });

    return databaseExplorer;
}