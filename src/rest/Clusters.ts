import url from 'url';
import axios from 'axios';
import { Response, headers } from './Helpers';

export class Clusters {

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

    async names(): Promise<Response> {
        let clusters: [string, string][] = [];
        const response = await this.list();
        if (response["status"] === "success") {
            const clusterConfig: Response[] = response["data"]["clusters"];
            clusterConfig.forEach(cluster => {
                clusters.push([cluster["cluster_id"], cluster["cluster_name"]]);
            });
            return Promise.resolve({ "status": "success", "data": clusters });
        } else {
            return Promise.resolve({ "status": "error", "data": response["data"] });
        }
    }

    async list(): Promise<Response> {
        const uri = url.resolve(this.host, 'api/2.0/clusters/list');
        return this.get(uri);
    }

    async info(clusterId: string): Promise<Response> {
        const uri = url.resolve(this.host, `api/2.0/clusters/get?cluster_id=${clusterId}`);
        try {
            const response = await axios.get(uri, headers(this.token));
            return Promise.resolve({ "status": "success", "data": response["data"] });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }
    }

    async start(clusterId: string): Promise<Response> {
        const uri = url.resolve(this.host, `api/2.0/clusters/start`);
        return this.post(uri, { "cluster_id": clusterId });
    }

    async stop(clusterId: string): Promise<Response> {
        const uri = url.resolve(this.host, `api/2.0/clusters/delete`);
        return this.post(uri, { "cluster_id": clusterId });
    }

    async restart(clusterId: string): Promise<Response> {
        const uri = url.resolve(this.host, `api/2.0/clusters/restart`);
        return this.post(uri, { "cluster_id": clusterId });
    }
}
