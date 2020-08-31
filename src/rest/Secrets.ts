import { Response, Rest } from './Rest';

export class Secrets extends Rest {

    async listScopes(): Promise<Response> {
        return this.get('api/2.0/secrets/scopes/list');
    }

    async list(scope: string): Promise<Response> {
        return this.get2(`api/2.0/secrets/list`, { "scope": scope });
    }

    async put(scope: string, key: string, value: string): Promise<Response> {
        return this.post(`api/2.0/secrets/list`, {
            "scope": scope,
            "key": key,
            "string_value": value
        });
    }
}
