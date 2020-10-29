export function experimentsCode() {
    return `
    try:
        import json
        from mlflow.tracking import MlflowClient
        client = MlflowClient()
        exps = [{"id": e.experiment_id, "stage": e.lifecycle_stage, "name": e.name.split("/")[-1]} 
                for e in client.list_experiments()]
        print(json.dumps(exps))
    except:
        print("[]")
    `;
}


export function modelCode() {
    return `
    try:
        import json
        from mlflow.tracking import MlflowClient
        client = MlflowClient()
        exps = [{"name": m.name, "versions": {v.version:v.current_stage for v in client.list_registered_models()[0].latest_versions}} 
                for m in client.list_registered_models()]
        print(json.dumps(exps))
    except:
        print("[]")
    `;
}