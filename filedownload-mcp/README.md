# File Download MCP Server

## Overview
The File Download MCP server safely persists text or binary payloads under `~/.claude/downloads`. It creates the directory on startup, sanitises filenames to avoid traversal attacks, and offers utilities for managing saved artifacts.

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

Saved files are written to `~/.claude/downloads`. Pass only the desired filename—paths and unsafe characters are automatically stripped.

## Available Tools
- `save_text_file` – Persist UTF-8 text content to a file.
- `save_binary_file` – Write base64 encoded content as binary.
- `list_downloads` – Enumerate current files in the downloads directory.
- `get_downloads_path` – Return the absolute downloads folder path.
- `delete_file` – Remove a downloaded file by name.

## Tips
- `save_text_file` and `save_binary_file` overwrite existing files with the same name.
- Use `list_downloads` before calling `delete_file` to confirm the exact filename on disk.
- All failures return structured error messages; surface them to users when a write is rejected.
