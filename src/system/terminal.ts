import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as output from '../databricks/Output';

export class TerminalExecute {
    writeEmitter = new vscode.EventEmitter<string>();
    terminal: vscode.Terminal;

    constructor(msg: string) {
        let pty = {
            onDidWrite: this.writeEmitter.event,
            open: () => this.writeEmitter.fire(msg + '\r\n\r\n'),
            close: () => { /* noop*/ },
        };
        this.terminal = vscode.window.createTerminal({ name: "Databricks Run Terminal", pty });
    }

    async execute(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.terminal.show();
            const child = spawn(command, {
                stdio: 'pipe', shell: true
            });
            child.stdout?.on('data', data => {
                this.print(data.toString());
            });
            child.stderr?.on('data', data => {
                this.print(data.toString());
            });
            child.on('exit', (code, signal) => {
                if (code === 0) {
                    output.info(`Successfully executed '${command}`);
                } else {
                    output.error(`Failed to execute '${command}(${code})`);
                }
                resolve();
            });
        });
    }

    print(msg: string) {
        for (let line of msg.split(/\r?\n/)) {
            this.writeEmitter.fire(line + "\r\n");
        }
    }
}