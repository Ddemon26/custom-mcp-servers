#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

// Import utilities and types
import { checkImageMagickAvailable } from "./utils.js";
import { ImageMagickTools } from "./types.js";

// Import all commands
import {
  getImageInfo,
  resizeImage,
  cropImage,
  rotateImage,
  flipImage,
  convertFormat,
  adjustQuality,
  createThumbnail,
  addWatermark,
  batchResize,
  adjustBrightness,
  adjustContrast,
  adjustSaturation,
  blurImage,
  sharpenImage,
} from "./commands/index.js";

/**
 * Helper to parse input arrays (comma-separated or JSON)
 */
function parseInputArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON, treat as comma-separated
  }
  return input.split(",").map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "imagemagick-mcp-server",
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
        name: ImageMagickTools.GET_IMAGE_INFO,
        description: "Get detailed information about an image (format, dimensions, size, colorspace, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to the image file",
            },
          },
          required: ["inputPath"],
        },
      },
      {
        name: ImageMagickTools.RESIZE_IMAGE,
        description: "Resize an image to specified dimensions",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where resized image will be saved",
            },
            width: {
              type: "number",
              description: "Target width in pixels",
            },
            height: {
              type: "number",
              description: "Target height in pixels",
            },
            maintainAspect: {
              type: "boolean",
              description: "Maintain aspect ratio (default: true)",
            },
            quality: {
              type: "number",
              description: "Output quality (1-100)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: ImageMagickTools.CROP_IMAGE,
        description: "Crop an image to specified rectangle",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where cropped image will be saved",
            },
            x: {
              type: "number",
              description: "X coordinate of top-left corner",
            },
            y: {
              type: "number",
              description: "Y coordinate of top-left corner",
            },
            width: {
              type: "number",
              description: "Width of crop area",
            },
            height: {
              type: "number",
              description: "Height of crop area",
            },
          },
          required: ["inputPath", "outputPath", "x", "y", "width", "height"],
        },
      },
      {
        name: ImageMagickTools.ROTATE_IMAGE,
        description: "Rotate an image by specified degrees",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where rotated image will be saved",
            },
            degrees: {
              type: "number",
              description: "Rotation degrees (positive = clockwise)",
            },
          },
          required: ["inputPath", "outputPath", "degrees"],
        },
      },
      {
        name: ImageMagickTools.FLIP_IMAGE,
        description: "Flip an image horizontally or vertically",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where flipped image will be saved",
            },
            direction: {
              type: "string",
              description: "Flip direction: 'horizontal' or 'vertical'",
            },
          },
          required: ["inputPath", "outputPath", "direction"],
        },
      },
      {
        name: ImageMagickTools.CONVERT_FORMAT,
        description: "Convert image to different format",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where converted image will be saved",
            },
            format: {
              type: "string",
              description: "Target format (jpg, png, gif, bmp, tiff, webp)",
            },
            quality: {
              type: "number",
              description: "Output quality (1-100)",
            },
          },
          required: ["inputPath", "outputPath", "format"],
        },
      },
      {
        name: ImageMagickTools.ADJUST_QUALITY,
        description: "Adjust image quality/compression",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where adjusted image will be saved",
            },
            quality: {
              type: "number",
              description: "Quality level (1-100)",
            },
          },
          required: ["inputPath", "outputPath", "quality"],
        },
      },
      {
        name: ImageMagickTools.CREATE_THUMBNAIL,
        description: "Create thumbnail of specified size",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where thumbnail will be saved",
            },
            width: {
              type: "number",
              description: "Thumbnail width (default: 150)",
            },
            height: {
              type: "number",
              description: "Thumbnail height (default: 150)",
            },
            quality: {
              type: "number",
              description: "Thumbnail quality (default: 85)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: ImageMagickTools.ADD_WATERMARK,
        description: "Add watermark image to another image",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to main image",
            },
            watermarkPath: {
              type: "string",
              description: "Path to watermark image",
            },
            outputPath: {
              type: "string",
              description: "Path where output image will be saved",
            },
            position: {
              type: "string",
              description: "Position: northwest, north, northeast, west, center, east, southwest, south, southeast",
            },
            opacity: {
              type: "number",
              description: "Watermark opacity (0.0 to 1.0, default: 0.7)",
            },
          },
          required: ["inputPath", "watermarkPath", "outputPath"],
        },
      },
      {
        name: ImageMagickTools.BATCH_RESIZE,
        description: "Resize multiple images with the same settings",
        inputSchema: {
          type: "object",
          properties: {
            inputPaths: {
              type: "string",
              description: "Comma-separated or JSON array of image paths",
            },
            outputDir: {
              type: "string",
              description: "Directory where resized images will be saved",
            },
            width: {
              type: "number",
              description: "Target width in pixels",
            },
            height: {
              type: "number",
              description: "Target height in pixels",
            },
            maintainAspect: {
              type: "boolean",
              description: "Maintain aspect ratio (default: true)",
            },
            quality: {
              type: "number",
              description: "Output quality (1-100)",
            },
          },
          required: ["inputPaths", "outputDir"],
        },
      },
      {
        name: ImageMagickTools.ADJUST_BRIGHTNESS,
        description: "Adjust image brightness",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where adjusted image will be saved",
            },
            adjustment: {
              type: "number",
              description: "Brightness adjustment (-100 to 100, 0 = no change)",
            },
          },
          required: ["inputPath", "outputPath", "adjustment"],
        },
      },
      {
        name: ImageMagickTools.ADJUST_CONTRAST,
        description: "Adjust image contrast",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where adjusted image will be saved",
            },
            adjustment: {
              type: "number",
              description: "Contrast adjustment (-100 to 100, 0 = no change)",
            },
          },
          required: ["inputPath", "outputPath", "adjustment"],
        },
      },
      {
        name: ImageMagickTools.ADJUST_SATURATION,
        description: "Adjust image saturation",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where adjusted image will be saved",
            },
            adjustment: {
              type: "number",
              description: "Saturation adjustment (0-200, 100 = no change)",
            },
          },
          required: ["inputPath", "outputPath", "adjustment"],
        },
      },
      {
        name: ImageMagickTools.BLUR_IMAGE,
        description: "Apply blur effect to image",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where blurred image will be saved",
            },
            radius: {
              type: "number",
              description: "Blur radius (default: 1)",
            },
            sigma: {
              type: "number",
              description: "Blur standard deviation (default: 1)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: ImageMagickTools.SHARPEN_IMAGE,
        description: "Apply sharpen effect to image",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input image",
            },
            outputPath: {
              type: "string",
              description: "Path where sharpened image will be saved",
            },
            radius: {
              type: "number",
              description: "Sharpen radius (default: 0)",
            },
            sigma: {
              type: "number",
              description: "Sharpen standard deviation (default: 1.0)",
            },
          },
          required: ["inputPath", "outputPath"],
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
      case ImageMagickTools.GET_IMAGE_INFO: {
        if (typeof args.inputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath must be a string");
        }
        const result = await getImageInfo(args.inputPath);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.RESIZE_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await resizeImage(
          args.inputPath,
          args.outputPath,
          args.width as number | undefined,
          args.height as number | undefined,
          args.maintainAspect as boolean | undefined,
          args.quality as number | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.CROP_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" ||
            typeof args.x !== "number" || typeof args.y !== "number" ||
            typeof args.width !== "number" || typeof args.height !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "All parameters must be specified with correct types");
        }
        const result = await cropImage(
          args.inputPath,
          args.outputPath,
          args.x,
          args.y,
          args.width,
          args.height
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ROTATE_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.degrees !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and degrees must be specified with correct types");
        }
        const result = await rotateImage(args.inputPath, args.outputPath, args.degrees);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.FLIP_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.direction !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and direction must be strings");
        }
        if (!["horizontal", "vertical"].includes(args.direction)) {
          throw new McpError(ErrorCode.InvalidParams, "direction must be 'horizontal' or 'vertical'");
        }
        const result = await flipImage(args.inputPath, args.outputPath, args.direction as "horizontal" | "vertical");
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.CONVERT_FORMAT: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.format !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and format must be strings");
        }
        const result = await convertFormat(
          args.inputPath,
          args.outputPath,
          args.format,
          args.quality as number | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ADJUST_QUALITY: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.quality !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and quality must be specified");
        }
        const result = await adjustQuality(args.inputPath, args.outputPath, args.quality);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.CREATE_THUMBNAIL: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await createThumbnail(
          args.inputPath,
          args.outputPath,
          (args.width as number) || 150,
          (args.height as number) || 150,
          (args.quality as number) || 85
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ADD_WATERMARK: {
        if (typeof args.inputPath !== "string" || typeof args.watermarkPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, watermarkPath, and outputPath must be strings");
        }
        const result = await addWatermark(
          args.inputPath,
          args.watermarkPath,
          args.outputPath,
          (args.position as string) || "southeast",
          (args.opacity as number) || 0.7
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.BATCH_RESIZE: {
        if (typeof args.inputPaths !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPaths and outputDir must be strings");
        }
        const inputs = parseInputArray(args.inputPaths);
        const result = await batchResize(
          inputs,
          args.outputDir,
          args.width as number | undefined,
          args.height as number | undefined,
          args.maintainAspect as boolean | undefined,
          args.quality as number | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ADJUST_BRIGHTNESS: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.adjustment !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and adjustment must be specified");
        }
        const result = await adjustBrightness(args.inputPath, args.outputPath, args.adjustment);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ADJUST_CONTRAST: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.adjustment !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and adjustment must be specified");
        }
        const result = await adjustContrast(args.inputPath, args.outputPath, args.adjustment);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.ADJUST_SATURATION: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.adjustment !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and adjustment must be specified");
        }
        const result = await adjustSaturation(args.inputPath, args.outputPath, args.adjustment);
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.BLUR_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await blurImage(
          args.inputPath,
          args.outputPath,
          (args.radius as number) || 1,
          (args.sigma as number) || 1
        );
        return { content: [{ type: "text", text: result }] };
      }

      case ImageMagickTools.SHARPEN_IMAGE: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await sharpenImage(
          args.inputPath,
          args.outputPath,
          (args.radius as number) || 0,
          (args.sigma as number) || 1.0
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
  // Check if ImageMagick is available
  const imageMagickAvailable = await checkImageMagickAvailable();
  if (!imageMagickAvailable) {
    console.error("Warning: ImageMagick not found. Please install ImageMagick to use this server.");
    console.error("Visit https://imagemagick.org/script/download.php for installation instructions.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ImageMagick MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
