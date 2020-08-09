let task = {
    "version": "2.0.0",
    "tasks": [{
        "label": "Zip library",
        "type": "shell",
        "command": "${config:db-12-vscode.zip-command} /tmp/${config:db-12-vscode.lib-folder}.zip ${config:db-12-vscode.lib-folder}/",
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
        "command": "${config:db-12-vscode.databricks-cli} --profile ${config:db-12-vscode.profile} fs cp --overwrite /tmp/${config:db-12-vscode.lib-folder}.zip ${config:db-12-vscode.remote-folder}",
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

export { task };