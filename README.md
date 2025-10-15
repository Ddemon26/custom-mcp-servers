# Custom MCP Servers

A collection of production-ready Model Context Protocol (MCP) servers written in TypeScript to extend AI coding assistants with reproducible tooling. Every server communicates over stdio and can be registered with any MCP-compliant client (Claude Desktop, CLI agents, IDE integrations) to add focused capabilities without leaking sensitive workspace data.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Integration With MCP Clients](#integration-with-mcp-clients)
- [Server Reference](#server-reference)
  - [archive-mcp - Archive Utilities](#archive-mcp--archive-utilities)
  - [browser-mcp - Headless Browser Automation](#browser-mcp--headless-browser-automation)
  - [curl - HTTP Request Workbench](#curl--http-request-workbench)
  - [dice-roll - Gaming Dice Simulator](#dice-roll--gaming-dice-simulator)
  - [easy-view - Read-Only Workspace Explorer](#easy-view--read-only-workspace-explorer)
  - [file-download - Persistent Download Sink](#file-download--persistent-download-sink)
  - [json-mcp - Structured Data Toolkit](#json-mcp--structured-data-toolkit)
  - [markdown-mcp - Markdown Utilities](#markdown-mcp--markdown-utilities)
  - [osrs-lookup - Old School RuneScape Lookup](#osrs-lookup--old-school-runescape-lookup)
  - [time - Time Zone Utilities](#time--time-zone-utilities)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview
- Each server is self-contained (its own `package.json`, `src`, and compiled `dist` output) so you can build, deploy, or version them independently.
- Tooling covers HTTP inspection, browser automation, archive management, dice rolling, read-only codebase exploration, controlled file download management, structured data conversions (JSON/YAML/XML), Markdown analysis, Old School RuneScape data lookups, and timezone utilities.
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

2. **Install dependencies per server.** Each server is an independent Node project.
   ```bash
   for dir in archive-mcp browser-mcp curl dice-roll easy-view file-download json-mcp markdown-mcp osrs-lookup time; do
     (cd "$dir" && npm install)
   done
   ```
   Rerun the loop whenever `package.json` files change.

3. **Build the TypeScript once per server.**
   ```bash
   for dir in archive-mcp browser-mcp curl dice-roll easy-view file-download json-mcp markdown-mcp osrs-lookup time; do
     (cd "$dir" && npm run build)
   done
   ```
   Each build emits `dist/server.js`, which is the entry point you register with MCP clients.

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
4. **Invoke tools by name** inside your client (`navigate`, `create_zip`, `curl_execute`, `roll_d100`, `scan_directory`, `save_text_file`, `format_json`, `markdown_to_html`, `get_current_time`, etc.). The server responses appear in the assistant panel.

## Server Reference

### archive-mcp - Archive Utilities
- **Path:** `archive-mcp/`
- **Purpose:** Create and extract ZIP/TAR/TAR.GZ archives plus gzip individual files.
- **Key behaviours:**
  - Ensures destination folders exist before writing archives or compressed files.
  - Accepts JSON-encoded path arrays for multi-source operations so assistants can build inputs dynamically.
  - Supports `stripComponents` for tar-based extraction to drop leading directory levels.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `create_zip` | Create a ZIP archive from files/directories. | `sources` (JSON string array), `outputPath` (string) | `compressionLevel` (`9`) |
| `create_tar` | Build an uncompressed TAR archive. | `sources` (JSON string array), `outputPath` (string) | None |
| `create_targz` | Build a gzip-compressed TAR archive. | `sources` (JSON string array), `outputPath` (string) | None |
| `extract` | Extract ZIP/TAR/TAR.GZ into a directory. | `archivePath` (string), `outputDir` (string) | `stripComponents` (`0`) |
| `list_contents` | List archive entries without extracting. | `archivePath` (string) | None |
| `compress_file` | Gzip a single file. | `inputPath` (string) | `outputPath` (string) |
| `decompress_file` | Gunzip a file. | `inputPath` (string) | `outputPath` (string) |

**Usage tips**
- Provide absolute paths when possible; relative inputs resolve from the server’s working directory.
- Encode `sources` as `JSON.stringify([...])` before passing to keep argument schemas simple.
- Extraction overwrites existing files—target empty temp directories when unsure.

### browser-mcp - Headless Browser Automation
- **Path:** `browser-mcp/`
- **Purpose:** Drive a headless Chromium instance for navigation, scraping, and capture tasks.
- **Key behaviours:**
  - Reuses a single Puppeteer browser/page between calls for performance; call `close_browser` to reset.
  - Launches with `--no-sandbox` flags for compatibility with CI and container environments.
  - Returns screenshots as base64 when no path is supplied, avoiding filesystem writes by default.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `navigate` | Load a URL and wait for completion. | `url` (string) | `waitUntil` (`networkidle2`) |
| `screenshot` | Capture page or element image. | None | `fullPage` (`true`), `selector`, `path` |
| `get_html` | Return HTML markup. | None | `selector` |
| `get_text` | Return text content. | None | `selector` |
| `click` | Click an element. | `selector` (string) | `waitForNavigation` (`false`) |
| `type` | Type into an input/textarea. | `selector` (string), `text` (string) | `delay` (`0`), `clear` (`true`) |
| `evaluate` | Run JavaScript in page context. | `script` (string) | None |
| `wait_for_selector` | Wait for an element to appear. | `selector` (string) | `timeout` (`30000`) |
| `pdf` | Save the current page as PDF. | `path` (string) | `fullPage` (`true`) |
| `get_cookies` | Retrieve cookies. | None | `url` |
| `set_cookies` | Set cookies on the current page. | `cookies` (JSON string array) | None |
| `extract_data` | Pull structured data via CSS selectors. | `selectors` (JSON string object) | None |
| `fill_form` | Fill multiple fields and optionally submit. | `fields` (JSON string object) | `submitSelector` |
| `close_browser` | Close the active browser instance. | None | None |

**Usage tips**
- Call `navigate` before other actions to guarantee the page exists.
- Pass JSON strings (e.g., `JSON.stringify({ "#email": "user@example.com" })`) for `fields`, `selectors`, and `cookies`.
- Use `wait_for_selector` between navigation and extraction to ensure dynamic content is present.

### curl - HTTP Request Workbench
- **Path:** `curl/`
- **Purpose:** Issue HTTP requests with the system `curl` binary, capture responses once, and explore them without spending additional model tokens.
- **Key behaviours:**
  - Stores up to 50 responses in memory with metadata (status, headers, body preview). Oldest entries are pruned automatically.
  - Errors returned by `curl` (certificate errors, timeouts, DNS failures) are captured as synthetic responses so you can review failure details.
  - Adds `-s -i` flags to minimise progress output and include response headers automatically.
  - Supports request bodies (`-d`) for POST/PUT/PATCH with shell-safe quoting.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `curl_execute` | Execute an HTTP request via the local `curl` binary and cache the response. | `url` | `method` (`GET`), `headers` (object of `header: value`), `data`, `timeout` (seconds, default `30`), `follow_redirects` (`true`), `insecure` (`false`) |
| `curl_list` | Summarise recently cached responses. | None | `limit` (`10`), `filter_method`, `filter_url_contains` |
| `curl_show` | Return full details for a cached response. | `id` | `show_body` (`true`), `body_lines` (`50`, use `0` for complete body), `show_headers` (`true`) |
| `curl_search` | Search cached response bodies. | `query` | `case_sensitive` (`false`), `max_results` (`20`) |
| `curl_clear` | Remove cached responses. | None | `id`, `older_than_hours` |

**Usage tips**
- `curl_list` shows truncated IDs (first 8 characters); pass the full UUID to `curl_show` or `curl_clear`.
- Set `body_lines: 0` when calling `curl_show` to stream the whole payload if you are comfortable with the token cost.
- Provide headers as a JSON object (for example, `{ "Authorization": "Bearer <token>" }`).
- If you see `curl` command errors, verify the executable is in your `PATH` or supply absolute URLs.

### dice-roll - Gaming Dice Simulator
- **Path:** `dice-roll/`
- **Purpose:** Provide predictable, validated dice rolls for tabletop or gaming scenarios.
- **Key behaviours:**
  - Validates side counts (2-1000) and roll counts (1-20) to stop runaway requests.
  - Uses Node's `Math.random`, which is fine for casual use but not cryptographically secure.
  - Formats output with total, individual rolls, and percentile support (00-99 by rolling two d10s).

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `roll_d100` | Roll a 100-sided die one or more times. | None | `count` (string, `"1"`, accepts `1`-`20`) |
| `roll_custom_die` | Roll a die with a custom number of sides. | None | `sides` (string, default `"6"`, accepts `2`-`1000`), `count` (string, default `"1"`, accepts `1`-`20`) |
| `roll_standard_dice` | Parse standard notation (`XdY`) and roll accordingly. | None | `dice_notation` (string, default `"1d6"`, supports up to 20 dice and 1000 sides) |
| `roll_percentile` | Roll percentile dice (00-99). | None | None |

**Usage tips**
- Arguments are parsed as strings to match typical MCP payloads; whitespace is trimmed automatically.
- The server logs rolls to stderr (useful when debugging or auditing results).
- Because randomness uses `Math.random`, do not rely on it for security-critical scenarios.

### easy-view - Read-Only Workspace Explorer
- **Path:** `easy-view/`
- **Purpose:** Safely inspect files in the current working directory (the directory where the MCP client starts the server) without editing anything.
- **Key behaviours:**
  - Builds an index of the workspace using `fast-glob`, skipping heavy directories (`node_modules`, `.git`, `dist`, `build`, minified assets) and files larger than 50 MB.
  - Caches the index between calls; invoke `scan_directory` with `refresh: true` after large changes.
  - Treats a wide range of extensions as text to provide line counts; binary files are still listed but lines are set to `0`.
  - `view_file` protects against massive outputs by limiting files to 10 MB and lines to 2000 per request.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `scan_directory` | Build or refresh the in-memory file index. | None | `refresh` (`false`) |
| `list_files` | List indexed files with filtering and sorting. | None | `pattern` (`"*"` glob), `sort_by` (`"name"`, `"size"`, `"lines"`, `"modified"`), `limit` (`50`, max `200`), `min_size`, `max_size` |
| `search_files` | Search file content using a regular expression. | `pattern` | `file_pattern` (`"*"`), `case_sensitive` (`false`), `context_lines` (`2`, max `5`), `max_results` (`100`, cap `500`), `max_line_length` (`200`, cap `1000`) |
| `view_file` | Stream file contents with smart windowing. | `file_path` | `start_line` (`1`), `end_line` (optional), `max_lines` (`500`, cap `2000`), `around_line`, `context_size` (`25`, cap `100`) |
| `analyze_structure` | Summarise directories and extensions. | None | `depth` (`3`), `show_extensions` (`true`) |
| `find_large_files` | Locate the largest files in the index. | None | `limit` (`20`, cap `50`), `min_size` (`1024` bytes) |
| `file_info` | Inspect file metadata without loading content. | `file_path` | None |

**Usage tips**
- Always run `scan_directory` once per session to prime the index; other tools will call it lazily if needed.
- Patterns for `list_files` and `search_files` accept simple wildcards (`*`, `?`); they are converted to regular expressions internally.
- `view_file` highlights the `around_line` with a marker so you can quickly spot the target line in context.
- If you add or delete large numbers of files, run `scan_directory` with `refresh: true` to keep stats accurate.

### file-download - Persistent Download Sink
- **Path:** `file-download/`
- **Purpose:** Provide a safe place for MCP assistants to persist generated files to the user's machine under `~/.claude/downloads`.
- **Key behaviours:**
  - Creates the downloads directory lazily (`~/.claude/downloads`) and reuses it across sessions. On Windows this resolves to `%USERPROFILE%\.claude\downloads`.
  - Sanitises filenames to block path traversal, reserved characters, and leading dots before writing.
  - Supports both UTF-8 text saves and arbitrary binary blobs supplied as base64.
  - Offers listing and deletion helpers so the assistant can manage its outputs explicitly.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `save_text_file` | Write a UTF-8 text file. | `filename`, `content` | None |
| `save_binary_file` | Write a binary file from base64. | `filename`, `content` (base64 string) | None |
| `list_downloads` | Enumerate files and directories in the download folder. | None | None |
| `get_downloads_path` | Return the absolute path to the download folder. | None | None |
| `delete_file` | Remove a file from the download folder. | `filename` | None |

**Usage tips**
- Supply only the intended filename; directories are not permitted and will be flattened during sanitisation.
- `save_binary_file` rejects invalid base64 strings - validate data before sending.
- Use `list_downloads` to confirm the file landed as expected before instructing a user to open it.

### json-mcp - Structured Data Toolkit
- **Path:** `json-mcp/`
- **Purpose:** Validate, query, and transform structured data across JSON, YAML, and XML formats.
- **Key behaviours:**
  - Uses Ajv for JSON Schema validation and returns detailed error metadata.
  - Supports JSONPath queries plus bidirectional conversions between JSON, YAML, and XML.
  - Provides diff and deep-merge helpers for comparing or combining payloads safely.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `format_json` | Prettify JSON with configurable indentation. | `data` (string) | `indent` (`2`) |
| `validate_json` | Check whether a string parses as JSON. | `data` (string) | None |
| `jsonpath_query` | Execute a JSONPath expression against JSON text. | `data` (string), `path` (string) | None |
| `validate_schema` | Validate JSON data against a JSON Schema. | `data` (string), `schema` (string) | None |
| `yaml_to_json` | Convert YAML to JSON. | `yaml` (string) | `indent` (`2`) |
| `json_to_yaml` | Convert JSON to YAML. | `json` (string) | None |
| `xml_to_json` | Convert XML to JSON. | `xml` (string) | `indent` (`2`) |
| `json_to_xml` | Convert JSON to formatted XML. | `json` (string) | `rootName` (`"root"`) |
| `json_merge` | Deep merge two JSON objects. | `json1` (string), `json2` (string) | `indent` (`2`) |
| `json_diff` | Report differences between JSON objects. | `json1` (string), `json2` (string) | None |

**Usage tips**
- Supply compact JSON strings; the server handles parsing before formatting.
- When validating schemas, provide both the instance and schema as JSON strings.
- `json_diff` returns `null` when documents match exactly—treat that as "no differences".

### markdown-mcp - Markdown Utilities
- **Path:** `markdown-mcp/`
- **Purpose:** Convert, format, and extract structure from Markdown documents.
- **Key behaviours:**
  - Leverages `marked`, `turndown`, and the Remark ecosystem for reliable Markdown ↔ HTML conversions.
  - Normalises headings, lists, code fences, and emphasis for consistent formatting output.
  - Surfaces document structure by extracting headings, links, images, and table-of-contents markdown.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `markdown_to_html` | Render Markdown to HTML. | `markdown` (string) | None |
| `html_to_markdown` | Convert HTML back to Markdown. | `html` (string) | None |
| `format_markdown` | Reformat Markdown with standard conventions. | `markdown` (string) | None |
| `extract_headers` | List headings with their levels. | `markdown` (string) | None |
| `extract_links` | Enumerate links found in the document. | `markdown` (string) | None |
| `extract_images` | Enumerate images with alt text. | `markdown` (string) | None |
| `extract_toc` | Generate a Markdown table of contents. | `markdown` (string) | `maxDepth` (`3`) |
| `validate_markdown` | Check syntax and highlight common issues. | `markdown` (string) | None |

**Usage tips**
- `extract_toc` filters headings deeper than `maxDepth`; raise it when you need full depth.
- Formatting preserves GitHub Flavoured Markdown extensions (tables, strikethrough, task lists).
- Validation warnings include missing URLs or alt text—surface them to users for cleanup.

### osrs-lookup - Old School RuneScape Lookup
- **Path:** `osrs-lookup/`
- **Purpose:** Query Old School RuneScape (OSRS) public APIs for Grand Exchange and player highscore data directly from an assistant session.
- **Key behaviours:**
  - Wraps the official OSRS endpoints for item categories, item search, detailed listings, price history, and player highscores.
  - Normalises request parameters and validates required inputs (for example, `item_id` and `player_name`) before calling the APIs.
  - Returns structured JSON with parsed values (current price, daily averages, skill ranks) so assistants can reason about the results without additional parsing.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `ge_category` | List item counts by starting letter for a Grand Exchange category. | None | `category` (`1` for OSRS by default) |
| `ge_item_detail` | Retrieve detailed price and trend information for a specific item. | `item_id` (number) | None |
| `ge_items_search` | Page through catalogue items filtered by category and starting letter. | `alpha` (string) | `category` (`1`), `page` (`1`) |
| `ge_price_graph` | Fetch 180-day price history data for charting or analysis. | `item_id` (number) | None |
| `player_highscore` | Fetch a player's skill levels, experience, and activity ranks. | `player_name` (string) | None |

**Usage tips**
- URL-encode player names before passing them if they contain spaces; the server takes care of the rest.
- Use `ge_category` first to discover available item IDs, then drill down with `ge_item_detail` or `ge_price_graph`.
- Highscore lookups require exact display names; check spelling if you see `HTTP 404` responses.

### time - Time Zone Utilities
- **Path:** `time/`
- **Purpose:** Fetch current times or convert between timezones using IANA zone names.
- **Key behaviours:**
  - Detects the host timezone via `Intl` and validates all inputs against the IANA database.
  - Uses Luxon to respect daylight-saving boundaries when performing conversions.
  - Returns structured metadata including day of week and DST state for both source and target zones.

| Tool | Purpose | Required arguments | Optional arguments / defaults |
| ---- | ------- | ------------------ | ----------------------------- |
| `get_current_time` | Return the current time in a timezone. | `timezone` (string) | None |
| `convert_time` | Translate a HH:MM timestamp between zones. | `source_timezone` (string), `time` (string), `target_timezone` (string) | None |

**Usage tips**
- Provide 24-hour `HH:MM` inputs for conversions; seconds default to `00`.
- Use canonical IANA names such as `America/New_York`—abbreviations like `EST` are rejected.
- The conversion response includes the offset delta (e.g., `+5h`) for quick reference.

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
