# HTML MCP Server

A comprehensive Model Context Protocol (MCP) server that provides powerful HTML parsing, extraction, and manipulation capabilities. Built with Cheerio and jsDOM for reliable DOM operations.

## Features

### HTML Parsing & Analysis
- **DOM Structure Parsing** - Get basic document structure and element counts
- **Element Selection** - CSS selector-based element matching with attribute extraction
- **Text Extraction** - Extract and clean text content with word/character counting
- **HTML Validation** - Identify missing DOCTYPE, unclosed tags, deprecated elements

### Content Extraction
- **Link Extraction** - Extract and classify links (internal, external, email, phone)
- **Image Extraction** - Extract images with metadata, filter base64 images
- **Metadata Extraction** - Extract title, description, Open Graph, Twitter Card tags
- **Form Extraction** - Extract form structures, fields, and validation attributes
- **Table Extraction** - Parse HTML tables into structured data with headers
- **Heading Extraction** - Extract headings and generate document outline

### HTML Manipulation
- **Element Removal** - Remove elements matching CSS selectors
- **Content Replacement** - Replace text or HTML content of matched elements
- **HTML Minification** - Remove whitespace and comments to reduce file size
- **HTML Prettification** - Format HTML with proper indentation

### Advanced Features
- **File and String Input** - Work with HTML files or direct content strings
- **Attribute Extraction** - Get specific attributes from matched elements
- **Multiple Element Operations** - Process multiple elements at once
- **Error Handling** - Comprehensive error reporting for invalid HTML

## Installation

```bash
# Navigate to the html-mcp directory
cd html-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## Usage

### Running the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "html": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\path\\to\\mcp-servers\\html-mcp\\dist\\server.js"
      ]
    }
  }
}
```

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "html": {
    "command": "node",
    "args": ["C:\\Users\\YourUsername\\path\\to\\mcp-servers\\html-mcp\\dist\\server.js"]
  }
}
```

## Tools Reference

### 1. parse_html

Parse HTML and return basic DOM structure information.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
  "type": "content"
}
```

**Returns:** Title, element count, text content, DOCTYPE presence

---

### 2. select_elements

Select HTML elements using CSS selectors.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, required) - CSS selector to match elements
- `selectorType` (string, optional) - Selector type: "css" (default) or "xpath"
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<div class='content'><p>Hello <span>world</span></p></div>",
  "selector": ".content span",
  "type": "content"
}
```

**Returns:** Matched elements with attributes, text, and HTML

---

### 3. extract_text

Extract text content from HTML.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, optional) - CSS selector to limit extraction
- `includeTags` (boolean, optional) - Include HTML tags in output
- `preserveWhitespace` (boolean, optional) - Preserve original whitespace
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<div><p>Hello  world!</p></div>",
  "selector": "p",
  "preserveWhitespace": false,
  "type": "content"
}
```

**Returns:** Cleaned text with character, word, and line counts

---

### 4. extract_links

Extract all links from HTML with classification.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `includeInternal` (boolean, optional) - Include internal links (default: true)
- `includeExternal` (boolean, optional) - Include external links (default: true)
- `selector` (string, optional) - CSS selector to limit extraction
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<a href='https://example.com'>External</a> <a href='/page'>Internal</a>",
  "includeExternal": true,
  "includeInternal": true,
  "type": "content"
}
```

**Returns:** Classified links with href, text, title, target, and type

---

### 5. extract_images

Extract all images from HTML with metadata.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `includeBase64` (boolean, optional) - Include base64 encoded images
- `selector` (string, optional) - CSS selector to limit extraction
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<img src='image.jpg' alt='Description' width='300' height='200'>",
  "includeBase64": false,
  "type": "content"
}
```

**Returns:** Image metadata with src, alt, dimensions, and type classification

---

### 6. get_attributes

Get attributes from matched elements.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, required) - CSS selector to match elements
- `attributes` (array, optional) - Specific attributes to extract (empty = all)
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<a href='https://example.com' class='link' target='_blank'>Link</a>",
  "selector": "a",
  "attributes": ["href", "class", "target"],
  "type": "content"
}
```

**Returns:** Attribute values for matched elements

---

### 7. validate_html

Validate HTML structure and identify issues.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<html><head></head><body><h1>Test</h1></body></html>",
  "type": "content"
}
```

**Returns:** Issues, warnings, and validation summary with missing DOCTYPE, title, charset

---

### 8. minify_html

Minify HTML by removing whitespace and comments.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<!-- Comment --> <div>   <p>Hello</p>   </div>",
  "type": "content"
}
```

**Returns:** Minified HTML with size reduction statistics

---

### 9. prettify_html

Format HTML with proper indentation.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `indentSize` (number, optional) - Number of spaces for indentation (default: 2)
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<div><p>Hello</p></div>",
  "indentSize": 4,
  "type": "content"
}
```

**Returns:** Formatted HTML with proper indentation

---

### 10. remove_elements

Remove elements matching CSS selector.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, required) - CSS selector for elements to remove
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<div><p>Keep</p> <p class='remove'>Remove</p></div>",
  "selector": ".remove",
  "type": "content"
}
```

**Returns:** Modified HTML with removed elements count

---

### 11. replace_content

Replace content of matched elements.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, required) - CSS selector for elements to modify
- `newContent` (string, required) - New content (HTML tags are parsed, plain text is escaped)
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<div><p>Old content</p></div>",
  "selector": "p",
  "newContent": "<strong>New content</strong>",
  "type": "content"
}
```

**Returns:** Modified HTML with replacement count

---

### 12. extract_metadata

Extract page metadata, Open Graph, and Twitter Card tags.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<head><title>Page Title</title><meta name='description' content='Desc'><meta property='og:title' content='OG Title'></head>",
  "type": "content"
}
```

**Returns:** Standard metadata, Open Graph tags, Twitter Card tags

---

### 13. extract_tables

Extract structured data from HTML tables.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, optional) - CSS selector to limit to specific tables
- `includeHeaders` (boolean, optional) - Include table headers (default: true)
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<table><tr><th>Name</th><th>Age</th></tr><tr><td>John</td><td>25</td></tr></table>",
  "includeHeaders": true,
  "type": "content"
}
```

**Returns:** Structured table data with headers and rows

---

### 14. extract_forms

Extract form fields and structure.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `selector` (string, optional) - CSS selector to limit to specific forms
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<form method='post' action='/submit'><input name='email' type='email' required></form>",
  "type": "content"
}
```

**Returns:** Form structure with action, method, and field details

---

### 15. extract_headings

Extract headings and generate document outline.

**Parameters:**
- `htmlContent` (string, required) - HTML content or file path
- `includeText` (boolean, optional) - Include heading text (default: true)
- `maxLevel` (number, optional) - Maximum heading level (1-6, default: 6)
- `type` (string, optional) - Input type: "content" (default) or "file"

**Example:**
```json
{
  "htmlContent": "<h1>Title</h1><h2>Section 1</h2><h3>Subsection</h3>",
  "includeText": true,
  "maxLevel": 3,
  "type": "content"
}
```

**Returns:** Hierarchical document outline with heading levels

## Common Use Cases

### Web Scraping
Extract structured data from web pages:
```json
{
  "tool": "select_elements",
  "selector": ".product-item",
  "htmlContent": "...", // HTML content
  "type": "content"
}
```

### Content Analysis
Analyze page structure and metadata:
```json
{
  "tool": "extract_metadata",
  "htmlContent": "...",
  "type": "content"
}
```

### Data Extraction
Extract tabular data from websites:
```json
{
  "tool": "extract_tables",
  "htmlContent": "...",
  "includeHeaders": true,
  "type": "content"
}
```

### Link Analysis
Find all external links:
```json
{
  "tool": "extract_links",
  "htmlContent": "...",
  "includeExternal": true,
  "includeInternal": false,
  "type": "content"
}
```

### HTML Cleanup
Remove unwanted elements:
```json
{
  "tool": "remove_elements",
  "htmlContent": "...",
  "selector": ".advertisement, .sidebar",
  "type": "content"
}
```

### Content Modification
Update text content:
```json
{
  "tool": "replace_content",
  "htmlContent": "...",
  "selector": ".price",
  "newContent": "$29.99",
  "type": "content"
}
```

## CSS Selectors Guide

Common CSS selectors used with HTML tools:

**Basic Selectors:**
- `tagname` - All elements with this tag
- `.class` - Elements with this class
- `#id` - Element with this ID

**Attribute Selectors:**
- `[attribute]` - Elements with this attribute
- `[attribute=value]` - Elements with exact attribute value
- `[attribute^=prefix]` - Elements with attribute starting with prefix
- `[attribute$=suffix]` - Elements with attribute ending with suffix

**Combination Selectors:**
- `parent child` - Descendants
- `parent > child` - Direct children
- `element1, element2` - Multiple selectors
- `element1 + element2` - Adjacent siblings

**Pseudo-selectors:**
- `:first-child`, `:last-child`
- `:nth-child(n)`
- `:not(selector)`

## Input Types

### Content Input
Use `"type": "content"` (default) for direct HTML strings:
```json
{
  "htmlContent": "<html><body>Hello</body></html>",
  "type": "content"
}
```

### File Input
Use `"type": "file"` to load HTML from files:
```json
{
  "htmlContent": "C:\\path\\to\\file.html",
  "type": "file"
}
```

## Performance Considerations

1. **Large HTML** - For very large HTML files, consider using specific selectors to limit processing
2. **Result Limits** - Most tools limit results to 100-200 items to prevent memory issues
3. **File vs Content** - File input is faster for large documents
4. **Memory Usage** - Server processes HTML in memory, very large files may cause issues

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Clean build artifacts
npm run clean
```

## Error Handling

The server provides detailed error messages for common issues:
- **Invalid HTML** - Malformed HTML or encoding issues
- **Invalid selectors** - CSS selector syntax errors
- **File not found** - When using file input with non-existent files
- **Memory issues** - Very large HTML files
- **Encoding problems** - Non-UTF8 content

## Limitations

- **XPath support** - Currently only CSS selectors are supported
- **Result limits** - Most extraction tools limit to 100-200 results
- **Memory constraints** - Large HTML files may cause memory issues
- **Dynamic content** - No JavaScript execution support
- **External resources** - No automatic loading of external CSS/JS

## Dependencies

- **cheerio** - Fast, flexible, and lean implementation of core jQuery designed specifically for the server
- **jsdom** - A pure-JavaScript implementation of many web standards, notably the WHATWG DOM and HTML Standards
- **css-select** - CSS selector engine for Node.js

## Troubleshooting

### Common Issues

**Invalid CSS Selector**
- Use valid CSS selector syntax
- Test selectors in browser console first
- Escape special characters

**File Not Found**
- Ensure file paths are correct
- Use double backslashes on Windows: `"C:\\path\\file.html"`
- Check file permissions

**Memory Issues**
- Reduce input HTML size
- Use more specific selectors
- Limit result extraction

**Encoding Problems**
- Ensure HTML files are UTF-8 encoded
- Check for byte order marks (BOM)

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All 15 tools remain functional
- Error handling follows existing patterns
- Documentation is updated for any changes
- CSS selector compatibility is maintained

## Support

For issues related to:
- **This MCP server** - Open an issue in the repository
- **CSS selectors** - See [MDN CSS Selectors Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
- **Cheerio library** - See [Cheerio Documentation](https://cheerio.js.org/)
- **MCP protocol** - See [Model Context Protocol docs](https://modelcontextprotocol.io)

## Credits

Built on:
- [Cheerio](https://cheerio.js.org/) - Fast, flexible, and lean implementation of core jQuery
- [jsdom](https://github.com/jsdom/jsdom) - A pure-JavaScript implementation of web standards
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP TypeScript SDK