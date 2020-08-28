import { execSync } from 'child_process';
import * as output from '../databricks/Output';

export function pipList(python: string): string {
    try {
        return execSync(`${python} -m pip list --format json`).toString();
    } catch (error) {
        output.info(error["stderr"].toString());
        return "";
    };
}

export function pipInstall(python: string, library: string, version?: string): string {
    try {
        if (version) {
            return execSync(`${python} -m pip install --upgrade ${library}==${version}`).toString();
        } else {
            return execSync(`${python} -m pip install --upgrade ${library}`).toString();
        }
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
