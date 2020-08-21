import * as vscode from 'vscode';
import { RemoteCommand } from '../rest/RemoteCommand';
import { librariesCode } from './PythonTemplate';
import { baseLibraries } from './baselibs';
import { pipList } from '../system/shell';
import * as output from '../databricks/DatabricksOutput';
import { executionContexts } from '../databricks/ExecutionContext';
import { Library } from './Library';

export class LibraryExplorerProvider implements vscode.TreeDataProvider<Library> {
    clusterID = "";
    remoteCommand = <RemoteCommand>{};
    language = "";

    remoteLibraries = new Map<string, Library>();
    localLibraries = new Map<string, string>();

    errorResponse(msg: string) {
        return new Library(false, msg, "", "", vscode.TreeItemCollapsibleState.None);
    }

    getTreeItem(variable: Library): vscode.TreeItem {
        return variable;
    }

    parseResponse(jsonData: string) {
        var data = JSON.parse(jsonData);
        Object.keys(data).forEach(key => {
            this.remoteLibraries.set(data[key]["name"], new Library(
                false,
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
            return Promise.resolve([this.errorResponse(`Not implmented`)]);
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
        this.localLibraries = new Map<string, string>();
        // TODO: python.pythonPath is deprecated!
        let pythonConfig = vscode.workspace.getConfiguration("python");
        let python = pythonConfig.get("pythonPath");
        if (python === "python") {
            await vscode.commands.executeCommand("python.setInterpreter");
            let pythonConfig = vscode.workspace.getConfiguration("python");
            python = pythonConfig.get("pythonPath");
        }
        output.info(`Local python interpreter: ${python}`);
        let locaLibs: string = pipList(python as string);
        this.parseLocal(locaLibs);

        const code = librariesCode();
        let remoteLibs = await this.remoteCommand.execute(code);
        this.parseResponse(remoteLibs["data"]);
        return [
            new Library(true, "Python", "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library(true, "DE and ML", "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library(true, "Base", "", "", vscode.TreeItemCollapsibleState.Collapsed)
        ];
    }

    private getLibraries(category: Library): Library[] {
        var libs: Library[] = [];
        if (category.name === "Python") {
            libs.push(this.remoteLibraries.get("python") || this.errorResponse("python version is missing"));
        } else if (category.name === "Base") {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (baseLibraries.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || this.errorResponse(`lib ${key} is missing`));
                }
            });
        } else {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (!baseLibraries.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || this.errorResponse(`lib ${key} is missing`));
                }
            });
        }
        return libs.sort((a, b) => a.name.localeCompare(b.name));
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Library | undefined> = new vscode.EventEmitter<Library | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Library | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        const filename = executionContexts.getFilename();
        if (!filename?.startsWith("/")) {
            return;
        }
        const context = executionContexts.getContext();
        if (context) {
            this.clusterID = context.cluster;
            this.remoteCommand = context.remoteCommand;
            this.language = context.language;
            if (this.language === "python") {
                output.info("LibraryExplorer refresh");
                this._onDidChangeTreeData.fire();
            }
        }
    }

    downloadEnvFile() {
        var envFile: string[] = [];
        envFile.push("# env.yml");
        envFile.push("#");
        envFile.push("# Edit as necessary, save as env.yaml and create an environment via");
        envFile.push("#   conda env create -n databricks -f env.yml");
        envFile.push("# Then select this environment as interpreter in VS Code");
        envFile.push("#");
        envFile.push("channels:");
        envFile.push("  - defaults");
        envFile.push("dependencies:");
        if (this.remoteLibraries.get("python")) {
            envFile.push(`  - python=${this.remoteLibraries.get("python")?.version}`);
        }
        if (this.remoteLibraries.get("pip")) {
            envFile.push(`  - pip=${this.remoteLibraries.get("pip")?.version}`);
        }
        envFile.push("  - pip:");
        output.info(this.remoteLibraries.toString());
        Array.from(this.remoteLibraries.keys()).forEach(key => {
            if (!baseLibraries.includes(key) && !["python", "sparkdl", "horovod"].includes(key)) {
                let version = this.remoteLibraries.get(key)?.version;
                if (version) {
                    if (key === "torchvision") {
                        version = version.substr(0, 5);
                    }
                    if (key === "sparkdl") {
                        version = version.substr(0, 5);
                    }
                    if (key === "hyperopt") {
                        version = version.substr(0, 5);
                    }
                    envFile.push(`    - ${key}==${version}`);
                }
            }
        });

        vscode.workspace.openTextDocument({
            language: "yaml",
            content: envFile.join("\n"),
        }).then(document => {
            vscode.window.showTextDocument(document);
        });
    }
}

export function createLibraryExplorer() {
    const libraryExplorer = new LibraryExplorerProvider();
    vscode.window.registerTreeDataProvider('databricksLibraryExplorer', libraryExplorer);
    vscode.window.createTreeView('databricksLibraryExplorer', { treeDataProvider: libraryExplorer });

    libraryExplorer.refresh();
    return libraryExplorer;
}