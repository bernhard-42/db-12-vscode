export function watchCode(outfile: string) {
    return `
import os
import shutil

class __DB_Watch__:
    _print_builtin = print
    _outfile = None
    _tempfile = None

    @staticmethod
    def init(outfile):
        __DB_Watch__._outfile = outfile
        __DB_Watch__._tempfile = f"/tmp/{os.path.basename(outfile)}"
        __DB_Watch__.clear()
    
    @staticmethod
    def print_file(*args, **kwargs):
        with open(__DB_Watch__._tempfile, "a") as out:
            __DB_Watch__._print_builtin(*args, **dict(kwargs, **{"file": out, "flush": True}))
        shutil.copy(__DB_Watch__._tempfile, __DB_Watch__._outfile)
        os.sync()
    
    @staticmethod
    def watch():
        if __DB_Watch__._outfile is None:
            return __DB_Watch__._print_builtin
        else:
            __DB_Watch__.clear()
            return __DB_Watch__.print_file

    @staticmethod
    def clear():
        try:
            os.unlink(__DB_Watch__._tempfile)
            os.unlink(__DB_Watch__._outfile)
        except:
            pass
        os.sync()

    @staticmethod
    def unwatch():
        return __DB_Watch__._print_builtin

__DB_Watch__.init("${outfile}")    
`;
}