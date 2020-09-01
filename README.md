# Databricks Run

## Features

- Use Databriocks [Context/Command API](https://docs.databricks.com/dev-tools/api/1.2/index.html#execution-context) to send single lines or selected code block to a remote Databricks cluster
- Supports Python, SQL, Scala and R.
- For Python provides a variable explorer to inspect the variables of the remote cluster in VS Code

## Known Issues

None

## Release Notes

Users appreciate release notes as you update your extension.

### 0.1.0

- Initial release

### 0.2.0

- Added support of libraries
- Refactored to remove API 1.2 references

### 0.3.0

- Removed language as a setting

### 0.9.0

- More explorers (databses, clusters, libraries)
- Configuration is now outside of .vscode
- Complete task build systems