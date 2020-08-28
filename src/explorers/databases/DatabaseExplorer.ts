import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import { Json } from '../../rest/utils';
import { DatabaseItem } from './Database';
import { getDatabases, getTables, getSchema } from './DatabaseTemplate';
import { BaseExplorer } from '../BaseExplorer';

export class DatabaseExplorerProvider extends BaseExplorer<DatabaseItem> {
    temp: Json = { "0": "temporary", "1": "persistent" };

    constructor() {
        super((msg: string): DatabaseItem => new DatabaseItem(msg));
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

    async getTopLevel(): Promise<DatabaseItem[]> {
        const command = getDatabases();
        let result = await this.execute(command);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"], "database", ""));
        } else {
            return Promise.resolve([new DatabaseItem("missing")]);
        }
    }

    async getNextLevel(databaseItem: DatabaseItem): Promise<DatabaseItem[]> {
        let command: string;
        let key: string;
        let type: string;
        if (databaseItem.type === "database") {
            type = "table";
            command = getTables(databaseItem.name);
        } else {
            type = "column";
            command = getSchema(databaseItem.getParent(), databaseItem.name);
        }
        let result = await this.execute(command);
        if (result["status"] === "success") {
            const objs = this.parse(result["data"], type, databaseItem.getParent());
            return Promise.resolve(objs);
        } else {
            return Promise.resolve([new DatabaseItem("Missing")]);
        }
    }
}

export function createDatabaseExplorer(remoteCommand: RemoteCommand) {
    const databaseExplorer = new DatabaseExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksDatabaseExplorer', databaseExplorer);
    vscode.window.createTreeView('databricksDatabaseExplorer', { treeDataProvider: databaseExplorer });

    return databaseExplorer;
}