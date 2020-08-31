import * as vscode from 'vscode';
import { RemoteCommand, } from '../../rest/RemoteCommand';
import { Json } from '../../rest/Rest';
import { DatabaseItem } from './Database';
import { BaseExplorer } from '../BaseExplorer';

export class DatabaseExplorerProvider extends BaseExplorer<DatabaseItem> {
    temp: Json = { true: "temporary", false: "persistent" };

    constructor() {
        super(["python", "sql", "scala"], (msg: string): DatabaseItem => new DatabaseItem(msg));
    }

    parse(table: string[][], type: string, parent: string) {
        return table.map(row => new DatabaseItem(
            (type === "table") ? row[1] : row[0],
            type,
            (type === "table") ? this.temp[row[2]] : ((type === "database") ? "" : row[1]),
            (type === "database") ? row[0] : parent,
            (type === "column") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    async getTopLevel(): Promise<DatabaseItem[]> {
        let result = await this.remoteCommand.getDatabases();
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]["result"]["data"], "database", ""));
        } else {
            return Promise.resolve([new DatabaseItem("missing")]);
        }
    }

    async getNextLevel(databaseItem: DatabaseItem): Promise<DatabaseItem[]> {
        let command: string;
        let key: string;
        let type: string;
        let result: Json;
        if (databaseItem.type === "database") {
            type = "table";
            result = await this.remoteCommand.getTables(databaseItem.name);
        } else {
            type = "column";
            result = await this.remoteCommand.getSchema(databaseItem.getParent(), databaseItem.name);
        }
        if (result["status"] === "success") {
            const objs = this.parse(result["data"]["result"]["data"], type, databaseItem.getParent());
            return Promise.resolve(objs);
        } else {
            return Promise.resolve([new DatabaseItem("Missing")]);
        }
    }

    getSnippet(database: DatabaseItem) {
        return database.name;
    }
}

export function createDatabaseExplorer(remoteCommand: RemoteCommand) {
    const databaseExplorer = new DatabaseExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksDatabaseExplorer', databaseExplorer);
    vscode.window.createTreeView('databricksDatabaseExplorer', { treeDataProvider: databaseExplorer });

    return databaseExplorer;
}