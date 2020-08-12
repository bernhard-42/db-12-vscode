import url from 'url';
import axios from 'axios';
import { window, OutputChannel } from 'vscode';
import { Response, headers, poll } from './Helpers';

export class RemoteCommand {
    profile: string = "";
    host: string = "";
    token: string = "";
    language: string = "";
    cluster: string = "";
    commandId: string = "";
    contextId: string = "";

    async createContext(profile: string, host: string, token: string, language: string, cluster: string): Promise<Response> {
        this.profile = profile;
        this.host = host;
        this.token = token;
        this.language = language;
        this.cluster = cluster;

        try {
            const uri = url.resolve(host, 'api/1.2/contexts/create');
            const data = {
                "language": language,
                "clusterId": cluster
            };
            const response = await axios.post(uri, data, headers(token));
            this.contextId = (response as Response)["data"].id;
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }

        // Poll context until it is created

        try {
            const path = `api/1.2/contexts/status?clusterId=${cluster}&contextId=${this.contextId}`;
            const uri = url.resolve(this.host, path);
            const condition = (value: string) => value === "PENDING";
            let response = await poll(uri, token, condition, 1000);
            var msg = `Execution Context created for profile '${this.profile}' and cluster '${this.cluster}'`;
            return Promise.resolve({ "status": "success", "data": msg });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }
    }

    async stop(): Promise<Response> {
        try {
            const uri = url.resolve(this.host, 'api/1.2/contexts/destroy');
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId
            };
            await axios.post(uri, data, headers(this.token));
            return Promise.resolve({ "status": "success", "data": "Execution context stopped" });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }
    }

    async execute(code: string): Promise<Response> {
        try {
            const uri = url.resolve(this.host, 'api/1.2/commands/execute');
            const data = {
                "language": this.language,
                "clusterId": this.cluster,
                "contextId": this.contextId,
                "command": code
            };
            const response = await axios.post(uri, data, headers(this.token));
            this.commandId = (response as Response)["data"].id;
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }

        // Poll command until it is finished

        try {
            const path = `api/1.2/commands/status?clusterId=${this.cluster}&contextId=${this.contextId}&commandId=${this.commandId}`;
            const uri = url.resolve(this.host, path);
            const condition = (value: string) => ["Queued", "Running", "Cancelling"].indexOf(value) !== -1;

            let response = await poll(uri, this.token, condition, 100) as Response;

            if (response["data"].status === "Finished") {
                let resultType = (response["data"] as Response)["results"]["resultType"];
                if (resultType === "error") {
                    const out = response["data"]["results"]["cause"];
                    if (out.indexOf("CommandCancelledException") === -1) {
                        return Promise.resolve({ "status": "error", "data": out });
                    }
                    return Promise.resolve({ "status": "warning", "data": "Command cancelled" });
                } else {
                    const result = response["data"]["results"]["data"] as string;
                    return Promise.resolve({ "status": "success", "data": result });
                }
            } else if (response["data"].status === "Cancelled") {
                return Promise.resolve({ "status": "error", "data": "Command execution cancelled" });
            } else {
                return Promise.resolve({ "status": "error", "data": "Command execution failed" });
            }
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }
    }

    async cancel(): Promise<Response> {
        try {
            const uri = url.resolve(this.host, 'api/1.2/commands/cancel');
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId,
                "commandId": this.commandId
            };
            await axios.post(uri, data, headers(this.token));
            return Promise.resolve({ "status": "success", "data": "Command cancelled" });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error.response.data.error });
        }
    }
}