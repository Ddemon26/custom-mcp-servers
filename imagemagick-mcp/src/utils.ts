import { spawn } from "child_process";
import { stat, mkdir } from "fs/promises";

type MagickInvocation = {
  binary: string;
  includeSubcommand: boolean;
};

const invocationCache = new Map<string, MagickInvocation>();

async function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error: any = new Error(`${command} exited with code ${code}`);
        error.exitCode = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

/**
 * Execute ImageMagick using either the modern `magick` entrypoint or legacy per-tool binaries.
 * Automatically falls back and caches the working invocation for each subcommand.
 */
export async function runImageMagickCommand(
  subcommand: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const candidates: MagickInvocation[] = [];
  const cached = invocationCache.get(subcommand);

  const pushCandidate = (candidate: MagickInvocation) => {
    if (!candidates.some((c) => c.binary === candidate.binary && c.includeSubcommand === candidate.includeSubcommand)) {
      candidates.push(candidate);
    }
  };

  if (cached) {
    pushCandidate(cached);
  }

  pushCandidate({ binary: "magick", includeSubcommand: true });
  pushCandidate({ binary: subcommand, includeSubcommand: false });

  let lastNotFoundError: unknown = null;

  for (const candidate of candidates) {
    const fullArgs = candidate.includeSubcommand ? [subcommand, ...args] : args;
    try {
      const result = await runProcess(candidate.binary, fullArgs);
      invocationCache.set(subcommand, candidate);
      return result;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        lastNotFoundError = error;
        continue;
      }
      throw error;
    }
  }

  const error = new Error(
    `ImageMagick command "${subcommand}" was not found. Install ImageMagick or ensure it is available on PATH.`
  );
  (error as any).cause = lastNotFoundError;
  throw error;
}

/**
 * Check if ImageMagick is available on the system
 */
export async function checkImageMagickAvailable(): Promise<boolean> {
  try {
    await runImageMagickCommand("convert", ["-version"]);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.cause?.code === "ENOENT") {
      return false;
    }
    return false;
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
