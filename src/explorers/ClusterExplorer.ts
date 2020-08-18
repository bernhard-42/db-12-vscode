import * as vscode from 'vscode';
import { Clusters } from '../rest/Clusters';
import { Response } from '../rest/Helpers';

class Cluster extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly state: string,
        public readonly cluster_id: string,
        public readonly spark_version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState);
    }

    get tooltip(): string {
        return `${this.cluster_id}: ${this.spark_version}`;
    }

    get description(): string {
        return `(${this.state})`;
    }
}

export class DatabricksClusterExplorerProvider implements vscode.TreeDataProvider<Cluster> {
    clusters: Clusters;
    noClusters: Cluster[];

    constructor(host: string, token: string) {
        this.clusters = new Clusters(host, token);
        this.noClusters = [new Cluster("none", "", "", "", vscode.TreeItemCollapsibleState.None)];
    }

    getTreeItem(cluster: Cluster): vscode.TreeItem {
        return cluster;
    }

    getChildren(cluster?: Cluster): Thenable<Cluster[]> {
        if (cluster) {
            return Promise.resolve(this.noClusters);
        } else {
            return Promise.resolve(this.getClusters());
        }
    }

    private async getClusters(): Promise<Cluster[]> {
        let result = await this.clusters.list();
        if (result["status"] === "success") {
            let clusters: Cluster[] = [];
            const clusterConfig: Response[] = result["data"];
            clusterConfig.forEach(cluster => {
                clusters.push(new Cluster(
                    cluster["cluster_name"],
                    cluster["state"],
                    cluster["spark_version"],
                    cluster["cluster_id"],
                    vscode.TreeItemCollapsibleState.None));
            });
            if (clusters.length > 0) {
                return Promise.resolve(clusters);
            } else {
                return Promise.resolve(this.noClusters);
            }

        } else {
            return Promise.resolve(this.noClusters);
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Cluster | undefined> = new vscode.EventEmitter<Cluster | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Cluster | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

export function createClusterExplorer(host: string, token: string) {
    const clusterExplorer = new DatabricksClusterExplorerProvider(host, token);
    vscode.window.registerTreeDataProvider('databricksClusterExplorer', clusterExplorer);

    vscode.window.createTreeView('databricksClusterExplorer', { treeDataProvider: clusterExplorer });

    clusterExplorer.refresh();
    return clusterExplorer;
}