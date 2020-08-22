import url from 'url';
import axios from 'axios';
import { Response, headers } from './Helpers';

export class Clusters {
    host: string = "";
    token: string = "";

    constructor(host: string, token: string) {
        this.host = host;
        this.token = token;
    }

    async names(): Promise<Response> {
        let clusters: [string, string][] = [];
        const response = await this.list();
        if (response["status"] === "success") {
            const clusterConfig: Response[] = response["data"];
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
        try {
            const response = await axios.get(uri, headers(this.token));
            return Promise.resolve({ "status": "success", "data": response["data"]["clusters"] });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }
    }
}
