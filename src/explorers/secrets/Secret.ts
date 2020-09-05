import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';

export class Secret extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: Json | string,
        public readonly type?: string,
        public parent?: string[],
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    get description(): string {
        return `${this.value} `;
    }

    get tooltip(): string {
        return `${this.value}`;
    }

    get contextValue() {
        return this.type;
    }
}