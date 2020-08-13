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

    async listClusterNames(): Promise<Response> {
        let clusters: string[] = [];
        const uri = url.resolve(this.host, 'api/2.0/clusters/list');
        try {
            const response = await axios.get(uri, headers(this.token));
            const clusterConfig: Response[] = response["data"]["clusters"];
            clusterConfig.forEach(cluster => {
                clusters.push(cluster["cluster_id"]);
            });
            return Promise.resolve({ "status": "success", "data": clusters });
        } catch (error) {
            return Promise.resolve({ "status": "error", "data": error });
        }
    }
}
