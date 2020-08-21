import { Response } from '../rest/Helpers';
import * as output from '../databricks/DatabricksOutput';
import { importCode } from './PythonTemplate';
import { RemoteCommand } from '../rest/RemoteCommand';

export async function setImportPath(remoteFolder: string, libFolder: string, remoteCommand: RemoteCommand) {
    const importPath = remoteFolder.replace("dbfs:", "/dbfs");
    const code = importCode(importPath, libFolder);

    var result = await remoteCommand.execute(code) as Response;
    if (result["status"] === "success") {
        output.info(`Added import path: ${importPath}/${libFolder}.zip`);
    } else {
        output.info(`Failed to add import path: ${importPath}/${libFolder}.zip`);
    }
}