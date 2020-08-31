import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import fs from 'fs';
import os from 'os';
import ini from 'ini';
import path from 'path';

import * as output from './Output';
import { getWorkspaceRoot } from './utils';

interface ConfigObj {
    [key: string]: any;
}

export class DatabricksConfig {
    workspaceFolder: string | undefined;
    config = <ConfigObj>{};
    gitignore = ".gitignore";
    configFile = ".databricks-run.json";

    constructor() {
        this.workspaceFolder = getWorkspaceRoot();
    }

    init() {
        if (this.workspaceFolder) {
            const fqConfigFile = path.join(this.workspaceFolder, this.configFile);
            const fqGitignore = path.join(this.workspaceFolder, this.gitignore);
            if (fs.existsSync(fqConfigFile)) {
                this.config = this.load();
            } else {
                this.config = {};
                this.save();
            }
            if (fs.existsSync(fqGitignore)) {
                if (!fs.readFileSync(fqGitignore).toString().split(/\r?\n/).includes(this.configFile)) {
                    fs.appendFileSync(fqGitignore, os.EOL + this.configFile);
                }
            } else {
                fs.writeFileSync(fqGitignore, this.configFile + os.EOL);
            }
        }
    }

    load(): ConfigObj {
        if (this.workspaceFolder) {
            const fqConfigFile = path.join(this.workspaceFolder, this.configFile);
            return JSON.parse(fs.readFileSync(fqConfigFile).toString());
        }
        return {};
    }

    save() {
        if (this.workspaceFolder) {
            const fqConfigFile = path.join(this.workspaceFolder, this.configFile);
            fs.writeFileSync(fqConfigFile, JSON.stringify(this.config, null, 2));
        }
    }

    private getConfig(key: string) {
        return this.config[key];
    }

    private setConfig(key: string, value: any) {
        this.config[key] = value;
        this.save();
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

    getClusterInfo() {
        let [cluster, clusterName] = ["", ""];
        const clusterInfo = this.config["cluster"];
        if (clusterInfo) {
            const sep = clusterInfo.indexOf(" ");
            cluster = clusterInfo.substring(0, sep) || "";
            clusterName = clusterInfo.substring(sep + 2, clusterInfo.length - 1) || "";
        }
        return [cluster, clusterName];
    }
    setRemoteFolder(value: string) {
        this.setConfig("remote-work-folder", value);
    }

    setPythonLibFolder(value: string) {
        this.setConfig("python-lib-folder", value);
    }

    setProfile(value: string) {
        this.setConfig("profile", value);
    }

    setCluster(value: string) {
        this.setConfig("cluster", value);
    }

    getHostAndToken() {
        let profile = this.getProfile();
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        const host = dbConfig[profile]["host"];
        const token = dbConfig[profile]["token"];
        return [host, token];
    }

    getProfiles() {
        const databrickscfg = fs.readFileSync(path.join(os.homedir(), '.databrickscfg'), 'utf8');
        const dbConfig = ini.parse(databrickscfg);
        return Object.keys(dbConfig);
    }

    getMaxArrayLen() {
        let config = vscode.workspace.getConfiguration();
        return config.get("DatabricksRun.maxArrayElements") as number;
    }

    getMaxStringLen() {
        let config = vscode.workspace.getConfiguration();
        return config.get("DatabricksRun.maxStringLength") as number;
    }
}


