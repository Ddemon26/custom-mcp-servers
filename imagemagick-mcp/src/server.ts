#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { stat, mkdir } from "fs/promises";
import { dirname, basename, join } from "path";

const execAsync = promisify(exec);

// Tool name constants
const ImageMagickTools = {
  GET_IMAGE_INFO: "get_image_info",
  RESIZE_IMAGE: "resize_image",
  CROP_IMAGE: "crop_image",
  ROTATE_IMAGE: "rotate_image",
  FLIP_IMAGE: "flip_image",
  CONVERT_FORMAT: "convert_format",
  ADJUST_QUALITY: "adjust_quality",
  CREATE_THUMBNAIL: "create_thumbnail",
  ADD_WATERMARK: "add_watermark",
  BATCH_RESIZE: "batch_resize",
  ADJUST_BRIGHTNESS: "adjust_brightness",
  ADJUST_CONTRAST: "adjust_contrast",
  ADJUST_SATURATION: "adjust_saturation",
  BLUR_IMAGE: "blur_image",
  SHARPEN_IMAGE: "sharpen_image",
} as const;

// Helper function to check if ImageMagick is available
async function checkImageMagickAvailable(): Promise<boolean> {
  try {
    await execAsync("convert -version");
    return true;
  } catch {
    return false;
  }
}

// Helper function to check if file exists
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
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper function to parse geometry string
function parseGeometry(geometry: string): { width?: number; height?: number } {
  const result: { width?: number; height?: number } = {};

  // Handle patterns like "800x600", "800x", "x600"
  const match = geometry.match(/(\d*)?x(\d*)?/);
  if (match) {
    if (match[1]) result.width = parseInt(match[1]);
    if (match[2]) result.height = parseInt(match[2]);
  }

  return result;
}

// Get image information using ImageMagick's identify command
async function getImageInfo(inputPath: string): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const command = `identify -verbose "${inputPath}"`;
    const { stdout, stderr } = await execAsync(command);

    // Parse the verbose output
    const lines = stdout.split("\n");
    const info: any = {
      success: true,
      file: inputPath,
      format: "unknown",
      dimensions: { width: 0, height: 0 },
      resolution: { x: 0, y: 0 },
      fileSize: 0,
      colorSpace: "unknown",
      depth: 0,
      channels: 0,
      properties: {},
      message: "✅ Image info retrieved successfully",
    };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();

      if (key.trim() === "Image:" && value) {
        info.format = value.split(" ")[0];
      } else if (key.trim() === "Geometry:") {
        const match = value.match(/(\d+)x(\d+)/);
        if (match) {
          info.dimensions.width = parseInt(match[1]);
          info.dimensions.height = parseInt(match[2]);
        }
      } else if (key.trim() === "Resolution:") {
        const match = value.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
        if (match) {
          info.resolution.x = parseFloat(match[1]);
          info.resolution.y = parseFloat(match[2]);
        }
      } else if (key.trim() === "Filesize:") {
        // Convert various formats to bytes
        if (value.includes("B")) {
          const match = value.match(/([\d.]+)\s*(B|KB|MB|GB)/);
          if (match) {
            const size = parseFloat(match[1]);
            const unit = match[2];
            let bytes = size;
            if (unit === "KB") bytes = size * 1024;
            else if (unit === "MB") bytes = size * 1024 * 1024;
            else if (unit === "GB") bytes = size * 1024 * 1024 * 1024;
            info.fileSize = Math.round(bytes);
          }
        }
      } else if (key.trim() === "Colorspace:") {
        info.colorSpace = value;
      } else if (key.trim() === "Depth:") {
        const match = value.match(/(\d+)-bit/);
        if (match) {
          info.depth = parseInt(match[1]);
        }
      } else if (key.trim() === "Channel depth:") {
        const matches = Array.from(value.matchAll(/(\w+): (\d+)-bit/g));
        if (matches) {
          info.channels = matches.length;
        }
      }
    }

    return JSON.stringify(info, null, 2);
  } catch (error) {
    throw new Error(`Failed to get image info: ${error}`);
  }
}

// Resize image
async function resizeImage(
  inputPath: string,
  outputPath: string,
  width?: number,
  height?: number,
  maintainAspect: boolean = true,
  quality?: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    let geometry = "";
    if (width && height) {
      geometry = maintainAspect ? `${width}x${height}` : `${width}x${height}!`;
    } else if (width) {
      geometry = `${width}`;
    } else if (height) {
      geometry = `x${height}`;
    } else {
      throw new Error("Either width or height must be specified");
    }

    const qualityArg = quality ? `-quality ${quality}` : "";
    const command = `convert "${inputPath}" -resize ${geometry} ${qualityArg} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "resize_image",
      input: inputPath,
      output: outputPath,
      geometry,
      maintainAspect,
      quality: quality || "default",
      fileSize: formatBytes(stats.size),
      message: `✅ Image resized successfully to ${geometry}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Image resize failed: ${error}`);
  }
}

// Crop image
async function cropImage(
  inputPath: string,
  outputPath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const geometry = `${width}x${height}+${x}+${y}`;
    const command = `convert "${inputPath}" -crop ${geometry} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "crop_image",
      input: inputPath,
      output: outputPath,
      cropArea: { x, y, width, height },
      fileSize: formatBytes(stats.size),
      message: `✅ Image cropped successfully (${width}x${height} at ${x},${y})`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Image crop failed: ${error}`);
  }
}

// Rotate image
async function rotateImage(
  inputPath: string,
  outputPath: string,
  degrees: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -rotate ${degrees} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "rotate_image",
      input: inputPath,
      output: outputPath,
      degrees,
      fileSize: formatBytes(stats.size),
      message: `✅ Image rotated ${degrees} degrees`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Image rotation failed: ${error}`);
  }
}

// Flip image
async function flipImage(
  inputPath: string,
  outputPath: string,
  direction: "horizontal" | "vertical"
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const flipArg = direction === "horizontal" ? "-flop" : "-flip";
    const command = `convert "${inputPath}" ${flipArg} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "flip_image",
      input: inputPath,
      output: outputPath,
      direction,
      fileSize: formatBytes(stats.size),
      message: `✅ Image flipped ${direction}ly`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Image flip failed: ${error}`);
  }
}

// Convert image format
async function convertFormat(
  inputPath: string,
  outputPath: string,
  format: string,
  quality?: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const qualityArg = quality ? `-quality ${quality}` : "";
    const command = `convert "${inputPath}" ${qualityArg} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "convert_format",
      input: inputPath,
      output: outputPath,
      format: format.toUpperCase(),
      quality: quality || "default",
      fileSize: formatBytes(stats.size),
      message: `✅ Image converted to ${format.toUpperCase()}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Format conversion failed: ${error}`);
  }
}

// Adjust image quality
async function adjustQuality(
  inputPath: string,
  outputPath: string,
  quality: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    if (quality < 1 || quality > 100) {
      throw new Error("Quality must be between 1 and 100");
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -quality ${quality} "${outputPath}"`;

    await execAsync(command);

    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);
    const sizeChange = ((outputStats.size - inputStats.size) / inputStats.size * 100).toFixed(1);

    return JSON.stringify({
      success: true,
      operation: "adjust_quality",
      input: inputPath,
      output: outputPath,
      quality,
      originalSize: formatBytes(inputStats.size),
      newSize: formatBytes(outputStats.size),
      sizeChange: `${sizeChange}%`,
      message: `✅ Quality adjusted to ${quality}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Quality adjustment failed: ${error}`);
  }
}

// Create thumbnail
async function createThumbnail(
  inputPath: string,
  outputPath: string,
  width: number = 150,
  height: number = 150,
  quality: number = 85
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -thumbnail ${width}x${height} -quality ${quality} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "create_thumbnail",
      input: inputPath,
      output: outputPath,
      size: `${width}x${height}`,
      quality,
      fileSize: formatBytes(stats.size),
      message: `✅ Thumbnail created (${width}x${height})`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Thumbnail creation failed: ${error}`);
  }
}

// Add watermark to image
async function addWatermark(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  position: string = "southeast",
  opacity: number = 0.7
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input image not found: ${inputPath}`);
    }
    if (!await pathExists(watermarkPath)) {
      throw new Error(`Watermark image not found: ${watermarkPath}`);
    }

    await ensureDir(dirname(outputPath));

    const gravityMap: { [key: string]: string } = {
      "northwest": "NorthWest",
      "north": "North",
      "northeast": "NorthEast",
      "west": "West",
      "center": "Center",
      "east": "East",
      "southwest": "SouthWest",
      "south": "South",
      "southeast": "SouthEast",
    };

    const gravity = gravityMap[position.toLowerCase()] || "SouthEast";
    const opacityArg = Math.round(opacity * 100);

    const command = `composite -gravity ${gravity} -dissolve ${opacityArg} "${watermarkPath}" "${inputPath}" "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "add_watermark",
      input: inputPath,
      watermark: watermarkPath,
      output: outputPath,
      position,
      opacity,
      fileSize: formatBytes(stats.size),
      message: `✅ Watermark added at ${position}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Watermark addition failed: ${error}`);
  }
}

// Batch resize multiple images
async function batchResize(
  inputPaths: string[],
  outputDir: string,
  width?: number,
  height?: number,
  maintainAspect: boolean = true,
  quality?: number
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const results: any[] = [];

    for (const inputPath of inputPaths) {
      try {
        if (!await pathExists(inputPath)) {
          results.push({ input: inputPath, status: "❌ File not found" });
          continue;
        }

        const filename = basename(inputPath);
        const outputPath = join(outputDir, filename);

        let geometry = "";
        if (width && height) {
          geometry = maintainAspect ? `${width}x${height}` : `${width}x${height}!`;
        } else if (width) {
          geometry = `${width}`;
        } else if (height) {
          geometry = `x${height}`;
        }

        const qualityArg = quality ? `-quality ${quality}` : "";
        const command = `convert "${inputPath}" -resize ${geometry} ${qualityArg} "${outputPath}"`;
        await execAsync(command);

        const stats = await stat(outputPath);
        results.push({
          input: inputPath,
          output: outputPath,
          status: "✅ Success",
          geometry,
          fileSize: formatBytes(stats.size),
        });
      } catch (error) {
        results.push({ input: inputPath, status: `❌ Error: ${error}` });
      }
    }

    const successCount = results.filter(r => r.status.startsWith("✅")).length;

    return JSON.stringify({
      success: true,
      operation: "batch_resize",
      totalFiles: inputPaths.length,
      successCount,
      failCount: inputPaths.length - successCount,
      outputDir,
      results,
      message: `✅ Batch resize completed: ${successCount}/${inputPaths.length} files processed`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Batch resize failed: ${error}`);
  }
}

// Adjust brightness
async function adjustBrightness(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -brightness-contrast ${adjustment}x0 "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "adjust_brightness",
      input: inputPath,
      output: outputPath,
      adjustment,
      fileSize: formatBytes(stats.size),
      message: `✅ Brightness adjusted by ${adjustment}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Brightness adjustment failed: ${error}`);
  }
}

// Adjust contrast
async function adjustContrast(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -brightness-contrast 0x${adjustment} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "adjust_contrast",
      input: inputPath,
      output: outputPath,
      adjustment,
      fileSize: formatBytes(stats.size),
      message: `✅ Contrast adjusted by ${adjustment}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Contrast adjustment failed: ${error}`);
  }
}

// Adjust saturation
async function adjustSaturation(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -modulate 100,${adjustment} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "adjust_saturation",
      input: inputPath,
      output: outputPath,
      adjustment,
      fileSize: formatBytes(stats.size),
      message: `✅ Saturation adjusted to ${adjustment}%`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Saturation adjustment failed: ${error}`);
  }
}

// Blur image
async function blurImage(
  inputPath: string,
  outputPath: string,
  radius: number = 1,
  sigma: number = 1
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -blur ${radius}x${sigma} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "blur_image",
      input: inputPath,
      output: outputPath,
      radius,
      sigma,
      fileSize: formatBytes(stats.size),
      message: `✅ Image blurred (${radius}x${sigma})`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Blur operation failed: ${error}`);
  }
}

// Sharpen image
async function sharpenImage(
  inputPath: string,
  outputPath: string,
  radius: number = 0,
  sigma: number = 1.0
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `convert "${inputPath}" -sharpen ${radius}x${sigma} "${outputPath}"`;

    await execAsync(command);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "sharpen_image",
      input: inputPath,
      output: outputPath,
      radius,
      sigma,
      fileSize: formatBytes(stats.size),
      message: `✅ Image sharpened (${radius}x${sigma})`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Sharpen operation failed: ${error}`);
  }
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

// Helper to parse input arrays (comma-separated or JSON)
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