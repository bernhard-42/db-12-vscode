export function variablesCode(maxlen: number, maxstr: 100) {
    return `
    import inspect
    import itertools
    import json
    import pandas as pd
    import numpy as np
    import pyspark
    from IPython import get_ipython
    from types import ModuleType
    
    
    class __DB_Var_Explorer__:
        maxlen = 10
    
        @staticmethod
        def get_type(t):
            tt = type(t)
            if tt.__module__ == "builtins":
                return tt.__name__
            else:
                return "%s.%s" % (tt.__module__, tt.__name__)
    
        @staticmethod
        def is_leaf(var):
            if type(var).__module__ == "builtins":
                return not isinstance(var, (dict, list, tuple))
            elif np.isscalar(var):
                return True
            else:
                return False
    
        @staticmethod
        def split(variable):
            parts = [v.replace("[", "|[").replace("]", "]|").split("|") for v in variable.split(".")]
            return [e for e in list(itertools.chain(*parts)) if e != ""]
    
        @staticmethod
        def get_value(var):
            if isinstance(var, (list, tuple, np.ndarray, pd.Series)):
                return "(%d elements)" % len(var)
            elif isinstance(var, (pd.DataFrame)):
                return "(%dx%d elements)" % var.shape
            elif (type(var).__module__ == "builtins" or np.isscalar(var)) and not isinstance(var, (dict)):
                result = str(var)
                if len(result) > ${maxstr}:
                    return result[:${maxstr}] + "..."
                else:
                    return result
            else:
                return ""
            
        @staticmethod
        def get_variables():
            from IPython import get_ipython
    
            print(
                json.dumps(
                    {
                        v: {
                            "type": __DB_Var_Explorer__.get_type(t),
                            "value": __DB_Var_Explorer__.get_value(t),
                            "parent": "",
                            "leaf": __DB_Var_Explorer__.is_leaf(t),
                        }
                        for v, t in get_ipython().user_ns.items()
                        if (not v.startswith("_"))
                        and (not v in ["In", "Out"])
                        and (not callable(t))
                        and (not isinstance(t, ModuleType))
                    }
                )
            )
            
        @staticmethod
        def ellipsis(objs):
            ml = __DB_Var_Explorer__.maxlen
            if len(objs) > ml:
                return (objs[:(ml // 2)] + 
                        [("...", "(%d further elements)" % (len(objs) - ml), "")] + 
                        objs[(-ml // 2):])
            else:
                return objs
            
        @staticmethod
        def get_attributes(variable):
            parts = __DB_Var_Explorer__.split(variable)
            var = get_ipython().user_ns[parts[0]]
            for p in parts[1:]:
                if isinstance(var, (list, tuple, dict, np.ndarray)):
                    if p.startswith("("):
                        p = p[1:-1]
                    if isinstance(var, (list, tuple, np.ndarray)):
                        index = int(p)
                    else:
                        index = p
                        if isinstance(index, (str)) and (index.startswith("'") or index.startswith('"')):
                            index = index[1:-1]
                    var = var[index]
                else:
                    var = getattr(var, p)
    
            if isinstance(var, (tuple, list, np.ndarray)):
                ml = __DB_Var_Explorer__.maxlen
                objs = __DB_Var_Explorer__.ellipsis(
                    [("(%d)" % i, v, __DB_Var_Explorer__.get_type(v)) for i, v in enumerate(var)]
                )
            elif isinstance(var, pd.Series):
                objs = __DB_Var_Explorer__.ellipsis(
                    [("(%d)" % i, v, __DB_Var_Explorer__.get_type(v)) for i, v in var.items()]
                )
            elif isinstance(var, dict):
                objs = [(k, v, __DB_Var_Explorer__.get_type(v)) for k, v in var.items()]
            elif isinstance(var, pd.DataFrame):
                objs = [(k, "", v.name) for k, v in var.dtypes.to_dict().items()]
            elif isinstance(var, pyspark.sql.DataFrame):
                objs = [(c.name, "", c.dataType.simpleString()) for c in var.schema.fields]
            elif type(var).__module__ == "builtins":
                objs = [(str(var), var, type(var))]
            elif np.isscalar(var):
                objs = [(str(var), var.item(), "numpy.%s" % type(var).__name__)]
            else:
                objs = [(k, v, __DB_Var_Explorer__.get_type(v)) for k, v in inspect.getmembers(var)]
            print(
                json.dumps(
                    {
                        k: {
                            "type": t,
                            "value":  __DB_Var_Explorer__.get_value(v),
                            "parent": variable,
                            "leaf": __DB_Var_Explorer__.is_leaf(v),
                        }
                        for k, v, t in objs
                        if (not str(k).startswith("_")) and (not callable(v))
                    },
                    indent=2,
                )
            )
`;
}

export function getVariables() {
    return "__DB_Var_Explorer__.get_variables()";
}

export function getAttributes(pythonVar: string) {
    return `__DB_Var_Explorer__.get_attributes("${pythonVar}")`;
}