import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';

export class Experiment extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: Json | string,
        public readonly stage?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    // @ts-ignore
    get description(): string {
        return `(runid = ${this.value})`;
    }

    // @ts-ignore
    get tooltip(): string {
        return `stage = ${this.stage} `;
    }
}