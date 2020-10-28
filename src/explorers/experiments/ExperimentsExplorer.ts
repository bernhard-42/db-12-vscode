import * as vscode from 'vscode';
import { Experiment } from './Experiment';
import { experimentsCode } from './ExperimentTemplate';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';


let experimentList = new Map<string, Experiment>();

export class ExperimentsExplorerProvider extends BaseExplorer<Experiment> {
    experimentsApi = <Experiment>{};

    constructor() {
        super(["python"], (msg: string): Experiment => new Experiment(msg));
        this.hasContext = true;
    }

    parse(jsonData: string) {
        var data = JSON.parse(jsonData);
        data.sort((a: any, b: any) => a.id.localeCompare(b.id)).reverse();
        let result = data.map((experiment: Json) => new Experiment(
            experiment["name"],
            experiment["id"],
            experiment["stage"],
            vscode.TreeItemCollapsibleState.None
        ));
        return result;
    }

    async getTopLevel(): Promise<Experiment[]> {
        let code = experimentsCode();
        let result = await this.execute(experimentsCode());
        if (result.isSuccess()) {
            let experiments = Promise.resolve(this.parse(result.toJson()["result"]["data"]));
            return experiments;
        } else {
            output.error(result.toString());
            return Promise.resolve([new Experiment("missing")]);
        }
    }

    async getNextLevel(parent: Experiment): Promise<Experiment[]> {
        return Promise.resolve([new Experiment("Missing")]);
    }
}

export function createExperimentsExplorer() {
    const experimentsExplorer = new ExperimentsExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksExperimentsExplorer', experimentsExplorer);
    vscode.window.createTreeView('databricksExperimentsExplorer', { treeDataProvider: experimentsExplorer });

    return experimentsExplorer;
}