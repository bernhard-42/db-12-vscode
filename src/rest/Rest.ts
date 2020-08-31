import axios from 'axios';
import * as output from '../databricks/Output';
import { Http2ServerResponse } from 'http2';

export interface Json {
    [key: string]: any;
}

export class Response {
    constructor(public status: string, public data: Json | string) { };

    static success(data: Json | string) {
        return new Response("success", data);
    }

    static failure(data: Json | string) {
        return new Response("error", data);
    }

    static warning(data: Json | string) {
        return new Response("warning", data);
    }

    isSuccess() {
        return this.status === "success";
    }
    isFailure() {
        return this.status === "error";
    }
    isWarning() {
        return this.status === "warning";
    }
}

export class Rest {

    constructor(protected host: string, protected token: string) { }

    private headers(token: string) {
        return {
            headers: {
                "Authorization": `Bearer ${token}`,
                // "User-Agent": `VSCodeDatabricksRun/0.9.0`
            }
        };
    };

    async get(uri: string): Promise<Response> {
        try {
            const response = await axios.get(uri, this.headers(this.token));
            return Promise.resolve(Response.success(response["data"]));
        } catch (error) {
            return Promise.resolve(Response.failure(error));
        }
    }

    async post(uri: string, data: Json): Promise<Response> {
        try {
            const response = await axios.post(uri, data, this.headers(this.token));
            return Promise.resolve(Response.success(response["data"]));
        } catch (error) {
            return Promise.resolve(Response.failure(error));
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
        uri: string,
        token: string,
        condition: (value: string) => boolean,
        ms: number) {

        const fn = () => axios.get(uri, this.headers(token));
        let response = await fn();
        let progress = false;
        while (condition(response["data"].status)) {
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