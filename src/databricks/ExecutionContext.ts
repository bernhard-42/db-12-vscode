import { RemoteCommand } from '../rest/RemoteCommand';
import * as output from './DatabricksOutput';
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
            let context = this.executionContexts.get(fname);
            if (context) {
                output.info(`Retrieved context for file ${fname}`);
            }
            return context;
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
            output.info(`Clearing context for file ${fname}`);
            this.executionContexts.delete(fname);
        }
        return Array.from(this.executionContexts.keys()).length;
    }
}

export const executionContexts = new ExecutionContexts();
