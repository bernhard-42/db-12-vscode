import * as vscode from 'vscode';
import { Json } from '../../rest/Rest';
import { timeStamp } from 'console';

export class ClusterAttribute extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value?: Json,
        public readonly type?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState || vscode.TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `cluster_id: ${(this.value || {})["cluster_id"]}
cluster_name: ${ (this.value || {})["cluster_name"]}
spark_version: ${ (this.value || {})["spark_version"]}
node_type_id: ${ (this.value || {})["node_type_id"]}
num_workers: ${ (this.value || {})["num_workers"]}
cluster_cores: ${ (this.value || {})["cluster_cores"]}
cluster_memory_mb: ${ (this.value || {})["cluster_memory_mb"]}`;
    }

    get description(): string {
        if (this.type === "cluster") {
            return (this.value) ? this.value["state"] : "";
        } else if (this.value === Object(this.value)) {
            return "";
        } else {
            return `${this.value} `;
        }
    }

    getValue(): Json {
        return this.value || {};
    }

    get contextValue() {
        return this.type;
    }

    getclusterId() {
        return (this.value) ? this.value["cluster_id"] : "";
    }
}