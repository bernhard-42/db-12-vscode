import axios from 'axios';
import * as output from '../databricks/DatabricksOutput';

export interface Response {
    [key: string]: any;
}

export function headers(token: string) {
    return { headers: { "Authorization": `Bearer ${token}` } };
};

export async function poll(
    uri: string,
    token: string,
    condition: (value: string) => boolean,
    ms: number) {

    const fn = () => axios.get(uri, headers(token));
    let response = await fn();
    while (condition((response as Response)["data"].status)) {
        output.write("»", false);
        await wait(ms);
        response = await fn();
    }
    output.write("\n", false);
    return response;
}

function wait(ms = 100) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}