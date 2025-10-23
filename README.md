# Custom MCP Servers

A collection of production-ready Model Context Protocol (MCP) servers written in TypeScript to extend AI coding assistants with reproducible tooling. Every server communicates over stdio and can be registered with any MCP-compliant client (Claude Desktop, CLI agents, IDE integrations) to add focused capabilities without leaking sensitive workspace data.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Integration With MCP Clients](#integration-with-mcp-clients)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview
- Each server is self-contained (its own `package.json`, `src`, and compiled `dist` output) so you can build, deploy, or version them independently.
- Tooling covers HTTP inspection, browser automation, archive management, FFmpeg-powered media editing, ImageMagick-powered image processing, large-scale media downloading via yt-dlp, dice rolling, read-only codebase exploration, controlled file download management, structured data conversions (JSON/YAML/XML), Markdown analysis, Old School RuneScape data lookups, and timezone utilities.
- All servers log operational details to stderr to keep stdout clean for MCP responses.
- Distributed under the MIT license for unrestricted commercial and personal use.


## Prerequisites
- Node.js 18 LTS or newer (ships with npm 9+). Earlier runtimes may lack modern ECMAScript APIs used by `@modelcontextprotocol/sdk`.
- npm (installed with Node) or another Node package manager if you prefer (`pnpm`, `yarn`). Commands below use npm.
- The `curl` command-line client accessible in your `PATH` for the HTTP workbench. Most macOS and Linux distributions include it; on Windows install curl or enable it via Windows features.
- A terminal that supports the scripts you invoke. On Windows, the provided `npm run clean` uses Unix `rm -rf`; either run it from Git Bash/WSL or replace with `Remove-Item -Recurse -Force dist`.
- An MCP-compatible client (for example, Claude Desktop >= v1.5, an IDE with MCP support, or a custom automation harness).

## Quick Start
1. **Clone or open the repository.**
   ```powershell
   git clone https://github.com/Ddemon26/custom-mcp-servers.git
   cd custom-mcp-servers
   ```

2. **Install dependencies.** Run `npm install` inside each server the first time you clone the repo and whenever that server’s `package.json` changes.

3. **Build the TypeScript output.** From the server directory, run `npm run build` before you register it with an MCP client; this generates the `dist/server.js` entry point.

4. **Run a server locally (manual verification).**
   ```powershell
   npm run start
   ```
   The process binds stdio and will wait for requests from an MCP client. Stop with `Ctrl+C` after confirming the build.

5. **(Optional) Use live reload while iterating.**
   ```powershell
   npm run dev
   ```
   `ts-node` starts the server directly from `src/server.ts`, recompiling on each launch. Ideal for debugging before producing a release build.

## Integration With MCP Clients
All servers speak MCP over stdio. You typically register them in your client's configuration so it spawns the process and proxies requests/responses automatically.

1. **Build the server (`npm run build`)** you want to expose.
2. **Add an entry to your MCP client configuration.** Below is a Claude Desktop example for Windows; adapt the paths for macOS (`~/Library/Application Support/Claude/claude_desktop_config.json`) or Linux (`~/.config/Claude/claude_desktop_config.json`).

   ```json
   {
     "mcpServers": {
       "archive-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/archive-mcp/src/server.js"]
       },
       "browser-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/browser-mcp/src/server.js"]
       },
       "curl": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/curl/src/server.js"]
       },
       "dice-roll": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/dice-roll/src/server.js"]
       },
       "easy-view": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/easy-view/src/server.js"]
       },
       "file-download": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/file-download/src/server.js"]
       },
       "ffmpeg-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/ffmpeg-mcp/src/server.js"]
       },
       "yt-dlp-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/yt-dlp-mcp/src/server.js"]
       },
       "html-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/html-mcp/src/server.js"]
       },
       "imagemagick-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/imagemagick-mcp/src/server.js"]
       },
       "json-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/json-mcp/src/server.js"]
       },
       "markdown-mcp": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/markdown-mcp/src/server.js"]
       },
       "osrs-lookup": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/osrs-lookup/src/server.js"]
       },
       "time": {
         "command": "node",
         "args": ["/your/path/to/custom-mcp-servers/time/src/server.js"]
       }
     }
   }
   ```
   - Use forward slashes in JSON to avoid escaping backslashes.
   - Ensure the working directory matches the project root so relative paths (for example, the easy-view index) resolve correctly.
3. **Restart the client** so it reloads the MCP configuration.
4. **Invoke tools by name** inside your client (`navigate`, `create_zip`, `convert_video`, `download_video`, `parse_html`, `resize_image`, `curl_execute`, `roll_d100`, `scan_directory`, `save_text_file`, `format_json`, `markdown_to_html`, `get_current_time`, etc.). The server responses appear in the assistant panel.


## Development Workflow
- Run `npm run dev` for quick experiments; it uses `ts-node` so TypeScript changes take effect immediately (restart the process after edits).
- Run `npm run build` before shipping or registering the server to guarantee the compiled JavaScript is up to date.
- Use `npm run start` to execute the compiled build exactly as the client will run it.
- If you need to clear build artefacts on Windows, run `powershell -Command "Remove-Item dist -Recurse -Force"` instead of `npm run clean`, or install a cross-platform cleaner (e.g., add `rimraf`).
- Type definitions live in `dist/server.d.ts` after building; include them if consuming these servers as libraries elsewhere.

## Troubleshooting
- **`curl_execute` fails with "`curl` is not recognized":** Install curl or add it to the system `PATH`. On Windows, grab the official installer or enable the optional Windows feature.
- **`list_files` or `search_files` return nothing:** Run `scan_directory` first or pass `{ "refresh": true }` if you recently changed the workspace.
- **`view_file` reports "File too large":** The safety cap is 10 MB. Open the file locally or reduce it before requesting the full content.
- **`save_binary_file` throws "Base64 content is required":** Ensure the content string is valid base64 and not JSON-escaped (remove newline characters or wrap in proper JSON).
- **`npm run clean` fails on Windows:** Use PowerShell's `Remove-Item` command or run the script from Git Bash/WSL where `rm` exists.

## License
Released under the [MIT License](LICENSE). You are free to fork, extend, and bundle these servers with your own MCP tooling.
