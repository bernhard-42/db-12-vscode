import * as vscode from 'vscode';
import decomment from 'decomment';
import fs from 'fs';

import * as output from '../databricks/Output';

import { buildWheelTask } from './BuildWheelTemplate';

export function createBuildWheelTasks() {
    let vscodeFolder = (vscode.workspace.rootPath || ".") + "/.vscode";
    let taskJson = vscodeFolder + "/tasks.json";

    const dbTasks = buildWheelTask();
    if (!fs.existsSync(vscodeFolder)) {
        fs.mkdirSync(vscodeFolder);
    }
    if (fs.existsSync(taskJson)) {
        const tasksStr = decomment(fs.readFileSync(taskJson, "utf8"));
        const exTaskJson = JSON.parse(tasksStr);
        let createWheel = true;
        let uploadWheel = true;

        for (const task of exTaskJson["tasks"]) {
            let label = ("label" in task) ? task["label"] as string : "";
            if (label === "Databricks Run: Create wheel") {
                createWheel = false;
            } else if (label === "Databricks Run: Create and upload wheel") {
                uploadWheel = false;
            }
        }
        if (createWheel) {
            exTaskJson["tasks"].push(dbTasks["tasks"][0]);
        }
        if (uploadWheel) {
            exTaskJson["tasks"].push(dbTasks["tasks"][1]);
        }
        if (createWheel || uploadWheel) {
            fs.writeFileSync(taskJson, JSON.stringify(exTaskJson, null, 2));
            output.info(`Updated ${taskJson}`);
        }
    } else {
        fs.writeFileSync(taskJson, JSON.stringify(dbTasks, null, 2));
        output.info(`Created ${taskJson}`);
    }
}