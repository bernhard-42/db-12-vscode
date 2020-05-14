import * as vscode from 'vscode';
import * as path from 'path';
import { Rest12 } from './rest';

export class DatabricksVariableExplorerProvider implements vscode.TreeDataProvider<Variable> {
    rest: Rest12 = <Rest12>{};

    getTreeItem(variable: Variable): vscode.TreeItem {
        return variable;
    }

    getChildren(variable?: Variable): Thenable<Variable[]> {
        if (variable) {
            return Promise.resolve(this.getAttributes(variable));
        } else {
            return Promise.resolve(this.getVariables());
        }
    }

    private async getVariables(): Promise<Variable[]> {
        console.log(this.rest);
        let result = await this.rest.execute("__db_get_variables__()");
        return Promise.resolve([new Variable("test", "str", "abc", "", vscode.TreeItemCollapsibleState.Collapsed)]);
    }

    private getAttributes(variable: Variable): Variable[] {
        return [new Variable("", "", "", "", vscode.TreeItemCollapsibleState.Collapsed)];
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Variable | undefined> = new vscode.EventEmitter<Variable | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Variable | undefined> = this._onDidChangeTreeData.event;

    refresh(rest: Rest12): void {
        this.rest = rest;
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
        return `${this.name} <${this.type}>`;
    }

    get description(): string {
        return this.name;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'Variable.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'Variable.svg')
    };
}
