export function variablesCode() {
    return `
import inspect
import itertools
import json
import pyspark
import pandas as pd
from IPython import get_ipython
from types import ModuleType


class __DB_Var_Explorer__:
    @staticmethod
    def var_type(t):
        tt = type(t)
        if tt.__module__ == "builtins":
            return tt.__name__
        else:
            return "%s.%s" % (tt.__module__, tt.__name__)

    @staticmethod
    def is_leaf(v):
        if type(v).__module__ == "builtins":
            return not isinstance(v, (dict, list, tuple))
        else:
            return False

    @staticmethod
    def var_split(variable):
        parts = [v.replace("[", "|[").replace("]", "]|").split("|") for v in variable.split(".")]
        return [e for e in list(itertools.chain(*parts)) if e != ""]

    @staticmethod
    def get_variables():
        from IPython import get_ipython

        print(
            json.dumps(
                {
                    v: {
                        "type": __DB_Var_Explorer__.var_type(t),
                        "value": str(t),
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
    def get_attributes(variable):
        parts = __DB_Var_Explorer__.var_split(variable)
        var = get_ipython().user_ns[parts[0]]
        for p in parts[1:]:
            if isinstance(var, (list, tuple, dict)):
                if isinstance(var, (list, tuple)):
                    index = int(p)
                else:
                    index = p
                    if index.startswith("'") or index.startswith('"'):
                        index = index[1:-1]
                var = var[index]
            else:
                var = getattr(var, p)

        if isinstance(var, (tuple, list)):
            objs = [("%s" % v, t) for v, t in enumerate(var)]
        elif isinstance(var, dict):
            objs = var.items()
        elif isinstance(var, pyspark.sql.DataFrame):
            objs = [(c.name, c.dataType.simpleString()) for c in var.schema.fields]
        elif isinstance(var, pd.DataFrame):
            objs = [(k, v.name) for k, v in var.dtypes.to_dict().items()]
        elif type(var).__module__ == "builtins":
            objs = [(str(var), type(var))]
        else:
            objs = inspect.getmembers(var)

        print(
            json.dumps(
                {
                    v: {
                        "type": __DB_Var_Explorer__.var_type(t),
                        "value": str(t),
                        "parent": variable,
                        "leaf": __DB_Var_Explorer__.is_leaf(t),
                    }
                    for v, t in objs
                    if (not v.startswith("_")) and (not callable(t))
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