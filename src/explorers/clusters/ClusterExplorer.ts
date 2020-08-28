import * as vscode from 'vscode';
import { Clusters } from '../../rest/Clusters';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/utils';
import { ClusterAttribute } from './ClusterAttribute';
import { BaseExplorer } from '../BaseExplorer';

export class ClusterExplorerProvider extends BaseExplorer<ClusterAttribute> {
    clusterApi = <Clusters>{};
    clusterInfo = <Json>{};

    constructor(private clusterId: string, host: string, token: string) {
        super((msg: string): ClusterAttribute => new ClusterAttribute(msg));
        this.clusterApi = new Clusters(host, token);
        this.hasContext = true;
    }

    async getTopLevel(): Promise<ClusterAttribute[]> {
        let result: Json = await this.execute();
        if (result["status"] === "success") {
            this.clusterInfo = result["data"];
            return [
                new ClusterAttribute(
                    `${this.clusterInfo["cluster_name"]} (${this.clusterInfo["state"]})`,
                    this.clusterInfo,
                    vscode.TreeItemCollapsibleState.Collapsed)
            ];
        } else {
            return Promise.resolve([new ClusterAttribute("Retrieving cluster config failed")]);
        }
    }

    async getNextLevel(parent: ClusterAttribute): Promise<ClusterAttribute[]> {
        let attributes: ClusterAttribute[] = [];
        for (let key of Object.keys(parent.getValue())) {
            const obj = parent.getValue()[key];
            attributes.push(
                new ClusterAttribute(
                    key,
                    obj,
                    (obj === Object(obj)) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
                )
            );
        }
        return Promise.resolve(attributes);
    }

    async execute(): Promise<Json> {
        return this.clusterApi.info(this.clusterId);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}


export function createClusterExplorer(clusterId: string, host: string, token: string) {
    const environmentExplorer = new ClusterExplorerProvider(clusterId, host, token);
    vscode.window.registerTreeDataProvider('databricksClusterExplorer', environmentExplorer);
    vscode.window.createTreeView('databricksClusterExplorer', { treeDataProvider: environmentExplorer });

    output.info("Successfully registered Cluster Explorer");

    return environmentExplorer;
}