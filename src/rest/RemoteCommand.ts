import url from 'url';
import { Response, Json, Rest } from './Rest';
import * as output from '../databricks/Output';

export class RemoteCommand extends Rest {
    commandId: string = "";
    contextId: string = "";

    constructor(
        protected host: string, protected token: string,
        private profile: string, private language: string, private cluster: string
    ) {
        super(host, token);
    }

    async createContext(): Promise<Response> {
        try {
            const data = {
                "language": this.language,
                "clusterId": this.cluster
            };
            const response = await this.post('api/1.2/contexts/create', data);
            if (response.isFailure()) {
                return Response.failure(response.data);
            }
            this.contextId = response.toJson()["id"];
            output.info(`Remote Context id: ${this.contextId}`);
        } catch (error) {
            return this.failure(error.response.data.error);
        }

        // Poll context until it is created
        try {
            const uriPath = `api/1.2/contexts/status?clusterId=${this.cluster}&contextId=${this.contextId}`;
            const condition = (value: string) => value === "pending";
            let result = await this.poll(uriPath, this.token, condition, 1000);
            let msg = "";
            if ((result.status === 200) && (result.data.status.toLowerCase() === "running")) {
                msg = `Execution Context created for profile '${this.profile}' and cluster '${this.cluster}'`;
                return this.success(msg);
            } else {
                return this.failure(`Error creating execution context${result.data.status}`);
            }
        } catch (error) {
            return this.failure(error.response.data.error);
        }
    }

    async stop(): Promise<Response> {
        output.info(`Stopping remote context with id: ${this.contextId}: `);
        try {
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId
            };
            await this.post('api/1.2/contexts/destroy', data);
            return this.success("Execution context stopped");
        } catch (error) {
            return this.failure(error.response.data.error);
        }
    }

    async execute(code: string): Promise<Response> {
        try {
            const data = {
                "language": this.language,
                "clusterId": this.cluster,
                "contextId": this.contextId,
                "command": code
            };
            const response = await this.post('api/1.2/commands/execute', data);
            this.commandId = response.toJson()["id"];
        } catch (error) {
            return this.failure(error.response.data.error);
        }

        // Poll command until it is finished
        try {
            const uriPath = `api/1.2/commands/status?clusterId=${this.cluster}&contextId=${this.contextId}&commandId=${this.commandId}`;
            const condition = (value: string) => ["queued", "running", "cancelling"].indexOf(value) !== -1;

            let response = await this.poll(uriPath, this.token, condition, 100) as Json;

            if (response["data"].status === "Finished") {
                let resultType = response["data"]["results"]["resultType"];
                if (resultType === "error") {
                    const out = response["data"]["results"]["cause"];
                    if (out.indexOf("CommandCancelledException") === -1) {
                        output.info(out);
                        return this.failure(out);
                    }
                    return this.warning("Command cancelled");
                } else {
                    if (resultType === "table") {
                        return this.success({
                            "result": {
                                "data": response["data"]["results"]["data"],
                                "schema": response["data"]["results"]["schema"],
                                "type": resultType
                            }
                        });
                    } else {
                        return this.success({
                            "result": {
                                "data": response["data"]["results"]["data"],
                                "type": resultType
                            }
                        });
                    }
                }
            } else if (response["data"].status === "Cancelled") {
                return this.failure("Command execution cancelled");
            } else {
                return this.failure("Command execution failed");
            }
        } catch (error) {
            return this.failure(error.response.data.error);
        }
    }

    async cancel(): Promise<Response> {
        try {
            const data = {
                "clusterId": this.cluster,
                "contextId": this.contextId,
                "commandId": this.commandId
            };
            await this.post('api/1.2/commands/cancel', data);
            return this.success("Command cancelled");
        } catch (error) {
            return this.failure(error.response.data.error);
        }
    }

    private async databaseInfo(sqlCommand: string): Promise<Response> {
        let command = "";
        switch (this.language) {
            case "sql":
                command = sqlCommand;
                break;
            case "python":
                command = `display(spark.sql("${sqlCommand}"))`;
                break;
            case "scala":
                command = `display(spark.sql("${sqlCommand}"))`;
                break;
            default:
                return this.failure(`Language ${this.language} is not supported`);
        }
        return this.execute(command);
    }

    async getDatabases(): Promise<Response> {
        return this.databaseInfo("show databases");
    }

    async getTables(database: string): Promise<Response> {
        return this.databaseInfo(`show tables in ${database}`);
    }

    async getSchema(database: string, table: string): Promise<Response> {
        return this.databaseInfo(`describe ${database}.${table}`);
    }
}