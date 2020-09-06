import fs from 'fs';
import url from 'url';
import { Response, Rest } from './Rest';

export class Dbfs extends Rest {

    async upload(source: string, target: string): Promise<Response> {
        // Create
        let size = 500 * 1024;
        let result: Response;
        let handle: number;

        // Open 
        result = await this.post(`api/2.0/dbfs/create`, { "path": target, "overwrite": true });
        if (result.isSuccess()) {
            handle = result.toJson()["handle"];
        } else {
            return Promise.reject(this.failure(result.toString()));
        }

        // Add blocks
        let content = "";
        try {
            content = fs.readFileSync(source).toString('base64');
        } catch (error) {
            return Promise.reject(this.failure(error));
        }

        const numChunks = Math.ceil(content.length / size);
        for (let i = 0, offset = 0; i < numChunks; ++i, offset += size) {
            let chunk = content.substr(offset, size);
            result = await this.post(`api/2.0/dbfs/add-block`, { "handle": handle, "data": chunk });
            if (result.isFailure()) {
                return this.failure(result.data);
            }
        }

        // Close
        result = await this.post(`api/2.0/dbfs/close`, { "handle": handle });
        if (result.isFailure()) {
            return this.failure(result.data);
        }
        return this.success("");
    }

    async exists(path: string): Promise<Response> {
        let uri = url.resolve(this.host, `api/2.0/dbfs/get-status`);
        let result = await this.get2(uri, { "path": path });
        if (result.isFailure()) {
            return this.failure(result.data);
        }
        return this.success(result.data);
    }

    async mkdir(path: string): Promise<Response> {
        let uri = url.resolve(this.host, `api/2.0/dbfs/mkdirs`);
        let result = await this.post(uri, { "path": path });
        if (result.isFailure()) {
            return this.failure(result.data);
        }
        return this.success(result.data);
    }
}