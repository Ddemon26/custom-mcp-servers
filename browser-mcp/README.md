# Browser MCP Server

A Model Context Protocol (MCP) server for browser automation using Puppeteer. Enables web scraping, automated testing, screenshots, PDF generation, and general browser automation tasks.

## Features

### Navigation & Interaction
- **Navigate**: Load web pages with configurable wait conditions
- **Click**: Click elements by CSS selector
- **Type**: Type text into input fields with customizable delay
- **Fill Forms**: Automatically fill multiple form fields
- **Wait for Selector**: Wait for elements to appear

### Data Extraction
- **Get HTML**: Extract HTML content from page or specific elements
- **Get Text**: Extract text content from page or specific elements
- **Extract Data**: Extract structured data using CSS selectors
- **Execute Scripts**: Run custom JavaScript in page context

### Content Capture
- **Screenshots**: Capture full page, viewport, or specific elements
- **PDF Generation**: Generate PDFs of web pages
- **Cookies**: Get and set cookies

### Browser Management
- Persistent browser instance for efficient operation
- Automatic cleanup on exit
- Headless mode for server environments

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
    "browser": {
      "command": "node",
      "args": ["/absolute/path/to/browser-mcp/dist/server.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned this repository.

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "browser-mcp": {
    "command": "node",
    "args": ["/absolute/path/to/browser-mcp/dist/server.js"]
  }
}
```

## Available Tools

### navigate
Navigate to a URL and wait for page load.

**Parameters:**
- `url` (string, required): URL to navigate to
- `waitUntil` (string, optional): When to consider navigation complete
  - `"load"` - Wait for load event
  - `"domcontentloaded"` - Wait for DOMContentLoaded event
  - `"networkidle0"` - Wait until no network connections for 500ms
  - `"networkidle2"` - Wait until ≤2 network connections for 500ms (default)

**Example:**
```json
{
  "url": "https://example.com",
  "waitUntil": "networkidle2"
}
```

### screenshot
Take a screenshot of the page or a specific element.

**Parameters:**
- `fullPage` (boolean, optional): Capture full scrollable page (default: true)
- `selector` (string, optional): CSS selector of element to screenshot
- `path` (string, optional): File path to save screenshot (returns base64 if not provided)

**Example:**
```json
{
  "fullPage": true,
  "path": "./screenshots/example.png"
}
```

**Element screenshot:**
```json
{
  "selector": ".main-content",
  "path": "./screenshots/content.png"
}
```

### get_html
Get HTML content of the page or a specific element.

**Parameters:**
- `selector` (string, optional): CSS selector of element (returns full page HTML if not provided)

**Example:**
```json
{
  "selector": "article.post"
}
```

### get_text
Get text content of the page or a specific element.

**Parameters:**
- `selector` (string, optional): CSS selector of element (returns full page text if not provided)

**Example:**
```json
{
  "selector": "h1.title"
}
```

### click
Click an element on the page.

**Parameters:**
- `selector` (string, required): CSS selector of element to click
- `waitForNavigation` (boolean, optional): Wait for navigation after click (default: false)

**Example:**
```json
{
  "selector": "button#submit",
  "waitForNavigation": true
}
```

### type
Type text into an input element.

**Parameters:**
- `selector` (string, required): CSS selector of input element
- `text` (string, required): Text to type
- `delay` (number, optional): Delay between keystrokes in ms (default: 0)
- `clear` (boolean, optional): Clear existing text before typing (default: true)

**Example:**
```json
{
  "selector": "input[name='username']",
  "text": "myusername",
  "delay": 50
}
```

### evaluate
Execute JavaScript in the page context.

**Parameters:**
- `script` (string, required): JavaScript code to execute

**Example:**
```json
{
  "script": "document.querySelectorAll('a').length"
}
```

**Complex example:**
```json
{
  "script": "Array.from(document.querySelectorAll('h2')).map(h => h.textContent)"
}
```

### wait_for_selector
Wait for an element to appear on the page.

**Parameters:**
- `selector` (string, required): CSS selector to wait for
- `timeout` (number, optional): Maximum wait time in ms (default: 30000)

**Example:**
```json
{
  "selector": ".dynamic-content",
  "timeout": 10000
}
```

### pdf
Generate a PDF of the current page.

**Parameters:**
- `path` (string, required): File path to save PDF
- `fullPage` (boolean, optional): Generate PDF of full page (default: true)

**Example:**
```json
{
  "path": "./documents/page.pdf",
  "fullPage": true
}
```

### get_cookies
Get cookies from the current page.

**Parameters:**
- `url` (string, optional): URL to get cookies for

**Example:**
```json
{
  "url": "https://example.com"
}
```

### set_cookies
Set cookies for the current page.

**Parameters:**
- `cookies` (string, required): JSON string of cookie objects array

**Example:**
```json
{
  "cookies": "[{\"name\":\"session\",\"value\":\"abc123\",\"domain\":\".example.com\",\"path\":\"/\"}]"
}
```

### extract_data
Extract structured data from the page using CSS selectors.

**Parameters:**
- `selectors` (string, required): JSON object mapping field names to CSS selectors

**Example:**
```json
{
  "selectors": "{\"title\":\"h1.post-title\",\"author\":\".author-name\",\"tags\":\".tag\"}"
}
```

**Returns:**
```json
{
  "title": "Example Post Title",
  "author": "John Doe",
  "tags": ["javascript", "web", "tutorial"]
}
```

### fill_form
Fill out a form with multiple fields and optionally submit.

**Parameters:**
- `fields` (string, required): JSON object mapping selectors to values
- `submitSelector` (string, optional): CSS selector of submit button

**Example:**
```json
{
  "fields": "{\"input[name='email']\":\"user@example.com\",\"input[name='password']\":\"password123\"}",
  "submitSelector": "button[type='submit']"
}
```

### close_browser
Close the browser and clean up resources.

**Example:**
```json
{}
```

## Use Cases

### Web Scraping
```javascript
// Navigate to a page
navigate({ url: "https://example.com/products" })

// Extract product data
extract_data({
  selectors: JSON.stringify({
    productName: "h1.product-title",
    price: ".price",
    description: ".description",
    reviews: ".review-text"
  })
})
```

### Automated Testing
```javascript
// Navigate to login page
navigate({ url: "https://app.example.com/login" })

// Fill and submit login form
fill_form({
  fields: JSON.stringify({
    "#email": "test@example.com",
    "#password": "testpass123"
  }),
  submitSelector: "button[type='submit']"
})

// Wait for dashboard
wait_for_selector({ selector: ".dashboard" })

// Take screenshot
screenshot({ path: "./test-results/logged-in.png" })
```

### Content Capture
```javascript
// Navigate to article
navigate({ url: "https://blog.example.com/article" })

// Generate PDF
pdf({ path: "./articles/saved-article.pdf" })

// Take screenshot
screenshot({
  selector: "article.main-content",
  path: "./screenshots/article.png"
})
```

### Dynamic Content Extraction
```javascript
// Navigate to page with dynamic content
navigate({ url: "https://example.com/dynamic" })

// Wait for content to load
wait_for_selector({ selector: ".loaded-content" })

// Execute custom script to get data
evaluate({
  script: `
    Array.from(document.querySelectorAll('.item')).map(item => ({
      title: item.querySelector('.title').textContent,
      price: item.querySelector('.price').textContent
    }))
  `
})
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

## Important Notes

### Browser Lifecycle
- The browser instance persists between tool calls for efficiency
- Use `close_browser` when you're done to free resources
- Browser automatically closes on server shutdown

### Headless Mode
- Server runs in headless mode by default (no visible browser window)
- Optimized for server environments and automation

### Selectors
- All selectors use standard CSS selector syntax
- Wait for dynamic content with `wait_for_selector` before interacting
- Use specific selectors to avoid ambiguity

### Screenshots
- Base64 encoding when no path is provided
- PNG format for all screenshots
- Full page screenshots may be large for long pages

## Dependencies

- `@modelcontextprotocol/sdk`: Core MCP framework
- `puppeteer`: Headless Chrome browser automation

## License

MIT
