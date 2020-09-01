import path from 'path';
import glob from 'glob';
import fs from 'fs';

import { Dbfs } from '../rest/Dbfs';
import { BaseTask } from './BaseTask';
import * as output from '../databricks/Output';

export class UploadTask extends BaseTask {
    localFile = "";
    remoteFile = "";

    constructor(private type: string) {
        super();
    }

    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.ready) {
                if (this.type === "zip") {
                    this.localFile = path.join(this.buildFolder, `${this.libFolder}.zip`);
                    this.remoteFile = `${this.remoteFolder}/${this.libFolder}.zip`; // force unix separator
                } else {
                    this.localFile = glob.sync(path.join(this.distFolder, '*.whl'))
                        .map(name => ({ name, time: fs.statSync(name).ctime.getTime() }))
                        .sort((a, b) => b.time - a.time)[0].name;
                    let wheel = path.basename(this.localFile);
                    this.remoteFile = `${this.remoteFolder}/${wheel}`; // force unix separator
                }
                this.writeEmitter.fire(`Starting upload of ${this.localFile} ...\r\n`);
                let [host, token] = this.databricksConfig.getHostAndToken();

                const dbfs = new Dbfs(host, token);
                let result = await dbfs.upload(this.localFile, this.remoteFile);
                if (result.isSuccess()) {
                    this.writeEmitter.fire(`${this.type} uploaded to ${this.remoteFolder}\r\n`);
                    output.write(
                        "To enable the library on the remote cluster, use\n" +
                        `    %pip install ${this.remoteFile.replace("dbfs:", "/dbfs")}\n`
                    );
                } else {
                    this.writeEmitter.fire(`${result.toString()}\r\n`);
                }
            } else {
                this.writeEmitter.fire("No library or remote folder given. Exiting\r\n");
            }
            this.closeEmitter.fire();
            resolve();
        });
    }
}