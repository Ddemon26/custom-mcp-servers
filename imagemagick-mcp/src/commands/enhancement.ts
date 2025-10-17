import { stat } from "fs/promises";
import { dirname } from "path";
import { execAsync, pathExists, ensureDir, formatBytes } from "../utils.js";

/**
 * Adjust image brightness
 */
export async function adjustBrightness(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `magick convert "${inputPath}" -brightness-contrast ${adjustment}x0 "${outputPath}"`;

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

/**
 * Adjust image contrast
 */
export async function adjustContrast(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `magick convert "${inputPath}" -brightness-contrast 0x${adjustment} "${outputPath}"`;

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

/**
 * Adjust image saturation
 */
export async function adjustSaturation(
  inputPath: string,
  outputPath: string,
  adjustment: number
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const command = `magick convert "${inputPath}" -modulate 100,${adjustment} "${outputPath}"`;

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

/**
 * Apply blur effect to an image
 */
export async function blurImage(
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

    const command = `magick convert "${inputPath}" -blur ${radius}x${sigma} "${outputPath}"`;

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

/**
 * Apply sharpen effect to an image
 */
export async function sharpenImage(
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

    const command = `magick convert "${inputPath}" -sharpen ${radius}x${sigma} "${outputPath}"`;

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
