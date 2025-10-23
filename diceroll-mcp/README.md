# Dice Roll MCP Server

## Overview
The Dice Roll MCP server provides tabletop-friendly dice utilities with guard rails around sides and roll counts. It produces rich summaries (totals, averages) so you can reference results without extra computation.

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
- Development (TypeScript + ts-node):
  ```bash
  npm run dev
  ```

## Available Tools
- `roll_d100` – Roll a 100-sided die one or more times (1–20 rolls).
- `roll_custom_die` – Roll dice with 2–1000 sides, up to 20 dice per request.
- `roll_standard_dice` – Accepts notation such as `3d6` or `1d20` (max 20 dice, 1000 sides).
- `roll_percentile` – Roll percentile dice (00–99) using two d10 rolls.

All tools validate input, enforce sane limits, and return breakdowns showing individual rolls and aggregate statistics.
