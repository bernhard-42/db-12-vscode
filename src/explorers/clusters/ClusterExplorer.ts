import * as vscode from 'vscode';
import { Clusters } from '../../rest/Clusters';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';
import { ClusterAttribute } from './ClusterAttribute';
import { BaseExplorer } from '../BaseExplorer';
import { Response } from '../../rest/Rest';

interface Profile {
    clusters: string[],
    api: Clusters
}

let profileList = new Map<string, Profile>();

export class ClusterExplorerProvider extends BaseExplorer<ClusterAttribute> {

    constructor() {
        super(["python", "sql", "scala", "r"], (msg: string): ClusterAttribute => new ClusterAttribute(msg));
        this.hasContext = true;
    }

    async getTopLevel(): Promise<ClusterAttribute[]> {
        let profiles = profileList.keys();
        let entries: ClusterAttribute[] = [];
        for (let profile of profiles) {
            let entry = new ClusterAttribute(
                profile,
                {},
                "profile",
                vscode.TreeItemCollapsibleState.Collapsed);
            entries.push(entry);
        };
        return Promise.resolve(entries);
    }

    async getNextLevel(parent: ClusterAttribute): Promise<ClusterAttribute[]> {
        if (parent.type === "profile") {
            let clusters = profileList.get(parent.name)?.clusters;
            let api = profileList.get(parent.name)?.api;
            let entries: ClusterAttribute[] = [];
            if (clusters && api) {
                for (let cluster of clusters) {
                    let result = await api.info(cluster);
                    if (result.isSuccess()) {
                        let clusterInfo = result.toJson();
                        let entry = new ClusterAttribute(
                            clusterInfo["cluster_name"],
                            clusterInfo,
                            "cluster",
                            vscode.TreeItemCollapsibleState.Collapsed);
                        entries.push(entry);
                    }
                };
            }
            return Promise.resolve(entries);
        } else {
            let attributes: ClusterAttribute[] = [];
            for (let key of Object.keys(parent.getValue())) {
                const obj = parent.getValue()[key];
                attributes.push(
                    new ClusterAttribute(
                        key, obj, "config",
                        (obj === Object(obj)) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
                    )
                );
            }
            return Promise.resolve(attributes);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    async manageCluster(cluster: ClusterAttribute, command: string) {
        let clusterId = (cluster.value as Json)["cluster_id"];
        let profile = this.getProfileForCluster(clusterId);
        if (profile && clusterId) {
            let result: Response;
            let api = profile.api;
            if (command === "start") {
                result = await api.start(clusterId);
            } else if (command === "restart") {
                result = await api.restart(clusterId);
            } else if (command === "stop") {
                result = await api.stop(clusterId);
            } else {
                return;
            }
            if (result.isSuccess()) {
                vscode.window.showInformationMessage(`Triggered cluster ${command}`);
            } else {
                vscode.window.showErrorMessage(`Couldn't ${command} cluster`);
                output.error(result.toString());
            }
            for (let dummy of [0, 2]) {
                setTimeout(() => {
                    this.refresh();
                }, 1000);
            }
        }
    }

    getProfileForCluster(cluster: string) {
        for (let [profile, value] of profileList) {
            if (value.clusters.includes(cluster)) {
                return value;
            }
            return;
        }
    }

    push(profile: string, cluster: string, host: string, token: string) {
        if (!profileList.has(profile)) {
            profileList.set(profile, { clusters: [cluster], api: new Clusters(host, token) });
        } else {
            const entry = profileList.get(profile);
            if (entry && !entry.clusters.includes(cluster)) {
                entry.clusters.push(cluster);
                profileList.set(profile, entry);
            }
        }
    }
}


export function createClusterExplorer() {
    const environmentExplorer = new ClusterExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksClusterExplorer', environmentExplorer);
    vscode.window.createTreeView('databricksClusterExplorer', { treeDataProvider: environmentExplorer });

    output.info("Successfully registered Cluster Explorer");

    return environmentExplorer;
}