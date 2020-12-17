# Databricks Run

Use Databricks [Context/Command API](https://docs.databricks.com/dev-tools/api/1.2/index.html#execution-context) to send single lines or selected code block to a remote Databricks cluster directly from VS Code - plus a bunch of tools to provide info about the remote cluster in your local VS Code.

## Features

- Supports Python, SQL, Scala and R (R more experimental).
- It provides a **Cluster Explorer** where all connectd clusters are visible and can started/restarted/stopped
- It provides a **Database Explorer** where all databases and their schema can be browsed. Databse, table and column names can be pasted into the current file with a click
- For Python provides:
    - **%pip** support to install "notebook scoped" libraries
    - A **Variable Explorer** to inspect the variables of the remote cluster in VS Code. Pandas and Spark dataframe columns can be pasted into the current file with a click
    - A **Library Explorer** to see installed libraries on the cluster and compare version with the local environment. With a single click, library version of the cluster can be installed locally. Additinally a `env.yaml` file can be created to replicate a remote cluster environment locally
    - a table view of dataframes via `display`
    - a web view for plotly graphics via `displayHTML`


## How to start

- Download and install the extension [./build/databricks-run-0.9.1.vsix](build/databricks-run-0.9.1.vsix) in VS Code.

- For authentication it uses `~/databrickscfg`. Either you have Databricks CLI already installed or you create an ini file of form

    ```bash
    [dev]
    host = https://dev.cloud.databricks.com
    token = dapi

    [prod]
    host = https://prod.cloud.databricks.com
    token = dapi
    ```

Databricks Run for VS Code comes with four commands (cmd-shift-P or ctrl-shift-P):

- **Databricks Run: Initialize a Databricks Connection** (*cmd-k shift-I*)
    This will create an execution context for the current file (needs to be py, sql, scala or r)

- **Databricks Run: Send selection or line** (*cmd-k shift-enter*)
    This will send the current line or the selection to the execution context created for this file

- **Databricks Run: Cancel the currently running command** (*cmd-k shift-I*)
    This will cancel a long running command on the Databricks cluster (e.g. a SPark job)

- **Databricks Run: Stop the Databricks Connection** (*cmd-k shift-S*)
    This will finally close the execution context for the current file

Start with *cmd-k shift-I* and switch to the Databricks Run view!


## Known Issues

None

## Release Notes

- **0.1.0**
    - Initial release
- **0.2.0**
    - Added support of libraries
    - Refactored to remove API 1.2 references
- **0.3.0**
    - Removed language as a setting
- **0.9.0**
    - More explorers (databases, clusters, libraries)
    - Configuration is now outside of .vscode
    - Complete task build systems
- **0.9.2**
    - Added watch feature
- **0.9.3**
    - New MLflow experiments browser for MLflow tracking server
- **0.9.4**
    - MLflow browser now also supports models of the MLflow model registry
- **0.9.5**
    - Added Link to Spark UI
    - Magics #%pip and #%sh
    - Support cmd-K ctrl-k (or ctrl-k ctrl-k on windows) to send block between "# --" markers
    - When clicking on centext, both, code and terminal are getting focus
