import * as vscode from 'vscode';
import decomment from 'decomment';
import fs from 'fs';

import { DatabricksOutput } from '../databricks/DatabricksOutput';

import { tasks } from './TasksTemplate';

export function updateTasks() {
    let vscodeFolder = (vscode.workspace.rootPath || ".") + "/.vscode";
    let taskJson = vscodeFolder + "/tasks.json";

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
            DatabricksOutput.write(`Updated ${taskJson}`);
        }
    } else {
        fs.writeFileSync(taskJson, JSON.stringify(dbTasks, null, 2));
        DatabricksOutput.write(`Created ${taskJson}`);
    }
}
