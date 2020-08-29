import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promises } from 'dns';

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
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    this.print(error.message);
                }
                if (stdout) {
                    this.print(stdout);
                }
                if (stderr) {
                    this.print(stderr);
                }
                resolve();
            });
        });
    }

    print(msg: string) {
        for (let line of msg.split("\n")) {
            this.writeEmitter.fire('\x1b[D');
            this.writeEmitter.fire(line + "\r\n");
        }
    }
}