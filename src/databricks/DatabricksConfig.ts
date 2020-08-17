import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import * as output from './DatabricksOutput';
interface ConfigObj {
    [key: string]: any;
}

export class DatabricksConfig {
    private workspaceConfig: vscode.WorkspaceConfiguration;

    constructor() {
        this.workspaceConfig = vscode.workspace.getConfiguration("databricks-run");
    }

    update(value: any, name: string) {
        this.workspaceConfig.update(name, value, ConfigurationTarget.Workspace).then(
            () => {
                output.write(`Added ${name} to workspace config .vscode/settings.json`);
            },
            (error) => {
                output.write(error);
            }
        );
        return value;
    }

    getString(attribute: string): string {
        return this.workspaceConfig.get(attribute) as string || "";
    }

    getObject(attribute: string): ConfigObj {
        return this.workspaceConfig.get(attribute) || {};
    }
}

