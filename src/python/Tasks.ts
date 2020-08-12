import * as vscode from 'vscode';
import decomment from 'decomment';
import fs from 'fs';
import { DatabricksRunOutput } from '../databricks/DatabricksOutput';

function tasks() {
    return {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "Zip library",
                "type": "shell",
                "command": "${config:databricks-run.zip-command} /tmp/${config:databricks-run.lib-folder}.zip ${config:databricks-run.lib-folder}/",
                "windows": {
                    "command": "echo 'NotImplemented'"
                },
                "presentation": {
                    "reveal": "always",
                    "panel": "shared",
                    "clear": true
                },
                "problemMatcher": []
            },
            {
                "label": "Upload library",
                "type": "shell",
                "command": "${config:databricks-run.databricks-cli} --profile ${config:databricks-run.profile} fs cp --overwrite /tmp/${config:databricks-run.lib-folder}.zip ${config:databricks-run.remote-folder}",
                "windows": {
                    "command": "echo 'NotImplemented'"
                },
                "group": {
                    "kind": "build",
                    "isDefault": true
                },
                "presentation": {
                    "reveal": "always",
                    "panel": "shared"
                },
                "dependsOrder": "sequence",
                "dependsOn": [
                    "Zip library"
                ],
                "problemMatcher": []
            }
        ]
    };
}

export function updateTasks() {
    let vscodeFolder = (vscode.workspace.rootPath || ".") + "/.vscode";
    let taskJson = vscodeFolder + "/tasks.json";

    const output = new DatabricksRunOutput();

    const dbTasks = tasks();
    if (!fs.existsSync(vscodeFolder)) {
        fs.mkdirSync(vscodeFolder);
    }
    if (fs.existsSync(taskJson)) {
        const tasksStr = decomment(fs.readFileSync(taskJson, "utf8"));
        const exTaskJson = JSON.parse(tasksStr);
        let addZip = true;
        let addUpload = true;
        for (const task of exTaskJson["tasks"]) {
            let label = ("label" in task) ? task["label"] as string : "";
            if (label === "Zip library") {
                addZip = false;
            } else if (label === "Upload library") {
                addUpload = false;
            }
        }
        if (addZip) {
            exTaskJson["tasks"].push(dbTasks["tasks"][0]);
        }
        if (addUpload) {
            exTaskJson["tasks"].push(dbTasks["tasks"][1]);
        }
        if (addZip || addUpload) {
            fs.writeFileSync(taskJson, JSON.stringify(exTaskJson, null, 2));
            output.write(`Updated ${taskJson}`);
        }
    } else {
        fs.writeFileSync(taskJson, JSON.stringify(dbTasks, null, 2));
        output.write(`Created ${taskJson}`);
    }
}
