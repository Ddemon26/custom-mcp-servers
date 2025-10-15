# JSON MCP Server

A Model Context Protocol (MCP) server providing comprehensive JSON, YAML, and XML processing capabilities. This server enables AI assistants to validate, transform, query, and manipulate structured data formats.

## Features

### JSON Operations
- **Format JSON**: Prettify JSON with configurable indentation
- **Validate JSON**: Check if a string is valid JSON
- **JSONPath Query**: Query JSON data using JSONPath expressions
- **JSON Schema Validation**: Validate JSON against JSON Schema
- **JSON Merge**: Deep merge two JSON objects
- **JSON Diff**: Compare two JSON objects and show differences

### Format Conversion
- **YAML ↔ JSON**: Bidirectional conversion between YAML and JSON
- **XML ↔ JSON**: Bidirectional conversion between XML and JSON

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
    "json": {
      "command": "node",
      "args": ["/absolute/path/to/json-mcp/dist/server.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned this repository.

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "json-mcp": {
    "command": "node",
    "args": ["/absolute/path/to/json-mcp/dist/server.js"]
  }
}
```

## Available Tools

### format_json
Format and prettify JSON with configurable indentation.

**Parameters:**
- `data` (string, required): JSON string to format
- `indent` (number, optional): Number of spaces for indentation (default: 2)

### validate_json
Validate if a string is valid JSON.

**Parameters:**
- `data` (string, required): String to validate as JSON

**Returns:** `{ valid: boolean, error?: string }`

### jsonpath_query
Query JSON data using JSONPath expressions.

**Parameters:**
- `data` (string, required): JSON data to query
- `path` (string, required): JSONPath expression (e.g., `$.store.book[*].author`)

**Example:**
```json
{
  "data": "{\"store\":{\"book\":[{\"author\":\"John\"},{\"author\":\"Jane\"}]}}",
  "path": "$.store.book[*].author"
}
```

### validate_schema
Validate JSON data against a JSON Schema.

**Parameters:**
- `data` (string, required): JSON data to validate
- `schema` (string, required): JSON Schema to validate against

**Returns:** `{ valid: boolean, errors?: array }`

### yaml_to_json
Convert YAML to JSON.

**Parameters:**
- `yaml` (string, required): YAML string to convert
- `indent` (number, optional): Number of spaces for JSON indentation (default: 2)

### json_to_yaml
Convert JSON to YAML.

**Parameters:**
- `json` (string, required): JSON string to convert

### xml_to_json
Convert XML to JSON.

**Parameters:**
- `xml` (string, required): XML string to convert
- `indent` (number, optional): Number of spaces for JSON indentation (default: 2)

### json_to_xml
Convert JSON to XML.

**Parameters:**
- `json` (string, required): JSON string to convert
- `rootName` (string, optional): Name of the root XML element (default: 'root')

### json_merge
Deep merge two JSON objects.

**Parameters:**
- `json1` (string, required): First JSON object
- `json2` (string, required): Second JSON object (takes precedence)
- `indent` (number, optional): Number of spaces for indentation (default: 2)

### json_diff
Compare two JSON objects and show differences.

**Parameters:**
- `json1` (string, required): First JSON object
- `json2` (string, required): Second JSON object

**Returns:** JSON object showing the differences

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
- `jsonpath-plus`: JSONPath query support
- `yaml`: YAML parsing and stringification
- `fast-xml-parser`: XML parsing and building
- `ajv`: JSON Schema validation
- `json-diff`: JSON comparison

## License

MIT
