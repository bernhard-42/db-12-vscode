import { execSync } from 'child_process';
import * as output from '../databricks/DatabricksOutput';

export function pipList(python: string): string {
    try {
        return execSync(`${python} -m pip list --format json`).toString();
    } catch (error) {
        output.info(error["stderr"].toString());
        return "";
    };
}

export function pythonVersion(python: string): string {
    try {
        return execSync(`${python} --version`).toString();
    } catch (error) {
        output.info(error["stderr"].toString());
        return "";
    };
}