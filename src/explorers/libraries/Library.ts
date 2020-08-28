import * as path from 'path';
import * as vscode from 'vscode';

import { resourcesFolder } from '../../databricks/DatabricksRun';

export class Library extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly category?: boolean,
        public readonly version?: string,
        public readonly localVersion?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);

        let icon = "python.png";
        if (!category) {
            if (localVersion === version) {
                icon = "python_green.png";
            } else if (localVersion === "missing") {
                icon = "python_grey.png";
            } else {
                icon = "python_red.png";
            }
        }
        super.iconPath = {
            light: path.join(resourcesFolder, 'light', icon),
            dark: path.join(resourcesFolder, 'dark', icon),
        };
    }

    get tooltip(): string {
        return `Local env: ${this.localVersion}`;
    }

    get description(): string {
        return `${this.version}`;
    }

    get contextValue() {
        return (this.category || (this.name === "python")) ? "category" : 'library';
    }

}