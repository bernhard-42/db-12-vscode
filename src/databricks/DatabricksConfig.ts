import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import { DatabricksOutput } from './DatabricksOutput';

export class DatabricksConfig {
    private workspaceConfig: vscode.WorkspaceConfiguration;

    constructor() {
        this.workspaceConfig = vscode.workspace.getConfiguration("databricks-run");
    }

    update(value: string, name: string) {
        this.workspaceConfig.update(name, value, ConfigurationTarget.Workspace).then(
            () => {
                DatabricksOutput.write(`Added ${name} to workspace config .vscode/settings.json`);
            },
            (error) => {
                DatabricksOutput.write(error);
            }
        );
        return value;
    }

    get(attribute: string): string {
        return this.workspaceConfig.get(attribute) || "";
    }
}

