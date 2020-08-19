import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';
import { librariesCode } from './PythonTemplate';
import { BASELIST } from './baselibs';
import { exec } from 'child_process';

function execShellCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

export class LibraryExplorerProvider implements vscode.TreeDataProvider<Library> {
    remoteCommand: RemoteCommand = <RemoteCommand>{};
    remoteLibraries = new Map<string, Library>();
    localLibraries = new Map<string, string>();

    language = "";

    errorResponse(msg: string) {
        return new Library(msg, "", "", vscode.TreeItemCollapsibleState.None);
    }

    getTreeItem(variable: Library): vscode.TreeItem {
        return variable;
    }

    parseResponse(jsonData: string) {
        var data = JSON.parse(jsonData);
        Object.keys(data).forEach(key => {
            this.remoteLibraries.set(data[key]["name"], new Library(
                data[key]["name"],
                data[key]["version"],
                (this.localLibraries.has(data[key]["name"])) ? this.localLibraries.get(data[key]["name"]) || "missing" : "missing",
                vscode.TreeItemCollapsibleState.None
            ));
        });
    }

    parseLocal(jsonData: string) {
        var data = JSON.parse(jsonData);
        Object.keys(data).forEach(key => {
            this.localLibraries.set(data[key]["name"], data[key]["version"]);
        });
    }

    getChildren(library?: Library): Thenable<Library[]> {
        if (this.language !== "python") {
            return Promise.resolve([this.errorResponse(`No implmented for ${this.language}`)]);
        }
        if (Object.keys(this.remoteCommand).length > 0) {
            if (library) {
                return Promise.resolve(this.getLibraries(library));
            } else {
                return Promise.resolve(this.getCategories());
            }
        } else {
            return Promise.resolve([this.errorResponse("No context")]);
        }
    }

    private async getCategories(): Promise<Library[]> {
        let locaLibs: string = await execShellCommand('pip list --format json') || "";
        this.parseLocal(locaLibs);

        const code = librariesCode();
        let remoteLibs = await this.remoteCommand.execute(code);
        this.parseResponse(remoteLibs["data"]);
        return [
            new Library("Python", "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library("DE and ML", "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library("Base", "", "", vscode.TreeItemCollapsibleState.Collapsed)
        ];
    }

    private getLibraries(category: Library): Library[] {
        var libs: Library[] = [];
        if (category.name === "Python") {
            libs.push(this.remoteLibraries.get("python") || this.errorResponse("python version is missing"));
        } else if (category.name === "Base") {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (BASELIST.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || this.errorResponse(`lib ${key} is missing`));
                }
            });
        } else {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (!BASELIST.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || this.errorResponse(`lib ${key} is missing`));
                }
            });
        }
        return libs.sort((a, b) => a.name.localeCompare(b.name));
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Library | undefined> = new vscode.EventEmitter<Library | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Library | undefined> = this._onDidChangeTreeData.event;

    refresh(remoteCommand: RemoteCommand, language: string): void {
        this.remoteCommand = remoteCommand;
        this.language = language;
        this._onDidChangeTreeData.fire();
    }
}

class Library extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly localVersion: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(name, collapsibleState);
    }

    get tooltip(): string {
        return `Local env: ${this.localVersion}`;
    }

    get description(): string {
        return `${this.version}`;
    }
}

export function createLibraryExplorer(language: string, remoteCommand: RemoteCommand) {
    const libraryExplorer = new LibraryExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksLibraryExplorer', libraryExplorer);

    vscode.window.createTreeView('databricksLibraryExplorer', { treeDataProvider: libraryExplorer });

    libraryExplorer.refresh(remoteCommand, language);
    return libraryExplorer;
}