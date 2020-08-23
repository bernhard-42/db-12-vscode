export function tasks() {
    return {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "Zip library",
                "type": "shell",
                "command": "${config:databricks-run.zip-command} /tmp/${config:databricks-run.python-lib-folder}.zip ${config:databricks-run.python-lib-folder}/",
                "windows": {
                    "command": "${config:databricks-run.zip-command} -Path ${config:databricks-run.python-lib-folder} -DestinationPath C:\\Temp\\${config:databricks-run.python-lib-folder}"
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
                    "command": "${config:databricks-run.databricks-cli} --profile ${config:databricks-run.profile} fs cp --overwrite C:\\Temp//${config:databricks-run.python-lib-folder}.zip ${config:databricks-run.remote-work-folder}"
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