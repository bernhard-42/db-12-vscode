import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from '../databricks/DatabricksOutput';
import { Response } from '../rest/Helpers';
import { variablesCode } from './PythonTemplate';
import { executionContexts } from '../databricks/ExecutionContext';
import { Variable } from './Variable';

export class VariableExplorerProvider implements vscode.TreeDataProvider<Variable> {
    remoteCommand: RemoteCommand = <RemoteCommand>{};
    language = "";

    getTreeItem(variable: Variable): vscode.TreeItem {
        return variable;
    }

    parse(jsonData: string) {
        var data = JSON.parse(jsonData);
        return Object.keys((data)).map(key => new Variable(
            key,
            data[key]["type"],
            data[key]["value"],
            data[key]["parent"],
            (!data[key]["leaf"]) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        ));
    }

    getChildren(variable?: Variable): Thenable<Variable[]> {
        if (this.language !== "python") {
            return Promise.resolve([new Variable("No context", "", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
        if (Object.keys(this.remoteCommand).length > 0) {
            if (variable) {
                return Promise.resolve(this.getAttributes(variable));
            } else {
                return Promise.resolve(this.getVariables());
            }
        } else {
            return Promise.resolve([new Variable("No context", "", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private async getVariables(): Promise<Variable[]> {
        let result = await this.remoteCommand.execute("__db_get_variables__()");
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("missing", "", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private async getAttributes(variable: Variable): Promise<Variable[]> {
        var pythonVar = (variable.parent === "") ? variable.name : `${variable.parent}.${variable.name}`;
        let result = await this.remoteCommand.execute(`__db_get_attributes__("${pythonVar}")`);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("Missing", "Missing", "", "", vscode.TreeItemCollapsibleState.None)]);
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Variable | undefined> = new vscode.EventEmitter<Variable | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Variable | undefined> = this._onDidChangeTreeData.event;

    refresh(filename?: string): void {
        if (filename && !filename?.startsWith("/")) {
            return;
        }
        output.info("VariableExplorer refresh");
        let context = executionContexts.getContext(filename);
        if (context) {
            this.remoteCommand = context.remoteCommand;
            this.language = context.language;
        } else {
            this.language = "";
        }
        this._onDidChangeTreeData.fire();
    }
}


export async function createVariableExplorer(language: string, remoteCommand: RemoteCommand) {
    const variableExplorer = new VariableExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksVariableExplorer', variableExplorer);
    vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

    if (language === "python") {
        var result = await remoteCommand.execute(variablesCode()) as Response;
        if (result["status"] === "success") {
            output.info("Successfully registered Variable Explorer");
        } else {
            output.info("Error: Failed to register Variable Explorer");
            return;
        }
    } else {
        return;
    }

    return variableExplorer;
}