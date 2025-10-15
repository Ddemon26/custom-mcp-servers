#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";

// Constants
const BrowserTools = {
  NAVIGATE: "navigate",
  SCREENSHOT: "screenshot",
  GET_HTML: "get_html",
  GET_TEXT: "get_text",
  CLICK: "click",
  TYPE: "type",
  EVALUATE: "evaluate",
  WAIT_FOR_SELECTOR: "wait_for_selector",
  PDF: "pdf",
  GET_COOKIES: "get_cookies",
  SET_COOKIES: "set_cookies",
  EXTRACT_DATA: "extract_data",
  FILL_FORM: "fill_form",
  CLOSE_BROWSER: "close_browser",
} as const;

// Browser management
let browser: Browser | null = null;
let currentPage: Page | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function getPage(): Promise<Page> {
  if (!currentPage || currentPage.isClosed()) {
    const br = await getBrowser();
    currentPage = await br.newPage();
  }
  return currentPage;
}

async function closeBrowser(): Promise<void> {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.close();
    currentPage = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Browser operations
async function navigate(url: string, waitUntil: string = "networkidle2"): Promise<string> {
  try {
    const page = await getPage();
    const validWaitOptions = ["load", "domcontentloaded", "networkidle0", "networkidle2"];
    const wait = validWaitOptions.includes(waitUntil) ? waitUntil as any : "networkidle2";

    await page.goto(url, { waitUntil: wait });
    const title = await page.title();
    const finalUrl = page.url();

    return JSON.stringify({
      success: true,
      url: finalUrl,
      title: title,
    }, null, 2);
  } catch (error) {
    throw new Error(`Navigation failed: ${error}`);
  }
}

async function takeScreenshot(
  fullPage: boolean = true,
  selector?: string,
  path?: string
): Promise<string> {
  try {
    const page = await getPage();

    const options: any = {
      encoding: "base64",
      fullPage: selector ? false : fullPage,
    };

    if (path) {
      options.path = path;
    }

    let screenshot: string;
    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      screenshot = await element.screenshot(options) as string;
    } else {
      screenshot = await page.screenshot(options) as string;
    }

    return JSON.stringify({
      success: true,
      screenshot: path ? undefined : screenshot,
      path: path,
      message: path ? `Screenshot saved to ${path}` : "Screenshot captured as base64",
    }, null, 2);
  } catch (error) {
    throw new Error(`Screenshot failed: ${error}`);
  }
}

async function getHtml(selector?: string): Promise<string> {
  try {
    const page = await getPage();

    let html: string;
    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      html = await page.evaluate(el => el.outerHTML, element);
    } else {
      html = await page.content();
    }

    return html;
  } catch (error) {
    throw new Error(`Getting HTML failed: ${error}`);
  }
}

async function getText(selector?: string): Promise<string> {
  try {
    const page = await getPage();

    let text: string;
    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      text = await page.evaluate(el => el.textContent || '', element);
    } else {
      text = await page.evaluate(() => document.body.textContent || '');
    }

    return text.trim();
  } catch (error) {
    throw new Error(`Getting text failed: ${error}`);
  }
}

async function clickElement(selector: string, waitForNavigation: boolean = false): Promise<string> {
  try {
    const page = await getPage();

    await page.waitForSelector(selector, { timeout: 10000 });

    if (waitForNavigation) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        page.click(selector),
      ]);
    } else {
      await page.click(selector);
    }

    return JSON.stringify({
      success: true,
      message: `Clicked element: ${selector}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Click failed: ${error}`);
  }
}

async function typeText(
  selector: string,
  text: string,
  delay: number = 0,
  clear: boolean = true
): Promise<string> {
  try {
    const page = await getPage();

    await page.waitForSelector(selector, { timeout: 10000 });

    if (clear) {
      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press('Backspace');
    }

    await page.type(selector, text, { delay });

    return JSON.stringify({
      success: true,
      message: `Typed into element: ${selector}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Typing failed: ${error}`);
  }
}

async function evaluateScript(script: string): Promise<any> {
  try {
    const page = await getPage();
    const result = await page.evaluate((script) => {
      // eslint-disable-next-line no-eval
      return eval(script);
    }, script);

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(`Script evaluation failed: ${error}`);
  }
}

async function waitForSelector(selector: string, timeout: number = 30000): Promise<string> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout });

    return JSON.stringify({
      success: true,
      message: `Element found: ${selector}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Wait for selector failed: ${error}`);
  }
}

async function generatePdf(path: string, fullPage: boolean = true): Promise<string> {
  try {
    const page = await getPage();

    await page.pdf({
      path,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    return JSON.stringify({
      success: true,
      path,
      message: `PDF saved to ${path}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`PDF generation failed: ${error}`);
  }
}

async function getCookies(url?: string): Promise<string> {
  try {
    const page = await getPage();
    const cookies = url ? await page.cookies(url) : await page.cookies();

    return JSON.stringify(cookies, null, 2);
  } catch (error) {
    throw new Error(`Getting cookies failed: ${error}`);
  }
}

async function setCookies(cookies: any[]): Promise<string> {
  try {
    const page = await getPage();
    await page.setCookie(...cookies);

    return JSON.stringify({
      success: true,
      message: `Set ${cookies.length} cookie(s)`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Setting cookies failed: ${error}`);
  }
}

async function extractData(selectors: Record<string, string>): Promise<string> {
  try {
    const page = await getPage();

    const data: Record<string, any> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const elements = await page.$$(selector);
        if (elements.length === 1) {
          data[key] = await page.evaluate(el => el.textContent?.trim() || '', elements[0]);
        } else if (elements.length > 1) {
          data[key] = await Promise.all(
            elements.map(el => page.evaluate(e => e.textContent?.trim() || '', el))
          );
        } else {
          data[key] = null;
        }
      } catch (err) {
        data[key] = null;
      }
    }

    return JSON.stringify(data, null, 2);
  } catch (error) {
    throw new Error(`Data extraction failed: ${error}`);
  }
}

async function fillForm(fields: Record<string, string>, submitSelector?: string): Promise<string> {
  try {
    const page = await getPage();

    for (const [selector, value] of Object.entries(fields)) {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type(selector, value);
    }

    if (submitSelector) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        page.click(submitSelector),
      ]);
    }

    return JSON.stringify({
      success: true,
      message: `Filled ${Object.keys(fields).length} field(s)`,
      submitted: !!submitSelector,
    }, null, 2);
  } catch (error) {
    throw new Error(`Form filling failed: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "browser-mcp-server",
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
        name: BrowserTools.NAVIGATE,
        description: "Navigate to a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to" },
            waitUntil: {
              type: "string",
              description: "When to consider navigation complete: 'load', 'domcontentloaded', 'networkidle0', 'networkidle2' (default)"
            },
          },
          required: ["url"],
        },
      },
      {
        name: BrowserTools.SCREENSHOT,
        description: "Take a screenshot of the page or element",
        inputSchema: {
          type: "object",
          properties: {
            fullPage: { type: "boolean", description: "Capture full scrollable page (default: true)" },
            selector: { type: "string", description: "CSS selector of element to screenshot (optional)" },
            path: { type: "string", description: "File path to save screenshot (optional, returns base64 if not provided)" },
          },
        },
      },
      {
        name: BrowserTools.GET_HTML,
        description: "Get HTML content of the page or element",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of element (optional, returns full page if not provided)" },
          },
        },
      },
      {
        name: BrowserTools.GET_TEXT,
        description: "Get text content of the page or element",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of element (optional, returns full page text if not provided)" },
          },
        },
      },
      {
        name: BrowserTools.CLICK,
        description: "Click an element on the page",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of element to click" },
            waitForNavigation: { type: "boolean", description: "Wait for navigation after click (default: false)" },
          },
          required: ["selector"],
        },
      },
      {
        name: BrowserTools.TYPE,
        description: "Type text into an input element",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of input element" },
            text: { type: "string", description: "Text to type" },
            delay: { type: "number", description: "Delay between keystrokes in ms (default: 0)" },
            clear: { type: "boolean", description: "Clear existing text before typing (default: true)" },
          },
          required: ["selector", "text"],
        },
      },
      {
        name: BrowserTools.EVALUATE,
        description: "Execute JavaScript in the page context",
        inputSchema: {
          type: "object",
          properties: {
            script: { type: "string", description: "JavaScript code to execute" },
          },
          required: ["script"],
        },
      },
      {
        name: BrowserTools.WAIT_FOR_SELECTOR,
        description: "Wait for an element to appear on the page",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to wait for" },
            timeout: { type: "number", description: "Maximum wait time in ms (default: 30000)" },
          },
          required: ["selector"],
        },
      },
      {
        name: BrowserTools.PDF,
        description: "Generate a PDF of the current page",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to save PDF" },
            fullPage: { type: "boolean", description: "Generate PDF of full page (default: true)" },
          },
          required: ["path"],
        },
      },
      {
        name: BrowserTools.GET_COOKIES,
        description: "Get cookies from the current page",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to get cookies for (optional)" },
          },
        },
      },
      {
        name: BrowserTools.SET_COOKIES,
        description: "Set cookies for the current page",
        inputSchema: {
          type: "object",
          properties: {
            cookies: {
              type: "string",
              description: "JSON string of cookie objects array with name, value, domain, path, etc."
            },
          },
          required: ["cookies"],
        },
      },
      {
        name: BrowserTools.EXTRACT_DATA,
        description: "Extract data from page using CSS selectors",
        inputSchema: {
          type: "object",
          properties: {
            selectors: {
              type: "string",
              description: "JSON object mapping field names to CSS selectors"
            },
          },
          required: ["selectors"],
        },
      },
      {
        name: BrowserTools.FILL_FORM,
        description: "Fill out a form with multiple fields",
        inputSchema: {
          type: "object",
          properties: {
            fields: {
              type: "string",
              description: "JSON object mapping selectors to values"
            },
            submitSelector: { type: "string", description: "CSS selector of submit button (optional)" },
          },
          required: ["fields"],
        },
      },
      {
        name: BrowserTools.CLOSE_BROWSER,
        description: "Close the browser and clean up resources",
        inputSchema: {
          type: "object",
          properties: {},
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
      case BrowserTools.NAVIGATE: {
        if (typeof args.url !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url must be a string");
        }
        const waitUntil = typeof args.waitUntil === "string" ? args.waitUntil : undefined;
        const result = await navigate(args.url, waitUntil);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.SCREENSHOT: {
        const fullPage = typeof args.fullPage === "boolean" ? args.fullPage : true;
        const selector = typeof args.selector === "string" ? args.selector : undefined;
        const path = typeof args.path === "string" ? args.path : undefined;
        const result = await takeScreenshot(fullPage, selector, path);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.GET_HTML: {
        const selector = typeof args.selector === "string" ? args.selector : undefined;
        const result = await getHtml(selector);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.GET_TEXT: {
        const selector = typeof args.selector === "string" ? args.selector : undefined;
        const result = await getText(selector);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.CLICK: {
        if (typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "selector must be a string");
        }
        const waitForNavigation = typeof args.waitForNavigation === "boolean" ? args.waitForNavigation : false;
        const result = await clickElement(args.selector, waitForNavigation);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.TYPE: {
        if (typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "selector must be a string");
        }
        if (typeof args.text !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "text must be a string");
        }
        const delay = typeof args.delay === "number" ? args.delay : 0;
        const clear = typeof args.clear === "boolean" ? args.clear : true;
        const result = await typeText(args.selector, args.text, delay, clear);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.EVALUATE: {
        if (typeof args.script !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "script must be a string");
        }
        const result = await evaluateScript(args.script);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.WAIT_FOR_SELECTOR: {
        if (typeof args.selector !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "selector must be a string");
        }
        const timeout = typeof args.timeout === "number" ? args.timeout : 30000;
        const result = await waitForSelector(args.selector, timeout);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.PDF: {
        if (typeof args.path !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "path must be a string");
        }
        const fullPage = typeof args.fullPage === "boolean" ? args.fullPage : true;
        const result = await generatePdf(args.path, fullPage);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.GET_COOKIES: {
        const url = typeof args.url === "string" ? args.url : undefined;
        const result = await getCookies(url);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.SET_COOKIES: {
        if (typeof args.cookies !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "cookies must be a JSON string");
        }
        const cookies = JSON.parse(args.cookies);
        const result = await setCookies(cookies);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.EXTRACT_DATA: {
        if (typeof args.selectors !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "selectors must be a JSON string");
        }
        const selectors = JSON.parse(args.selectors);
        const result = await extractData(selectors);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.FILL_FORM: {
        if (typeof args.fields !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "fields must be a JSON string");
        }
        const fields = JSON.parse(args.fields);
        const submitSelector = typeof args.submitSelector === "string" ? args.submitSelector : undefined;
        const result = await fillForm(fields, submitSelector);
        return { content: [{ type: "text", text: result }] };
      }

      case BrowserTools.CLOSE_BROWSER: {
        await closeBrowser();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, message: "Browser closed" }, null, 2),
          }],
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
  console.error("Browser MCP Server running on stdio");
}

// Cleanup on exit
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
