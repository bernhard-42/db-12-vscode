import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from './Output';
import { getEditor, getCurrentFilename } from './utils';

interface IExecutionContext {
    language: string;
    remoteCommand: RemoteCommand;
    commandId: string;
    profile: string,
    host: string;
    token: string;
    cluster: string;
    clusterName: string,
    executionId: number;
}

class ExecutionContexts {
    executionContexts: Map<string, IExecutionContext>;

    constructor() {
        this.executionContexts = new Map<string, IExecutionContext>();
    }

    getContext(filename?: string) {
        let fname = filename || getCurrentFilename();
        if (fname) {
            return this.executionContexts.get(fname);
        }
        return;
    }

    setContext(fileName: string, language: string, remoteCommand: RemoteCommand, profile: string, host: string, token: string, cluster: string, clusterName: string) {
        const editor = getEditor();
        if (editor) {
            this.executionContexts.set(fileName, {
                language: language,
                remoteCommand: remoteCommand,
                commandId: "",
                profile: profile,
                host: host,
                token: token,
                cluster: cluster,
                clusterName: clusterName,
                executionId: 1
            });
        }
    }

    clearContext(filename?: string) {
        let fname = filename || getCurrentFilename();
        if (fname) {
            output.debug(`Clearing context for file ${fname}`);
            this.executionContexts.delete(fname);
        }
        return Array.from(this.executionContexts.keys()).length;
    }

    getClusters() {
        let clusters = Array.from(this.executionContexts.keys()).map(entry =>
            [
                this.getContext(entry)?.cluster || "",
                this.getContext(entry)?.host || "",
                this.getContext(entry)?.token || ""
            ]
        );
        return clusters;
    }

    getFilenames() {
        return Array.from(this.executionContexts.keys());
    }

    getFilenamesForCluster(clusterId: string) {
        let filenames: string[] = [];
        for (let [key, value] of this.executionContexts) {
            if (value.cluster === clusterId) {
                filenames.push(key);
            }
        }
        return filenames;
    }

    getProfiles() {
        let profiles: string[] = [];
        for (let [key, value] of this.executionContexts) {
            if (!profiles.includes(value.profile)) {
                profiles.push(key);
            }
        }
        return profiles;
    }
}

export const executionContexts = new ExecutionContexts();

