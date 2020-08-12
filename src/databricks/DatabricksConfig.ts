import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import { DatabricksRunOutput } from './DatabricksOutput';

export class DatabricksRunConfig {
    private workspaceConfig: vscode.WorkspaceConfiguration;
    private output: DatabricksRunOutput;

    constructor() {
        this.workspaceConfig = vscode.workspace.getConfiguration("databricks-run");
        this.output = new DatabricksRunOutput();
    }

    update(value: string, name: string) {
        this.workspaceConfig.update(name, value, ConfigurationTarget.Workspace).then(
            () => {
                this.output.write(`Added ${name} to workspace config .vscode/settings.json`);
            },
            (error) => {
                this.output.write(error);
            }
        );
        return value;
    }

    get(attribute: string): string {
        return this.workspaceConfig.get(attribute) || "";
    }
}

