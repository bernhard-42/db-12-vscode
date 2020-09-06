import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import { variablesCode, getVariables, getAttributes } from './VariableTemplate';
import { Variable } from './Variable';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';
import { DatabricksConfig } from '../../databricks/Config';

export class VariableExplorerProvider extends BaseExplorer<Variable> {
    language = "";
    maxArrayLen: number;
    maxStringLen: number;

    constructor() {
        super(["python"], (msg: string): Variable => new Variable(msg));
        let config = new DatabricksConfig();
        this.maxArrayLen = config.getMaxArrayLen();
        this.maxStringLen = config.getMaxStringLen();
    }

    parse(jsonData: string, dataframe: boolean) {
        var data = JSON.parse(jsonData);
        return Object.keys((data)).map(key => new Variable(
            key,
            data[key]["type"],
            data[key]["value"].replace("\n", "\\n"),
            data[key]["parent"],
            dataframe,
            (!data[key]["leaf"]) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        ));
    }

    async getTopLevel(): Promise<Variable[]> {
        let result = await this.execute(getVariables(), variablesCode(this.maxArrayLen, this.maxStringLen));
        if (result.isSuccess()) {
            return Promise.resolve(this.parse(result.toJson()["result"]["data"], false));
        } else {
            output.error(result.toString());
            return Promise.resolve([new Variable("missing")]);
        }
    }

    async getNextLevel(variable: Variable): Promise<Variable[]> {
        var pythonVar = (variable.parent === "") ? variable.name : `${variable.parent}.${variable.name}`;
        const dataframe = ["pyspark.sql.dataframe.DataFrame", "pandas.core.frame.DataFrame"].includes(variable.type || "");
        let result = await this.execute(getAttributes(pythonVar), variablesCode(this.maxArrayLen, this.maxStringLen));
        if (result.isSuccess()) {
            return Promise.resolve(this.parse(result.toJson()["result"]["data"], dataframe));
        } else {
            return Promise.resolve([new Variable("Missing")]);
        }
    }

    getSnippet(variable: Variable) {
        return variable.name;
    }
}

export function createVariableExplorer() {
    const variableExplorer = new VariableExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksVariableExplorer', variableExplorer);
    vscode.window.createTreeView('databricksVariableExplorer', { treeDataProvider: variableExplorer });

    return variableExplorer;
}