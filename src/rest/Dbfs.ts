import fs from 'fs';
import url from 'url';
import { Json, Response, Rest } from './Rest';

export class Dbfs extends Rest {

    async upload(source: string, target: string): Promise<Response> {
        // Create
        let uri = url.resolve(this.host, `api/2.0/dbfs/create`);
        let size = 500 * 1024;

        let result: Response;
        let handle: number;
        result = await this.post(uri, { "path": target, "overwrite": true });
        if (result.isSuccess()) {
            handle = (result.data as Json)["handle"];
        } else {
            return this.failure(result["data"]);
        }

        // Add blocks
        uri = url.resolve(this.host, `api/2.0/dbfs/add-block`);

        let content = "";
        try {
            content = fs.readFileSync(source).toString('base64');
        } catch (error) {
            return this.failure(error);
        }

        const numChunks = Math.ceil(content.length / size);
        for (let i = 0, offset = 0; i < numChunks; ++i, offset += size) {
            let chunk = content.substr(offset, size);
            result = await this.post(uri, { "handle": handle, "data": chunk });
            if (result.isFailure()) {
                return this.failure(result.data);
            }
        }

        // Close
        uri = url.resolve(this.host, `api/2.0/dbfs/close`);
        result = await this.post(uri, { "handle": handle });
        if (result.isFailure()) {
            return this.failure(result.data);
        }
        return this.success("");
    }

    async exists(path: string): Promise<Response> {
        let uri = url.resolve(this.host, `api/2.0/dbfs/get-status`);
        let result = await this.post(uri, { "path": path });
        if (result.isFailure()) {
            return this.failure(result.data);
        }
        return this.success(result.data);
    }
}