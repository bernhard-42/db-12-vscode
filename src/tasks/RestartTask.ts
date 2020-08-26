import * as vscode from 'vscode';

import { BaseTask } from './BaseTask';

export class RestartTask extends BaseTask {
    constructor() {
        super();
    }

    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            this.writeEmitter.fire(`Restarting extension ...\r\n`);
            vscode.commands.executeCommand("databricks-run.initialize", true);
            this.closeEmitter.fire();
            resolve();
        });
    }
}