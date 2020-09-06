import axios, { AxiosRequestConfig } from 'axios';
import url from 'url';
import * as output from '../databricks/Output';

export interface Json {
    [key: string]: any;
}

export class Response {
    constructor(public status: string, public data: Json | string) { };

    static success(data: Json | string): Response {
        return new Response("success", data);
    }

    static failure(data: Json | string): Response {
        return new Response("error", data);
    }

    static warning(data: Json | string): Response {
        return new Response("warning", data);
    }

    isSuccess(): boolean {
        return this.status === "success";
    }

    isFailure(): boolean {
        return this.status === "error";
    }

    isWarning(): boolean {
        return this.status === "warning";
    }

    toJson(): Json {
        return this.data as Json;
    }

    toString(): string {
        return this.data as string;
    }

}

export class Rest {

    constructor(protected host: string, protected token: string) { }

    private headers(token: string) {
        return {
            headers: {
                "Authorization": `Bearer ${token}`,
                // "User-Agent": `VSCodeDatabricksRun/0.9.0-${os.platform()}`
            }
        };
    };

    private resolve(uriPath: string) {
        return url.resolve(this.host, uriPath);
    }

    async get(uriPath: string): Promise<Response> {
        try {
            const response = await axios.get(this.resolve(uriPath), this.headers(this.token));
            return Promise.resolve(Response.success(response["data"]));
        } catch (error) {
            return Promise.resolve(Response.failure(`${error.response.status}: ${error.response.statusText} (${error.response.data})`));
        }
    }

    async get2(uriPath: string, data: Json): Promise<Response> {
        try {
            let config: AxiosRequestConfig = {
                method: 'get',
                url: this.resolve(uriPath),
                data: data
            };
            config.headers = this.headers(this.token)["headers"];
            const response = await axios(config);
            return Promise.resolve(Response.success(response["data"]));
        } catch (error) {
            return Promise.resolve(Response.failure(error.response.data.error));
        }
    }

    async post(uriPath: string, data: Json): Promise<Response> {
        try {
            const response = await axios.post(this.resolve(uriPath), data, this.headers(this.token));
            return Response.success(response["data"]);
        } catch (error) {
            return Response.failure(error.response.data.error);
        }
    }

    async success(data: Json | string): Promise<Response> {
        return Promise.resolve(Response.success(data));
    }

    async failure(data: Json | string): Promise<Response> {
        return Promise.resolve(Response.failure(data));
    }

    async warning(data: Json | string): Promise<Response> {
        return Promise.resolve(Response.warning(data));
    }

    async poll(
        uriPath: string,
        token: string,
        condition: (value: string) => boolean,
        ms: number) {

        const fn = () => axios.get(this.resolve(uriPath), this.headers(token));
        let response = await fn();
        let progress = false;
        while (condition(response["data"]["status"].toLowerCase())) {
            output.write("»", false);
            progress = true;
            await wait(ms);
            response = await fn();
        }
        if (progress) {
            output.write("\n", false);
        }
        return response;
    }
}

function wait(ms = 100) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}