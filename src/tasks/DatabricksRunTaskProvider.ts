import * as vscode from 'vscode';
import { RestartTask } from './RestartTask';
import { UploadTask } from './UploadTask';
import { RemoteInstallTask } from './RemoteInstallTask';

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

        let tasks = [
            // new vscode.Task(
            //     { type: DatabricksRunTaskProvider.type, action: "zip" },
            //     vscode.TaskScope.Workspace,
            //     "Create zip archive",
            //     DatabricksRunTaskProvider.type,
            //     new vscode.CustomExecution(
            //         async (): Promise<vscode.Pseudoterminal> => {
            //             return new BuildZipTask();
            //         }
            //     )
            // ),
            // new vscode.Task(
            //     { type: DatabricksRunTaskProvider.type, action: "upload-zip" },
            //     vscode.TaskScope.Workspace,
            //     "Upload zip archive",
            //     DatabricksRunTaskProvider.type,
            //     new vscode.CustomExecution(
            //         async (): Promise<vscode.Pseudoterminal> => {
            //             return new UploadTask("zip");
            //         }
            //     )
            // ),
            new vscode.Task(
                { type: DatabricksRunTaskProvider.type, action: "upload-wheel" },
                vscode.TaskScope.Workspace,
                "Upload wheel",
                DatabricksRunTaskProvider.type,
                new vscode.CustomExecution(
                    async (): Promise<vscode.Pseudoterminal> => {
                        return new UploadTask("wheel");
                    }
                )
            ),
            new vscode.Task(
                { type: DatabricksRunTaskProvider.type, action: "restart" },
                vscode.TaskScope.Workspace,
                "Restart",
                DatabricksRunTaskProvider.type,
                new vscode.CustomExecution(
                    async (): Promise<vscode.Pseudoterminal> => {
                        return new RestartTask();
                    }
                )
            ),
            new vscode.Task(
                { type: DatabricksRunTaskProvider.type, action: "install" },
                vscode.TaskScope.Workspace,
                "Remote Install",
                DatabricksRunTaskProvider.type,
                new vscode.CustomExecution(
                    async (): Promise<vscode.Pseudoterminal> => {
                        return new RemoteInstallTask();
                    }
                )
            )
        ];
        return tasks;
    }
}





