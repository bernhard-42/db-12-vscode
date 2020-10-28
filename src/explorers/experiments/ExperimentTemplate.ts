export function experimentsCode() {
    return `
    try:
        import json
        from mlflow.tracking import MlflowClient
        client = MlflowClient()
        exps = [{"id": e.experiment_id, "stage": e.lifecycle_stage, "name":e.name.split("/")[-1]} 
                for e in client.list_experiments()]
        print(json.dumps(exps))
    except:
        print("[]")
    `;
}
