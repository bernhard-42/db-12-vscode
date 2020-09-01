import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from './Output';
import { getEditor, getCurrentFilename } from './utils';

interface IExecutionContext {
    language: string;
    remoteCommand: RemoteCommand;
    commandId: string;
    host: string;
    token: string;
    cluster: string;
    clusterName: string,
    executionId: number;
}

export class ExecutionContexts {
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

    setContext(fileName: string, language: string, remoteCommand: RemoteCommand, host: string, token: string, cluster: string, clusterName: string) {
        const editor = getEditor();
        if (editor) {
            this.executionContexts.set(fileName, {
                language: language,
                remoteCommand: remoteCommand,
                commandId: "",
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
                this.executionContexts.get(entry)?.cluster || "",
                this.executionContexts.get(entry)?.host || "",
                this.executionContexts.get(entry)?.token || ""
            ]
        );
        return clusters;
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
}

export const executionContexts = new ExecutionContexts();

