import * as vscode from 'vscode';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

import { BaseTask } from './BaseTask';

export class BuildZipTask extends BaseTask {
    constructor() {
        super();
    }
    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.prepare()) {
                this.writeEmitter.fire(`Starting build ${this.workspaceRoot}/${this.libFolder}...\r\n`);

                const zipFile = path.join(this.buildFolder, `${this.libFolder}.zip`);
                if (fs.existsSync(zipFile)) {
                    fs.unlinkSync(zipFile);
                }

                let result = await this.createZip(
                    this.workspaceRoot,
                    this.libFolder,
                    zipFile,
                    this.writeEmitter
                );
                if (result) {
                    this.writeEmitter.fire('Build complete.\r\n\r\n');
                } else {
                    this.writeEmitter.fire('Build error.\r\n\r\n');
                }
            } else {
                this.writeEmitter.fire('Build failed.\r\n\r\n');
            }
            this.closeEmitter.fire();
            resolve();
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
}