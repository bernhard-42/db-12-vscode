export function buildWheelTask() {
    return {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "Databricks Run: Create wheel",
                "type": "shell",
                "command": "python setup.py bdist_wheel",
                "windows": {
                    "command": "python.exe setup.py bdist_wheel"
                },
                "presentation": {
                    "reveal": "always",
                    "panel": "shared",
                    "clear": true
                },
                "problemMatcher": []
            },
            {
                "label": "Databricks Run: Create and upload wheel",
                "type": "shell",
                "command": "echo 'Create and upload wheel done'",
                "presentation": {
                    "reveal": "always",
                    "panel": "shared",
                    "clear": false
                },
                "group": {
                    "kind": "build",
                    "isDefault": true
                },
                "problemMatcher": [],
                "dependsOrder": "sequence",
                "dependsOn": [
                    "Databricks Run: Create wheel",
                    "Databricks Run: Upload wheel",
                    "Databricks Run: Restart",
                    "Databricks Run: Remote Install"
                ]
            }
        ]
    };
}