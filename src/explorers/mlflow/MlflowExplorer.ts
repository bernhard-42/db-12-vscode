import * as vscode from 'vscode';
import { MlflowObject } from './MlflowObject';
import { experimentsCode, modelCode } from './MlflowTemplate';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';


export class MlflowExplorerProvider extends BaseExplorer<MlflowObject> {

    constructor() {
        super(["python"], (msg: string): MlflowObject => new MlflowObject(msg));
        this.hasContext = true;
    }

    parseExperiments(jsonData: string) {
        var data = JSON.parse(jsonData);
        data.sort((a: any, b: any) => a.id.localeCompare(b.id)).reverse();
        let result = data.map((experiment: Json) => new MlflowObject(
            experiment["name"],
            experiment["id"],
            experiment["stage"],
            "experiment",
            vscode.TreeItemCollapsibleState.None
        ));
        return result;
    }

    parseModels(jsonData: string) {
        var data = JSON.parse(jsonData);
        let result = data.map((model: Json) => new MlflowObject(
            model["name"],
            "",
            model.versions,
            "model",
            (Object.keys(model.versions).length > 0) ?
                vscode.TreeItemCollapsibleState.Collapsed :
                vscode.TreeItemCollapsibleState.None
        ));
        return result;
    }

    async getTopLevel(): Promise<MlflowObject[]> {
        return Promise.resolve([
            new MlflowObject("Experiments", "", "", "experiments", vscode.TreeItemCollapsibleState.Collapsed),
            new MlflowObject("Models", "", "", "models", vscode.TreeItemCollapsibleState.Collapsed),
        ]);
    }

    async getNextLevel(parent: MlflowObject): Promise<MlflowObject[]> {
        if (parent.type === "experiments") {
            let result = await this.execute(experimentsCode());
            if (result.isSuccess()) {
                let experiments = Promise.resolve(this.parseExperiments(result.toJson()["result"]["data"]));
                return experiments;
            } else {
                output.error(result.toString());
                return Promise.resolve([new MlflowObject("missing")]);
            }
        } else if (parent.type === "models") {
            let result = await this.execute(modelCode());
            if (result.isSuccess()) {
                let models = Promise.resolve(this.parseModels(result.toJson()["result"]["data"]));
                return models;
            } else {
                output.error(result.toString());
                return Promise.resolve([new MlflowObject("missing")]);
            }
        } else if (parent.type === "model") {
            if (parent.stage) {
                let result = Object.entries(parent.stage).map(([key, value]) => new MlflowObject(
                    `v${key}`,
                    "",
                    value,
                    "version",
                    vscode.TreeItemCollapsibleState.None
                ));
                return result;
            } else {
                return Promise.resolve([new MlflowObject("none")]);
            }
        } else {
            return Promise.resolve([new MlflowObject("missing")]);
        }
    }
}

export function createMlflowExplorer() {
    const mlflowExplorer = new MlflowExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksMlflowExplorer', mlflowExplorer);
    vscode.window.createTreeView('databricksMlflowExplorer', { treeDataProvider: mlflowExplorer });

    return mlflowExplorer;
}