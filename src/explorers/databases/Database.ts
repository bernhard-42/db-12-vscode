import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';

export class DatabaseItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly type?: string,
        public readonly value?: Json,
        public readonly fqName?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    // @ts-ignore
    get tooltip(): string {
        return `${this.fqName}`;
    }

    // @ts-ignore
    get description(): string {
        if (typeof this.value === "string") {
            return `${this.value}`;
        } else if (Array.isArray(this.value)) {
            return "array";
        } else {
            return "struct";
        }
    }

    getValue(key: string): Json {
        if (this.value === undefined) {
            return {};
        } else {
            return this.value[key];
        }
    };

    getFqName(): string {
        return this.fqName as string || "";
    }
}