import glob from 'glob';
import path from 'path';
import fs from 'fs';

import { executionContexts } from '../databricks/ExecutionContext';
import { BaseTask } from './BaseTask';
import * as output from '../databricks/Output';

export class RemoteInstallTask extends BaseTask {
    localFile = "";
    remoteFile = "";

    constructor() {
        super();
    }

    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            let context = executionContexts.getContext();
            if (context) {
                output.write(`Installing library in the remote context ...\r\n`);
                this.writeEmitter.fire(`Installing library in the remote context ...\r\n`);
                this.localFile = glob.sync(path.join(this.distFolder, '*.whl'))
                    .map(name => ({ name, time: fs.statSync(name).ctime.getTime() }))
                    .sort((a, b) => b.time - a.time)[0].name;
                let wheel = path.basename(this.localFile);
                this.remoteFile = `${this.remoteFolder}/${wheel}`; // force unix separator    
                let command = `%pip install ${this.remoteFile.replace("dbfs:", "/dbfs")}`;
                let result = await context.remoteCommand.execute(command);
                if (result.isSuccess()) {
                    output.write("done");
                    this.writeEmitter.fire(`Success\r\n`);
                } else {
                    output.write("failure");
                    this.writeEmitter.fire(`Failure\r\n`);
                }
            } else {
                this.writeEmitter.fire(`Error: Run Task "Databricks Run: Remote Install" when a source file with active remote context is open in VS Code\r\n`);
            }
            this.closeEmitter.fire();
            resolve();
        });
    }
}