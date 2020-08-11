import * as vscode from 'vscode';
import * as path from 'path';
import { RemoteCommand } from './remote-command';
import { timingSafeEqual } from 'crypto';

export class DatabricksVariableExplorerProvider implements vscode.TreeDataProvider<Variable> {
    rest: RemoteCommand = <RemoteCommand>{};
    language = "";

    getTreeItem(variable: Variable): vscode.TreeItem {
        return variable;
    }

    parse(jsonData: string) {
        var data = JSON.parse(jsonData);
        return Object.keys((data)).map(key => new Variable(
            key,
            data[key]["type"],
            data[key]["value"],
            data[key]["parent"],
            (!data[key]["leaf"]) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        ));
    }

    getChildren(variable?: Variable): Thenable<Variable[]> {
        if (this.language !== "python") {
            return Promise.resolve([new Variable("No implmented", `for ${this.language}`, "", "", vscode.TreeItemCollapsibleState.None)]);
        }
        if (Object.keys(this.rest).length > 0) {
            if (variable) {
                return Promise.resolve(this.getAttributes(variable));
            } else {
                return Promise.resolve(this.getVariables());
            }
        } else {
            return Promise.resolve([new Variable("No context", "No context", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private async getVariables(): Promise<Variable[]> {
        let result = await this.rest.execute("__db_get_variables__()");
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("missing", "", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private async getAttributes(variable: Variable): Promise<Variable[]> {
        var pythonVar = (variable.parent === "") ? variable.name : `${variable.parent}.${variable.name}`;
        let result = await this.rest.execute(`__db_get_attributes__("${pythonVar}")`);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("Missing", "Missing", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Variable | undefined> = new vscode.EventEmitter<Variable | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Variable | undefined> = this._onDidChangeTreeData.event;

    refresh(rest: RemoteCommand, language: string): void {
        this.rest = rest;
        this.language = language;
        this._onDidChangeTreeData.fire();
    }
}

class Variable extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly type: string,
        public readonly value: string,
        public readonly parent: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState);
    }

    get tooltip(): string {
        return `${this.type}`;
    }

    get description(): string {
        return `${this.type}  ${this.value}`;
    }
}
