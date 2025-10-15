# Curl MCP Server

## Overview
The Curl MCP server issues HTTP requests via the system `curl` binary and caches responses so you can inspect them without re-fetching or resending payloads. The design keeps token usage low by storing summaries and exposing specific drill-down tools.

## Requirements
- Node.js 18+
- `npm` 9+
- `curl` available on `PATH`

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
- Fast iteration with TypeScript:
  ```bash
  npm run dev
  ```

Responses are cached in-memory (up to 50 entries). Use `curl_clear` to prune by ID or age when needed.

## Available Tools
- `curl_execute` – Run an HTTP request with optional method, headers, body, timeout, redirect, and TLS options. Returns a response ID for later inspection.
- `curl_list` – Summarise stored responses with filters for method or partial URL matches.
- `curl_show` – Display headers and body for a cached response, with optional line limits.
- `curl_search` – Search across cached response bodies with optional case sensitivity and result limits.
- `curl_clear` – Remove one response (by ID), everything older than a threshold, or the full cache.

## Tips
- Multi-line payloads are passed to `curl` using single quotes; internal single quotes are escaped automatically.
- Errors from `curl` calls are also cached so you can inspect stderr output via `curl_show`.
- Redirects are followed by default. Disable them with `follow_redirects: false` when debugging specific hops.
