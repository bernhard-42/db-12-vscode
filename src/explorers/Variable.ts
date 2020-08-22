import * as vscode from 'vscode';

export class Variable extends vscode.TreeItem {
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