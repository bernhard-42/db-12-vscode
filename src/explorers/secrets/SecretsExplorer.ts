import * as vscode from 'vscode';
import { Secrets } from '../../rest/Secrets';
import { Secret } from './Secret';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';


let secretList = new Map<string, Secrets>();

export class SecretsExplorerProvider extends BaseExplorer<Secret> {
    secretsApi = <Secrets>{};

    constructor() {
        super(["python", "scala"], (msg: string): Secret => new Secret(msg));
        this.hasContext = true;
    }

    parse(secrets: Json[], type: string, parent?: string[]) {
        return secrets.map(secret => new Secret(
            (type === "scope") ? secret["name"] : secret["key"],
            (type === "scope") ? `(${secret["backend_type"]} backed scope)` : "(secret, paste only)",
            type,
            parent,
            (type === "secret") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    async getTopLevel(): Promise<Secret[]> {
        let profiles = secretList.keys();
        let entries: Secret[] = [];
        for (let profile of profiles) {
            let entry = new Secret(
                profile,
                "",
                "profile",
                [],
                vscode.TreeItemCollapsibleState.Collapsed);
            entries.push(entry);
        };
        return Promise.resolve(entries);
    }

    async getNextLevel(parent: Secret): Promise<Secret[]> {
        if (parent.type === "profile") {
            let api = secretList.get(parent.name);
            if (api) {
                let result = await api.listScopes();
                if (result.isSuccess()) {
                    return Promise.resolve(this.parse(result.toJson()["scopes"], "scope", [parent.name]));
                } else {
                    output.error(result.toString());
                }
            }
            return Promise.resolve([new Secret("missing")]);
        } else {
            let api = secretList.get((parent.parent || [])[0]);
            if (api) {
                let result = await api.list(parent.name);
                if (result.isSuccess()) {
                    const objs = this.parse(result.toJson()["secrets"], "secret", parent.parent?.concat([parent.name]));
                    return Promise.resolve(objs);
                } else {
                    output.error(result.toString());
                }
            }
            return Promise.resolve([new Secret("Missing")]);
        }
    }

    getSnippet(secret: Secret) {
        if (secret.parent && secret.parent?.length > 1) {
            return `dbutils.secrets.get("${secret.parent[1]}", "${secret.name}")`;
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    push(profile: string, host: string, token: string) {
        if (!secretList.has(profile)) {
            secretList.set(profile, new Secrets(host, token));
        }
    }
}

export function createSecretsExplorer() {
    const secretsExplorer = new SecretsExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksSecretsExplorer', secretsExplorer);
    vscode.window.createTreeView('databricksSecretsExplorer', { treeDataProvider: secretsExplorer });

    return secretsExplorer;
}