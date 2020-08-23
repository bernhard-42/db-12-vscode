export function tasks() {
    return {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "Zip library",
                "type": "shell",
                "command": "${config:databricks-run.zip-command} /tmp/${config:databricks-run.python-lib-folder}.zip ${config:databricks-run.python-lib-folder}/",
                "windows": {
                    "command": "echo 'NotImplemented'"
                },
                "presentation": {
                    "reveal": "always",
                    "panel": "shared",
                    "clear": true
                },
                "problemMatcher": []
            },
            {
                "label": "Upload library",
                "type": "shell",
                "command": "${config:databricks-run.databricks-cli} --profile ${config:databricks-run.profile} fs cp --overwrite /tmp/${config:databricks-run.python-lib-folder}.zip ${config:databricks-run.remote-work-folder}",
                "windows": {
                    "command": "echo 'NotImplemented'"
                },
                "group": {
                    "kind": "build",
                    "isDefault": true
                },
                "presentation": {
                    "reveal": "always",
                    "panel": "shared"
                },
                "dependsOrder": "sequence",
                "dependsOn": [
                    "Zip library"
                ],
                "problemMatcher": []
            }
        ]
    };
}