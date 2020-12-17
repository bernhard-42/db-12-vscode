import * as vscode from 'vscode';

import { BaseTask } from './BaseTask';
import { executionContexts } from '../databricks/ExecutionContext';
import * as output from '../databricks/Output';

export class RestartTask extends BaseTask {
    constructor() {
        super();
    }

    protected async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            let context = executionContexts.getContext();
            if (context) {
                output.write("Restarting context ...");
                setTimeout(() => {
                    this.writeEmitter.fire(`Restarting extension ...\r\n`);
                    vscode.commands.executeCommand("databricks-run.initialize", () => {
                        output.writeln("done");
                        resolve();
                        this.closeEmitter.fire();
                    });
                }, 1000);
            } else {
                this.writeEmitter.fire(`Error: Run Task "Databricks Run: Restart" when a source file with active remote context is open in VS Code\r\n`);
                resolve();
                this.closeEmitter.fire();
            }
        });
    }
}