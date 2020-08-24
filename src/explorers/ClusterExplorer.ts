import * as vscode from 'vscode';
import { Clusters } from '../rest/Clusters';
import * as output from '../databricks/DatabricksOutput';
import { Response } from '../rest/Helpers';
import { ClusterAttribute } from './ClusterAttribute';


export class ClusterExplorerProvider implements vscode.TreeDataProvider<ClusterAttribute> {
    clusterApi = <Clusters>{};
    clusterInfo = <Response>{};

    constructor(private clusterId: string, host: string, token: string) {
        this.clusterApi = new Clusters(host, token);
    }

    errorResponse(msg: string) {
        return new ClusterAttribute(msg, {}, vscode.TreeItemCollapsibleState.None);
    }

    getTreeItem(clusterAttribute: ClusterAttribute): vscode.TreeItem {
        return clusterAttribute;
    }

    getChildren(clusterAttribute?: ClusterAttribute): Thenable<ClusterAttribute[]> {
        if (this.clusterId) {
            if (clusterAttribute) {
                return Promise.resolve(this.getAttributes(clusterAttribute));
            } else {
                return Promise.resolve(this.getClusterInfo());
            }
        } else {
            return Promise.resolve([this.errorResponse("No context")]);
        }
    }

    private async getClusterInfo(): Promise<ClusterAttribute[]> {
        let result: Response = await this.clusterApi.info(this.clusterId);
        if (result["status"] === "success") {
            this.clusterInfo = result["data"];
            return [
                new ClusterAttribute(
                    `${this.clusterInfo["cluster_name"]} (${this.clusterInfo["state"]})`,
                    this.clusterInfo,
                    vscode.TreeItemCollapsibleState.Collapsed)
            ];
        } else {
            return Promise.resolve([this.errorResponse("Retrieving cluster config failed")]);
        }
    }

    private async getAttributes(environmentAttribute: ClusterAttribute): Promise<ClusterAttribute[]> {
        let attributes: ClusterAttribute[] = [];
        for (let key of Object.keys(environmentAttribute.value)) {
            const obj = environmentAttribute.value[key];
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

    private _onDidChangeTreeData: vscode.EventEmitter<ClusterAttribute | undefined> = new vscode.EventEmitter<ClusterAttribute | undefined>();

    readonly onDidChangeTreeData: vscode.Event<ClusterAttribute | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        output.info("EnviromentExplorer refresh");
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