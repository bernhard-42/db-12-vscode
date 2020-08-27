import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/utils';
import { variablesCode, getVariables, getAttributes } from './VariableTemplate';
import { executionContexts } from '../../databricks/ExecutionContext';
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
            return Promise.resolve([this.errorResponse("No context")]);
        }
        if (Object.keys(this.remoteCommand).length > 0) {
            if (variable) {
                return Promise.resolve(this.getAttributes(variable));
            } else {
                return Promise.resolve(this.getVariables());
            }
        } else {
            return Promise.resolve([this.errorResponse("No context")]);
        }
    }

    private errorResponse(msg: string) {
        return new Variable(msg, "", "", "", vscode.TreeItemCollapsibleState.None);
    }

    private async getVariables(): Promise<Variable[]> {
        let result = await this.execute(getVariables(), true);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([this.errorResponse("missing")]);
        }
    }

    private async getAttributes(variable: Variable): Promise<Variable[]> {
        var pythonVar = (variable.parent === "") ? variable.name : `${variable.parent}.${variable.name}`;
        let result = await this.execute(getAttributes(pythonVar), true);
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([this.errorResponse("Missing")]);
        }
    }

    private async execute(command: string, init: boolean): Promise<Json> {
        let result = await this.remoteCommand.execute(command);
        if (result["status"] === "success") {
            return result;
        }
        if (init) {
            result = await this.remoteCommand.execute(variablesCode()) as Json;
            if (result["status"] === "success") {
                output.info("Successfully registered Variable Explorer");
                return this.execute(command, false);
            }
        }
        vscode.window.showErrorMessage("Failed to retrieve remote variables");
        return { "error": "Failed to retrieve remote variables" };
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
            this.language = ""; // ensures variable explorere will be cleaned
        }
        this._onDidChangeTreeData.fire();
    }
}


export function createVariableExplorer(language: string, remoteCommand: RemoteCommand) {
    const variableExplorer = new VariableExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksVariableExplorer', variableExplorer);
    vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

    return variableExplorer;
}