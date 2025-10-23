import { stat } from "fs/promises";
import { dirname, basename, join } from "path";
import { execAsync, pathExists, ensureDir, formatBytes } from "../utils.js";
import { GRAVITY_MAP, WatermarkPosition } from "../types.js";

/**
 * Create a thumbnail of specified size
 */
export async function createThumbnail(
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

    const command = `magick convert "${inputPath}" -thumbnail ${width}x${height} -quality ${quality} "${outputPath}"`;

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

/**
 * Add a watermark to an image
 */
export async function addWatermark(
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

    const gravity = GRAVITY_MAP[position.toLowerCase()] || "SouthEast";
    const opacityArg = Math.round(opacity * 100);

    const command = `magick composite -gravity ${gravity} -dissolve ${opacityArg} "${watermarkPath}" "${inputPath}" "${outputPath}"`;

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

/**
 * Batch resize multiple images
 */
export async function batchResize(
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
        const command = `magick convert "${inputPath}" -resize ${geometry} ${qualityArg} "${outputPath}"`;
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
