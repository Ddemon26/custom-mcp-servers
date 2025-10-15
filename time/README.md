# Time MCP Server

## Overview
The Time MCP server offers timezone-aware utilities built on Luxon. It delivers precise timestamps, day-of-week labels, DST status, and safe conversions between arbitrary IANA zones while enforcing strict input validation.

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
- Development (ts-node):
  ```bash
  npm run dev
  ```

## Available Tools
- `get_current_time` – Return the current time in the requested IANA timezone, including day-of-week and DST flag.
- `convert_time` – Convert a provided `HH:MM` time from a source timezone to a target timezone and report the offset delta.

Both tools validate timezone inputs using Luxon's `IANAZone` and surface informative MCP errors when validation fails.

## Tips
- Supply explicit timezones even if they match the local machine; the input schema marks them as required.
- `convert_time` assumes the provided time refers to “today” in the source timezone before computing the destination time.
- Errors include `ErrorCode.InvalidParams` when arguments are missing or malformed—propagate these back to your client for easy debugging.
