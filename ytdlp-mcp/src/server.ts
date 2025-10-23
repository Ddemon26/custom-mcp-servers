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
import { stat, mkdir } from "fs/promises";
import { dirname, join, basename } from "path";
import { homedir } from "os";

// Tool name constants
const YtDlpTools = {
  GET_VIDEO_INFO: "get_video_info",
  DOWNLOAD_VIDEO: "download_video",
  DOWNLOAD_AUDIO: "download_audio",
  DOWNLOAD_PLAYLIST: "download_playlist",
  LIST_FORMATS: "list_formats",
  DOWNLOAD_SUBTITLES: "download_subtitles",
  DOWNLOAD_THUMBNAIL: "download_thumbnail",
  SEARCH_VIDEOS: "search_videos",
  DOWNLOAD_CHANNEL: "download_channel",
  EXTRACT_CHAPTERS: "extract_chapters",
} as const;

async function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
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

// Helper function to check if yt-dlp is available
async function checkYtDlpAvailable(): Promise<boolean> {
  try {
    await runProcess("yt-dlp", ["--version"]);
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

// Helper function to parse duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Get video information
async function getVideoInfo(url: string): Promise<string> {
  try {
    const { stdout } = await runProcess("yt-dlp", ["--dump-json", "--no-playlist", url]);
    const info = JSON.parse(stdout);

    const result = {
      success: true,
      url,
      title: info.title || "N/A",
      uploader: info.uploader || info.channel || "N/A",
      duration: info.duration ? formatDuration(info.duration) : "N/A",
      viewCount: info.view_count ? info.view_count.toLocaleString() : "N/A",
      likeCount: info.like_count ? info.like_count.toLocaleString() : "N/A",
      uploadDate: info.upload_date || "N/A",
      description: info.description ? info.description.substring(0, 500) + "..." : "N/A",
      thumbnail: info.thumbnail || "N/A",
      webpage_url: info.webpage_url || url,
      formats: info.formats ? info.formats.length : 0,
      hasSubtitles: info.subtitles ? Object.keys(info.subtitles).length > 0 : false,
      message: "✅ Video info retrieved successfully",
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(`Failed to get video info: ${error}`);
  }
}

// Download video
async function downloadVideo(
  url: string,
  outputDir: string,
  quality: string = "best",
  format?: string
): Promise<string> {
  try {
    await ensureDir(outputDir);

    let formatString: string;
    switch (quality.toLowerCase()) {
      case "best":
        formatString = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
        break;
      case "1080p":
        formatString = "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]";
        break;
      case "720p":
        formatString = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]";
        break;
      case "480p":
        formatString = "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]";
        break;
      default:
        formatString = format || "best";
    }

    const outputTemplate = join(outputDir, "%(title)s.%(ext)s");
    const args = [
      "-f", formatString,
      "--no-playlist",
      "-o", outputTemplate,
      url,
    ];

    const { stdout, stderr } = await runProcess("yt-dlp", args);

    // Extract filename from output
    const downloadMatch = stdout.match(/\[download\] Destination: (.+)/);
    const filename = downloadMatch ? basename(downloadMatch[1]) : "downloaded file";

    return JSON.stringify({
      success: true,
      operation: "download_video",
      url,
      outputDir,
      quality,
      filename,
      message: `✅ Video downloaded successfully: ${filename}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Video download failed: ${error}`);
  }
}

// Download audio only
async function downloadAudio(
  url: string,
  outputDir: string,
  format: string = "mp3",
  quality: string = "192"
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const outputTemplate = join(outputDir, "%(title)s.%(ext)s");
    const args = [
      "-x",
      "--audio-format", format,
      "--audio-quality", `${quality}K`,
      "--no-playlist",
      "-o", outputTemplate,
      url,
    ];

    const { stdout } = await runProcess("yt-dlp", args);

    // Extract filename from output
    const downloadMatch = stdout.match(/\[ExtractAudio\] Destination: (.+)/);
    const filename = downloadMatch ? basename(downloadMatch[1]) : `audio.${format}`;

    return JSON.stringify({
      success: true,
      operation: "download_audio",
      url,
      outputDir,
      format,
      quality: `${quality}K`,
      filename,
      message: `✅ Audio downloaded successfully: ${filename}`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Audio download failed: ${error}`);
  }
}

// Download playlist
async function downloadPlaylist(
  url: string,
  outputDir: string,
  quality: string = "best",
  startIndex?: number,
  endIndex?: number
): Promise<string> {
  try {
    await ensureDir(outputDir);

    let formatString = quality === "best"
      ? "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
      : `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]`;

    const outputTemplate = join(outputDir, "%(playlist_index)s - %(title)s.%(ext)s");
    const args = ["-f", formatString];
    if (typeof startIndex === "number") {
      args.push("--playlist-start", String(startIndex));
    }
    if (typeof endIndex === "number") {
      args.push("--playlist-end", String(endIndex));
    }
    args.push("-o", outputTemplate, url);

    const { stdout } = await runProcess("yt-dlp", args);

    // Count downloaded files
    const downloadedCount = (stdout.match(/\[download\] Destination:/g) || []).length;

    return JSON.stringify({
      success: true,
      operation: "download_playlist",
      url,
      outputDir,
      quality,
      downloadedCount,
      message: `✅ Playlist downloaded: ${downloadedCount} videos`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Playlist download failed: ${error}`);
  }
}

// List available formats
async function listFormats(url: string): Promise<string> {
  try {
    const { stdout } = await runProcess("yt-dlp", ["-F", "--no-playlist", url]);

    // Parse the format list
    const lines = stdout.split("\n");
    const formatLines = lines.filter(line =>
      line.match(/^\d+/) && !line.includes("format code")
    );

    const formats = formatLines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        id: parts[0],
        ext: parts[1],
        resolution: parts[2] || "audio only",
        info: parts.slice(3).join(" "),
      };
    });

    return JSON.stringify({
      success: true,
      url,
      formatCount: formats.length,
      formats: formats.slice(0, 20), // Limit to first 20 for readability
      fullOutput: stdout,
      message: `✅ Found ${formats.length} available formats`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Failed to list formats: ${error}`);
  }
}

// Download subtitles
async function downloadSubtitles(
  url: string,
  outputDir: string,
  languages: string = "en",
  autoGenerated: boolean = false
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const outputTemplate = join(outputDir, "%(title)s.%(ext)s");
    const args = [
      "--write-sub",
      "--sub-lang", languages,
      "--skip-download",
      "--no-playlist",
      "-o", outputTemplate,
      url,
    ];
    if (autoGenerated) {
      args.splice(3, 0, "--write-auto-sub");
    }

    const { stdout } = await runProcess("yt-dlp", args);

    return JSON.stringify({
      success: true,
      operation: "download_subtitles",
      url,
      outputDir,
      languages,
      autoGenerated,
      message: "✅ Subtitles downloaded successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Subtitle download failed: ${error}`);
  }
}

// Download thumbnail
async function downloadThumbnail(
  url: string,
  outputDir: string,
  format: string = "jpg"
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const outputTemplate = join(outputDir, "%(title)s.%(ext)s");
    const args = [
      "--write-thumbnail",
      "--skip-download",
      "--convert-thumbnails", format,
      "--no-playlist",
      "-o", outputTemplate,
      url,
    ];

    const { stdout } = await runProcess("yt-dlp", args);

    return JSON.stringify({
      success: true,
      operation: "download_thumbnail",
      url,
      outputDir,
      format,
      message: "✅ Thumbnail downloaded successfully",
    }, null, 2);
  } catch (error) {
    throw new Error(`Thumbnail download failed: ${error}`);
  }
}

// Search videos (uses ytsearch: prefix)
async function searchVideos(
  query: string,
  maxResults: number = 10
): Promise<string> {
  try {
    const searchQuery = `ytsearch${maxResults}:${query}`;
    const { stdout } = await runProcess("yt-dlp", ["--dump-json", "--flat-playlist", searchQuery]);

    // Parse JSON lines
    const results = stdout.trim().split("\n").map(line => {
      try {
        const info = JSON.parse(line);
        return {
          title: info.title,
          url: info.url || `https://www.youtube.com/watch?v=${info.id}`,
          uploader: info.uploader || info.channel,
          duration: info.duration ? formatDuration(info.duration) : "N/A",
          viewCount: info.view_count ? info.view_count.toLocaleString() : "N/A",
        };
      } catch {
        return null;
      }
    }).filter(r => r !== null);

    return JSON.stringify({
      success: true,
      query,
      resultCount: results.length,
      results,
      message: `✅ Found ${results.length} results`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Search failed: ${error}`);
  }
}

// Download from channel
async function downloadChannel(
  channelUrl: string,
  outputDir: string,
  maxDownloads?: number,
  dateAfter?: string
): Promise<string> {
  try {
    await ensureDir(outputDir);

    const outputTemplate = join(outputDir, "%(upload_date)s - %(title)s.%(ext)s");
    const args = [
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
      "-o", outputTemplate,
    ];
    if (typeof maxDownloads === "number") {
      args.push("--max-downloads", String(maxDownloads));
    }
    if (dateAfter) {
      args.push("--dateafter", dateAfter);
    }
    args.push(channelUrl);

    const { stdout } = await runProcess("yt-dlp", args);

    const downloadedCount = (stdout.match(/\[download\] Destination:/g) || []).length;

    return JSON.stringify({
      success: true,
      operation: "download_channel",
      channelUrl,
      outputDir,
      downloadedCount,
      message: `✅ Downloaded ${downloadedCount} videos from channel`,
    }, null, 2);
  } catch (error) {
    throw new Error(`Channel download failed: ${error}`);
  }
}

// Extract chapter information
async function extractChapters(url: string): Promise<string> {
  try {
    const { stdout } = await runProcess("yt-dlp", ["--dump-json", "--no-playlist", url]);
    const info = JSON.parse(stdout);

    const chapters = info.chapters || [];

    const formattedChapters = chapters.map((chapter: any) => ({
      title: chapter.title,
      startTime: formatDuration(chapter.start_time),
      endTime: formatDuration(chapter.end_time),
      startSeconds: chapter.start_time,
      endSeconds: chapter.end_time,
    }));

    return JSON.stringify({
      success: true,
      url,
      videoTitle: info.title,
      chapterCount: chapters.length,
      chapters: formattedChapters,
      message: chapters.length > 0
        ? `✅ Found ${chapters.length} chapters`
        : "ℹ️ No chapters found in this video",
    }, null, 2);
  } catch (error) {
    throw new Error(`Failed to extract chapters: ${error}`);
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "yt-dlp-mcp-server",
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
        name: YtDlpTools.GET_VIDEO_INFO,
        description: "Get detailed information about a video (title, duration, views, uploader, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL (YouTube, Vimeo, Twitter, etc.)",
            },
          },
          required: ["url"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_VIDEO,
        description: "Download video from supported platforms",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL to download",
            },
            outputDir: {
              type: "string",
              description: "Directory where video will be saved",
            },
            quality: {
              type: "string",
              description: "Video quality: best, 1080p, 720p, 480p (default: best)",
            },
            format: {
              type: "string",
              description: "Custom format string (advanced)",
            },
          },
          required: ["url", "outputDir"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_AUDIO,
        description: "Download audio only from video",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL",
            },
            outputDir: {
              type: "string",
              description: "Directory where audio will be saved",
            },
            format: {
              type: "string",
              description: "Audio format: mp3, m4a, wav, opus, flac (default: mp3)",
            },
            quality: {
              type: "string",
              description: "Audio quality in kbps: 128, 192, 256, 320 (default: 192)",
            },
          },
          required: ["url", "outputDir"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_PLAYLIST,
        description: "Download entire playlist or specific range",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Playlist URL",
            },
            outputDir: {
              type: "string",
              description: "Directory where videos will be saved",
            },
            quality: {
              type: "string",
              description: "Video quality: best, 1080p, 720p, 480p (default: best)",
            },
            startIndex: {
              type: "number",
              description: "Start from this playlist index (optional)",
            },
            endIndex: {
              type: "number",
              description: "End at this playlist index (optional)",
            },
          },
          required: ["url", "outputDir"],
        },
      },
      {
        name: YtDlpTools.LIST_FORMATS,
        description: "List all available download formats and qualities",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL",
            },
          },
          required: ["url"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_SUBTITLES,
        description: "Download video subtitles/captions",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL",
            },
            outputDir: {
              type: "string",
              description: "Directory where subtitles will be saved",
            },
            languages: {
              type: "string",
              description: "Comma-separated language codes (e.g., 'en,es,fr')",
            },
            autoGenerated: {
              type: "boolean",
              description: "Include auto-generated subtitles (default: false)",
            },
          },
          required: ["url", "outputDir"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_THUMBNAIL,
        description: "Download video thumbnail image",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL",
            },
            outputDir: {
              type: "string",
              description: "Directory where thumbnail will be saved",
            },
            format: {
              type: "string",
              description: "Image format: jpg, png, webp (default: jpg)",
            },
          },
          required: ["url", "outputDir"],
        },
      },
      {
        name: YtDlpTools.SEARCH_VIDEOS,
        description: "Search for videos on YouTube",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results (default: 10)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: YtDlpTools.DOWNLOAD_CHANNEL,
        description: "Download videos from a channel",
        inputSchema: {
          type: "object",
          properties: {
            channelUrl: {
              type: "string",
              description: "Channel URL",
            },
            outputDir: {
              type: "string",
              description: "Directory where videos will be saved",
            },
            maxDownloads: {
              type: "number",
              description: "Maximum number of videos to download (optional)",
            },
            dateAfter: {
              type: "string",
              description: "Only download videos after this date (YYYYMMDD format)",
            },
          },
          required: ["channelUrl", "outputDir"],
        },
      },
      {
        name: YtDlpTools.EXTRACT_CHAPTERS,
        description: "Extract chapter/timestamp information from video",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Video URL",
            },
          },
          required: ["url"],
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
      case YtDlpTools.GET_VIDEO_INFO: {
        if (typeof args.url !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url must be a string");
        }
        const result = await getVideoInfo(args.url);
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_VIDEO: {
        if (typeof args.url !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url and outputDir must be strings");
        }
        const result = await downloadVideo(
          args.url,
          args.outputDir,
          (args.quality as string) || "best",
          args.format as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_AUDIO: {
        if (typeof args.url !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url and outputDir must be strings");
        }
        const result = await downloadAudio(
          args.url,
          args.outputDir,
          (args.format as string) || "mp3",
          (args.quality as string) || "192"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_PLAYLIST: {
        if (typeof args.url !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url and outputDir must be strings");
        }
        const result = await downloadPlaylist(
          args.url,
          args.outputDir,
          (args.quality as string) || "best",
          args.startIndex as number | undefined,
          args.endIndex as number | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.LIST_FORMATS: {
        if (typeof args.url !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url must be a string");
        }
        const result = await listFormats(args.url);
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_SUBTITLES: {
        if (typeof args.url !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url and outputDir must be strings");
        }
        const result = await downloadSubtitles(
          args.url,
          args.outputDir,
          (args.languages as string) || "en",
          (args.autoGenerated as boolean) || false
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_THUMBNAIL: {
        if (typeof args.url !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url and outputDir must be strings");
        }
        const result = await downloadThumbnail(
          args.url,
          args.outputDir,
          (args.format as string) || "jpg"
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.SEARCH_VIDEOS: {
        if (typeof args.query !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "query must be a string");
        }
        const result = await searchVideos(
          args.query,
          (args.maxResults as number) || 10
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.DOWNLOAD_CHANNEL: {
        if (typeof args.channelUrl !== "string" || typeof args.outputDir !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "channelUrl and outputDir must be strings");
        }
        const result = await downloadChannel(
          args.channelUrl,
          args.outputDir,
          args.maxDownloads as number | undefined,
          args.dateAfter as string | undefined
        );
        return { content: [{ type: "text", text: result }] };
      }

      case YtDlpTools.EXTRACT_CHAPTERS: {
        if (typeof args.url !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "url must be a string");
        }
        const result = await extractChapters(args.url);
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
  // Check if yt-dlp is available
  const ytDlpAvailable = await checkYtDlpAvailable();
  if (!ytDlpAvailable) {
    console.error("Warning: yt-dlp not found. Please install yt-dlp to use this server.");
    console.error("Visit https://github.com/yt-dlp/yt-dlp#installation for installation instructions.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("yt-dlp MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
