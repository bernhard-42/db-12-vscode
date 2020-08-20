import { execSync } from 'child_process';
import * as output from '../databricks/DatabricksOutput';

export function pipList(python: string): string {
    try {
        return execSync(`${python} -m pip list --format json`).toString();
    } catch (error) {
        output.write(error["stderr"].toString());
        return "";
    };
}
