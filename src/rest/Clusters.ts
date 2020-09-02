import { Json, Response, Rest } from './Rest';

export class Clusters extends Rest {

    async names(): Promise<Response> {
        let clusters: [string, string, string][] = [];
        const response = await this.list();
        if (response.isSuccess()) {
            const clusterConfig: Json[] = response.toJson()["clusters"];
            clusterConfig.forEach(cluster => {
                clusters.push([cluster["cluster_id"], cluster["cluster_name"], cluster["state"]]);
            });
            return this.success(clusters);
        } else {
            return this.failure(response.toString());
        }
    }

    async list(): Promise<Response> {
        return this.get('api/2.0/clusters/list');
    }

    async info(clusterId: string): Promise<Response> {
        try {
            return this.get(`api/2.0/clusters/get?cluster_id=${clusterId}`);
        } catch (error) {
            return this.failure(error);
        }
    }

    async start(clusterId: string): Promise<Response> {
        return this.post(`api/2.0/clusters/start`, { "cluster_id": clusterId });
    }

    async stop(clusterId: string): Promise<Response> {
        return this.post(`api/2.0/clusters/delete`, { "cluster_id": clusterId });
    }

    async restart(clusterId: string): Promise<Response> {
        return this.post(`api/2.0/clusters/restart`, { "cluster_id": clusterId });
    }
}
