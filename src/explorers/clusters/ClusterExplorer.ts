import * as vscode from 'vscode';
import { Clusters } from '../../rest/Clusters';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';
import { ClusterAttribute } from './ClusterAttribute';
import { BaseExplorer } from '../BaseExplorer';
import { Response } from '../../rest/Rest';
import { executionContexts } from '../../databricks/ExecutionContext';

export class ClusterExplorerProvider extends BaseExplorer<ClusterAttribute> {
    clusterApi = <Clusters>{};
    clusterInfo = <Json>{};

    constructor(private clusterId: string, host: string, token: string) {
        super(["python", "sql", "scala", "r"], (msg: string): ClusterAttribute => new ClusterAttribute(msg));
        this.clusterApi = new Clusters(host, token);
        this.hasContext = true;
    }

    async getTopLevel(): Promise<ClusterAttribute[]> {
        let clusters = Array.from(executionContexts.executionContexts.keys()).map(entry =>
            executionContexts.executionContexts.get(entry)?.cluster || ""
        );
        let entries: ClusterAttribute[] = [];
        for (let cluster of Array.from(new Set(clusters))) {
            let result = await this.execute(cluster);
            let clusterInfo = result.toJson();
            if (result.isSuccess()) {
                let entry = new ClusterAttribute(
                    `${clusterInfo["cluster_name"]} (${clusterInfo["state"]})`,
                    clusterInfo,
                    vscode.TreeItemCollapsibleState.Collapsed);
                entries.push(entry);
            }
        };
        return Promise.resolve(entries);
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

    async execute(clusterId: string): Promise<Response> {
        return Promise.resolve(this.clusterApi.info(clusterId));
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}


export function createClusterExplorer(clusterId: string, host: string, token: string) {
    const environmentExplorer = new ClusterExplorerProvider(clusterId, host, token);
    vscode.window.registerTreeDataProvider('databricksClusterExplorer', environmentExplorer);
    vscode.window.createTreeView('databricksClusterExplorer', { treeDataProvider: environmentExplorer });

    output.info("Successfully registered Cluster Explorer");

    return environmentExplorer;
}