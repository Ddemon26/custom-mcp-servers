#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import archiver from "archiver";
import decompress from "decompress";
import { createWriteStream, createReadStream } from "fs";
import { stat, readdir, mkdir } from "fs/promises";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import * as tar from "tar";
import { join, dirname, basename } from "path";

// Constants
const ArchiveTools = {
  CREATE_ZIP: "create_zip",
  CREATE_TAR: "create_tar",
  CREATE_TARGZ: "create_targz",
  EXTRACT: "extract",
  LIST_CONTENTS: "list_contents",
  COMPRESS_FILE: "compress_file",
  DECOMPRESS_FILE: "decompress_file",
  ADD_TO_ZIP: "add_to_zip",
} as const;

// Helper function to parse sources (accepts JSON array or space-separated string)
function parseSources(sourcesStr: string): string[] {
  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(sourcesStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // If it's a single string in JSON format, wrap it in an array
    if (typeof parsed === 'string') {
      return [parsed];
    }
  } catch {
    // Not valid JSON, treat as space/comma/newline-separated string
  }

  // Split by whitespace, commas, or newlines and filter empty strings
  return sourcesStr
    .split(/[\s,\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Helper function to check if path exists
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Helper function to ensure directory exists
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Create ZIP archive
async function createZip(
  sources: string[],
  outputPath: string,
  compressionLevel: number = 9
): Promise<string> {
  try {
    // Ensure output directory exists
    await ensureDir(dirname(outputPath));

    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: compressionLevel },
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve(JSON.stringify({
          success: true,
          outputPath,
          totalBytes: archive.pointer(),
          message: `ZIP archive created: ${outputPath}`,
        }, null, 2));
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add files/directories to archive
      for (const source of sources) {
        stat(source).then(async (stats) => {
          if (stats.isDirectory()) {
            archive.directory(source, basename(source));
          } else {
            archive.file(source, { name: basename(source) });
          }
        }).catch(reject);
      }

      archive.finalize();
    });
  } catch (error) {
    throw new Error(`ZIP creation failed: ${error}`);
  }
}

// Create TAR archive
async function createTar(
  sources: string[],
  outputPath: string,
  gzip: boolean = false
): Promise<string> {
  try {
    await ensureDir(dirname(outputPath));

    const options: any = {
      file: outputPath,
      gzip: gzip,
    };

    await tar.create(options, sources);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      outputPath,
      totalBytes: stats.size,
      compressed: gzip,
      message: `TAR${gzip ? '.GZ' : ''} archive created: ${outputPath}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`TAR creation failed: ${error}`);
  }
}

// Extract archive
async function extractArchive(
  archivePath: string,
  outputDir: string,
  stripComponents: number = 0
): Promise<string> {
  try {
    if (!await pathExists(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    await ensureDir(outputDir);

    const ext = archivePath.toLowerCase();

    if (ext.endsWith('.tar') || ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
      // Use tar for .tar and .tar.gz files
      await tar.extract({
        file: archivePath,
        cwd: outputDir,
        strip: stripComponents,
      });
    } else {
      // Use decompress for zip and other formats
      await decompress(archivePath, outputDir, {
        strip: stripComponents,
      });
    }

    // Count extracted files
    const files = await readdir(outputDir);

    return JSON.stringify({
      success: true,
      archivePath,
      outputDir,
      filesExtracted: files.length,
      message: `Archive extracted to: ${outputDir}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Extraction failed: ${error}`);
  }
}

// List archive contents
async function listContents(archivePath: string): Promise<string> {
  try {
    if (!await pathExists(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    const ext = archivePath.toLowerCase();
    const files: string[] = [];

    if (ext.endsWith('.tar') || ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
      // List tar archive contents
      await tar.list({
        file: archivePath,
        onentry: (entry) => {
          files.push(entry.path);
        },
      });
    } else if (ext.endsWith('.zip')) {
      // For zip, we need to extract to list (decompress limitation)
      const entries = await decompress(archivePath, { strip: 0 });
      entries.forEach(entry => {
        files.push(entry.path);
      });
    } else {
      throw new Error('Unsupported archive format. Supported: .zip, .tar, .tar.gz, .tgz');
    }

    return JSON.stringify({
      archivePath,
      fileCount: files.length,
      files,
    }, null, 2);
  } catch (error) {
    throw new Error(`Listing contents failed: ${error}`);
  }
}

// Compress single file with gzip
async function compressFile(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const output = outputPath || `${inputPath}.gz`;
    await ensureDir(dirname(output));

    const gzip = createGzip({ level: 9 });
    const source = createReadStream(inputPath);
    const destination = createWriteStream(output);

    await pipeline(source, gzip, destination);

    const stats = await stat(output);

    return JSON.stringify({
      success: true,
      inputPath,
      outputPath: output,
      compressedSize: stats.size,
      message: `File compressed: ${output}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Compression failed: ${error}`);
  }
}

// Decompress gzip file
async function decompressFile(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    let output = outputPath;
    if (!output) {
      // Remove .gz extension
      output = inputPath.endsWith('.gz')
        ? inputPath.slice(0, -3)
        : `${inputPath}.decompressed`;
    }

    await ensureDir(dirname(output));

    const gunzip = createGunzip();
    const source = createReadStream(inputPath);
    const destination = createWriteStream(output);

    await pipeline(source, gunzip, destination);

    const stats = await stat(output);

    return JSON.stringify({
      success: true,
      inputPath,
      outputPath: output,
      decompressedSize: stats.size,
      message: `File decompressed: ${output}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Decompression failed: ${error}`);
  }
}

// Add files to existing ZIP
async function addToZip(
  archivePath: string,
  sources: string[],
  compressionLevel: number = 9
): Promise<string> {
  try {
    if (!await pathExists(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    // Note: archiver doesn't support modifying existing archives
    // We need to extract, add files, and recreate
    // For simplicity, we'll just inform the user this is a limitation

    throw new Error(
      'Adding to existing ZIP is not directly supported. ' +
      'Please extract the archive, add files, and create a new archive.'
    );
  } catch (error) {
    throw new Error(`Adding to archive failed: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "archive-mcp-server",
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
        name: ArchiveTools.CREATE_ZIP,
        description: "Create a ZIP archive from files and/or directories",
        inputSchema: {
          type: "object",
          properties: {
            sources: {
              type: "string",
              description: "File/directory paths to include (space-separated, comma-separated, or JSON array)"
            },
            outputPath: {
              type: "string",
              description: "Path where the ZIP file will be created"
            },
            compressionLevel: {
              type: "number",
              description: "Compression level 0-9 (default: 9, maximum compression)"
            },
          },
          required: ["sources", "outputPath"],
        },
      },
      {
        name: ArchiveTools.CREATE_TAR,
        description: "Create a TAR archive from files and/or directories",
        inputSchema: {
          type: "object",
          properties: {
            sources: {
              type: "string",
              description: "File/directory paths to include (space-separated, comma-separated, or JSON array)"
            },
            outputPath: {
              type: "string",
              description: "Path where the TAR file will be created"
            },
          },
          required: ["sources", "outputPath"],
        },
      },
      {
        name: ArchiveTools.CREATE_TARGZ,
        description: "Create a compressed TAR.GZ archive from files and/or directories",
        inputSchema: {
          type: "object",
          properties: {
            sources: {
              type: "string",
              description: "File/directory paths to include (space-separated, comma-separated, or JSON array)"
            },
            outputPath: {
              type: "string",
              description: "Path where the TAR.GZ file will be created"
            },
          },
          required: ["sources", "outputPath"],
        },
      },
      {
        name: ArchiveTools.EXTRACT,
        description: "Extract files from ZIP, TAR, or TAR.GZ archives",
        inputSchema: {
          type: "object",
          properties: {
            archivePath: {
              type: "string",
              description: "Path to the archive file"
            },
            outputDir: {
              type: "string",
              description: "Directory where files will be extracted"
            },
            stripComponents: {
              type: "number",
              description: "Number of leading path components to strip (default: 0)"
            },
          },
          required: ["archivePath", "outputDir"],
        },
      },
      {
        name: ArchiveTools.LIST_CONTENTS,
        description: "List contents of an archive without extracting",
        inputSchema: {
          type: "object",
          properties: {
            archivePath: {
              type: "string",
              description: "Path to the archive file"
            },
          },
          required: ["archivePath"],
        },
      },
      {
        name: ArchiveTools.COMPRESS_FILE,
        description: "Compress a single file using gzip",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to the file to compress"
            },
            outputPath: {
              type: "string",
              description: "Output path (default: input.gz)"
            },
          },
          required: ["inputPath"],
        },
      },
      {
        name: ArchiveTools.DECOMPRESS_FILE,
        description: "Decompress a gzip compressed file",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to the .gz file"
            },
            outputPath: {
              type: "string",
              description: "Output path (default: removes .gz extension)"
            },
          },
          required: ["inputPath"],
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
      case ArchiveTools.CREATE_ZIP: {
        if (typeof args.sources !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "sources must be a string");
        }
        if (typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "outputPath must be a string");
        }
        const sources = parseSources(args.sources);
        const compressionLevel = typeof args.compressionLevel === "number"
          ? args.compressionLevel
          : 9;
        const result = await createZip(sources, args.outputPath, compressionLevel);
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.CREATE_TAR: {
        if (typeof args.sources !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "sources must be a string");
        }
        if (typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "outputPath must be a string");
        }
        const sources = parseSources(args.sources);
        const result = await createTar(sources, args.outputPath, false);
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.CREATE_TARGZ: {
        if (typeof args.sources !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "sources must be a string");
        }
        if (typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "outputPath must be a string");
        }
        const sources = parseSources(args.sources);
        const result = await createTar(sources, args.outputPath, true);
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.EXTRACT: {
        if (typeof args.archivePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "archivePath must be a string");
        }
        if (typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "outputDir must be a string");
        }
        const stripComponents = typeof args.stripComponents === "number"
          ? args.stripComponents
          : 0;
        const result = await extractArchive(
          args.archivePath,
          args.outputDir,
          stripComponents
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.LIST_CONTENTS: {
        if (typeof args.archivePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "archivePath must be a string");
        }
        const result = await listContents(args.archivePath);
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.COMPRESS_FILE: {
        if (typeof args.inputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath must be a string");
        }
        const outputPath = typeof args.outputPath === "string"
          ? args.outputPath
          : undefined;
        const result = await compressFile(args.inputPath, outputPath);
        return { content: [{ type: "text", text: result }] };
      }

      case ArchiveTools.DECOMPRESS_FILE: {
        if (typeof args.inputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath must be a string");
        }
        const outputPath = typeof args.outputPath === "string"
          ? args.outputPath
          : undefined;
        const result = await decompressFile(args.inputPath, outputPath);
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
  console.error("Archive MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
