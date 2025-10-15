#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { load } from "cheerio";
import { JSDOM } from "jsdom";
import { readFile, writeFile } from "fs/promises";
import { join, basename } from "path";

// Tool name constants
const HtmlTools = {
  PARSE_HTML: "parse_html",
  SELECT_ELEMENTS: "select_elements",
  EXTRACT_TEXT: "extract_text",
  EXTRACT_LINKS: "extract_links",
  EXTRACT_IMAGES: "extract_images",
  GET_ATTRIBUTES: "get_attributes",
  VALIDATE_HTML: "validate_html",
  MINIFY_HTML: "minify_html",
  PRETTIFY_HTML: "prettify_html",
  REMOVE_ELEMENTS: "remove_elements",
  REPLACE_CONTENT: "replace_content",
  EXTRACT_METADATA: "extract_metadata",
  EXTRACT_TABLES: "extract_tables",
  EXTRACT_FORMS: "extract_forms",
  EXTRACT_HEADINGS: "extract_headings",
} as const;

// Helper function to load HTML from different sources
async function loadHtml(source: string, type: "content" | "file" = "content"): Promise<string> {
  try {
    if (type === "file") {
      return await readFile(source, "utf8");
    }
    return source;
  } catch (error) {
    throw new Error(`Failed to load HTML: ${error}`);
  }
}

// Parse HTML and return DOM structure
async function parseHtml(htmlContent: string, type: "content" | "file" = "content"): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    // Get basic structure information
    const structure = {
      title: $("title").text() || "No title",
      hasDoctype: html.trim().toLowerCase().startsWith("<!doctype"),
      elementCount: $("*").length,
      textContent: $.root().text().substring(0, 500) + ($.root().text().length > 500 ? "..." : ""),
      topLevelTags: $("html > head, html > body").map((_, el) => (el as any).tagName?.toLowerCase() || "unknown").get(),
    };

    return JSON.stringify({
      success: true,
      operation: "parse_html",
      structure,
      message: "✅ HTML parsed successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`HTML parsing failed: ${error}`);
  }
}

// Select elements using CSS selector or XPath
async function selectElements(
  htmlContent: string,
  selector: string,
  selectorType: "css" | "xpath" = "css",
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    let elements: any[] = [];

    if (selectorType === "css") {
      $(selector).each((_, el) => {
        const element = el as any;
        elements.push({
          tagName: element.tagName?.toLowerCase() || "unknown",
          text: $(el).text().trim(),
          html: $.html(el),
          attributes: Object.fromEntries(
            Object.entries(element.attribs || {})
          ),
          className: element.attribs?.class || "",
          id: element.attribs?.id || "",
        });
      });
    } else {
      // For XPath, we'd need additional parsing
      // For now, we'll support CSS selectors which are more commonly used
      throw new Error("XPath selectors not yet supported, please use CSS selectors");
    }

    return JSON.stringify({
      success: true,
      operation: "select_elements",
      selector,
      selectorType,
      elementCount: elements.length,
      elements: elements.slice(0, 100), // Limit results
      message: `✅ Found ${elements.length} elements`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Element selection failed: ${error}`);
  }
}

// Extract text content
async function extractText(
  htmlContent: string,
  options: {
    selector?: string;
    includeTags?: boolean;
    preserveWhitespace?: boolean;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    let text: string;

    if (options.selector) {
      text = $(options.selector).text();
    } else {
      text = $.root().text();
    }

    if (!options.preserveWhitespace) {
      text = text.replace(/\s+/g, " ").trim();
    }

    let result = {
      success: true,
      operation: "extract_text",
      text,
      characterCount: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      lineCount: text.split("\n").length,
      selector: options.selector || "document body",
    };

    if (options.includeTags) {
      const $el = options.selector ? $(options.selector) : $("body");
      result = {
        ...result,
        html: $.html($el),
      } as any;
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(`Text extraction failed: ${error}`);
  }
}

// Extract links
async function extractLinks(
  htmlContent: string,
  options: {
    includeInternal?: boolean;
    includeExternal?: boolean;
    selector?: string;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const baseDomain = new URL($('base').attr('href') || 'http://localhost').hostname;
    const $links = options.selector ? $(options.selector).find('a') : $('a');

    const links: any[] = [];

    $links.each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const text = $(el).text().trim();
      const title = $(el).attr('title') || "";
      const target = $(el).attr('target') || "";

      // Classify link type
      let linkType = "other";
      if (href.startsWith('http://') || href.startsWith('https://')) {
        linkType = "external";
      } else if (href.startsWith('#')) {
        linkType = "anchor";
      } else if (href.startsWith('mailto:')) {
        linkType = "email";
      } else if (href.startsWith('tel:')) {
        linkType = "phone";
      } else {
        linkType = "internal";
      }

      // Filter based on options
      if (!options.includeExternal && linkType === "external") return;
      if (!options.includeInternal && linkType === "internal") return;

      links.push({
        href,
        text,
        title,
        target,
        type: linkType,
        isExternal: href.startsWith('http'),
      });
    });

    return JSON.stringify({
      success: true,
      operation: "extract_links",
      linkCount: links.length,
      links: links.slice(0, 200), // Limit results
      message: `✅ Extracted ${links.length} links`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Link extraction failed: ${error}`);
  }
}

// Extract images
async function extractImages(
  htmlContent: string,
  options: {
    includeBase64?: boolean;
    selector?: string;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const $images = options.selector ? $(options.selector).find('img') : $('img');
    const images: any[] = [];

    $images.each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      const alt = $(el).attr('alt') || "";
      const title = $(el).attr('title') || "";
      const width = $(el).attr('width') || "";
      const height = $(el).attr('height') || "";
      const loading = $(el).attr('loading') || "";

      let imageType = "other";
      if (src.startsWith('http://') || src.startsWith('https://')) {
        imageType = "external";
      } else if (src.startsWith('data:')) {
        imageType = "base64";
      } else if (src.startsWith('//')) {
        imageType = "protocol-relative";
      } else {
        imageType = "relative";
      }

      // Filter base64 images if not requested
      if (!options.includeBase64 && imageType === "base64") return;

      images.push({
        src,
        alt,
        title,
        width,
        height,
        loading,
        type: imageType,
        dimensions: width && height ? `${width}x${height}` : "unknown",
      });
    });

    return JSON.stringify({
      success: true,
      operation: "extract_images",
      imageCount: images.length,
      images: images.slice(0, 200), // Limit results
      message: `✅ Extracted ${images.length} images`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Image extraction failed: ${error}`);
  }
}

// Get attributes from elements
async function getAttributes(
  htmlContent: string,
  selector: string,
  attributes: string[] = [],
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const results: any[] = [];

    $(selector).each((_, el) => {
      const element = $(el);
      const domEl = el as any;
      const attribs: any = {
        tagName: domEl.tagName?.toLowerCase() || "unknown",
      };

      if (attributes.length > 0) {
        attributes.forEach(attr => {
          attribs[attr] = element.attr(attr) || "";
        });
      } else {
        // Get all attributes
        Object.entries(domEl.attribs || {}).forEach(([key, value]) => {
          attribs[key] = value;
        });
      }

      results.push(attribs);
    });

    return JSON.stringify({
      success: true,
      operation: "get_attributes",
      selector,
      elementCount: results.length,
      attributes: results.slice(0, 100), // Limit results
      message: `✅ Extracted attributes from ${results.length} elements`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Attribute extraction failed: ${error}`);
  }
}

// Validate HTML structure
async function validateHtml(
  htmlContent: string,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for DOCTYPE
    if (!html.trim().toLowerCase().startsWith("<!doctype")) {
      warnings.push("Missing DOCTYPE declaration");
    }

    // Check for title
    if (!$("title").length) {
      issues.push("Missing <title> tag");
    }

    // Check for meta charset
    if (!$("meta[charset]").length && !$('meta[http-equiv="content-type"]').length) {
      warnings.push("Missing charset declaration");
    }

    // Check for missing alt attributes on images
    const imagesWithoutAlt = $("img:not([alt])").length;
    if (imagesWithoutAlt > 0) {
      warnings.push(`${imagesWithoutAlt} images missing alt attributes`);
    }

    // Check for unclosed tags (basic check)
    const openTags = html.match(/<([a-z]+)(?![^>]*\/>)/gi) || [];
    const closeTags = html.match(/<\/([a-z]+)>/gi) || [];
    if (openTags.length !== closeTags.length) {
      warnings.push("Possible unclosed HTML tags");
    }

    // Check for deprecated tags
    const deprecatedTags = ["font", "center", "marquee", "blink"];
    deprecatedTags.forEach(tag => {
      if ($(tag).length > 0) {
        warnings.push(`Deprecated tag <${tag}> found`);
      }
    });

    return JSON.stringify({
      success: true,
      operation: "validate_html",
      isValid: issues.length === 0,
      issues,
      warnings,
      summary: {
        totalIssues: issues.length,
        totalWarnings: warnings.length,
        hasErrors: issues.length > 0,
        hasWarnings: warnings.length > 0,
      },
      message: issues.length === 0 ? "✅ HTML is valid" : "❌ HTML has issues",
    }, null, 2);
  } catch (error) {
    throw new Error(`HTML validation failed: ${error}`);
  }
}

// Minify HTML
async function minifyHtml(
  htmlContent: string,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    // Simple minification - remove comments and extra whitespace
    let minified = html
      .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
      .replace(/\s+/g, " ") // Collapse whitespace
      .replace(/>\s+</g, "><") // Remove whitespace between tags
      .trim();

    const originalSize = html.length;
    const minifiedSize = minified.length;
    const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

    return JSON.stringify({
      success: true,
      operation: "minify_html",
      originalSize,
      minifiedSize,
      sizeReduction: `${savings}%`,
      minifiedHtml: minified,
      message: `✅ HTML minified (${savings}% size reduction)`,
    }, null, 2);
  } catch (error) {
    throw new Error(`HTML minification failed: ${error}`);
  }
}

// Prettify HTML
async function prettifyHtml(
  htmlContent: string,
  indentSize: number = 2,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Use browser's built-in formatting
    let prettified = document.documentElement.outerHTML;

    // Simple pretty printing with proper indentation
    const indent = " ".repeat(indentSize);
    const depth = (str: string, currentDepth: number = 0): string => {
      return str
        .replace(/></g, ">\n<")
        .split("\n")
        .map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("</")) {
            currentDepth--;
          }
          const result = indent.repeat(Math.max(0, currentDepth)) + trimmed;
          if (trimmed.startsWith("<") && !trimmed.startsWith("</") && !trimmed.endsWith("/>")) {
            currentDepth++;
          }
          return result;
        })
        .join("\n");
    };

    prettified = depth(prettified);

    return JSON.stringify({
      success: true,
      operation: "prettify_html",
      indentSize,
      prettifiedHtml: prettified,
      message: "✅ HTML prettified successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`HTML prettification failed: ${error}`);
  }
}

// Remove elements
async function removeElements(
  htmlContent: string,
  selector: string,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const $elements = $(selector);
    const count = $elements.length;

    $elements.remove();

    const modifiedHtml = $.html();

    return JSON.stringify({
      success: true,
      operation: "remove_elements",
      selector,
      removedCount: count,
      modifiedHtml,
      message: `✅ Removed ${count} elements`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Element removal failed: ${error}`);
  }
}

// Replace content
async function replaceContent(
  htmlContent: string,
  selector: string,
  newContent: string,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const $elements = $(selector);
    const count = $elements.length;

    if (newContent.startsWith("<") && newContent.endsWith(">")) {
      // Replace with HTML
      $elements.html(newContent);
    } else {
      // Replace with text
      $elements.text(newContent);
    }

    const modifiedHtml = $.html();

    return JSON.stringify({
      success: true,
      operation: "replace_content",
      selector,
      replacedCount: count,
      newContent,
      modifiedHtml,
      message: `✅ Replaced content in ${count} elements`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Content replacement failed: ${error}`);
  }
}

// Extract metadata
async function extractMetadata(
  htmlContent: string,
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const metadata: any = {
      title: $("title").text(),
      description: $('meta[name="description"]').attr("content") || "",
      keywords: $('meta[name="keywords"]').attr("content") || "",
      author: $('meta[name="author"]').attr("content") || "",
      viewport: $('meta[name="viewport"]').attr("content") || "",
      charset: $('meta[charset]').attr("charset") || "",
      canonical: $('link[rel="canonical"]').attr("href") || "",
      language: $("html").attr("lang") || "",
      favicon: $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "",
    };

    // Extract Open Graph tags
    const ogTags: any = {};
    $('meta[property^="og:"]').each((_, el) => {
      const property = $(el).attr("property") || "";
      const content = $(el).attr("content") || "";
      if (property && content) {
        ogTags[property] = content;
      }
    });

    // Extract Twitter Card tags
    const twitterTags: any = {};
    $('meta[name^="twitter:"]').each((_, el) => {
      const name = $(el).attr("name") || "";
      const content = $(el).attr("content") || "";
      if (name && content) {
        twitterTags[name] = content;
      }
    });

    return JSON.stringify({
      success: true,
      operation: "extract_metadata",
      metadata,
      openGraph: ogTags,
      twitterCard: twitterTags,
      message: "✅ Metadata extracted successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Metadata extraction failed: ${error}`);
  }
}

// Extract tables
async function extractTables(
  htmlContent: string,
  options: {
    selector?: string;
    includeHeaders?: boolean;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const $tables = options.selector ? $(options.selector).filter("table") : $("table");
    const tables: any[] = [];

    $tables.each((_, table) => {
      const $table = $(table);
      const tableData: any = {
        id: $table.attr("id") || "",
        class: $table.attr("class") || "",
        rows: [],
      };

      if (options.includeHeaders !== false) {
        const $headers = $table.find("thead tr th, tr:first-child th, tr:first-child td");
        if ($headers.length > 0) {
          tableData.headers = $headers.map((_, el) => $(el).text().trim()).get();
        }
      }

      // Extract data rows
      $table.find("tbody tr, tr").each((_, row) => {
        const $row = $(row);
        const cells = $row.find("td, th").map((_, el) => $(el).text().trim()).get();

        // Skip if this is a header row and we're processing it separately
        if ($row.find("th").length > 0 && options.includeHeaders !== false) {
          return;
        }

        if (cells.length > 0) {
          tableData.rows.push(cells);
        }
      });

      tables.push(tableData);
    });

    return JSON.stringify({
      success: true,
      operation: "extract_tables",
      tableCount: tables.length,
      tables: tables.slice(0, 10), // Limit results
      message: `✅ Extracted ${tables.length} tables`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Table extraction failed: ${error}`);
  }
}

// Extract forms
async function extractForms(
  htmlContent: string,
  options: {
    selector?: string;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const $forms = options.selector ? $(options.selector).filter("form") : $("form");
    const forms: any[] = [];

    $forms.each((_, form) => {
      const $form = $(form);
      const formData: any = {
        id: $form.attr("id") || "",
        class: $form.attr("class") || "",
        action: $form.attr("action") || "",
        method: $form.attr("method") || "GET",
        enctype: $form.attr("enctype") || "",
        fields: [],
      };

      // Extract form fields
      $form.find("input, select, textarea, button").each((_, field) => {
        const $field = $(field);
        const fieldData: any = {
          type: $field.attr("type") || $field.prop("tagName").toLowerCase(),
          name: $field.attr("name") || "",
          id: $field.attr("id") || "",
          value: $field.attr("value") || "",
          placeholder: $field.attr("placeholder") || "",
          required: $field.prop("required") || false,
          disabled: $field.prop("disabled") || false,
        };

        // Add options for select elements
        if ($field.prop("tagName") === "SELECT") {
          fieldData.options = $field.find("option").map((_, option) => ({
            value: $(option).attr("value") || "",
            text: $(option).text().trim(),
            selected: $(option).prop("selected") || false,
          })).get();
        }

        formData.fields.push(fieldData);
      });

      forms.push(formData);
    });

    return JSON.stringify({
      success: true,
      operation: "extract_forms",
      formCount: forms.length,
      forms: forms.slice(0, 10), // Limit results
      message: `✅ Extracted ${forms.length} forms`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Form extraction failed: ${error}`);
  }
}

// Extract headings
async function extractHeadings(
  htmlContent: string,
  options: {
    includeText?: boolean;
    maxLevel?: number;
  } = {},
  type: "content" | "file" = "content"
): Promise<string> {
  try {
    const html = await loadHtml(htmlContent, type);
    const $ = load(html);

    const maxLevel = options.maxLevel || 6;
    let selector = "h1";
    for (let i = 2; i <= maxLevel; i++) {
      selector += `, h${i}`;
    }

    const $headings = $(selector);
    const headings: any[] = [];

    $headings.each((_, heading) => {
      const $heading = $(heading);
      const domHeading = heading as any;
      const headingData: any = {
        level: parseInt(domHeading.tagName?.substring(1) || "1"),
        id: $heading.attr("id") || "",
        class: $heading.attr("class") || "",
      };

      if (options.includeText !== false) {
        headingData.text = $heading.text().trim();
      }

      headings.push(headingData);
    });

    // Generate outline
    const outline: any[] = [];
    headings.forEach(heading => {
      const level = heading.level;
      outline.push({
        level,
        text: heading.text || "",
        id: heading.id || "",
      });
    });

    return JSON.stringify({
      success: true,
      operation: "extract_headings",
      headingCount: headings.length,
      headings,
      outline,
      message: `✅ Extracted ${headings.length} headings`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Heading extraction failed: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "html-mcp-server",
    version: "1.0.0",
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
        name: HtmlTools.PARSE_HTML,
        description: "Parse HTML and return basic DOM structure information",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.SELECT_ELEMENTS,
        description: "Select HTML elements using CSS selectors",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector to match elements",
            },
            selectorType: {
              type: "string",
              description: "Selector type: 'css' (default) or 'xpath'",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent", "selector"],
        },
      },
      {
        name: HtmlTools.EXTRACT_TEXT,
        description: "Extract text content from HTML",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector to limit extraction (optional)",
            },
            includeTags: {
              type: "boolean",
              description: "Include HTML tags in output (default: false)",
            },
            preserveWhitespace: {
              type: "boolean",
              description: "Preserve original whitespace (default: false)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_LINKS,
        description: "Extract all links from HTML with classification",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            includeInternal: {
              type: "boolean",
              description: "Include internal links (default: true)",
            },
            includeExternal: {
              type: "boolean",
              description: "Include external links (default: true)",
            },
            selector: {
              type: "string",
              description: "CSS selector to limit extraction (optional)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_IMAGES,
        description: "Extract all images from HTML with metadata",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            includeBase64: {
              type: "boolean",
              description: "Include base64 encoded images (default: false)",
            },
            selector: {
              type: "string",
              description: "CSS selector to limit extraction (optional)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.GET_ATTRIBUTES,
        description: "Get attributes from matched elements",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector to match elements",
            },
            attributes: {
              type: "array",
              items: { type: "string" },
              description: "Specific attributes to extract (empty array = all attributes)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent", "selector"],
        },
      },
      {
        name: HtmlTools.VALIDATE_HTML,
        description: "Validate HTML structure and identify issues",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.MINIFY_HTML,
        description: "Minify HTML by removing whitespace and comments",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.PRETTIFY_HTML,
        description: "Format HTML with proper indentation",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            indentSize: {
              type: "number",
              description: "Number of spaces for indentation (default: 2)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.REMOVE_ELEMENTS,
        description: "Remove elements matching CSS selector",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector for elements to remove",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent", "selector"],
        },
      },
      {
        name: HtmlTools.REPLACE_CONTENT,
        description: "Replace content of matched elements",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector for elements to modify",
            },
            newContent: {
              type: "string",
              description: "New content (HTML tags are parsed, plain text is escaped)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent", "selector", "newContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_METADATA,
        description: "Extract page metadata, Open Graph, and Twitter Card tags",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_TABLES,
        description: "Extract structured data from HTML tables",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector to limit to specific tables (optional)",
            },
            includeHeaders: {
              type: "boolean",
              description: "Include table headers (default: true)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_FORMS,
        description: "Extract form fields and structure",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            selector: {
              type: "string",
              description: "CSS selector to limit to specific forms (optional)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
        },
      },
      {
        name: HtmlTools.EXTRACT_HEADINGS,
        description: "Extract headings and generate document outline",
        inputSchema: {
          type: "object",
          properties: {
            htmlContent: {
              type: "string",
              description: "HTML content or file path",
            },
            includeText: {
              type: "boolean",
              description: "Include heading text (default: true)",
            },
            maxLevel: {
              type: "number",
              description: "Maximum heading level (1-6, default: 6)",
            },
            type: {
              type: "string",
              description: "Input type: 'content' (default) or 'file'",
            },
          },
          required: ["htmlContent"],
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
      case HtmlTools.PARSE_HTML: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await parseHtml(args.htmlContent, (args.type as "content" | "file") || "content");
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.SELECT_ELEMENTS: {
        if (typeof args.htmlContent !== "string" || typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent and selector must be strings");
        }
        const result = await selectElements(
          args.htmlContent,
          args.selector,
          (args.selectorType as "css" | "xpath") || "css",
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_TEXT: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractText(
          args.htmlContent,
          {
            selector: args.selector as string | undefined,
            includeTags: args.includeTags as boolean | undefined,
            preserveWhitespace: args.preserveWhitespace as boolean | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_LINKS: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractLinks(
          args.htmlContent,
          {
            includeInternal: args.includeInternal as boolean | undefined,
            includeExternal: args.includeExternal as boolean | undefined,
            selector: args.selector as string | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_IMAGES: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractImages(
          args.htmlContent,
          {
            includeBase64: args.includeBase64 as boolean | undefined,
            selector: args.selector as string | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.GET_ATTRIBUTES: {
        if (typeof args.htmlContent !== "string" || typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent and selector must be strings");
        }
        const result = await getAttributes(
          args.htmlContent,
          args.selector,
          args.attributes as string[] || [],
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.VALIDATE_HTML: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await validateHtml(args.htmlContent, (args.type as "content" | "file") || "content");
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.MINIFY_HTML: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await minifyHtml(args.htmlContent, (args.type as "content" | "file") || "content");
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.PRETTIFY_HTML: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await prettifyHtml(
          args.htmlContent,
          (args.indentSize as number) || 2,
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.REMOVE_ELEMENTS: {
        if (typeof args.htmlContent !== "string" || typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent and selector must be strings");
        }
        const result = await removeElements(
          args.htmlContent,
          args.selector,
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.REPLACE_CONTENT: {
        if (typeof args.htmlContent !== "string" || typeof args.selector !== "string" || typeof args.newContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent, selector, and newContent must be strings");
        }
        const result = await replaceContent(
          args.htmlContent,
          args.selector,
          args.newContent,
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_METADATA: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractMetadata(args.htmlContent, (args.type as "content" | "file") || "content");
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_TABLES: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractTables(
          args.htmlContent,
          {
            selector: args.selector as string | undefined,
            includeHeaders: args.includeHeaders as boolean | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_FORMS: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractForms(
          args.htmlContent,
          {
            selector: args.selector as string | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case HtmlTools.EXTRACT_HEADINGS: {
        if (typeof args.htmlContent !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "htmlContent must be a string");
        }
        const result = await extractHeadings(
          args.htmlContent,
          {
            includeText: args.includeText as boolean | undefined,
            maxLevel: args.maxLevel as number | undefined,
          },
          (args.type as "content" | "file") || "content"
        );
        return { content: [{ type: "text", text: result }] };
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
  console.error("HTML MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
