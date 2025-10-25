# Easy View MCP Server

## Overview
Easy View is a read-only MCP server that indexes the directory where it is launched, then exposes search and browsing helpers optimised for low token usage. It is ideal for quickly getting oriented in a local project without mutating files.

## Requirements
- Node.js 18+
- `npm` 9+

## Installation
```bash
npm install
npm run build
```

## Running
- Production build:
  ```bash
  npm start
  ```
- Development workflow:
  ```bash
  npm run dev
  ```

The server uses `process.cwd()` at startup. Start it from the root of the project you want to explore. Indexing skips common large folders (`node_modules`, `.git`, `dist`, `build`, `*.min.*`) and ignores files larger than 50 MB.

## Available Tools
- `scan_directory` – Build or refresh the in-memory index and return aggregate statistics.
- `list_files` – Glob-aware file listing with sorting by name, size, line count, or last modified time.
- `search_files` – Regex search across indexed text files with context lines and result limits.
- `view_file` – Display a slice of a file by range or around a specific line, with safety caps on line counts.
- `analyze_structure` – Summarise directory contents by depth and show extension statistics.
- `find_large_files` – Identify the biggest files above a configurable size threshold.
- `file_info` – Retrieve metadata (size, line counts, last modified) for a single file without streaming contents.

## Tips
- Run `scan_directory` with `refresh: true` after changing files so subsequent requests reuse the latest index.
- Combine `search_files` with `file_pattern` to focus on specific directories or extensions.
