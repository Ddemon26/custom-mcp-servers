#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { stat, mkdir, readFile, writeFile, unlink } from "fs/promises";
import { dirname, join, extname, basename } from "path";
import { existsSync } from "fs";

// Tool name constants
const FFmpegTools = {
  GET_MEDIA_INFO: "get_media_info",
  CONVERT_VIDEO: "convert_video",
  EXTRACT_AUDIO: "extract_audio",
  COMPRESS_VIDEO: "compress_video",
  TRIM_VIDEO: "trim_video",
  RESIZE_VIDEO: "resize_video",
  MERGE_VIDEOS: "merge_videos",
  ADD_AUDIO_TO_VIDEO: "add_audio_to_video",
  EXTRACT_FRAMES: "extract_frames",
  CREATE_GIF: "create_gif",
  ADD_WATERMARK: "add_watermark",
  ADJUST_SPEED: "adjust_speed",
  ROTATE_VIDEO: "rotate_video",
  ADD_SUBTITLES: "add_subtitles",
  BATCH_CONVERT: "batch_convert",
} as const;

async function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error: any = new Error(`${command} exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
  });
}

async function execFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await runProcess("ffmpeg", args);
  } catch (error: any) {
    const stderr = error?.stderr || error?.message || "Unknown FFmpeg error";
    const wrapped: any = new Error(`FFmpeg error: ${stderr}`);
    wrapped.stderr = stderr;
    throw wrapped;
  }
}

// Helper function to check if FFmpeg is available
async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await runProcess("ffmpeg", ["-version"]);
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

// Helper function to parse time string (HH:MM:SS or seconds)
function parseTimeString(timeStr: string): string {
  // If it's already in HH:MM:SS format, return as is
  if (/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(timeStr)) {
    return timeStr;
  }
  // If it's in seconds, convert to HH:MM:SS
  const seconds = parseFloat(timeStr);
  if (!isNaN(seconds)) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.padStart(5, "0")}`;
  }
  return timeStr;
}

// Get media file information using ffprobe
async function getMediaInfo(inputPath: string): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const { stdout } = await runProcess("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ]);
    const info = JSON.parse(stdout);

    const format = info.format || {};
    const videoStream = info.streams?.find((s: any) => s.codec_type === "video");
    const audioStream = info.streams?.find((s: any) => s.codec_type === "audio");

    const duration = format.duration ? `${Math.floor(parseFloat(format.duration))}s` : "N/A";
    const size = format.size ? formatBytes(parseInt(format.size)) : "N/A";
    const bitrate = format.bit_rate ? `${Math.floor(parseInt(format.bit_rate) / 1000)} kbps` : "N/A";

    const result = {
      success: true,
      file: inputPath,
      format: format.format_name || "N/A",
      duration,
      size,
      bitrate,
      video: videoStream ? {
        codec: videoStream.codec_name,
        resolution: `${videoStream.width}x${videoStream.height}`,
        fps: videoStream.r_frame_rate || "N/A",
        pixelFormat: videoStream.pix_fmt || "N/A",
      } : null,
      audio: audioStream ? {
        codec: audioStream.codec_name,
        sampleRate: audioStream.sample_rate ? `${audioStream.sample_rate} Hz` : "N/A",
        channels: audioStream.channels || "N/A",
        bitrate: audioStream.bit_rate ? `${Math.floor(parseInt(audioStream.bit_rate) / 1000)} kbps` : "N/A",
      } : null,
      message: "✅ Media info retrieved successfully",
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(`Failed to get media info: ${error}`);
  }
}

// Convert video to different format
async function convertVideo(
  inputPath: string,
  outputPath: string,
  quality?: string,
  videoCodec?: string,
  audioCodec?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    // Default codecs based on output format
    const ext = extname(outputPath).toLowerCase();
    const vcodec = videoCodec || (ext === ".webm" ? "libvpx-vp9" : "libx264");
    const acodec = audioCodec || (ext === ".webm" ? "libopus" : "aac");
    const crf = quality || "23"; // 23 is default quality

    const args = [
      "-i", inputPath,
      "-c:v", vcodec,
      "-crf", crf,
      "-c:a", acodec,
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "convert_video",
      input: inputPath,
      output: outputPath,
      fileSize: formatBytes(stats.size),
      message: `✅ Video converted successfully to ${extname(outputPath)}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Video conversion failed: ${error}`);
  }
}

// Extract audio from video
async function extractAudio(
  inputPath: string,
  outputPath: string,
  audioCodec?: string,
  bitrate?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    // Default codec based on output format
    const ext = extname(outputPath).toLowerCase();
    let codec = audioCodec;
    if (!codec) {
      switch (ext) {
        case ".mp3": codec = "libmp3lame"; break;
        case ".aac": codec = "aac"; break;
        case ".wav": codec = "pcm_s16le"; break;
        case ".flac": codec = "flac"; break;
        case ".ogg": codec = "libvorbis"; break;
        default: codec = "copy";
      }
    }

    const args = ["-i", inputPath, "-vn", "-c:a", codec];
    if (bitrate) {
      args.push("-b:a", bitrate);
    }
    args.push("-y", outputPath);
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "extract_audio",
      input: inputPath,
      output: outputPath,
      codec,
      fileSize: formatBytes(stats.size),
      message: "✅ Audio extracted successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Audio extraction failed: ${error}`);
  }
}

// Compress video
async function compressVideo(
  inputPath: string,
  outputPath: string,
  crf: number = 28,
  preset: string = "medium"
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    // CRF: 0-51, where 0 is lossless, 23 is default, 51 is worst quality
    const crfValue = Math.max(0, Math.min(51, crf));
    const args = [
      "-i", inputPath,
      "-c:v", "libx264",
      "-crf", String(crfValue),
      "-preset", preset,
      "-c:a", "aac",
      "-b:a", "128k",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);
    const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

    return JSON.stringify({
      success: true,
      operation: "compress_video",
      input: inputPath,
      output: outputPath,
      originalSize: formatBytes(inputStats.size),
      compressedSize: formatBytes(outputStats.size),
      compressionRatio: `${compressionRatio}%`,
      crf: crfValue,
      preset,
      message: "✅ Video compressed successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Video compression failed: ${error}`);
  }
}

// Trim video
async function trimVideo(
  inputPath: string,
  outputPath: string,
  startTime: string,
  duration?: string,
  endTime?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const start = parseTimeString(startTime);
    const args = ["-i", inputPath, "-ss", start];

    if (duration) {
      args.push("-t", parseTimeString(duration));
    } else if (endTime) {
      args.push("-to", parseTimeString(endTime));
    }

    args.push("-c", "copy", "-y", outputPath);
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "trim_video",
      input: inputPath,
      output: outputPath,
      startTime: start,
      duration: duration || "to end",
      fileSize: formatBytes(stats.size),
      message: "✅ Video trimmed successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Video trimming failed: ${error}`);
  }
}

// Resize video
async function resizeVideo(
  inputPath: string,
  outputPath: string,
  width?: number,
  height?: number,
  preset?: string
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    let scale: string;
    if (preset) {
      switch (preset.toLowerCase()) {
        case "720p": scale = "scale=1280:720"; break;
        case "1080p": scale = "scale=1920:1080"; break;
        case "4k": scale = "scale=3840:2160"; break;
        case "480p": scale = "scale=854:480"; break;
        default: scale = "scale=1280:720";
      }
    } else if (width && height) {
      scale = `scale=${width}:${height}`;
    } else if (width) {
      scale = `scale=${width}:-2`; // -2 maintains aspect ratio
    } else if (height) {
      scale = `scale=-2:${height}`;
    } else {
      throw new Error("Either width, height, or preset must be specified");
    }

    const args = [
      "-i", inputPath,
      "-vf", scale,
      "-c:a", "copy",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "resize_video",
      input: inputPath,
      output: outputPath,
      scale: preset || `${width}x${height}`,
      fileSize: formatBytes(stats.size),
      message: "✅ Video resized successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Video resizing failed: ${error}`);
  }
}

// Merge multiple videos
async function mergeVideos(
  inputPaths: string[],
  outputPath: string
): Promise<string> {
  try {
    // Validate all input files exist
    for (const path of inputPaths) {
      if (!await pathExists(path)) {
        throw new Error(`Input file not found: ${path}`);
      }
    }

    await ensureDir(dirname(outputPath));

    // Create a temporary file list
    const fileListPath = join(dirname(outputPath), `filelist_${Date.now()}.txt`);
    const fileListContent = inputPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");

    await writeFile(fileListPath, fileListContent, "utf8");

    const args = [
      "-f", "concat",
      "-safe", "0",
      "-i", fileListPath,
      "-c", "copy",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    // Clean up temp file
    await unlink(fileListPath).catch(() => {});

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "merge_videos",
      inputs: inputPaths,
      output: outputPath,
      fileCount: inputPaths.length,
      fileSize: formatBytes(stats.size),
      message: `✅ ${inputPaths.length} videos merged successfully`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Video merging failed: ${error}`);
  }
}

// Add audio to video
async function addAudioToVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  replaceAudio: boolean = true
): Promise<string> {
  try {
    if (!await pathExists(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!await pathExists(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    await ensureDir(dirname(outputPath));

    let args: string[];
    if (replaceAudio) {
      args = [
        "-i", videoPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        "-y", outputPath,
      ];
    } else {
      args = [
        "-i", videoPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-filter_complex", "[0:a][1:a]amerge=inputs=2[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-shortest",
        "-y", outputPath,
      ];
    }

    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "add_audio_to_video",
      videoInput: videoPath,
      audioInput: audioPath,
      output: outputPath,
      mode: replaceAudio ? "replace" : "merge",
      fileSize: formatBytes(stats.size),
      message: "✅ Audio added to video successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Adding audio to video failed: ${error}`);
  }
}

// Extract frames from video
async function extractFrames(
  inputPath: string,
  outputDir: string,
  startTime?: string,
  duration?: string,
  fps?: number,
  format: string = "jpg"
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(outputDir);

    const outputPattern = join(outputDir, `frame_%04d.${format}`);

    const args = ["-i", inputPath];
    if (startTime) {
      args.push("-ss", parseTimeString(startTime));
    }
    if (duration) {
      args.push("-t", parseTimeString(duration));
    }
    if (fps) {
      args.push("-vf", `fps=${fps}`);
    }
    args.push(outputPattern);

    await execFFmpeg(args);

    return JSON.stringify({
      success: true,
      operation: "extract_frames",
      input: inputPath,
      outputDir,
      format,
      fps: fps || "all frames",
      message: "✅ Frames extracted successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Frame extraction failed: ${error}`);
  }
}

// Create animated GIF
async function createGif(
  inputPath: string,
  outputPath: string,
  startTime?: string,
  duration: string = "5",
  fps: number = 10,
  width: number = 480
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    const filters = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

    const args = ["-i", inputPath];
    if (startTime) {
      args.push("-ss", parseTimeString(startTime));
    }
    args.push("-t", parseTimeString(duration), "-vf", filters, "-y", outputPath);
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "create_gif",
      input: inputPath,
      output: outputPath,
      duration,
      fps,
      width,
      fileSize: formatBytes(stats.size),
      message: "✅ GIF created successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`GIF creation failed: ${error}`);
  }
}

// Add watermark to video
async function addWatermark(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  position: string = "bottom-right",
  opacity: number = 1.0
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    if (!await pathExists(watermarkPath)) {
      throw new Error(`Watermark file not found: ${watermarkPath}`);
    }

    await ensureDir(dirname(outputPath));

    // Position mapping
    let overlay: string;
    switch (position.toLowerCase()) {
      case "top-left": overlay = "10:10"; break;
      case "top-right": overlay = "main_w-overlay_w-10:10"; break;
      case "bottom-left": overlay = "10:main_h-overlay_h-10"; break;
      case "bottom-right": overlay = "main_w-overlay_w-10:main_h-overlay_h-10"; break;
      case "center": overlay = "(main_w-overlay_w)/2:(main_h-overlay_h)/2"; break;
      default: overlay = "main_w-overlay_w-10:main_h-overlay_h-10";
    }

    const alphaFilter = opacity < 1.0 ? `format=rgba,colorchannelmixer=aa=${opacity}` : "";
    const filter = alphaFilter
      ? `[1:v]${alphaFilter}[wm];[0:v][wm]overlay=${overlay}`
      : `overlay=${overlay}`;

    const args = [
      "-i", inputPath,
      "-i", watermarkPath,
      "-filter_complex", filter,
      "-c:a", "copy",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

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
      message: "✅ Watermark added successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Adding watermark failed: ${error}`);
  }
}

// Adjust video speed
async function adjustSpeed(
  inputPath: string,
  outputPath: string,
  speed: number = 1.0
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    if (speed <= 0 || speed > 4) {
      throw new Error("Speed must be between 0 and 4");
    }

    await ensureDir(dirname(outputPath));

    const videoSpeed = 1 / speed;
    const audioSpeed = speed;
    const filter = `[0:v]setpts=${videoSpeed}*PTS[v];[0:a]atempo=${audioSpeed}[a]`;
    const args = [
      "-i", inputPath,
      "-filter_complex", filter,
      "-map", "[v]",
      "-map", "[a]",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "adjust_speed",
      input: inputPath,
      output: outputPath,
      speed: `${speed}x`,
      fileSize: formatBytes(stats.size),
      message: `✅ Video speed adjusted to ${speed}x`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Speed adjustment failed: ${error}`);
  }
}

// Rotate video
async function rotateVideo(
  inputPath: string,
  outputPath: string,
  rotation: string = "90"
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await ensureDir(dirname(outputPath));

    let transpose: string;
    switch (rotation) {
      case "90": transpose = "transpose=1"; break;
      case "180": transpose = "transpose=1,transpose=1"; break;
      case "270": transpose = "transpose=2"; break;
      case "hflip": transpose = "hflip"; break;
      case "vflip": transpose = "vflip"; break;
      default: transpose = "transpose=1";
    }

    const args = [
      "-i", inputPath,
      "-vf", transpose,
      "-c:a", "copy",
      "-y", outputPath,
    ];
    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "rotate_video",
      input: inputPath,
      output: outputPath,
      rotation,
      fileSize: formatBytes(stats.size),
      message: `✅ Video rotated successfully (${rotation})`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Video rotation failed: ${error}`);
  }
}

// Add subtitles to video
async function addSubtitles(
  inputPath: string,
  subtitlePath: string,
  outputPath: string,
  burnIn: boolean = true
): Promise<string> {
  try {
    if (!await pathExists(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    if (!await pathExists(subtitlePath)) {
      throw new Error(`Subtitle file not found: ${subtitlePath}`);
    }

    await ensureDir(dirname(outputPath));

    let args: string[];
    if (burnIn) {
      // Burn subtitles into video
      const escapedPath = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\\\:");
      const filter = `subtitles='${escapedPath}'`;
      args = [
        "-i", inputPath,
        "-vf", filter,
        "-c:a", "copy",
        "-y", outputPath,
      ];
    } else {
      // Embed subtitles as separate stream
      args = [
        "-i", inputPath,
        "-i", subtitlePath,
        "-c", "copy",
        "-c:s", "mov_text",
        "-y", outputPath,
      ];
    }

    await execFFmpeg(args);

    const stats = await stat(outputPath);

    return JSON.stringify({
      success: true,
      operation: "add_subtitles",
      input: inputPath,
      subtitles: subtitlePath,
      output: outputPath,
      mode: burnIn ? "burned-in" : "embedded",
      fileSize: formatBytes(stats.size),
      message: "✅ Subtitles added successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Adding subtitles failed: ${error}`);
  }
}

// Batch convert multiple files
async function batchConvert(
  inputPaths: string[],
  outputDir: string,
  outputFormat: string,
  quality: string = "23"
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const results: Array<{ input: string; output: string; status: string }> = [];

    for (const inputPath of inputPaths) {
      try {
        if (!await pathExists(inputPath)) {
          results.push({ input: inputPath, output: "N/A", status: "❌ File not found" });
          continue;
        }

        const filename = basename(inputPath, extname(inputPath));
        const outputPath = join(outputDir, `${filename}.${outputFormat}`);

        await convertVideo(inputPath, outputPath, quality);
        results.push({ input: inputPath, output: outputPath, status: "✅ Success" });
      } catch (error) {
        results.push({ input: inputPath, output: "N/A", status: `❌ Error: ${error}` });
      }
    }

    const successCount = results.filter(r => r.status.startsWith("✅")).length;

    return JSON.stringify({
      success: true,
      operation: "batch_convert",
      totalFiles: inputPaths.length,
      successCount,
      failCount: inputPaths.length - successCount,
      outputDir,
      results,
      message: `✅ Batch conversion completed: ${successCount}/${inputPaths.length} files processed`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Batch conversion failed: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "ffmpeg-mcp-server",
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
        name: FFmpegTools.GET_MEDIA_INFO,
        description: "Get detailed information about a media file (duration, codecs, resolution, bitrate, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to the media file",
            },
          },
          required: ["inputPath"],
        },
      },
      {
        name: FFmpegTools.CONVERT_VIDEO,
        description: "Convert video to a different format (mp4, avi, mkv, webm, mov, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where converted video will be saved",
            },
            quality: {
              type: "string",
              description: "Quality level (CRF: 0-51, default 23, lower is better)",
            },
            videoCodec: {
              type: "string",
              description: "Video codec (e.g., libx264, libx265, libvpx-vp9)",
            },
            audioCodec: {
              type: "string",
              description: "Audio codec (e.g., aac, mp3, opus)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.EXTRACT_AUDIO,
        description: "Extract audio track from video file",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where audio file will be saved (mp3, wav, aac, flac, ogg)",
            },
            audioCodec: {
              type: "string",
              description: "Audio codec (optional, auto-detected from output format)",
            },
            bitrate: {
              type: "string",
              description: "Audio bitrate (e.g., '128k', '192k', '320k')",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.COMPRESS_VIDEO,
        description: "Compress video to reduce file size",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where compressed video will be saved",
            },
            crf: {
              type: "number",
              description: "Constant Rate Factor (0-51, default 28, higher = smaller file)",
            },
            preset: {
              type: "string",
              description: "Encoding preset (ultrafast, fast, medium, slow, veryslow)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.TRIM_VIDEO,
        description: "Cut/trim video by time range",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where trimmed video will be saved",
            },
            startTime: {
              type: "string",
              description: "Start time (HH:MM:SS or seconds)",
            },
            duration: {
              type: "string",
              description: "Duration to keep (HH:MM:SS or seconds)",
            },
            endTime: {
              type: "string",
              description: "End time (alternative to duration)",
            },
          },
          required: ["inputPath", "outputPath", "startTime"],
        },
      },
      {
        name: FFmpegTools.RESIZE_VIDEO,
        description: "Resize/scale video resolution",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where resized video will be saved",
            },
            width: {
              type: "number",
              description: "Target width in pixels",
            },
            height: {
              type: "number",
              description: "Target height in pixels",
            },
            preset: {
              type: "string",
              description: "Resolution preset (480p, 720p, 1080p, 4k)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.MERGE_VIDEOS,
        description: "Merge/concatenate multiple video files",
        inputSchema: {
          type: "object",
          properties: {
            inputPaths: {
              type: "string",
              description: "Comma-separated or JSON array of video file paths to merge",
            },
            outputPath: {
              type: "string",
              description: "Path where merged video will be saved",
            },
          },
          required: ["inputPaths", "outputPath"],
        },
      },
      {
        name: FFmpegTools.ADD_AUDIO_TO_VIDEO,
        description: "Add or replace audio track in video",
        inputSchema: {
          type: "object",
          properties: {
            videoPath: {
              type: "string",
              description: "Path to video file",
            },
            audioPath: {
              type: "string",
              description: "Path to audio file",
            },
            outputPath: {
              type: "string",
              description: "Path where output video will be saved",
            },
            replaceAudio: {
              type: "boolean",
              description: "Replace existing audio (true) or mix with it (false)",
            },
          },
          required: ["videoPath", "audioPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.EXTRACT_FRAMES,
        description: "Extract video frames as images",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputDir: {
              type: "string",
              description: "Directory where frames will be saved",
            },
            startTime: {
              type: "string",
              description: "Start time (optional)",
            },
            duration: {
              type: "string",
              description: "Duration (optional)",
            },
            fps: {
              type: "number",
              description: "Frames per second to extract (optional)",
            },
            format: {
              type: "string",
              description: "Output format (jpg, png)",
            },
          },
          required: ["inputPath", "outputDir"],
        },
      },
      {
        name: FFmpegTools.CREATE_GIF,
        description: "Create animated GIF from video",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where GIF will be saved",
            },
            startTime: {
              type: "string",
              description: "Start time (optional)",
            },
            duration: {
              type: "string",
              description: "Duration in seconds (default: 5)",
            },
            fps: {
              type: "number",
              description: "Frames per second (default: 10)",
            },
            width: {
              type: "number",
              description: "Width in pixels (default: 480)",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.ADD_WATERMARK,
        description: "Add image watermark to video",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            watermarkPath: {
              type: "string",
              description: "Path to watermark image (PNG recommended)",
            },
            outputPath: {
              type: "string",
              description: "Path where output video will be saved",
            },
            position: {
              type: "string",
              description: "Position: top-left, top-right, bottom-left, bottom-right, center",
            },
            opacity: {
              type: "number",
              description: "Opacity (0.0 to 1.0, default 1.0)",
            },
          },
          required: ["inputPath", "watermarkPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.ADJUST_SPEED,
        description: "Speed up or slow down video",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where output video will be saved",
            },
            speed: {
              type: "number",
              description: "Speed multiplier (0.5 = half speed, 2.0 = double speed)",
            },
          },
          required: ["inputPath", "outputPath", "speed"],
        },
      },
      {
        name: FFmpegTools.ROTATE_VIDEO,
        description: "Rotate or flip video",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            outputPath: {
              type: "string",
              description: "Path where output video will be saved",
            },
            rotation: {
              type: "string",
              description: "Rotation: 90, 180, 270, hflip, vflip",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.ADD_SUBTITLES,
        description: "Add subtitles to video (burn-in or embed)",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to input video file",
            },
            subtitlePath: {
              type: "string",
              description: "Path to subtitle file (.srt, .ass)",
            },
            outputPath: {
              type: "string",
              description: "Path where output video will be saved",
            },
            burnIn: {
              type: "boolean",
              description: "Burn subtitles into video (true) or embed as stream (false)",
            },
          },
          required: ["inputPath", "subtitlePath", "outputPath"],
        },
      },
      {
        name: FFmpegTools.BATCH_CONVERT,
        description: "Convert multiple video files to the same format",
        inputSchema: {
          type: "object",
          properties: {
            inputPaths: {
              type: "string",
              description: "Comma-separated or JSON array of video file paths",
            },
            outputDir: {
              type: "string",
              description: "Directory where converted files will be saved",
            },
            outputFormat: {
              type: "string",
              description: "Output format extension (e.g., mp4, mkv, webm)",
            },
            quality: {
              type: "string",
              description: "Quality level (CRF: 0-51, default 23)",
            },
          },
          required: ["inputPaths", "outputDir", "outputFormat"],
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
      case FFmpegTools.GET_MEDIA_INFO: {
        if (typeof args.inputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath must be a string");
        }
        const result = await getMediaInfo(args.inputPath);
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.CONVERT_VIDEO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await convertVideo(
          args.inputPath,
          args.outputPath,
          args.quality as string | undefined,
          args.videoCodec as string | undefined,
          args.audioCodec as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.EXTRACT_AUDIO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await extractAudio(
          args.inputPath,
          args.outputPath,
          args.audioCodec as string | undefined,
          args.bitrate as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.COMPRESS_VIDEO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await compressVideo(
          args.inputPath,
          args.outputPath,
          args.crf as number | undefined,
          args.preset as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.TRIM_VIDEO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.startTime !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, outputPath, and startTime must be strings");
        }
        const result = await trimVideo(
          args.inputPath,
          args.outputPath,
          args.startTime,
          args.duration as string | undefined,
          args.endTime as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.RESIZE_VIDEO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await resizeVideo(
          args.inputPath,
          args.outputPath,
          args.width as number | undefined,
          args.height as number | undefined,
          args.preset as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.MERGE_VIDEOS: {
        if (typeof args.inputPaths !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPaths and outputPath must be strings");
        }
        const inputs = parseInputArray(args.inputPaths);
        const result = await mergeVideos(inputs, args.outputPath);
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.ADD_AUDIO_TO_VIDEO: {
        if (typeof args.videoPath !== "string" || typeof args.audioPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "videoPath, audioPath, and outputPath must be strings");
        }
        const result = await addAudioToVideo(
          args.videoPath,
          args.audioPath,
          args.outputPath,
          args.replaceAudio as boolean | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.EXTRACT_FRAMES: {
        if (typeof args.inputPath !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputDir must be strings");
        }
        const result = await extractFrames(
          args.inputPath,
          args.outputDir,
          args.startTime as string | undefined,
          args.duration as string | undefined,
          args.fps as number | undefined,
          (args.format as string) || "jpg"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.CREATE_GIF: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await createGif(
          args.inputPath,
          args.outputPath,
          args.startTime as string | undefined,
          (args.duration as string) || "5",
          (args.fps as number) || 10,
          (args.width as number) || 480
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.ADD_WATERMARK: {
        if (typeof args.inputPath !== "string" || typeof args.watermarkPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, watermarkPath, and outputPath must be strings");
        }
        const result = await addWatermark(
          args.inputPath,
          args.watermarkPath,
          args.outputPath,
          (args.position as string) || "bottom-right",
          (args.opacity as number) || 1.0
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.ADJUST_SPEED: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string" || typeof args.speed !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings, speed must be a number");
        }
        const result = await adjustSpeed(args.inputPath, args.outputPath, args.speed);
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.ROTATE_VIDEO: {
        if (typeof args.inputPath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath and outputPath must be strings");
        }
        const result = await rotateVideo(
          args.inputPath,
          args.outputPath,
          (args.rotation as string) || "90"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.ADD_SUBTITLES: {
        if (typeof args.inputPath !== "string" || typeof args.subtitlePath !== "string" || typeof args.outputPath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPath, subtitlePath, and outputPath must be strings");
        }
        const result = await addSubtitles(
          args.inputPath,
          args.subtitlePath,
          args.outputPath,
          args.burnIn !== false
        );
        return { content: [{ type: "text", text: result }] };
      }

      case FFmpegTools.BATCH_CONVERT: {
        if (typeof args.inputPaths !== "string" || typeof args.outputDir !== "string" || typeof args.outputFormat !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "inputPaths, outputDir, and outputFormat must be strings");
        }
        const inputs = parseInputArray(args.inputPaths);
        const result = await batchConvert(
          inputs,
          args.outputDir,
          args.outputFormat,
          (args.quality as string) || "23"
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
  // Check if FFmpeg is available
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    console.error("Warning: FFmpeg not found. Please install FFmpeg to use this server.");
    console.error("Visit https://ffmpeg.org/download.html for installation instructions.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FFmpeg MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
