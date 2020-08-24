import * as vscode from 'vscode';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { getWorkspaceRoot } from '../databricks/utils';
import { DatabricksConfig } from '../databricks/DatabricksConfig';
import { Dbfs } from '../rest/Dbfs';

export class DatabricksRunTaskProvider implements vscode.TaskProvider {
    static type = "Databricks Run";
    private tasks: vscode.Task[] = [];

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        return undefined;
    }

    getTasks(): vscode.Task[] {
        if (this.tasks.length > 0) {
            return this.tasks;
        }

        let task = new vscode.Task(
            { type: DatabricksRunTaskProvider.type },
            vscode.TaskScope.Workspace,
            "Upload Python Library",
            DatabricksRunTaskProvider.type,
            new vscode.CustomExecution(
                async (): Promise<vscode.Pseudoterminal> => {
                    return new UploadPythonLibrary();
                }
            )
        );
        return [task];
    }
}

class UploadPythonLibrary implements vscode.Pseudoterminal {
    workspaceRoot = "";
    libFolder = "";
    remoteFolder = "";
    host = "";
    token = "";
    ready = false;

    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<void>();
    onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    constructor() {
        this.workspaceRoot = getWorkspaceRoot() || "";
        let databricksConfig = new DatabricksConfig();
        this.libFolder = databricksConfig.getPythonLibFolder();
        this.remoteFolder = databricksConfig.getRemoteFolder();

        [this.host, this.token] = databricksConfig.getClusterConfig();
        this.ready = (this.workspaceRoot !== "") && (this.libFolder !== "") && (this.remoteFolder !== "");
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.doBuild();
    }

    close(): void {
        this.closeEmitter.fire();
    }

    private async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.ready) {
                if (this.workspaceRoot && this.libFolder && this.remoteFolder) {
                    const buildFolder = path.join(this.workspaceRoot, "build");
                    const zipFile = path.join(buildFolder, `${this.libFolder}.zip`);
                    if (!fs.existsSync(buildFolder)) {
                        fs.mkdirSync(buildFolder);
                    }
                    if (fs.existsSync(zipFile)) {
                        fs.unlinkSync(zipFile);
                    }
                    this.writeEmitter.fire(`Starting build ${this.workspaceRoot}/${this.libFolder}...\r\n`);

                    let result = await this.createZip(
                        this.workspaceRoot,
                        this.libFolder,
                        zipFile,
                        this.writeEmitter
                    );
                    if (result) {
                        result = await this.upload(
                            zipFile,
                            `${this.remoteFolder}/${this.libFolder}.zip`,
                            this.writeEmitter);
                    }
                    this.writeEmitter.fire('Build complete.\r\n\r\n');
                    this.closeEmitter.fire();
                    resolve();
                };
            } else {
                this.writeEmitter.fire('Build failed.\r\n\r\n');
                this.closeEmitter.fire();
                resolve();
            }
        });
    }

    private async createZip(root: string, folder: string, zipFile: string, writeEmitter: vscode.EventEmitter<string>): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let output = fs.createWriteStream(zipFile);
            let archive = archiver('zip', {
                zlib: { level: 9 }
            });

            output.on('close', function () {
                writeEmitter.fire(`zip ${zipFile} file created, ${archive.pointer()} total bytes written\r\n`);
                resolve(true);
            });

            archive.on('warning', function (err) {
                if (err.code === 'ENOENT') {
                    writeEmitter.fire("Error no entity\r\n");
                } else {
                    resolve(false);
                }
            });

            archive.on('error', function (err) {
                writeEmitter.fire(`${err}`);
                resolve(false);
            });

            archive.pipe(output);
            writeEmitter.fire(`Zipping folder ${folder}\r\n`);

            archive
                .directory(path.join(root, folder), folder, data => {
                    if (data.name.indexOf("__pycache__") >= 0) { return false; };
                    if (data.name.endsWith(".pyc")) { return false; }
                    return data;
                })
                .finalize();
        });
    }

    private async upload(zipFile: string, remoteFolder: string, writeEmitter: vscode.EventEmitter<string>): Promise<boolean> {
        const dbfs = new Dbfs(this.host, this.token);
        let result = await dbfs.upload(zipFile, remoteFolder);
        if (result["status"] === "success") {
            writeEmitter.fire(`Python library uploaded to ${remoteFolder}\r\n`);
            return Promise.resolve(true);
        } else {
            writeEmitter.fire(`${result["data"]}\r\n`);
        }
        return Promise.resolve(false);
    }
}