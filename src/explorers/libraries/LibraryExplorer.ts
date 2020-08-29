import * as vscode from 'vscode';
import { RemoteCommand } from '../../rest/RemoteCommand';
import { pipList, pythonVersion, pipInstall } from '../../system/shell';
import { TerminalExecute } from '../../system/terminal';

import * as output from '../../databricks/Output';

import { Library } from './Library';
import { librariesCode } from './LibraryTemplate';
import { baseLibraries } from './baselibs';
import { BaseExplorer } from '../BaseExplorer';

export class LibraryExplorerProvider extends BaseExplorer<Library> {
    remoteLibraries = new Map<string, Library>();
    localLibraries = new Map<string, string>();
    hasContext = false;

    constructor(remoteCommand: RemoteCommand) {
        super((msg: string): Library => new Library(msg));
    }

    getTreeItem(variable: Library): vscode.TreeItem {
        return variable;
    }

    parseResponse(jsonData: string) {
        var data = JSON.parse(jsonData);
        Object.keys(data).forEach(key => {
            this.remoteLibraries.set(data[key]["name"], new Library(
                data[key]["name"].toLowerCase(),
                false,
                data[key]["version"],
                (this.localLibraries.has(data[key]["name"])) ? this.localLibraries.get(data[key]["name"]) || "missing" : "missing",
                vscode.TreeItemCollapsibleState.None
            ));
        });
    }

    parseLocal(jsonData: string) {
        var data = JSON.parse(jsonData);
        Object.keys(data).forEach(key => {
            this.localLibraries.set(data[key]["name"].toLowerCase(), data[key]["version"]);
        });
    }

    async getTopLevel(): Promise<Library[]> {
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

        let pyVersion: string = pythonVersion(python as string).split(" ")[1];
        this.localLibraries.set("python", pyVersion);

        const code = librariesCode();
        let remoteLibs = await this.remoteCommand.execute(code);
        this.parseResponse(remoteLibs["data"]);
        return Promise.resolve([
            new Library("Python", true, "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library("Spark", true, "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library("DE and ML Libraries", true, "", "", vscode.TreeItemCollapsibleState.Collapsed),
            new Library("Base Libraries", true, "", "", vscode.TreeItemCollapsibleState.Collapsed)
        ]);
    }

    async getNextLevel(category: Library): Promise<Library[]> {
        var libs: Library[] = [];
        if (category.name === "Python") {
            libs.push(this.remoteLibraries.get("python") || new Library("python is missing"));
        } else if (category.name === "Spark") {
            libs.push(this.remoteLibraries.get("pyspark") || new Library("spark is missing"));
        } else if (category.name === "Base Libraries") {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (baseLibraries.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || new Library(`lib ${key} is missing`));
                }
            });
        } else {
            Array.from(this.remoteLibraries.keys()).forEach(key => {
                if (!baseLibraries.includes(key) && !(key === "python")) {
                    libs.push(this.remoteLibraries.get(key) || new Library(`lib ${key} is missing`));
                }
            });
        }
        return Promise.resolve(libs.sort((a, b) => a.name.localeCompare(b.name)));
    }

    async install(library?: Library) {

        let pythonConfig = vscode.workspace.getConfiguration("python");
        let python = pythonConfig.get("pythonPath");
        if (python && library) {
            if ((await vscode.window.showQuickPick(["yes", "no"], {
                placeHolder: `Install library ${library.name} in the local environment with pip?`
            }) || "") === "yes") {
                let terminal = new TerminalExecute("Installing... ");
                await terminal.execute(`${python} -m pip install --upgrade ${library.name}==${library.version}`);
                this.refresh();
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

        envFile.push("#   Data Engineering & Science related libraries");
        const dslibs = Array.from(this.remoteLibraries.keys()).filter(key => !baseLibraries.includes(key) && key !== "python").sort();
        for (let lib of dslibs) {
            let version = this.remoteLibraries.get(lib)?.version;
            const prefix = (["python", "sparkdl", "horovod"].includes(lib)) ? "#" : " ";
            if (version) {
                if (lib === "torchvision") {
                    version = version.substr(0, 5);
                }
                if (lib === "sparkdl") {
                    version = version.substr(0, 5);
                }
                if (lib === "hyperopt") {
                    version = version.substr(0, 5);
                }
                envFile.push(`${prefix}   - ${lib}==${version}`);
            }
        }

        envFile.push("#   Basic python libraries");
        const baselibs = Array.from(this.remoteLibraries.keys()).filter(key => baseLibraries.includes(key) && key !== "python").sort();
        for (let lib of baselibs) {
            let version = this.remoteLibraries.get(lib)?.version;
            envFile.push(`#   - ${lib}==${version}`);
        };

        vscode.workspace.openTextDocument({
            language: "yaml",
            content: envFile.join("\n"),
        }).then(document => {
            vscode.window.showTextDocument(document);
        });
    }
}

export function createLibraryExplorer(remoteCommand: RemoteCommand) {
    const libraryExplorer = new LibraryExplorerProvider(remoteCommand);
    vscode.window.registerTreeDataProvider('databricksLibraryExplorer', libraryExplorer);
    vscode.window.createTreeView('databricksLibraryExplorer', { treeDataProvider: libraryExplorer });

    libraryExplorer.refresh();
    return libraryExplorer;
}
