import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';

export class ClusterAttribute extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: Json,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `${JSON.stringify(this.value)}`;
    }

    get description(): string {
        if (this.value === Object(this.value)) {
            return `${JSON.stringify(this.value).substring(0, 50)} ...`;
        } else {
            return `${this.value}`;
        }
    }

    getValue(): Json {
        return this.value || {};
    }
}