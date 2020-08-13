import { Response } from '../rest/Helpers';
import { DatabricksOutput } from '../databricks/DatabricksOutput';
import { importCode } from './PythonTemplate';
import { RemoteCommand } from '../rest/RemoteCommand';

export async function setImportPath(remoteFolder: string, libFolder: string, remoteCommand: RemoteCommand) {
    const importPath = remoteFolder.replace("dbfs:", "/dbfs");
    const code = importCode(importPath, libFolder);

    var result = await remoteCommand.execute(code) as Response;
    if (result["status"] === "success") {
        DatabricksOutput.write(`Added import path: ${importPath}/${libFolder}.zip`);
    } else {
        DatabricksOutput.write(`Failed to add import path: ${importPath}/${libFolder}.zip`);
    }
}