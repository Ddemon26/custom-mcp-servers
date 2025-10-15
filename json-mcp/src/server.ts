#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { JSONPath } from "jsonpath-plus";
import YAML from "yaml";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import Ajv from "ajv";
// @ts-ignore - json-diff lacks type definitions
import jsonDiff from "json-diff";

// Constants
const JsonTools = {
  FORMAT_JSON: "format_json",
  VALIDATE_JSON: "validate_json",
  JSONPATH_QUERY: "jsonpath_query",
  VALIDATE_SCHEMA: "validate_schema",
  YAML_TO_JSON: "yaml_to_json",
  JSON_TO_YAML: "json_to_yaml",
  XML_TO_JSON: "xml_to_json",
  JSON_TO_XML: "json_to_xml",
  JSON_MERGE: "json_merge",
  JSON_DIFF: "json_diff",
} as const;

// JSON formatting
function formatJson(data: string, indent: number = 2): string {
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed, null, indent);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error}`);
  }
}

// JSON validation
function validateJson(data: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(data);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// JSONPath query
function jsonPathQuery(data: string, path: string): any {
  try {
    const parsed = JSON.parse(data);
    const result = JSONPath({ path, json: parsed });
    return result;
  } catch (error) {
    throw new Error(`JSONPath query failed: ${error}`);
  }
}

// JSON Schema validation
function validateSchema(data: string, schema: string): { valid: boolean; errors?: any } {
  try {
    // Parse data with detailed error
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      throw new Error(`Invalid JSON data: ${e}`);
    }

    // Parse schema with detailed error
    let parsedSchema;
    try {
      parsedSchema = JSON.parse(schema);
    } catch (e) {
      throw new Error(`Invalid JSON schema: ${e}`);
    }

    const ajv = new (Ajv as any)({ allErrors: true });
    const validate = ajv.compile(parsedSchema);
    const valid = validate(parsedData);

    return {
      valid,
      errors: valid ? undefined : validate.errors,
    };
  } catch (error) {
    throw new Error(`Schema validation failed: ${error}`);
  }
}

// YAML to JSON
function yamlToJson(yamlData: string, indent: number = 2): string {
  try {
    // Preprocess: Convert escaped newlines to actual newlines
    const processedYaml = yamlData
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');

    const parsed = YAML.parse(processedYaml);
    return JSON.stringify(parsed, null, indent);
  } catch (error) {
    throw new Error(`YAML parsing failed: ${error}`);
  }
}

// JSON to YAML
function jsonToYaml(jsonData: string): string {
  try {
    const parsed = JSON.parse(jsonData);
    return YAML.stringify(parsed);
  } catch (error) {
    throw new Error(`JSON to YAML conversion failed: ${error}`);
  }
}

// XML to JSON
function xmlToJson(xmlData: string, indent: number = 2): string {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(xmlData);
    return JSON.stringify(parsed, null, indent);
  } catch (error) {
    throw new Error(`XML parsing failed: ${error}`);
  }
}

// JSON to XML
function jsonToXml(jsonData: string, rootName: string = "root"): string {
  try {
    const parsed = JSON.parse(jsonData);
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true,
    });

    // Wrap in root element if not already an object with single key
    const data = typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 1
      ? parsed
      : { [rootName]: parsed };

    return builder.build(data);
  } catch (error) {
    throw new Error(`JSON to XML conversion failed: ${error}`);
  }
}

// JSON merge
function jsonMerge(json1: string, json2: string, indent: number = 2): string {
  try {
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);

    // Deep merge function
    const merge = (target: any, source: any): any => {
      if (Array.isArray(target) && Array.isArray(source)) {
        return [...target, ...source];
      }
      if (typeof target === "object" && typeof source === "object" && target !== null && source !== null) {
        const result = { ...target };
        for (const key in source) {
          if (key in result) {
            result[key] = merge(result[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
        return result;
      }
      return source;
    };

    const merged = merge(obj1, obj2);
    return JSON.stringify(merged, null, indent);
  } catch (error) {
    throw new Error(`JSON merge failed: ${error}`);
  }
}

// JSON diff
function jsonDiffCompare(json1: string, json2: string): string {
  try {
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);

    const differences = jsonDiff.diff(obj1, obj2);
    return JSON.stringify(differences, null, 2);
  } catch (error) {
    throw new Error(`JSON diff failed: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "json-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: JsonTools.FORMAT_JSON,
        description: "Format and prettify JSON with configurable indentation",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string", description: "JSON string to format" },
            indent: { type: "number", description: "Number of spaces for indentation (default: 2)" },
          },
          required: ["data"],
        },
      },
      {
        name: JsonTools.VALIDATE_JSON,
        description: "Validate if a string is valid JSON",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string", description: "String to validate as JSON" },
          },
          required: ["data"],
        },
      },
      {
        name: JsonTools.JSONPATH_QUERY,
        description: "Query JSON data using JSONPath expressions",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string", description: "JSON data to query" },
            path: { type: "string", description: "JSONPath expression (e.g., '$.store.book[*].author')" },
          },
          required: ["data", "path"],
        },
      },
      {
        name: JsonTools.VALIDATE_SCHEMA,
        description: "Validate JSON data against a JSON Schema",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string", description: "JSON data to validate" },
            schema: { type: "string", description: "JSON Schema to validate against" },
          },
          required: ["data", "schema"],
        },
      },
      {
        name: JsonTools.YAML_TO_JSON,
        description: "Convert YAML to JSON",
        inputSchema: {
          type: "object",
          properties: {
            yaml: { type: "string", description: "YAML string to convert" },
            indent: { type: "number", description: "Number of spaces for JSON indentation (default: 2)" },
          },
          required: ["yaml"],
        },
      },
      {
        name: JsonTools.JSON_TO_YAML,
        description: "Convert JSON to YAML",
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string", description: "JSON string to convert" },
          },
          required: ["json"],
        },
      },
      {
        name: JsonTools.XML_TO_JSON,
        description: "Convert XML to JSON",
        inputSchema: {
          type: "object",
          properties: {
            xml: { type: "string", description: "XML string to convert" },
            indent: { type: "number", description: "Number of spaces for JSON indentation (default: 2)" },
          },
          required: ["xml"],
        },
      },
      {
        name: JsonTools.JSON_TO_XML,
        description: "Convert JSON to XML",
        inputSchema: {
          type: "object",
          properties: {
            json: { type: "string", description: "JSON string to convert" },
            rootName: { type: "string", description: "Name of the root XML element (default: 'root')" },
          },
          required: ["json"],
        },
      },
      {
        name: JsonTools.JSON_MERGE,
        description: "Deep merge two JSON objects",
        inputSchema: {
          type: "object",
          properties: {
            json1: { type: "string", description: "First JSON object" },
            json2: { type: "string", description: "Second JSON object (takes precedence)" },
            indent: { type: "number", description: "Number of spaces for indentation (default: 2)" },
          },
          required: ["json1", "json2"],
        },
      },
      {
        name: JsonTools.JSON_DIFF,
        description: "Compare two JSON objects and show differences",
        inputSchema: {
          type: "object",
          properties: {
            json1: { type: "string", description: "First JSON object" },
            json2: { type: "string", description: "Second JSON object" },
          },
          required: ["json1", "json2"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, "Missing arguments");
  }

  try {
    switch (name) {
      case JsonTools.FORMAT_JSON: {
        if (typeof args.data !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "data must be a string");
        }
        const indent = typeof args.indent === "number" ? args.indent : 2;
        const result = formatJson(args.data, indent);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.VALIDATE_JSON: {
        if (typeof args.data !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "data must be a string");
        }
        const result = validateJson(args.data);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case JsonTools.JSONPATH_QUERY: {
        if (typeof args.data !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "data must be a string");
        }
        if (typeof args.path !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "path must be a string");
        }
        const result = jsonPathQuery(args.data, args.path);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case JsonTools.VALIDATE_SCHEMA: {
        if (typeof args.data !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "data must be a string");
        }
        if (typeof args.schema !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "schema must be a string");
        }
        const result = validateSchema(args.data, args.schema);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case JsonTools.YAML_TO_JSON: {
        if (typeof args.yaml !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "yaml must be a string");
        }
        const indent = typeof args.indent === "number" ? args.indent : 2;
        const result = yamlToJson(args.yaml, indent);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.JSON_TO_YAML: {
        if (typeof args.json !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json must be a string");
        }
        const result = jsonToYaml(args.json);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.XML_TO_JSON: {
        if (typeof args.xml !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "xml must be a string");
        }
        const indent = typeof args.indent === "number" ? args.indent : 2;
        const result = xmlToJson(args.xml, indent);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.JSON_TO_XML: {
        if (typeof args.json !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json must be a string");
        }
        const rootName = typeof args.rootName === "string" ? args.rootName : "root";
        const result = jsonToXml(args.json, rootName);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.JSON_MERGE: {
        if (typeof args.json1 !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json1 must be a string");
        }
        if (typeof args.json2 !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json2 must be a string");
        }
        const indent = typeof args.indent === "number" ? args.indent : 2;
        const result = jsonMerge(args.json1, args.json2, indent);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case JsonTools.JSON_DIFF: {
        if (typeof args.json1 !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json1 must be a string");
        }
        if (typeof args.json2 !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "json2 must be a string");
        }
        const result = jsonDiffCompare(args.json1, args.json2);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error}`
    );
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("JSON MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
