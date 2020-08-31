import url from 'url';
import { Json, Response, Rest } from './Rest';

export class Clusters extends Rest {

    async names(): Promise<Response> {
        let clusters: [string, string][] = [];
        const response = await this.list();
        if (response.isSuccess()) {
            const clusterConfig: Json[] = (response.data as Json)["clusters"];
            clusterConfig.forEach(cluster => {
                clusters.push([cluster["cluster_id"], cluster["cluster_name"]]);
            });
            return this.success(clusters);
        } else {
            return this.failure(response["data"]);
        }
    }

    async list(): Promise<Response> {
        const uri = url.resolve(this.host, 'api/2.0/clusters/list');
        return this.get(uri);
    }

    async info(clusterId: string): Promise<Response> {
        const uri = url.resolve(this.host, `api/2.0/clusters/get?cluster_id=${clusterId}`);
        try {
            return this.get(uri);
        } catch (error) {
            return this.failure(error);
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
