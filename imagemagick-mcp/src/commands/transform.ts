import { stat } from "fs/promises";
import { dirname } from "path";
import { execAsync, pathExists, ensureDir, formatBytes } from "../utils.js";
import { FlipDirection } from "../types.js";

/**
 * Resize an image to specified dimensions
 */
export async function resizeImage(
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
    const command = `magick convert "${inputPath}" -resize ${geometry} ${qualityArg} "${outputPath}"`;

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

/**
 * Crop an image to a specified rectangle
 */
export async function cropImage(
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
    const command = `magick convert "${inputPath}" -crop ${geometry} "${outputPath}"`;

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

/**
 * Rotate an image by specified degrees
 */
export async function rotateImage(
  inputPath: string,
  outputPath: string,
  degrees: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `magick convert "${inputPath}" -rotate ${degrees} "${outputPath}"`;

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

/**
 * Flip an image horizontally or vertically
 */
export async function flipImage(
  inputPath: string,
  outputPath: string,
  direction: FlipDirection
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const flipArg = direction === "horizontal" ? "-flop" : "-flip";
    const command = `magick convert "${inputPath}" ${flipArg} "${outputPath}"`;

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
