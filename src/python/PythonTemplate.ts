export function importCode(remoteFolder: string, libFolder: string) {
    return `
import sys
if not "${remoteFolder}/${libFolder}.zip" in sys.path: sys.path.insert(0, "${remoteFolder}/${libFolder}.zip")
`;
}


