#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { marked } from "marked";
import TurndownService from "turndown";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

// Constants
const MarkdownTools = {
  MARKDOWN_TO_HTML: "markdown_to_html",
  HTML_TO_MARKDOWN: "html_to_markdown",
  FORMAT_MARKDOWN: "format_markdown",
  EXTRACT_HEADERS: "extract_headers",
  EXTRACT_LINKS: "extract_links",
  EXTRACT_IMAGES: "extract_images",
  EXTRACT_TOC: "extract_toc",
  VALIDATE_MARKDOWN: "validate_markdown",
} as const;

// Markdown to HTML
function markdownToHtml(markdown: string): string {
  try {
    return marked.parse(markdown) as string;
  } catch (error) {
    throw new Error(`Markdown to HTML conversion failed: ${error}`);
  }
}

// HTML to Markdown
function htmlToMarkdown(html: string): string {
  try {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    return turndownService.turndown(html);
  } catch (error) {
    throw new Error(`HTML to Markdown conversion failed: ${error}`);
  }
}

// Format Markdown
async function formatMarkdown(markdown: string): Promise<string> {
  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkStringify)
      .process(markdown);

    return String(result);
  } catch (error) {
    throw new Error(`Markdown formatting failed: ${error}`);
  }
}

// Extract Headers
async function extractHeaders(markdown: string): Promise<Array<{ level: number; text: string; }>> {
  const headers: Array<{ level: number; text: string; }> = [];

  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

    visit(tree, "heading", (node: any) => {
      const text = node.children
        .map((child: any) => {
          if (child.type === "text") return child.value;
          if (child.type === "inlineCode") return child.value;
          return "";
        })
        .join("");

      headers.push({
        level: node.depth,
        text: text.trim(),
      });
    });

    return headers;
  } catch (error) {
    throw new Error(`Header extraction failed: ${error}`);
  }
}

// Extract Links
async function extractLinks(markdown: string): Promise<Array<{ text: string; url: string; title?: string; }>> {
  const links: Array<{ text: string; url: string; title?: string; }> = [];

  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

    visit(tree, "link", (node: any) => {
      const text = node.children
        .map((child: any) => child.value || "")
        .join("");

      links.push({
        text: text.trim(),
        url: node.url,
        title: node.title || undefined,
      });
    });

    return links;
  } catch (error) {
    throw new Error(`Link extraction failed: ${error}`);
  }
}

// Extract Images
async function extractImages(markdown: string): Promise<Array<{ alt: string; url: string; title?: string; }>> {
  const images: Array<{ alt: string; url: string; title?: string; }> = [];

  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

    visit(tree, "image", (node: any) => {
      images.push({
        alt: node.alt || "",
        url: node.url,
        title: node.title || undefined,
      });
    });

    return images;
  } catch (error) {
    throw new Error(`Image extraction failed: ${error}`);
  }
}

// Extract Table of Contents
async function extractToc(markdown: string, maxDepth: number = 3): Promise<string> {
  try {
    const headers = await extractHeaders(markdown);
    const filteredHeaders = headers.filter(h => h.level <= maxDepth);

    let toc = "## Table of Contents\n\n";

    for (const header of filteredHeaders) {
      const indent = "  ".repeat(header.level - 1);
      const anchor = header.text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

      toc += `${indent}- [${header.text}](#${anchor})\n`;
    }

    return toc;
  } catch (error) {
    throw new Error(`TOC extraction failed: ${error}`);
  }
}

// Validate Markdown
async function validateMarkdown(markdown: string): Promise<{ valid: boolean; error?: string; warnings?: string[]; }> {
  try {
    // Try to parse the markdown
    const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

    const warnings: string[] = [];

    // Check for common issues
    visit(tree, "link", (node: any) => {
      if (!node.url) {
        warnings.push("Found link without URL");
      }
    });

    visit(tree, "image", (node: any) => {
      if (!node.url) {
        warnings.push("Found image without URL");
      }
      if (!node.alt) {
        warnings.push("Found image without alt text");
      }
    });

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      error: String(error),
    };
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "markdown-mcp-server",
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
        name: MarkdownTools.MARKDOWN_TO_HTML,
        description: "Convert Markdown to HTML",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to convert" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.HTML_TO_MARKDOWN,
        description: "Convert HTML to Markdown",
        inputSchema: {
          type: "object",
          properties: {
            html: { type: "string", description: "HTML content to convert" },
          },
          required: ["html"],
        },
      },
      {
        name: MarkdownTools.FORMAT_MARKDOWN,
        description: "Format and prettify Markdown with consistent style",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to format" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.EXTRACT_HEADERS,
        description: "Extract all headers from Markdown document",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to analyze" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.EXTRACT_LINKS,
        description: "Extract all links from Markdown document",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to analyze" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.EXTRACT_IMAGES,
        description: "Extract all images from Markdown document",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to analyze" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.EXTRACT_TOC,
        description: "Generate a table of contents from Markdown headers",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to analyze" },
            maxDepth: { type: "number", description: "Maximum header depth to include (default: 3)" },
          },
          required: ["markdown"],
        },
      },
      {
        name: MarkdownTools.VALIDATE_MARKDOWN,
        description: "Validate Markdown syntax and check for common issues",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to validate" },
          },
          required: ["markdown"],
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
      case MarkdownTools.MARKDOWN_TO_HTML: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = markdownToHtml(args.markdown);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case MarkdownTools.HTML_TO_MARKDOWN: {
        if (typeof args.html !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "html must be a string");
        }
        const result = htmlToMarkdown(args.html);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case MarkdownTools.FORMAT_MARKDOWN: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = await formatMarkdown(args.markdown);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case MarkdownTools.EXTRACT_HEADERS: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = await extractHeaders(args.markdown);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case MarkdownTools.EXTRACT_LINKS: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = await extractLinks(args.markdown);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case MarkdownTools.EXTRACT_IMAGES: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = await extractImages(args.markdown);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case MarkdownTools.EXTRACT_TOC: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 3;
        const result = await extractToc(args.markdown, maxDepth);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case MarkdownTools.VALIDATE_MARKDOWN: {
        if (typeof args.markdown !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "markdown must be a string");
        }
        const result = await validateMarkdown(args.markdown);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
  console.error("Markdown MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
