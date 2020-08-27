import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from '../databricks/DatabricksOutput';
import { Response } from '../rest/Helpers';
import { executionContexts } from '../databricks/ExecutionContext';
import { DatabaseItem } from './Database';

export class DatabaseExplorerProvider implements vscode.TreeDataProvider<DatabaseItem> {
    remoteCommand: RemoteCommand = <RemoteCommand>{};
    language = "";
    temp: Response = { "0": "temporary", "1": "persistent" };

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
        if (Object.keys(this.remoteCommand).length > 0) {
            if (database) {
                return Promise.resolve(this.getTables(database));
            } else {
                return Promise.resolve(this.getDatabases());
            }
        } else {
            return Promise.resolve([this.errorResponse("No context")]);
        }
    }

    private errorResponse(msg: string) {
        return new DatabaseItem(msg, "", "", "", vscode.TreeItemCollapsibleState.None);
    }

    private async getDatabases(): Promise<DatabaseItem[]> {
        const command = 'print(";".join([f"{row.namespace}:" for row in spark.sql("show databases").collect()]))';
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
            key = databaseObj.name;
            command = `print(";".join([f"{row.tableName}:{0 if row.isTemporary else 1}" for row in spark.sql("show tables in ${key}").collect()]))`;
        } else {
            type = "column";
            key = `${databaseObj.parent}.${databaseObj.name}`;
            command = `print(";".join(([f"{c.name}:{c.dataType.simpleString()}" for c in spark.sql("select * from default.exampletable").schema.fields])))`;
        }
        let result = await this.execute(command, true);
        if (result["status"] === "success") {
            const objs = this.parse(result["data"], type, databaseObj.parent);
            return Promise.resolve(objs);
        } else {
            return Promise.resolve([this.errorResponse("Missing")]);
        }
    }

    private async execute(command: string, init: boolean): Promise<Response> {
        let result = await this.remoteCommand.execute(command);
        if (result["status"] === "success") {
            return result;
        }
        // if (init) {
        //     result = await this.remoteCommand.execute(databasesCode()) as Response;
        //     if (result["status"] === "success") {
        //         output.info("Successfully registered Database Explorer");
        //         return this.execute(command, false);
        //     }
        // }
        vscode.window.showErrorMessage("Failed to retrieve remote databases");
        return { "error": "Failed to retrieve remote databases" };
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