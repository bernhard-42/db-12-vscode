import * as vscode from 'vscode';
import { Secrets } from '../../rest/Secrets';
import { Secret } from './Secret';
import { BaseExplorer } from '../BaseExplorer';
import * as output from '../../databricks/Output';
import { Json } from '../../rest/Rest';

export class SecretsExplorerProvider extends BaseExplorer<Secret> {
    secretsApi = <Secrets>{};

    constructor(host: string, token: string) {
        super(["python", "sql", "scala", "r"], (msg: string): Secret => new Secret(msg));
        this.secretsApi = new Secrets(host, token);
        this.hasContext = true;
    }

    parse(secrets: Json[], type: string, parent?: string) {
        return secrets.map(secret => new Secret(
            (type === "scope") ? secret["name"] : secret["key"],
            type,
            (type === "scope") ? `(${secret["backend_type"]})` : "(paste only)",
            parent,
            (type === "secret") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
        ));
    }

    async getTopLevel(): Promise<Secret[]> {
        let result = await this.secretsApi.listScopes();
        if (result.isSuccess()) {
            return Promise.resolve(this.parse(result.toJson()["scopes"], "scope"));
        } else {
            output.error(result.toString());
            return Promise.resolve([new Secret("missing")]);
        }
    }

    async getNextLevel(secret: Secret): Promise<Secret[]> {
        let result = await this.secretsApi.list(secret.name);
        if (result.isSuccess()) {
            const objs = this.parse(result.toJson()["secrets"], "secret", secret["name"]);
            return Promise.resolve(objs);
        } else {
            output.error(result.toString());
            return Promise.resolve([new Secret("Missing")]);
        }
    }

    getSnippet(secret: Secret) {
        return `dbutils.secrets.get("${secret.parent}", "${secret.name}")`;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}

export function createSecretsExplorer(host: string, token: string) {
    const secretsExplorer = new SecretsExplorerProvider(host, token);
    vscode.window.registerTreeDataProvider('databricksSecretsExplorer', secretsExplorer);
    vscode.window.createTreeView('databricksSecretsExplorer', { treeDataProvider: secretsExplorer });

    return secretsExplorer;
}