import { exec } from "child_process";
import { promisify } from "util";
import { stat, mkdir } from "fs/promises";

export const execAsync = promisify(exec);

/**
 * Check if ImageMagick is available on the system
 */
export async function checkImageMagickAvailable(): Promise<boolean> {
  try {
    // Try ImageMagick 7 syntax first
    await execAsync("magick -version");
    return true;
  } catch {
    try {
      // Fallback to ImageMagick 6 syntax
      await execAsync("convert -version");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if a file or directory exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it recursively if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Parse ImageMagick geometry string (e.g., "800x600", "800x", "x600")
 */
export function parseGeometry(geometry: string): { width?: number; height?: number } {
  const result: { width?: number; height?: number } = {};

  // Handle patterns like "800x600", "800x", "x600"
  const match = geometry.match(/(\d*)?x(\d*)?/);
  if (match) {
    if (match[1]) result.width = parseInt(match[1]);
    if (match[2]) result.height = parseInt(match[2]);
  }

  return result;
}
