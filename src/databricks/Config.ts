import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import fs from 'fs';
import os from 'os';
import ini from 'ini';
import path from 'path';

import * as output from './Output';
interface ConfigObj {
    [key: string]: any;
}

export class DatabricksConfig {
    workspaceFolder: string | undefined;
    config = <ConfigObj>{};

    private getConfig(key: string) {
        const workspaceConfig = vscode.workspace.getConfiguration("databricks-run");
        return workspaceConfig.get(key) as string;
    }

    private setConfig(key: string, value: any, user: boolean) {
        const target = (user) ? ConfigurationTarget.Global : ConfigurationTarget.Workspace;
        const workspaceConfig = vscode.workspace.getConfiguration("databricks-run");
        workspaceConfig.update(key, value, target).then(
            () => {
                if (target === ConfigurationTarget.Global) {
                    output.info(`Added ${key} to user config`);
                } else {
                    output.info(`Added ${key} to workspace config (.vscode/settings.json)`);
                }
            },
            (error) => {
                output.info(error);
            }
        );
        return value;
    }

    getRemoteFolder() {
        return this.getConfig("remote-work-folder");
    }
    getPythonLibFolder() {
        return this.getConfig("python-lib-folder");
    }
    getProfile() {
        return this.getConfig("profile");
    }
    getCluster() {
        return this.getConfig("cluster");
    }
    setRemoteFolder(value: string, user: boolean) {
        this.setConfig("remote-work-folder", value, user);
    }
    setPythonLibFolder(value: string, user: boolean) {
        this.setConfig("python-lib-folder", value, user);
    }
    setProfile(value: string, user: boolean) {
        this.setConfig("profile", value, user);
    }
    setCluster(value: string, user: boolean) {
        this.setConfig("cluster", value, user);
    }

    getClusterConfig() {
        let profile = this.getProfile();
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        const host = dbConfig[profile]["host"];
        const token = dbConfig[profile]["token"];
        return [host, token];
    }
}


