import { stat } from "fs/promises";
import { dirname } from "path";
import { runImageMagickCommand, pathExists, ensureDir, formatBytes } from "../utils.js";

/**
 * Convert an image to a different format
 */
export async function convertFormat(
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

    const magickArgs = [
      inputPath,
      ...(quality ? ["-quality", String(quality)] : []),
      outputPath,
    ];

    await runImageMagickCommand("convert", magickArgs);

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

/**
 * Adjust image quality/compression
 */
export async function adjustQuality(
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

    const magickArgs = [
      inputPath,
      "-quality",
      String(quality),
      outputPath,
    ];

    await runImageMagickCommand("convert", magickArgs);

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
