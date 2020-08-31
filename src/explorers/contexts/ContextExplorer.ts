import * as vscode from 'vscode';
import { Context } from './Context';
import { BaseExplorer } from '../BaseExplorer';
import { executionContexts } from '../../databricks/ExecutionContext';
import path from 'path';

export class ContextExplorerProvider extends BaseExplorer<Context> {

    constructor() {
        super(["python", "sql", "scala", "r"], (msg: string): Context => new Context(msg));
        this.hasContext = true;
    }

    async getTopLevel(): Promise<Context[]> {
        const entries = Array.from(executionContexts.executionContexts.keys());
        return Promise.resolve(entries.map(entry =>
            new Context(
                path.basename(entry),
                entry,
                vscode.TreeItemCollapsibleState.Collapsed
            )
        ));
    }

    async getNextLevel(context: Context): Promise<Context[]> {
        if (context.value) {
            let details = executionContexts.executionContexts.get(context.value);
            return Promise.resolve([
                new Context("language", details?.language, vscode.TreeItemCollapsibleState.None),
                new Context("host", details?.host, vscode.TreeItemCollapsibleState.None),
                new Context("cluster", details?.cluster, vscode.TreeItemCollapsibleState.None),
                new Context("clusterName", details?.clusterName, vscode.TreeItemCollapsibleState.None),
            ]);
        } else {
            return Promise.resolve([new Context("No notext")]);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}

export function createContextExplorer() {
    const contextExplorer = new ContextExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksContextExplorer', contextExplorer);
    vscode.window.createTreeView('databricksContextExplorer', { treeDataProvider: contextExplorer });

    return contextExplorer;
}