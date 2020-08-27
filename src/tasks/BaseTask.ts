import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';

import { DatabricksConfig } from '../databricks/Config';
import { getWorkspaceRoot } from '../databricks/utils';

export class BaseTask implements vscode.Pseudoterminal {
    databricksConfig: DatabricksConfig;
    workspaceRoot = "";
    buildFolder = "";
    distFolder = "";
    libFolder = "";
    host = "";
    token = "";
    ready = false;

    protected writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    protected closeEmitter = new vscode.EventEmitter<void>();
    onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    constructor() {
        this.workspaceRoot = getWorkspaceRoot() || "";
        this.buildFolder = path.join(this.workspaceRoot, "build");
        this.distFolder = path.join(this.workspaceRoot, "dist");
        this.databricksConfig = new DatabricksConfig();
        this.libFolder = this.databricksConfig.getPythonLibFolder();

        this.ready = (this.workspaceRoot !== "") && (this.libFolder !== "");
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.doBuild();
    }

    close(): void {
        this.closeEmitter.fire();
    }

    protected prepare(): boolean {
        if (this.ready) {
            if (!fs.existsSync(this.buildFolder)) {
                fs.mkdirSync(this.buildFolder);
            }
            return true;
        }
        return false;
    }

    protected async doBuild(): Promise<void> {
        return undefined;
    }
}
