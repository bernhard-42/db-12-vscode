import path from 'path';

import { Dbfs } from '../rest/Dbfs';
import { BaseTask } from './BaseTask';

export class UploadTask extends BaseTask {
    file: string;

    constructor(private type: string) {
        super();
        if (type === "zip") {
            this.file = path.join(this.buildFolder, `${this.libFolder}.zip`);
        } else {
            this.file = path.join(this.distFolder, `${this.libFolder}-0.1-py3-none-any.whl`);
        }
    }

    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            this.writeEmitter.fire(`Starting upload of ${this.file} ...\r\n`);
            let [host, token] = this.databricksConfig.getClusterConfig();
            let remoteFolder = this.databricksConfig.getRemoteFolder();

            const dbfs = new Dbfs(host, token);
            const remoteFile = path.join(remoteFolder, `${this.libFolder}-0.1-py3-none-any.whl`);
            let result = await dbfs.upload(this.file, remoteFile);
            if (result["status"] === "success") {
                this.writeEmitter.fire(`${this.type} uploaded to ${remoteFolder}\r\n`);
                this.writeEmitter.fire(`\r\nUse\r\n    %pip install ${remoteFile.replace("dbfs:", "/dbfs")}'\r\n`);
                this.writeEmitter.fire("to enable the library on the remote cluster\r\n");
            } else {
                this.writeEmitter.fire(`${result["data"]}\r\n`);
            }
            this.closeEmitter.fire();
            resolve();
        });
    }
}