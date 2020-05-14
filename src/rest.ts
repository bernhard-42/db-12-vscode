import url from 'url';
import axios from 'axios';
import { window, OutputChannel } from 'vscode';

interface Response {
    [key: string]: any;
}

interface ExecutionContext {
    language: string;
    contextId: string;
    commandId: string;
    host: string;
    token: string;
    cluster: string;
    executionId: number;
}

function headers(token: string) {
    return { headers: { "Authorization": `Bearer ${token}` } };
};

export class Rest12 {
    output: OutputChannel;
    editorPrefix: string;
    profile: string = "";
    host: string = "";
    token: string = "";
    language: string = "";
    cluster: string = "";
    commandId: string = "";
    contextId: string = "";

    constructor(output: OutputChannel, editorPrefix: string) {
        this.output = output;
        this.editorPrefix = editorPrefix;
    }

    async createContext(profile: string, host: string, token: string, language: string, cluster: string): Promise<boolean> {
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
            window.showErrorMessage(`ERROR[2]: ${error}\n`);
            return Promise.resolve(false);
        }

        // Poll context until it is created

        try {
            const path = `api/1.2/contexts/status?clusterId=${cluster}&contextId=${this.contextId}`;
            const uri = url.resolve(this.host, path);
            const condition = (value: string) => value === "PENDING";
            let response = await this.poll(uri, token, condition, 1000, this.output);
            this.output.appendLine(`Execution Context created for profile '${this.profile}' and cluster '${this.cluster}'`);
            return Promise.resolve(true);
        } catch (error) {
            window.showErrorMessage(`ERROR[3]: ${error}\n`);
            return Promise.resolve(false);
        }
    }

    getContextId(): string {
        return this.contextId;
    }

    async stop() {
        try {
            const uri = url.resolve(this.host, 'api/1.2/contexts/destroy');
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId
            };
            await axios.post(uri, data, headers(this.token));
            this.output.appendLine(this.editorPrefix + "Execution context stopped");
        } catch (error) {
            this.output.appendLine(this.editorPrefix + ` ERROR[4]: ${error}\n`);
        }
    }

    async execute(code: string): Promise<boolean> {
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
            this.output.appendLine(this.editorPrefix + ` ERROR[5]: ${error}\n`);
            return Promise.resolve(false);
        }

        // Poll command until it is finished

        try {
            const path = `api/1.2/commands/status?clusterId=${this.cluster}&contextId=${this.contextId}&commandId=${this.commandId}`;
            const uri = url.resolve(this.host, path);
            const condition = (value: string) => ["Queued", "Running", "Cancelling"].indexOf(value) !== -1;
            let response = await this.poll(uri, this.token, condition, 100, this.output) as Response;

            if (response["data"].status === "Finished") {
                let resultType = (response["data"] as Response)["results"]["resultType"];
                if (resultType === "error") {
                    const out = response["data"]["results"]["cause"];
                    if (out.indexOf("CommandCancelledException") === -1) {
                        this.output.appendLine(this.editorPrefix + " ERROR[6]:\n" + out);
                    }
                    return Promise.resolve(false);
                } else {
                    const out = response["data"]["results"]["data"] as string;
                    out.split("\n").forEach((line) => {
                        this.output.append(this.editorPrefix);
                        this.output.appendLine(line);
                    });
                    return Promise.resolve(true);
                }
            } else if (response["data"].status === "Cancelled") {
                this.output.appendLine("Error: Command execution cancelled");
                return Promise.resolve(false);
            } else {
                this.output.appendLine("Error: Command execution failed");
                return Promise.resolve(false);
            }
        } catch (error) {
            this.output.appendLine(`Error: ${error}\n`);
            return Promise.resolve(false);
        }
    }

    async cancel() {
        try {
            const uri = url.resolve(this.host, 'api/1.2/commands/cancel');
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId,
                "commandId": this.commandId
            };
            await axios.post(uri, data, headers(this.token));
            this.output.appendLine("\n" + this.editorPrefix + "=> Command cancelled");
        } catch (error) {
            this.output.appendLine(this.editorPrefix + ` ERROR8: ${error}\n`);
        }
    }

    async poll(
        uri: string,
        token: string,
        condition: (value: string) => boolean,
        ms: number,
        output: OutputChannel) {

        const fn = () => axios.get(uri, headers(token));
        let response = await fn();
        while (condition((response as Response)["data"].status)) {
            output.append("»");
            await this.wait(ms);
            response = await fn();
        }
        output.append("\n");
        return response;
    }

    wait(ms = 100) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}