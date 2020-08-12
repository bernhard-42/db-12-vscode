import axios from 'axios';
import { window } from 'vscode';

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

    const output = window.createOutputChannel("Databricks");

    const fn = () => axios.get(uri, headers(token));
    let response = await fn();
    while (condition((response as Response)["data"].status)) {
        output.append("»");
        await wait(ms);
        response = await fn();
    }
    output.append("\n");
    return response;
}

function wait(ms = 100) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}