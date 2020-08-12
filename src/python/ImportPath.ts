import { Response } from '../rest/Helpers';
import { DatabricksRunOutput } from '../databricks/DatabricksOutput';
import { importCode } from './PythonTemplate';
import { RemoteCommand } from '../rest/RemoteCommand';

export async function setImportPath(remoteFolder: string, libFolder: string, remoteCommand: RemoteCommand) {
    const output = new DatabricksRunOutput();

    const importPath = remoteFolder.replace("dbfs:", "/dbfs");
    const code = importCode(importPath, libFolder);
    output.write("Added import path: " + importPath + "/" + libFolder + ".zip");
    var result = await remoteCommand.execute(code) as Response;
    if (result["status"] === "success") {
        output.write(result["data"]);
    } else {
        output.write(result["data"]);
    }
}