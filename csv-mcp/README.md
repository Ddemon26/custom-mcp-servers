## CSV MCP Server

Utilities for working with comma-separated values inside an MCP-compatible client.

### Features

#### Read Operations
- `parse_csv` – load CSV content (string or file) and preview rows/columns.
- `summarize_csv` – inspect column types, unique counts, and representative samples.
- `filter_csv` – return rows that satisfy a simple comparison against a column.
- `select_columns` – project the dataset onto a specific subset of columns.

#### Write Operations
- `create_csv` – create a new CSV file from an array of objects/JSON.
- `append_rows` – append new rows to an existing CSV file.

#### Edit Operations
- `update_rows` – update rows matching a filter condition.
- `delete_rows` – delete rows matching a filter condition.
- `update_cell` – update specific cell(s) by row index and column name.
- `add_column` – add a new column with optional default value.
- `remove_column` – remove column(s) from a CSV file.
- `sort_csv` – sort rows by column value(s) in ascending or descending order.

### Development
```bash
npm install
npm run build
npm run start
```

### Usage Notes
- For read operations, provide `csv` content directly or reference a local file path.
- For write/edit operations, all file paths must be within the working directory.
- Use `customHeaders` when the data lacks a header row; otherwise the first row is treated as column names.
- Optional `delimiter` parameter allows working with non-comma delimiters (e.g., semicolon, tab).
- Filter operations support: equals, not_equals, contains, starts_with, ends_with, gt, gte, lt, lte.
