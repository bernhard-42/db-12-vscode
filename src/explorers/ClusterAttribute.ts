import * as vscode from 'vscode';
import { Response } from '../rest/Helpers';

export class ClusterAttribute extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value: Response,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState);
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
}