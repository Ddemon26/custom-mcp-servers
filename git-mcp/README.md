# git-mcp

`git-mcp` is a read-only Model Context Protocol (MCP) server that surfaces Git insights with token-aware responses and structured summaries. It mirrors the layout of the other TypeScript MCP servers in this repository and follows the same build, start, and dev workflow.

## Features
- Token-aware previews and detailed responses that store full command output for follow-up inspection via `git_last_response`.
- Git tooling focused on inspection only—no actions that mutate history (no pull, commit, push, tag, or stash commands).
- Structured summaries for status, branch health, commit history, merge conflicts, and more to help agents reason about repository state.

## Available Tools
- `git_status`: Show repository status using porcelain v2 parsing with staged/unstaged/conflict summaries. Supports optional path filters.
- `git_diff`: Inspect diffs for ranges, staged changes, or path subsets with optional whitespace and context controls plus aggregated change counts.
- `git_log`: Stream recent commits in a structured timeline with author, relative date, and ref decoration filters.
- `git_branch_overview`: Summarise local, remote, or all branches with upstream tracking, ahead/behind counts, and recency sorting.
- `git_show`: Inspect commits, trees, or blobs with optional stats, patches, or path filters.
- `git_blame_segment`: Review annotated ownership for specific file ranges using `git blame --line-porcelain`.
- `git_list_conflicts`: Surface merge conflict metadata derived from `git ls-files -u`.
- `git_last_response`: Retrieve or search the most recently executed command's stored detailed output.

## Development

Install dependencies, build, and run the server:

```bash
npm install
npm run build
npm start
```

For interactive development:

```bash
npm run dev
```

The server communicates over stdio, making it compatible with MCP-compliant clients.
