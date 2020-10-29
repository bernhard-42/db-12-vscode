import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';

export class MlflowObject extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: Json | string,
        public readonly stage?: string,
        public readonly type?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    // @ts-ignore
    get description(): string {
        if (this.type === "experiment") {
            return `(id = ${this.value})`;
        } else if (this.type === "model") {
            return "";
        } else if (this.type === "version") {
            return `(stage = ${this.stage})`;
        } else {
            return `${this.value}`;
        }
    }

    // @ts-ignore
    get tooltip(): string {
        if (this.type === "experiment") {
            return `stage = ${this.stage}`;
        } else if (this.type === "model") {
            return `${this.name}`;
        } else {
            return `${this.type}`;
        }
    }

    // @ts-ignore
    get contextValue() {
        return this.type;
    }
}