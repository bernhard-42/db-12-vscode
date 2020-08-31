import * as vscode from 'vscode';

export class Context extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: string,
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

    get contextValue() {
        return (this.value?.startsWith("/")) ? "context" : "detail";
    }
}