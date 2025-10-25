#!/usr/bin/env node

/**
 * Curl MCP Server - Token-friendly HTTP request execution via MCP
 * Provides response caching and organized viewing tools to minimize token usage
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

interface CurlResponse {
  id: string;
  timestamp: Date;
  url: string;
  method: string;
  status?: number;
  headers?: Record<string, string>;
  body: string;
  size: number;
  contentType?: string;
  error?: string;
}

interface ResponseSummary {
  id: string;
  url: string;
  method: string;
  status?: number;
  contentType?: string;
  size: number;
  timestamp: Date;
  preview: string;
}

class CurlServer {
  private server: Server;
  private responses: Map<string, CurlResponse> = new Map();
  private maxResponses: number = 50; // Limit memory usage

  constructor() {
    this.server = new Server(
      {
        name: 'curl-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async runCurlCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error: any = new Error(`curl exited with code ${code}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'curl_execute',
            description: 'Execute HTTP request and store response for later viewing (token-friendly)',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to make the request to'
                },
                method: {
                  type: 'string',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                  description: 'HTTP method to use (default: GET)',
                  default: 'GET'
                },
                headers: {
                  type: 'object',
                  description: 'Object containing HTTP headers',
                  additionalProperties: { type: 'string' }
                },
                data: {
                  type: 'string',
                  description: 'Request body data for POST/PUT/PATCH requests'
                },
                timeout: {
                  type: 'number',
                  description: 'Request timeout in seconds (default: 30)',
                  default: 30
                },
                follow_redirects: {
                  type: 'boolean',
                  description: 'Follow HTTP redirects (default: true)',
                  default: true
                },
                insecure: {
                  type: 'boolean',
                  description: 'Skip SSL certificate verification (default: false)',
                  default: false
                }
              },
              required: ['url']
            }
          },
          {
            name: 'curl_list',
            description: 'List all stored curl responses with summaries',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of responses to show (default: 10)',
                  default: 10
                },
                filter_method: {
                  type: 'string',
                  description: 'Filter by HTTP method'
                },
                filter_url_contains: {
                  type: 'string',
                  description: 'Filter by URL containing this text'
                }
              }
            }
          },
          {
            name: 'curl_show',
            description: 'Show detailed information about a specific curl response',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Response ID to view details for'
                },
                show_body: {
                  type: 'boolean',
                  description: 'Include response body (default: true)',
                  default: true
                },
                body_lines: {
                  type: 'number',
                  description: 'Number of lines to show from body (default: 50, 0 for all)',
                  default: 50
                },
                show_headers: {
                  type: 'boolean',
                  description: 'Include response headers (default: true)',
                  default: true
                }
              },
              required: ['id']
            }
          },
          {
            name: 'curl_search',
            description: 'Search within response bodies across all stored responses',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Text to search for in response bodies'
                },
                case_sensitive: {
                  type: 'boolean',
                  description: 'Case sensitive search (default: false)',
                  default: false
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum results to return (default: 20)',
                  default: 20
                }
              },
              required: ['query']
            }
          },
          {
            name: 'curl_clear',
            description: 'Clear stored responses (all or specific)',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Specific response ID to clear (optional, clears all if not provided)'
                },
                older_than_hours: {
                  type: 'number',
                  description: 'Clear responses older than this many hours'
                }
              }
            }
          }
        ]
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'curl_execute':
            return await this.handleCurlExecute(args);
          case 'curl_list':
            return await this.handleCurlList(args);
          case 'curl_show':
            return await this.handleCurlShow(args);
          case 'curl_search':
            return await this.handleCurlSearch(args);
          case 'curl_clear':
            return await this.handleCurlClear(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`
            }
          ]
        };
      }
    });
  }

  private async handleCurlExecute(args: any): Promise<any> {
    const {
      url,
      method = 'GET',
      headers,
      data,
      timeout = 30,
      follow_redirects = true,
      insecure = false
    } = args;

    // Validate URL
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    try {
      const args: string[] = ['-s', '-i', '-X', method.toUpperCase()];

      if (headers && typeof headers === 'object') {
        for (const [key, value] of Object.entries(headers)) {
          if (typeof value === 'string') {
            args.push('-H', `${key}: ${value}`);
          }
        }
      }

      if (
        data &&
        typeof data === 'string' &&
        ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
      ) {
        args.push('-d', data);
      }

      const safeTimeout = Number.isFinite(timeout) && timeout > 0 ? timeout : 30;
      args.push('--max-time', String(safeTimeout));

      if (follow_redirects) {
        args.push('-L');
      } else {
        args.push('--max-redirs', '0');
      }

      if (insecure) {
        args.push('-k');
      }

      args.push(url);

      const { stdout, stderr } = await this.runCurlCommand(args);

      // Parse response
      const response = this.parseCurlResponse(stdout, url, method);

      // Store response
      this.responses.set(response.id, response);

      // Clean up old responses if needed
      this.cleanupOldResponses();

      return {
        content: [
          {
            type: 'text',
            text: `Request executed successfully. Response ID: ${response.id}\nStatus: ${response.status || 'Unknown'}\nSize: ${response.size} bytes\nUse curl_list to see all responses or curl_show to view details.`
          }
        ]
      };
    } catch (error: any) {
      // Store error response
      const errorResponse: CurlResponse = {
        id: randomUUID(),
        timestamp: new Date(),
        url,
        method: method.toUpperCase(),
        body: '',
        size: 0,
        error: error.stderr || error.message || 'Unknown curl error'
      };

      this.responses.set(errorResponse.id, errorResponse);

      return {
        content: [
          {
            type: 'text',
            text: `Request failed. Error ID: ${errorResponse.id}\nError: ${errorResponse.error}\nUse curl_show with ID to view full error details.`
          }
        ]
      };
    }
  }

  private parseCurlResponse(stdout: string, url: string, method: string): CurlResponse {
    const lines = stdout.split('\r\n');
    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;
    let status: number | undefined;
    let contentType: string | undefined;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('HTTP/')) {
        const statusMatch = line.match(/HTTP\/\d\.\d (\d+)/);
        if (statusMatch) {
          status = parseInt(statusMatch[1]);
        }
        continue;
      }

      if (line === '') {
        bodyStartIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key.toLowerCase()] = value;

        if (key.toLowerCase() === 'content-type') {
          contentType = value;
        }
      }
    }

    const body = lines.slice(bodyStartIndex).join('\r\n');

    return {
      id: randomUUID(),
      timestamp: new Date(),
      url,
      method: method.toUpperCase(),
      status,
      headers,
      body,
      size: body.length,
      contentType
    };
  }

  private async handleCurlList(args: any): Promise<any> {
    const {
      limit = 10,
      filter_method,
      filter_url_contains
    } = args;

    let responses = Array.from(this.responses.values());

    // Apply filters
    if (filter_method) {
      responses = responses.filter(r => r.method.toLowerCase() === filter_method.toLowerCase());
    }

    if (filter_url_contains) {
      responses = responses.filter(r => r.url.toLowerCase().includes(filter_url_contains.toLowerCase()));
    }

    // Sort by timestamp (newest first)
    responses.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    responses = responses.slice(0, limit);

    if (responses.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No responses found. Use curl_execute to make HTTP requests.'
          }
        ]
      };
    }

    const summaries: ResponseSummary[] = responses.map(response => ({
      id: response.id,
      url: response.url,
      method: response.method,
      status: response.status,
      contentType: response.contentType,
      size: response.size,
      timestamp: response.timestamp,
      preview: response.body.substring(0, 100).replace(/\s+/g, ' ') + (response.body.length > 100 ? '...' : '')
    }));

    const listText = summaries.map(summary => {
      const timeStr = summary.timestamp.toLocaleTimeString();
      return `ID: ${summary.id.substring(0, 8)}\n  ${summary.method} ${summary.status || 'Unknown'} ${summary.url}\n  Size: ${summary.size} bytes | Time: ${timeStr}\n  Preview: ${summary.preview}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${responses.length} response(s):\n\n${listText}\n\nUse curl_show with full ID to view details.`
        }
      ]
    };
  }

  private async handleCurlShow(args: any): Promise<any> {
    const {
      id,
      show_body = true,
      body_lines = 50,
      show_headers = true
    } = args;

    const response = this.responses.get(id);

    if (!response) {
      throw new Error(`Response with ID ${id} not found`);
    }

    let output = `Response Details for ID: ${id}\n\n`;
    output += `URL: ${response.url}\n`;
    output += `Method: ${response.method}\n`;
    output += `Status: ${response.status || 'Unknown'}\n`;
    output += `Timestamp: ${response.timestamp.toLocaleString()}\n`;
    output += `Size: ${response.size} bytes\n`;

    if (response.contentType) {
      output += `Content-Type: ${response.contentType}\n`;
    }

    if (response.error) {
      output += `\nError: ${response.error}\n`;
    }

    if (show_headers && response.headers && Object.keys(response.headers).length > 0) {
      output += `\nHeaders:\n`;
      for (const [key, value] of Object.entries(response.headers)) {
        output += `  ${key}: ${value}\n`;
      }
    }

    if (show_body && response.body) {
      output += `\nBody:\n`;
      const bodyLines = response.body.split('\n');

      if (body_lines > 0 && bodyLines.length > body_lines) {
        output += bodyLines.slice(0, body_lines).join('\n');
        output += `\n\n... (${bodyLines.length - body_lines} more lines)`;
      } else {
        output += response.body;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: output
        }
      ]
    };
  }

  private async handleCurlSearch(args: any): Promise<any> {
    const {
      query,
      case_sensitive = false,
      max_results = 20
    } = args;

    if (!query) {
      throw new Error('Search query is required');
    }

    const searchQuery = case_sensitive ? query : query.toLowerCase();
    const results: Array<{id: string, url: string, method: string, matches: string[]}> = [];

    for (const response of this.responses.values()) {
      const body = case_sensitive ? response.body : response.body.toLowerCase();
      const lines = response.body.split('\n');
      const matches: string[] = [];

      lines.forEach((line, index) => {
        const searchLine = case_sensitive ? line : line.toLowerCase();
        if (searchLine.includes(searchQuery)) {
          matches.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });

      if (matches.length > 0) {
        results.push({
          id: response.id,
          url: response.url,
          method: response.method,
          matches: matches.slice(0, 5) // Limit matches per response
        });
      }
    }

    // Sort by relevance (more matches first) and limit results
    results.sort((a, b) => b.matches.length - a.matches.length);
    const limitedResults = results.slice(0, max_results);

    if (limitedResults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No matches found for "${query}" in any stored responses.`
          }
        ]
      };
    }

    const searchOutput = limitedResults.map(result => {
      return `ID: ${result.id.substring(0, 8)}\n  ${result.method} ${result.url}\n  Matches:\n    ${result.matches.join('\n    ')}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${limitedResults.length} response(s) matching "${query}":\n\n${searchOutput}`
        }
      ]
    };
  }

  private async handleCurlClear(args: any): Promise<any> {
    const { id, older_than_hours } = args;

    if (id) {
      // Clear specific response
      if (this.responses.delete(id)) {
        return {
          content: [
            {
              type: 'text',
              text: `Response ${id} has been cleared.`
            }
          ]
        };
      } else {
        throw new Error(`Response with ID ${id} not found`);
      }
    } else if (older_than_hours) {
      // Clear responses older than specified hours
      const cutoffTime = new Date(Date.now() - older_than_hours * 60 * 60 * 1000);
      const toDelete: string[] = [];

      for (const [id, response] of this.responses.entries()) {
        if (response.timestamp < cutoffTime) {
          toDelete.push(id);
        }
      }

      toDelete.forEach(id => this.responses.delete(id));

      return {
        content: [
          {
            type: 'text',
            text: `Cleared ${toDelete.length} response(s) older than ${older_than_hours} hours.`
          }
        ]
      };
    } else {
      // Clear all responses
      const count = this.responses.size;
      this.responses.clear();

      return {
        content: [
          {
            type: 'text',
            text: `Cleared all ${count} stored response(s).`
          }
        ]
      };
    }
  }

  private cleanupOldResponses(): void {
    if (this.responses.size <= this.maxResponses) {
      return;
    }

    // Sort by timestamp (oldest first)
    const sortedResponses = Array.from(this.responses.entries())
      .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

    // Remove oldest responses
    const toRemove = sortedResponses.slice(0, sortedResponses.length - this.maxResponses);
    toRemove.forEach(([id]) => this.responses.delete(id));
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Curl MCP Server running on stdio');
  }
}

// Start the server
const server = new CurlServer();
server.run().catch(console.error);
