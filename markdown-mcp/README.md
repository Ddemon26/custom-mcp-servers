# Markdown MCP Server

A Model Context Protocol (MCP) server providing comprehensive Markdown processing and transformation capabilities. This server enables AI assistants to parse, validate, format, and extract information from Markdown documents.

## Features

### Core Operations
- **Markdown ↔ HTML**: Bidirectional conversion between Markdown and HTML
- **Format Markdown**: Prettify and standardize Markdown formatting
- **Validate Markdown**: Check syntax and identify common issues

### Content Extraction
- **Extract Headers**: Get all headers with their levels
- **Extract Links**: Extract all links with text, URL, and optional titles
- **Extract Images**: Extract all images with alt text, URLs, and titles
- **Generate TOC**: Automatically create a table of contents from headers

## Installation

```bash
npm install
npm run build
```

## Usage

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "markdown": {
      "command": "node",
      "args": ["/absolute/path/to/markdown-mcp/dist/server.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned this repository.

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "markdown-mcp": {
    "command": "node",
    "args": ["/absolute/path/to/markdown-mcp/dist/server.js"]
  }
}
```

## Available Tools

### markdown_to_html
Convert Markdown to HTML.

**Parameters:**
- `markdown` (string, required): Markdown content to convert

**Returns:** HTML string

### html_to_markdown
Convert HTML to Markdown.

**Parameters:**
- `html` (string, required): HTML content to convert

**Returns:** Markdown string

### format_markdown
Format and prettify Markdown with consistent style.

**Parameters:**
- `markdown` (string, required): Markdown content to format

**Returns:** Formatted Markdown string

**Features:**
- Consistent heading style (ATX with `#`)
- Standardized list formatting
- Fenced code blocks
- Normalized emphasis and strong markers

### extract_headers
Extract all headers from a Markdown document.

**Parameters:**
- `markdown` (string, required): Markdown content to analyze

**Returns:** Array of `{ level: number, text: string }`

**Example output:**
```json
[
  { "level": 1, "text": "Main Title" },
  { "level": 2, "text": "Subtitle" },
  { "level": 3, "text": "Section" }
]
```

### extract_links
Extract all links from a Markdown document.

**Parameters:**
- `markdown` (string, required): Markdown content to analyze

**Returns:** Array of `{ text: string, url: string, title?: string }`

**Example output:**
```json
[
  {
    "text": "Example",
    "url": "https://example.com",
    "title": "Example Website"
  }
]
```

### extract_images
Extract all images from a Markdown document.

**Parameters:**
- `markdown` (string, required): Markdown content to analyze

**Returns:** Array of `{ alt: string, url: string, title?: string }`

**Example output:**
```json
[
  {
    "alt": "Logo",
    "url": "/images/logo.png",
    "title": "Company Logo"
  }
]
```

### extract_toc
Generate a table of contents from Markdown headers.

**Parameters:**
- `markdown` (string, required): Markdown content to analyze
- `maxDepth` (number, optional): Maximum header depth to include (default: 3)

**Returns:** Markdown-formatted table of contents

**Example output:**
```markdown
## Table of Contents

- [Main Title](#main-title)
  - [Subtitle](#subtitle)
    - [Section](#section)
```

### validate_markdown
Validate Markdown syntax and check for common issues.

**Parameters:**
- `markdown` (string, required): Markdown content to validate

**Returns:** `{ valid: boolean, error?: string, warnings?: string[] }`

**Checks:**
- Valid Markdown syntax
- Links without URLs
- Images without URLs or alt text

**Example output:**
```json
{
  "valid": true,
  "warnings": ["Found image without alt text"]
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode with hot reload
npm run dev

# Watch mode
npm run watch

# Clean build artifacts
npm run clean
```

## Dependencies

- `@modelcontextprotocol/sdk`: Core MCP framework
- `marked`: Markdown to HTML conversion
- `turndown`: HTML to Markdown conversion
- `remark`: Markdown processing framework
- `remark-parse`: Markdown parser
- `remark-stringify`: Markdown generator
- `remark-gfm`: GitHub Flavored Markdown support
- `unified`: Text processing framework
- `unist-util-visit`: Syntax tree traversal

## License

MIT
