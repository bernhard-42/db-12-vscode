let explorerCode = `
import inspect
import itertools
import json
from IPython import get_ipython
from types import ModuleType


def __db_type__(t):
    tt = type(t)
    if tt.__module__ == "builtins":
        return tt.__name__
    else:
        return "%s.%s" % (tt.__module__, tt.__name__)


def __db_is_leaf__(v):
    if type(v).__module__ == "builtins":
        return not isinstance(v, (dict, list, tuple))
    else:
        return False


def __db_split__(variable):
    parts = [v.replace("[", "|[").replace("]", "]|").split("|") for v in variable.split(".")]
    return [e for e in list(itertools.chain(*parts)) if e != ""]


def __db_get_variables__():
    from IPython import get_ipython

    print(json.dumps({
        v: {"type": __db_type__(t), "value": str(t), "parent": "", "leaf": __db_is_leaf__(t)}
        for v, t in get_ipython().user_ns.items()
        if (not v.startswith("_")) and 
           (not v in ["In", "Out"]) and 
           (not callable(t)) and 
           (not isinstance(t, ModuleType))}))


def __db_get_attributes__(variable):
    parts = __db_split__(variable)
    var = get_ipython().user_ns[parts[0]]
    for p in parts[1:]:
        if p[0] == "[":
            index = p[1:-1]
            if isinstance(var, (tuple, list)):
                index = int(index)
            if index.startswith("'") or index.startswith('"'):
                index = index[1:-1]
            var = var[index]
        else:
            var = getattr(var, p)

    if isinstance(var, (tuple, list)):
        objs = [("%s" % v, t) for v, t in enumerate(var)]
    elif isinstance(var, dict):
        objs = var.items()
    elif type(var).__module__ == "builtins":
        objs = [(var, type(var))]
    else:
        objs = inspect.getmembers(var)

    print(json.dumps({
        v: {"type": __db_type__(t), "value": str(t), "parent": variable, "leaf": __db_is_leaf__(t)}
        for v, t in objs
        if (not v.startswith("_")) and (not callable(t))
    }))

print("Variable explorer code loaded")
`;

export { explorerCode };
