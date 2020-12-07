import * as vscode from 'vscode';
import { RemoteCommand, } from '../../rest/RemoteCommand';
import { Response, Json } from '../../rest/Rest';
import { DatabaseItem } from './Database';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';

export class DatabaseExplorerProvider extends BaseExplorer<DatabaseItem> {
    temp: Json = { true: "temporary", false: "persistent" };

    constructor() {
        super(["python", "sql", "scala"], (msg: string): DatabaseItem => new DatabaseItem(msg));
    }

    parse_array(array: Json): Json {
        if (typeof array.elementType === "string") {
            return [array.elementType];
        } else if (array.elementType.elementType !== undefined) {
            return [this.parse_array(array.elementType)];
        } else if (array.elementType.type !== undefined) {
            return [this.parse_schema(array.elementType)];
        } else {
            return ["<ERROR>"];
        }
    }

    parse_schema(schema: Json): Json {
        var result: Json = {};
        schema.fields.forEach((field: Json) => {
            if (typeof field.type === "string") {
                result[field.name] = field.type;
            } else if (field.type.type === "array") {
                result[field.name] = this.parse_array(field.type);
            } else if (field.type.type === "struct") {
                result[field.name] = this.parse_schema(field.type);
            } else {
                result[field.name] = "<ERROR>";
            }
        });
        return result;
    }

    parse_python_result(schemaStr: string, type: string, parent: string) {
        let schema = this.parse_schema(JSON.parse(schemaStr));
        return Object.keys(schema).map(key => new DatabaseItem(
            key,
            "column",
            schema[key],
            `${parent}.${key}`,
            (typeof schema[key] === "string") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    parse_sql_result(dbObj: string[][], type: string, parent: string) {
        return dbObj.map(row => new DatabaseItem(
            (type === "table") ? row[1] : row[0],
            type,
            (type === "table") ? this.temp[row[2]] : ((type === "database") ? "" : row[1]),
            (type === "database") ? row[0] : `${parent}.${row[1]}`,
            (type === "column") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    async getTopLevel(): Promise<DatabaseItem[]> {
        let result = await this.remoteCommand.getDatabases();
        if (result.isSuccess()) {
            let result2 = Promise.resolve(this.parse_sql_result(result.toJson()["result"]["data"], "database", ""));
            return result2;
        } else {
            output.error(result.toString());
            return Promise.resolve([new DatabaseItem("missing")]);
        }
    }

    getSubtype(databaseItem: DatabaseItem) {
        return Object.keys(databaseItem.value || []).map(key => new DatabaseItem(
            Array.isArray(databaseItem.value) ? "[ ]" : key,
            "subtype",
            databaseItem.getValue(key),
            `${databaseItem.fqName}${Array.isArray(databaseItem.value) ? "[ ]" : "." + key}`,
            (typeof databaseItem.getValue(key) === "string") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    async getNextLevel(databaseItem: DatabaseItem): Promise<DatabaseItem[]> {
        let type: string;
        let result: Response;
        if (databaseItem.type === "column" || databaseItem.type === "subtype") {
            return this.getSubtype(databaseItem);
        } else if (databaseItem.type === "database") {
            type = "table";
            result = await this.remoteCommand.getTables(databaseItem.name);
        } else {
            type = "column";
            result = await this.remoteCommand.getSchema(databaseItem.getFqName());
        }
        if (result.isSuccess()) {
            let jResult = result.toJson()["result"]["data"];
            if (typeof jResult === "string") {
                const objs = this.parse_python_result(jResult, type, databaseItem.getFqName());
                return Promise.resolve(objs);
            } else {
                const objs = this.parse_sql_result(jResult, type, databaseItem.getFqName());
                return Promise.resolve(objs);
            }
        } else {
            output.error(result.toString());
            return Promise.resolve([new DatabaseItem("Missing")]);
        }
    }

    getSnippet(database: DatabaseItem) {
        return database.fqName;
    }
}

export function createDatabaseExplorer() {
    const databaseExplorer = new DatabaseExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksDatabaseExplorer', databaseExplorer);
    vscode.window.createTreeView('databricksDatabaseExplorer', { treeDataProvider: databaseExplorer });

    return databaseExplorer;
}