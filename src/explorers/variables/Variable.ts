import * as vscode from 'vscode';

export class Variable extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly type?: string,
        public readonly value?: string,
        public readonly parent?: string,
        public isDataframe?: boolean,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `${this.type}`;
    }

    get description(): string {
        return `${this.type}  ${this.value}`;
    }

    get contextValue() {
        return (this.isDataframe) ? "dataframe" : 'other';
    }
}