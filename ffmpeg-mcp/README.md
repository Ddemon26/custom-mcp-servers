# FFmpeg MCP Server

A comprehensive Model Context Protocol (MCP) server that provides 15 powerful video and audio processing tools powered by FFmpeg. This server enables AI assistants to perform professional-grade media manipulation tasks.

## Features

### Video Processing
- **Format Conversion** - Convert between any video format (MP4, AVI, MKV, WebM, MOV, FLV)
- **Compression** - Reduce file sizes with quality control
- **Trimming** - Cut videos by time range
- **Resizing** - Change resolution with preset sizes or custom dimensions
- **Merging** - Concatenate multiple videos
- **Speed Adjustment** - Speed up or slow down videos (0.5x to 4x)
- **Rotation** - Rotate or flip videos (90°, 180°, 270°, horizontal, vertical)
- **Watermarking** - Add image watermarks with position and opacity control

### Audio Processing
- **Audio Extraction** - Extract audio tracks from videos
- **Audio Replacement** - Add or replace audio in videos

### Frame & Animation
- **Frame Extraction** - Export video frames as images
- **GIF Creation** - Create animated GIFs from videos with optimization

### Subtitles
- **Subtitle Integration** - Burn-in or embed subtitle files (.srt, .ass)

### Batch Operations
- **Batch Conversion** - Process multiple files at once

### Metadata
- **Media Information** - Get detailed metadata (duration, codecs, resolution, bitrate)

## Prerequisites

**FFmpeg must be installed and available in your system PATH.**

### Installation Instructions

#### Windows
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use:
```bash
# Using Chocolatey
choco install ffmpeg

# Using Scoop
scoop install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Arch
sudo pacman -S ffmpeg
```

## Installation

```bash
# Navigate to the ffmpeg-mcp directory
cd ffmpeg-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## Usage

### Running the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ffmpeg": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\path\\to\\mcp-servers\\ffmpeg-mcp\\dist\\server.js"
      ]
    }
  }
}
```

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "ffmpeg": {
    "command": "node",
    "args": ["C:\\Users\\YourUsername\\path\\to\\mcp-servers\\ffmpeg-mcp\\dist\\server.js"]
  }
}
```

## Tools Reference

### 1. get_media_info

Get detailed information about a media file.

**Parameters:**
- `inputPath` (string, required) - Path to the media file

**Example:**
```json
{
  "inputPath": "C:\\videos\\sample.mp4"
}
```

**Returns:** JSON with duration, codecs, resolution, bitrate, format info

---

### 2. convert_video

Convert video to a different format.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `quality` (string, optional) - CRF value (0-51, default: 23, lower = better)
- `videoCodec` (string, optional) - Video codec (e.g., libx264, libx265, libvpx-vp9)
- `audioCodec` (string, optional) - Audio codec (e.g., aac, mp3, opus)

**Example:**
```json
{
  "inputPath": "C:\\videos\\input.avi",
  "outputPath": "C:\\videos\\output.mp4",
  "quality": "20"
}
```

---

### 3. extract_audio

Extract audio track from video.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output audio file (.mp3, .wav, .aac, .flac, .ogg)
- `audioCodec` (string, optional) - Audio codec (auto-detected from format)
- `bitrate` (string, optional) - Audio bitrate (e.g., "128k", "192k", "320k")

**Example:**
```json
{
  "inputPath": "C:\\videos\\movie.mp4",
  "outputPath": "C:\\audio\\soundtrack.mp3",
  "bitrate": "320k"
}
```

---

### 4. compress_video

Compress video to reduce file size.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `crf` (number, optional) - Compression level (0-51, default: 28, higher = smaller)
- `preset` (string, optional) - Encoding speed (ultrafast, fast, medium, slow, veryslow)

**Example:**
```json
{
  "inputPath": "C:\\videos\\large.mp4",
  "outputPath": "C:\\videos\\compressed.mp4",
  "crf": 28,
  "preset": "medium"
}
```

---

### 5. trim_video

Cut/trim video by time range.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `startTime` (string, required) - Start time (HH:MM:SS or seconds)
- `duration` (string, optional) - Duration to keep (HH:MM:SS or seconds)
- `endTime` (string, optional) - End time (alternative to duration)

**Example:**
```json
{
  "inputPath": "C:\\videos\\long.mp4",
  "outputPath": "C:\\videos\\clip.mp4",
  "startTime": "00:01:30",
  "duration": "00:00:45"
}
```

---

### 6. resize_video

Resize/scale video resolution.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `width` (number, optional) - Target width in pixels
- `height` (number, optional) - Target height in pixels
- `preset` (string, optional) - Resolution preset (480p, 720p, 1080p, 4k)

**Example:**
```json
{
  "inputPath": "C:\\videos\\4k.mp4",
  "outputPath": "C:\\videos\\1080p.mp4",
  "preset": "1080p"
}
```

Or with custom dimensions:
```json
{
  "inputPath": "C:\\videos\\input.mp4",
  "outputPath": "C:\\videos\\output.mp4",
  "width": 1280,
  "height": 720
}
```

---

### 7. merge_videos

Merge/concatenate multiple video files.

**Parameters:**
- `inputPaths` (string, required) - Comma-separated or JSON array of video paths
- `outputPath` (string, required) - Output merged video file

**Example:**
```json
{
  "inputPaths": "[\"C:\\\\videos\\\\part1.mp4\", \"C:\\\\videos\\\\part2.mp4\", \"C:\\\\videos\\\\part3.mp4\"]",
  "outputPath": "C:\\videos\\merged.mp4"
}
```

Or comma-separated:
```json
{
  "inputPaths": "C:\\videos\\part1.mp4, C:\\videos\\part2.mp4, C:\\videos\\part3.mp4",
  "outputPath": "C:\\videos\\merged.mp4"
}
```

---

### 8. add_audio_to_video

Add or replace audio track in video.

**Parameters:**
- `videoPath` (string, required) - Input video file
- `audioPath` (string, required) - Input audio file
- `outputPath` (string, required) - Output video file
- `replaceAudio` (boolean, optional) - Replace existing audio (true) or mix (false)

**Example:**
```json
{
  "videoPath": "C:\\videos\\video.mp4",
  "audioPath": "C:\\audio\\music.mp3",
  "outputPath": "C:\\videos\\output.mp4",
  "replaceAudio": true
}
```

---

### 9. extract_frames

Extract video frames as images.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputDir` (string, required) - Directory where frames will be saved
- `startTime` (string, optional) - Start time
- `duration` (string, optional) - Duration
- `fps` (number, optional) - Frames per second to extract
- `format` (string, optional) - Output format (jpg, png)

**Example:**
```json
{
  "inputPath": "C:\\videos\\movie.mp4",
  "outputDir": "C:\\frames",
  "startTime": "00:00:10",
  "duration": "00:00:05",
  "fps": 1,
  "format": "jpg"
}
```

---

### 10. create_gif

Create animated GIF from video.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output GIF file
- `startTime` (string, optional) - Start time
- `duration` (string, optional) - Duration in seconds (default: 5)
- `fps` (number, optional) - Frames per second (default: 10)
- `width` (number, optional) - Width in pixels (default: 480)

**Example:**
```json
{
  "inputPath": "C:\\videos\\clip.mp4",
  "outputPath": "C:\\gifs\\animated.gif",
  "startTime": "00:00:05",
  "duration": "3",
  "fps": 15,
  "width": 640
}
```

---

### 11. add_watermark

Add image watermark to video.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `watermarkPath` (string, required) - Watermark image (PNG recommended)
- `outputPath` (string, required) - Output video file
- `position` (string, optional) - Position: top-left, top-right, bottom-left, bottom-right, center
- `opacity` (number, optional) - Opacity (0.0 to 1.0, default: 1.0)

**Example:**
```json
{
  "inputPath": "C:\\videos\\video.mp4",
  "watermarkPath": "C:\\images\\logo.png",
  "outputPath": "C:\\videos\\watermarked.mp4",
  "position": "bottom-right",
  "opacity": 0.7
}
```

---

### 12. adjust_speed

Speed up or slow down video.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `speed` (number, required) - Speed multiplier (0.5 = half speed, 2.0 = double speed)

**Example:**
```json
{
  "inputPath": "C:\\videos\\normal.mp4",
  "outputPath": "C:\\videos\\fast.mp4",
  "speed": 2.0
}
```

---

### 13. rotate_video

Rotate or flip video.

**Parameters:**
- `inputPath` (string, required) - Input video file
- `outputPath` (string, required) - Output video file
- `rotation` (string, optional) - Rotation: 90, 180, 270, hflip, vflip (default: 90)

**Example:**
```json
{
  "inputPath": "C:\\videos\\sideways.mp4",
  "outputPath": "C:\\videos\\upright.mp4",
  "rotation": "90"
}
```

---

### 14. add_subtitles

Add subtitles to video (burn-in or embed).

**Parameters:**
- `inputPath` (string, required) - Input video file
- `subtitlePath` (string, required) - Subtitle file (.srt, .ass)
- `outputPath` (string, required) - Output video file
- `burnIn` (boolean, optional) - Burn subtitles into video (true) or embed as stream (false)

**Example:**
```json
{
  "inputPath": "C:\\videos\\movie.mp4",
  "subtitlePath": "C:\\subtitles\\english.srt",
  "outputPath": "C:\\videos\\subtitled.mp4",
  "burnIn": true
}
```

---

### 15. batch_convert

Convert multiple video files to the same format.

**Parameters:**
- `inputPaths` (string, required) - Comma-separated or JSON array of video paths
- `outputDir` (string, required) - Directory where converted files will be saved
- `outputFormat` (string, required) - Output format extension (e.g., mp4, mkv, webm)
- `quality` (string, optional) - Quality level (CRF: 0-51, default: 23)

**Example:**
```json
{
  "inputPaths": "[\"C:\\\\videos\\\\file1.avi\", \"C:\\\\videos\\\\file2.mov\", \"C:\\\\videos\\\\file3.mkv\"]",
  "outputDir": "C:\\videos\\converted",
  "outputFormat": "mp4",
  "quality": "23"
}
```

## Common Use Cases

### Converting Video Format
Convert an AVI file to MP4 with high quality:
```json
{
  "tool": "convert_video",
  "inputPath": "C:\\videos\\old.avi",
  "outputPath": "C:\\videos\\new.mp4",
  "quality": "18"
}
```

### Creating Social Media Clips
Extract a 30-second clip, resize to 1080p, and add watermark:
1. Use `trim_video` to cut the segment
2. Use `resize_video` with preset "1080p"
3. Use `add_watermark` to add branding

### Making GIFs for Sharing
Create an optimized GIF from a video moment:
```json
{
  "tool": "create_gif",
  "inputPath": "C:\\videos\\funny.mp4",
  "outputPath": "C:\\gifs\\reaction.gif",
  "startTime": "00:01:23",
  "duration": "3",
  "fps": 15,
  "width": 480
}
```

### Compressing for Email/Upload
Reduce file size while maintaining acceptable quality:
```json
{
  "tool": "compress_video",
  "inputPath": "C:\\videos\\large.mp4",
  "outputPath": "C:\\videos\\small.mp4",
  "crf": 30,
  "preset": "slow"
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Clean build artifacts
npm run clean
```

## Error Handling

The server provides detailed error messages for common issues:
- **FFmpeg not found** - Install FFmpeg and add to PATH
- **File not found** - Check that input file paths are correct
- **Invalid parameters** - Verify all required parameters are provided
- **Encoding errors** - Check FFmpeg stderr output in error messages

## Performance Tips

1. **Stream Copy** - Use `trim_video` with `-c copy` for fast, lossless cutting
2. **Preset Selection** - Use "ultrafast" for speed, "slow" for better compression
3. **CRF Values** - 18-23 for high quality, 28-32 for smaller files
4. **Resolution** - Downscale videos before other operations for faster processing

## Limitations

- Maximum speed adjustment: 0.1x to 4x
- Some operations require re-encoding (slower but necessary)
- Subtitle burning requires video re-encoding
- Batch operations process sequentially (not parallel)

## Troubleshooting

### FFmpeg Not Found
Ensure FFmpeg is installed and in your system PATH. Test with:
```bash
ffmpeg -version
```

### Path Issues on Windows
Use double backslashes in JSON: `"C:\\videos\\file.mp4"`

### Large File Processing
Some operations may take time with large files. The server will wait for completion.

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All 15 tools remain functional
- Error handling follows existing patterns
- Documentation is updated for any changes

## Support

For issues related to:
- **This MCP server** - Open an issue in the repository
- **FFmpeg usage** - Consult [FFmpeg documentation](https://ffmpeg.org/documentation.html)
- **MCP protocol** - See [Model Context Protocol docs](https://modelcontextprotocol.io)

## Credits

Built on:
- [FFmpeg](https://ffmpeg.org) - Multimedia processing framework
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP TypeScript SDK
