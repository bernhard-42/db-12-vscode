export function watchCode(outfile: string) {
    return `
import os
import shutil
import sys
from hashlib import md5

class __DB_Watch__:
    redirect = None
    outfile = None
    tmpfile = None
    stdout = sys.stdout
    stderr = sys.stderr
    
    class Redirect:
        def __init__(self):
            self.stdout = sys.stdout
            self.stderr = sys.stderr
            sys.stdout = self
            sys.stderr = self

        def close(self):
            sys.stdout = __DB_Watch__.stdout
            sys.stderr = __DB_Watch__.stderr
            self.stdout = None
            self.stderr = None
            
        def write(self, data):
            #
            # This is really heavyweight:
            # We have to write and flush to local disk, then copy over to dbfs and then flush again
            # Otherwise the latest message will not be on dbfs
            # Use only when really necessary!!!
            #
            with open(__DB_Watch__.tmpfile, "a") as out:
                out.write(data)
                out.flush()
            shutil.copy(__DB_Watch__.tmpfile, __DB_Watch__.outfile)
            os.sync()
        
        def flush(self):
            self.stdout.flush()

    @staticmethod
    def init(outfile):
        m = md5()
        m.update(outfile.encode("utf-8"))
        __DB_Watch__.outfile = outfile
        __DB_Watch__.tmpfile = "/tmp/" + m.hexdigest()
        __DB_Watch__.clear()
            
    @staticmethod
    def reset():
        sys.stdout = __DB_Watch__.stdout
        sys.stderr = __DB_Watch__.stderr
    
    @staticmethod
    def clear():
        try:
            os.unlink(__DB_Watch__.tmpfile)
            os.unlink(__DB_Watch__.outfile)
        except:
            pass
        os.sync()

    @staticmethod
    def watch():
        __DB_Watch__.redirect = __DB_Watch__.Redirect()

    @staticmethod
    def unwatch():
        __DB_Watch__.reset()
        __DB_Watch__.clear()

__DB_Watch__.init("${outfile}") 
`;
}
