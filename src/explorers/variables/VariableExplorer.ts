import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import { variablesCode, getVariables, getAttributes } from './VariableTemplate';
import { Variable } from './Variable';
import { BaseExplorer } from '../BaseExplorer';

export class VariableExplorerProvider extends BaseExplorer<Variable> {
    language = "";

    constructor() {
        super((msg: string): Variable => new Variable(msg));
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

    async getTopLevel(): Promise<Variable[]> {
        let result = await this.execute(getVariables(), variablesCode());
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("missing")]);
        }
    }

    async getNextLevel(variable: Variable): Promise<Variable[]> {
        var pythonVar = (variable.parent === "") ? variable.name : `${variable.parent}.${variable.name}`;
        let result = await this.execute(getAttributes(pythonVar), variablesCode());
        if (result["status"] === "success") {
            return Promise.resolve(this.parse(result["data"]));
        } else {
            return Promise.resolve([new Variable("Missing")]);
        }
    }
}

export function createVariableExplorer(language: string, remoteCommand: RemoteCommand) {
    const variableExplorer = new VariableExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksVariableExplorer', variableExplorer);
    vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

    return variableExplorer;
}