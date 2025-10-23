import { execAsync, pathExists } from "../utils.js";

/**
 * Get detailed image information using ImageMagick's identify command
 */
export async function getImageInfo(inputPath: string): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const command = `magick identify -verbose "${inputPath}"`;
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
