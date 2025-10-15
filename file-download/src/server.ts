#!/usr/bin/env node

/**
 * File Download MCP Server - Save files to ~/.claude/downloads/
 * Creates the directory if it doesn't exist and provides file saving tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class FileDownloadServer {
  private server: Server;
  private downloadsDir: string;

  constructor() {
    this.downloadsDir = path.join(os.homedir(), '.claude', 'downloads');

    this.server = new Server(
      {
        name: 'file-download-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
    this.ensureDownloadsDirectory();
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

  private ensureDownloadsDirectory(): void {
    try {
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        console.error(`✅ Created downloads directory: ${this.downloadsDir}`);
      } else {
        console.error(`📁 Downloads directory exists: ${this.downloadsDir}`);
      }
    } catch (error) {
      console.error('❌ Failed to create downloads directory:', error);
      throw error;
    }
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'save_text_file',
            description: 'Save text content to a file in ~/.claude/downloads/',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Name of the file to save (with extension)'
                },
                content: {
                  type: 'string',
                  description: 'Text content to save to the file'
                }
              },
              required: ['filename', 'content']
            }
          },
          {
            name: 'save_binary_file',
            description: 'Save binary content (base64 encoded) to a file in ~/.claude/downloads/',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Name of the file to save (with extension)'
                },
                content: {
                  type: 'string',
                  description: 'Base64 encoded binary content'
                }
              },
              required: ['filename', 'content']
            }
          },
          {
            name: 'list_downloads',
            description: 'List all files in the ~/.claude/downloads/ directory',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_downloads_path',
            description: 'Get the full path to the downloads directory',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'delete_file',
            description: 'Delete a file from the ~/.claude/downloads/ directory',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Name of the file to delete'
                }
              },
              required: ['filename']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_text_file':
            return await this.saveTextFile(args?.filename as string, args?.content as string);
          case 'save_binary_file':
            return await this.saveBinaryFile(args?.filename as string, args?.content as string);
          case 'list_downloads':
            return await this.listDownloads();
          case 'get_downloads_path':
            return await this.getDownloadsPath();
          case 'delete_file':
            return await this.deleteFile(args?.filename as string);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${errorMessage}`
            }
          ]
        };
      }
    });
  }

  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename is required and must be a string');
    }

    // Remove any path separators and other dangerous characters
    const sanitized = filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+/, '_')
      .trim();

    if (!sanitized) {
      throw new Error('Invalid filename');
    }

    return sanitized;
  }

  private async saveTextFile(filename: string, content: string) {
    console.error(`Saving text file: ${filename}`);

    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.downloadsDir, sanitizedFilename);

    try {
      await fs.promises.writeFile(filePath, content, 'utf8');

      const stats = await fs.promises.stat(filePath);
      console.error(`✅ Saved text file: ${filePath} (${stats.size} bytes)`);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully saved text file: **${sanitizedFilename}**\n📍 Location: ${filePath}\n📊 Size: ${stats.size} bytes`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to save text file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async saveBinaryFile(filename: string, base64Content: string) {
    console.error(`Saving binary file: ${filename}`);

    if (!base64Content || typeof base64Content !== 'string') {
      throw new Error('Base64 content is required and must be a string');
    }

    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.downloadsDir, sanitizedFilename);

    try {
      const buffer = Buffer.from(base64Content, 'base64');
      await fs.promises.writeFile(filePath, buffer);

      const stats = await fs.promises.stat(filePath);
      console.error(`✅ Saved binary file: ${filePath} (${stats.size} bytes)`);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully saved binary file: **${sanitizedFilename}**\n📍 Location: ${filePath}\n📊 Size: ${stats.size} bytes`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to save binary file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async listDownloads() {
    console.error('Listing downloads directory');

    try {
      const files = await fs.promises.readdir(this.downloadsDir);

      if (files.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📁 Downloads directory is empty\n📍 Location: ${this.downloadsDir}`
            }
          ]
        };
      }

      const fileDetails = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.downloadsDir, file);
          const stats = await fs.promises.stat(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            isDirectory: stats.isDirectory()
          };
        })
      );

      const fileList = fileDetails
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(file => {
          const icon = file.isDirectory ? '📁' : '📄';
          const size = file.isDirectory ? '' : ` (${file.size} bytes)`;
          return `${icon} **${file.name}**${size}`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `📁 Downloads directory contents (${files.length} items):\n📍 Location: ${this.downloadsDir}\n\n${fileList}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list downloads: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getDownloadsPath() {
    return {
      content: [
        {
          type: 'text',
          text: `📍 Downloads directory path: **${this.downloadsDir}**`
        }
      ]
    };
  }

  private async deleteFile(filename: string) {
    console.error(`Deleting file: ${filename}`);

    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.downloadsDir, sanitizedFilename);

    try {
      // Check if file exists
      await fs.promises.access(filePath);

      // Get file stats before deletion
      const stats = await fs.promises.stat(filePath);

      // Delete the file
      await fs.promises.unlink(filePath);

      console.error(`✅ Deleted file: ${filePath}`);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully deleted file: **${sanitizedFilename}**\n📍 Was located at: ${filePath}\n📊 Size was: ${stats.size} bytes`
          }
        ]
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${sanitizedFilename}`);
      }
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('File Download MCP server running on stdio');
  }
}

// Start the server
const server = new FileDownloadServer();
server.run().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});