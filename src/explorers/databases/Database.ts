import * as vscode from 'vscode';

export class DatabaseItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly type?: string,
        public readonly value?: string,
        public readonly parent?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `${this.value}`;
    }

    get description(): string {
        return `${this.value}`;
    }

    getParent() {
        return this.parent || "";
    }
}