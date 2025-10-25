#!/usr/bin/env node

/**
 * Easy View MCP Server - Read-only exploration of the current working directory
 * Provides tools for viewing and searching files in the directory where Claude Code was opened
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import glob from 'fast-glob';

interface FileIndex {
  path: string;
  size: number;
  lines: number;
  extension: string;
  lastModified: Date;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

class EasyViewServer {
  private server: Server;
  private workingDir: string;
  private fileIndex: Map<string, FileIndex> = new Map();
  private indexBuilt: boolean = false;

  constructor() {
    // Use the current working directory where Claude Code was opened
    this.workingDir = process.cwd();

    this.server = new Server(
      {
        name: 'easy-view-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
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

  private async buildFileIndex(): Promise<void> {
    console.error('Building file index...');
    this.fileIndex.clear();

    const files = await glob('**/*', {
      cwd: this.workingDir,
      onlyFiles: true,
      dot: false,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.min.*']
    });

    for (const file of files) {
      const fullPath = path.join(this.workingDir, file);
      try {
        const stats = await fs.promises.stat(fullPath);
        if (stats.size > 50 * 1024 * 1024) continue; // Skip files > 50MB

        let lines = 0;
        if (this.isTextFile(file)) {
          const content = await fs.promises.readFile(fullPath, 'utf8');
          lines = content.split('\n').length;
        }

        this.fileIndex.set(file, {
          path: file,
          size: stats.size,
          lines,
          extension: path.extname(file),
          lastModified: stats.mtime
        });
      } catch (error) {
        console.error(`Failed to index ${file}:`, error);
      }
    }

    this.indexBuilt = true;
    console.error(`Indexed ${this.fileIndex.size} files`);
  }

  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.r',
      '.sql', '.html', '.css', '.scss', '.sass', '.less', '.xml', '.json',
      '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.md', '.txt',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
    ];
    return textExtensions.includes(path.extname(filePath).toLowerCase()) ||
           !path.extname(filePath); // Files without extension might be text
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scan_directory',
            description: 'Scan and index all files in the current working directory',
            inputSchema: {
              type: 'object',
              properties: {
                refresh: {
                  type: 'boolean',
                  description: 'Force refresh the file index',
                  default: false
                }
              }
            }
          },
          {
            name: 'list_files',
            description: 'List files with smart filtering and sorting options',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Glob pattern to filter files (e.g., "*.js", "src/**/*.ts")',
                  default: '*'
                },
                sort_by: {
                  type: 'string',
                  enum: ['name', 'size', 'lines', 'modified'],
                  description: 'Sort files by criteria',
                  default: 'name'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of files to return',
                  default: 50
                },
                min_size: {
                  type: 'number',
                  description: 'Minimum file size in bytes'
                },
                max_size: {
                  type: 'number',
                  description: 'Maximum file size in bytes'
                }
              }
            }
          },
          {
            name: 'search_files',
            description: 'Search for patterns across all files with smart result limiting',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Search pattern (regex supported)'
                },
                file_pattern: {
                  type: 'string',
                  description: 'Limit search to files matching this pattern',
                  default: '*'
                },
                case_sensitive: {
                  type: 'boolean',
                  description: 'Case sensitive search',
                  default: false
                },
                context_lines: {
                  type: 'number',
                  description: 'Number of context lines before/after match',
                  default: 2
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 100
                },
                max_line_length: {
                  type: 'number',
                  description: 'Truncate lines longer than this',
                  default: 200
                }
              },
              required: ['pattern']
            }
          },
          {
            name: 'view_file',
            description: 'View file contents with smart chunking for large files',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Relative path to file in working directory'
                },
                start_line: {
                  type: 'number',
                  description: 'Starting line number (1-based)',
                  default: 1
                },
                end_line: {
                  type: 'number',
                  description: 'Ending line number (inclusive)'
                },
                max_lines: {
                  type: 'number',
                  description: 'Maximum lines to display',
                  default: 500
                },
                around_line: {
                  type: 'number',
                  description: 'Show lines around this specific line number'
                },
                context_size: {
                  type: 'number',
                  description: 'Context lines around target line',
                  default: 25
                }
              },
              required: ['file_path']
            }
          },
          {
            name: 'analyze_structure',
            description: 'Analyze project structure and provide summary statistics',
            inputSchema: {
              type: 'object',
              properties: {
                depth: {
                  type: 'number',
                  description: 'Maximum directory depth to analyze',
                  default: 3
                },
                show_extensions: {
                  type: 'boolean',
                  description: 'Show file extension statistics',
                  default: true
                }
              }
            }
          },
          {
            name: 'find_large_files',
            description: 'Find the largest files in the working directory',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of largest files to show',
                  default: 20
                },
                min_size: {
                  type: 'number',
                  description: 'Minimum size in bytes',
                  default: 1024
                }
              }
            }
          },
          {
            name: 'file_info',
            description: 'Get detailed information about a specific file (size, lines, type) without loading content',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Relative path to file in working directory'
                }
              },
              required: ['file_path']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scan_directory':
            return await this.scanDirectory(args?.refresh as boolean);
          case 'list_files':
            return await this.listFiles(args);
          case 'search_files':
            return await this.searchFiles(args);
          case 'view_file':
            return await this.viewFile(args);
          case 'analyze_structure':
            return await this.analyzeStructure(args);
          case 'find_large_files':
            return await this.findLargeFiles(args);
          case 'file_info':
            return await this.getFileInfo(args);
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

  private async scanDirectory(refresh: boolean = false) {
    if (!this.indexBuilt || refresh) {
      await this.buildFileIndex();
    }

    const stats = {
      totalFiles: this.fileIndex.size,
      totalSize: Array.from(this.fileIndex.values()).reduce((sum, file) => sum + file.size, 0),
      totalLines: Array.from(this.fileIndex.values()).reduce((sum, file) => sum + file.lines, 0),
    };

    const extensions = new Map<string, number>();
    for (const file of this.fileIndex.values()) {
      const ext = file.extension || '(no extension)';
      extensions.set(ext, (extensions.get(ext) || 0) + 1);
    }

    const topExtensions = Array.from(extensions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(', ');

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Directory Scanned**\n📍 Location: ${this.workingDir}\n\n📊 **Statistics:**\n• Files: ${stats.totalFiles}\n• Total Size: ${this.formatBytes(stats.totalSize)}\n• Total Lines: ${stats.totalLines.toLocaleString()}\n\n🗂️ **Top Extensions:** ${topExtensions}`
        }
      ]
    };
  }

  private async listFiles(args: any) {
    if (!this.indexBuilt) await this.buildFileIndex();

    const pattern = args?.pattern || '*';
    const sortBy = args?.sort_by || 'name';
    const limit = Math.min(args?.limit || 50, 200);
    const minSize = args?.min_size || 0;
    const maxSize = args?.max_size || Infinity;

    const matchedFiles = Array.from(this.fileIndex.values())
      .filter(file => {
        if (file.size < minSize || file.size > maxSize) return false;
        return this.matchesPattern(file.path, pattern);
      });

    matchedFiles.sort((a, b) => {
      switch (sortBy) {
        case 'size': return b.size - a.size;
        case 'lines': return b.lines - a.lines;
        case 'modified': return b.lastModified.getTime() - a.lastModified.getTime();
        default: return a.path.localeCompare(b.path);
      }
    });

    const limitedFiles = matchedFiles.slice(0, limit);
    const fileList = limitedFiles.map(file => {
      const sizeStr = this.formatBytes(file.size);
      const linesStr = file.lines > 0 ? ` (${file.lines} lines)` : '';
      return `📄 **${file.path}** - ${sizeStr}${linesStr}`;
    }).join('\n');

    const summary = `Found ${matchedFiles.length} files${matchedFiles.length > limit ? `, showing first ${limit}` : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: `📁 **Files in Working Directory**\n${summary}\n\n${fileList}`
        }
      ]
    };
  }

  private async searchFiles(args: any) {
    if (!this.indexBuilt) await this.buildFileIndex();

    const pattern = args.pattern;
    const filePattern = args?.file_pattern || '*';
    const caseSensitive = args?.case_sensitive || false;
    const contextLines = Math.min(args?.context_lines || 2, 5);
    const maxResults = Math.min(args?.max_results || 100, 500);
    const maxLineLength = Math.min(args?.max_line_length || 200, 1000);

    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    const results: SearchResult[] = [];

    const filesToSearch = Array.from(this.fileIndex.values())
      .filter(file => this.isTextFile(file.path) && this.matchesPattern(file.path, filePattern))
      .slice(0, 1000); // Limit files to search

    for (const fileInfo of filesToSearch) {
      if (results.length >= maxResults) break;

      try {
        const fullPath = path.join(this.workingDir, fileInfo.path);
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i];
          if (regex.test(line)) {
            const truncatedLine = line.length > maxLineLength
              ? line.substring(0, maxLineLength) + '...'
              : line;

            const context: string[] | undefined = contextLines > 0 ? [] : undefined;
            if (contextLines > 0 && context) {
              const start = Math.max(0, i - contextLines);
              const end = Math.min(lines.length - 1, i + contextLines);
              for (let j = start; j <= end; j++) {
                if (j !== i) {
                  const contextLine = lines[j].length > maxLineLength
                    ? lines[j].substring(0, maxLineLength) + '...'
                    : lines[j];
                  context.push(`${j + 1}: ${contextLine}`);
                }
              }
            }

            results.push({
              file: fileInfo.path,
              line: i + 1,
              content: truncatedLine,
              context
            });
          }
        }
      } catch (error) {
        console.error(`Error searching ${fileInfo.path}:`, error);
      }
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `🔍 **No matches found** for pattern: \`${pattern}\``
          }
        ]
      };
    }

    const resultText = results.map(result => {
      let text = `📄 **${result.file}:${result.line}**\n\`\`\`\n${result.content}\n\`\`\``;
      if (result.context && result.context.length > 0) {
        text += `\n*Context:*\n${result.context.join('\n')}`;
      }
      return text;
    }).join('\n\n');

    const summary = `Found ${results.length} matches${results.length >= maxResults ? ' (limited)' : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: `🔍 **Search Results for:** \`${pattern}\`\n${summary}\n\n${resultText}`
        }
      ]
    };
  }

  private async viewFile(args: any) {
    const filePath = args.file_path;
    const startLine = Math.max(1, args?.start_line || 1);
    const maxLines = Math.min(args?.max_lines || 500, 2000);
    const aroundLine = args?.around_line;
    const contextSize = Math.min(args?.context_size || 25, 100);

    const fullPath = path.join(this.workingDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.promises.stat(fullPath);
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error(`File too large to display: ${this.formatBytes(stats.size)}`);
    }

    const content = await fs.promises.readFile(fullPath, 'utf8');
    const lines = content.split('\n');

    let displayStartLine: number;
    let displayEndLine: number;

    if (aroundLine) {
      displayStartLine = Math.max(1, aroundLine - contextSize);
      displayEndLine = Math.min(lines.length, aroundLine + contextSize);
    } else {
      displayStartLine = startLine;
      displayEndLine = args?.end_line || Math.min(lines.length, startLine + maxLines - 1);
    }

    displayEndLine = Math.min(displayEndLine, displayStartLine + maxLines - 1);

    const displayLines = lines.slice(displayStartLine - 1, displayEndLine)
      .map((line, index) => {
        const lineNum = displayStartLine + index;
        const indicator = aroundLine === lineNum ? '→' : ' ';
        return `${indicator}${lineNum.toString().padStart(4)}: ${line}`;
      })
      .join('\n');

    const fileInfo = `📄 **${filePath}** (${lines.length} lines, ${this.formatBytes(stats.size)})`;
    const rangeInfo = `Showing lines ${displayStartLine}-${displayEndLine}`;

    return {
      content: [
        {
          type: 'text',
          text: `${fileInfo}\n${rangeInfo}\n\n\`\`\`\n${displayLines}\n\`\`\``
        }
      ]
    };
  }

  private async analyzeStructure(args: any) {
    if (!this.indexBuilt) await this.buildFileIndex();

    const maxDepth = args?.depth || 3;
    const showExtensions = args?.show_extensions !== false;

    const dirStructure = new Map<string, number>();
    const extensions = new Map<string, { count: number; size: number; lines: number }>();

    for (const file of this.fileIndex.values()) {
      const dir = path.dirname(file.path);
      const depth = dir === '.' ? 0 : dir.split(path.sep).length;

      if (depth <= maxDepth) {
        dirStructure.set(dir, (dirStructure.get(dir) || 0) + 1);
      }

      if (showExtensions) {
        const ext = file.extension || '(no extension)';
        const current = extensions.get(ext) || { count: 0, size: 0, lines: 0 };
        extensions.set(ext, {
          count: current.count + 1,
          size: current.size + file.size,
          lines: current.lines + file.lines
        });
      }
    }

    let structureText = '📁 **Directory Structure:**\n';
    const sortedDirs = Array.from(dirStructure.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 50);

    for (const [dir, count] of sortedDirs) {
      const displayDir = dir === '.' ? '(root)' : dir;
      const indent = '  '.repeat(Math.min(dir.split(path.sep).length, 5));
      structureText += `${indent}• ${displayDir} (${count} files)\n`;
    }

    if (showExtensions) {
      structureText += '\n🗂️ **File Extensions:**\n';
      const sortedExts = Array.from(extensions.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15);

      for (const [ext, stats] of sortedExts) {
        const linesText = stats.lines > 0 ? `, ${stats.lines.toLocaleString()} lines` : '';
        structureText += `• **${ext}**: ${stats.count} files, ${this.formatBytes(stats.size)}${linesText}\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: structureText
        }
      ]
    };
  }

  private async findLargeFiles(args: any) {
    if (!this.indexBuilt) await this.buildFileIndex();

    const limit = Math.min(args?.limit || 20, 50);
    const minSize = args?.min_size || 1024;

    const largeFiles = Array.from(this.fileIndex.values())
      .filter(file => file.size >= minSize)
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);

    if (largeFiles.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `📊 No files found larger than ${this.formatBytes(minSize)}`
          }
        ]
      };
    }

    const fileList = largeFiles.map((file, index) => {
      const linesText = file.lines > 0 ? ` (${file.lines.toLocaleString()} lines)` : '';
      return `${index + 1}. **${file.path}** - ${this.formatBytes(file.size)}${linesText}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📊 **Largest Files:**\n\n${fileList}`
        }
      ]
    };
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern === '*') return true;

    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  private async getFileInfo(args: any) {
    const filePath = args.file_path;
    const fullPath = path.join(this.workingDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.promises.stat(fullPath);

    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }

    // Check if we have this file in our index
    let indexedInfo = this.fileIndex.get(filePath);

    // If not in index or index is stale, get fresh info
    if (!indexedInfo || indexedInfo.lastModified.getTime() !== stats.mtime.getTime()) {
      let lines = 0;

      if (this.isTextFile(filePath)) {
        try {
          // For very large files, we'll estimate line count differently
          if (stats.size > 5 * 1024 * 1024) { // 5MB
            // Sample the file to estimate lines
            const buffer = Buffer.alloc(Math.min(64 * 1024, stats.size)); // Read first 64KB
            const fd = await fs.promises.open(fullPath, 'r');
            await fd.read(buffer, 0, buffer.length, 0);
            await fd.close();

            const sample = buffer.toString('utf8');
            const sampleLines = sample.split('\n').length;
            const estimatedLines = Math.round((sampleLines / buffer.length) * stats.size);
            lines = estimatedLines;
          } else {
            // For smaller files, count actual lines
            const content = await fs.promises.readFile(fullPath, 'utf8');
            lines = content.split('\n').length;
          }
        } catch (error) {
          // If reading as text fails, treat as binary
          lines = 0;
        }
      }

      // Update our index
      indexedInfo = {
        path: filePath,
        size: stats.size,
        lines,
        extension: path.extname(filePath),
        lastModified: stats.mtime
      };

      if (this.indexBuilt) {
        this.fileIndex.set(filePath, indexedInfo);
      }
    }

    const fileType = this.isTextFile(filePath) ? 'Text' : 'Binary';
    const extension = indexedInfo.extension || '(no extension)';
    const linesInfo = indexedInfo.lines > 0 ? `\n📏 **Lines:** ${indexedInfo.lines.toLocaleString()}` : '';
    const lastModified = indexedInfo.lastModified.toISOString().split('T')[0]; // YYYY-MM-DD format

    return {
      content: [
        {
          type: 'text',
          text: `📄 **File Information:** ${filePath}\n\n` +
                `📊 **Size:** ${this.formatBytes(indexedInfo.size)}\n` +
                `🗂️ **Type:** ${fileType} (${extension})${linesInfo}\n` +
                `📅 **Modified:** ${lastModified}\n` +
                `📍 **Full Path:** ${fullPath}`
        }
      ]
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Easy View MCP server running on stdio');
    console.error(`Working directory: ${this.workingDir}`);
  }
}

// Start the server
const server = new EasyViewServer();
server.run().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});