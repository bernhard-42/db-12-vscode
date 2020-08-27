import fs from 'fs';
import url from 'url';
import axios from 'axios';
import { Json, headers } from './utils';

export class Dbfs {

    constructor(private host: string, private token: string) { }

    async get(uri: string) {
        try {
            const response = await axios.get(uri, headers(this.token));
            return Promise.resolve({ "status": "success", "data": response["data"] });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }
    }

    async post(uri: string, data: any) {
        try {
            const response = await axios.post(uri, data, headers(this.token));
            return Promise.resolve({ "status": "success", "data": response["data"] });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }
    }

    async upload(source: string, target: string): Promise<Json> {
        // Create
        let uri = url.resolve(this.host, `api/2.0/dbfs/create`);
        let size = 500 * 1024;

        let result: Json;
        let handle: number;
        result = await this.post(uri, { "path": target, "overwrite": true });
        if (result["status"] === "success") {
            handle = result["data"]["handle"];
        } else {
            return Promise.resolve({ "status": "error", "data": result["data"] });
        }

        // Add blocks
        uri = url.resolve(this.host, `api/2.0/dbfs/add-block`);

        let content = "";
        try {
            content = fs.readFileSync(source).toString('base64');
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }

        const numChunks = Math.ceil(content.length / size);
        for (let i = 0, offset = 0; i < numChunks; ++i, offset += size) {
            let chunk = content.substr(offset, size);
            result = await this.post(uri, { "handle": handle, "data": chunk });
            if (result["status"] !== "success") {
                return Promise.resolve({ "status": "error", "data": result["data"] });
            }
        }

        // Close
        uri = url.resolve(this.host, `api/2.0/dbfs/close`);
        result = await this.post(uri, { "handle": handle });
        if (result["status"] !== "success") {
            return Promise.resolve({ "status": "error", "data": result["data"] });
        }
        return Promise.resolve({ "status": "success", "data": "" });
    }

    async exists(path: string): Promise<Json> {
        let uri = url.resolve(this.host, `api/2.0/dbfs/get-status`);
        let result = await this.post(uri, { "path": path });
        if (result["status"] !== "success") {
            return Promise.resolve({ "status": "error", "data": result["data"] });
        }
        return Promise.resolve({ "status": "success", "data": result["data"] });
    }
}