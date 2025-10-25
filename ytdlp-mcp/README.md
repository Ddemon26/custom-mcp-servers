# yt-dlp MCP Server

A comprehensive Model Context Protocol (MCP) server that provides powerful video/audio downloading capabilities powered by yt-dlp. Download videos from YouTube, Vimeo, Twitter, and 1000+ other platforms with ease.

## Features

### Video Operations
- **Video Download** - Download videos in various qualities (best, 1080p, 720p, 480p)
- **Audio Extraction** - Extract and download audio in multiple formats (MP3, M4A, WAV, OPUS, FLAC)
- **Playlist Download** - Download entire playlists or specific ranges
- **Channel Download** - Download all videos from a channel with date filtering
- **Format Listing** - View all available quality options before downloading

### Metadata & Information
- **Video Info** - Get detailed metadata (title, views, duration, uploader, description)
- **Chapter Extraction** - Extract timestamp/chapter information
- **Search** - Search for videos on YouTube

### Additional Features
- **Subtitle Download** - Download subtitles in multiple languages
- **Thumbnail Download** - Download video thumbnail images
- **Multi-platform Support** - Works with YouTube, Vimeo, Twitter, Facebook, Instagram, and 1000+ sites

## Prerequisites

**yt-dlp must be installed and available in your system PATH.**

### Installation Instructions

#### Windows
```bash
# Using winget
winget install yt-dlp

# Using Chocolatey
choco install yt-dlp

# Using Scoop
scoop install yt-dlp

# Manual installation
# Download from https://github.com/yt-dlp/yt-dlp/releases
# Add to PATH
```

#### macOS
```bash
# Using Homebrew
brew install yt-dlp

# Using pip
pip install yt-dlp
```

#### Linux
```bash
# Using pip
pip install yt-dlp

# Ubuntu/Debian (if available in repos)
sudo apt install yt-dlp

# Or download binary
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

## Installation

```bash
# Navigate to the yt-dlp-mcp directory
cd yt-dlp-mcp

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
    "yt-dlp": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\path\\to\\mcp-servers\\yt-dlp-mcp\\dist\\server.js"
      ]
    }
  }
}
```

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "yt-dlp": {
    "command": "node",
    "args": ["C:\\Users\\YourUsername\\path\\to\\mcp-servers\\yt-dlp-mcp\\dist\\server.js"]
  }
}
```

## Tools Reference

### 1. get_video_info

Get detailed information about a video without downloading it.

**Parameters:**
- `url` (string, required) - Video URL

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Returns:** Title, uploader, duration, views, likes, description, thumbnail, available formats

---

### 2. download_video

Download video from any supported platform.

**Parameters:**
- `url` (string, required) - Video URL
- `outputDir` (string, required) - Directory to save video
- `quality` (string, optional) - Quality: best, 1080p, 720p, 480p (default: best)
- `format` (string, optional) - Custom format string for advanced users

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputDir": "C:\\Videos\\Downloads",
  "quality": "1080p"
}
```

---

### 3. download_audio

Download audio only from video.

**Parameters:**
- `url` (string, required) - Video URL
- `outputDir` (string, required) - Directory to save audio
- `format` (string, optional) - Audio format: mp3, m4a, wav, opus, flac (default: mp3)
- `quality` (string, optional) - Bitrate: 128, 192, 256, 320 (default: 192)

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputDir": "C:\\Music\\Downloads",
  "format": "mp3",
  "quality": "320"
}
```

---

### 4. download_playlist

Download entire playlist or specific range.

**Parameters:**
- `url` (string, required) - Playlist URL
- `outputDir` (string, required) - Directory to save videos
- `quality` (string, optional) - Video quality (default: best)
- `startIndex` (number, optional) - Start from this video index
- `endIndex` (number, optional) - End at this video index

**Example:**
```json
{
  "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "outputDir": "C:\\Videos\\Playlists",
  "quality": "720p",
  "startIndex": 1,
  "endIndex": 10
}
```

---

### 5. list_formats

List all available download formats and qualities.

**Parameters:**
- `url` (string, required) - Video URL

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Returns:** List of format IDs, resolutions, extensions, and additional info

---

### 6. download_subtitles

Download video subtitles/captions.

**Parameters:**
- `url` (string, required) - Video URL
- `outputDir` (string, required) - Directory to save subtitles
- `languages` (string, optional) - Comma-separated language codes (default: "en")
- `autoGenerated` (boolean, optional) - Include auto-generated subtitles (default: false)

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputDir": "C:\\Subtitles",
  "languages": "en,es,fr",
  "autoGenerated": false
}
```

---

### 7. download_thumbnail

Download video thumbnail image.

**Parameters:**
- `url` (string, required) - Video URL
- `outputDir` (string, required) - Directory to save thumbnail
- `format` (string, optional) - Image format: jpg, png, webp (default: jpg)

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputDir": "C:\\Thumbnails",
  "format": "jpg"
}
```

---

### 8. search_videos

Search for videos on YouTube.

**Parameters:**
- `query` (string, required) - Search query
- `maxResults` (number, optional) - Maximum results (default: 10)

**Example:**
```json
{
  "query": "python tutorial",
  "maxResults": 20
}
```

**Returns:** List of videos with title, URL, uploader, duration, views

---

### 9. download_channel

Download videos from a channel.

**Parameters:**
- `channelUrl` (string, required) - Channel URL
- `outputDir` (string, required) - Directory to save videos
- `maxDownloads` (number, optional) - Maximum videos to download
- `dateAfter` (string, optional) - Only download videos after this date (YYYYMMDD format)

**Example:**
```json
{
  "channelUrl": "https://www.youtube.com/@channelname",
  "outputDir": "C:\\Videos\\Channels",
  "maxDownloads": 50,
  "dateAfter": "20240101"
}
```

---

### 10. extract_chapters

Extract chapter/timestamp information from video.

**Parameters:**
- `url` (string, required) - Video URL

**Example:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Returns:** List of chapters with titles, start/end times

## Common Use Cases

### Download Music from YouTube
```json
{
  "tool": "download_audio",
  "url": "https://www.youtube.com/watch?v=...",
  "outputDir": "C:\\Music",
  "format": "mp3",
  "quality": "320"
}
```

### Download Educational Playlist
```json
{
  "tool": "download_playlist",
  "url": "https://www.youtube.com/playlist?list=...",
  "outputDir": "C:\\Education",
  "quality": "720p"
}
```

### Research: Get Video Info Before Downloading
```json
{
  "tool": "get_video_info",
  "url": "https://www.youtube.com/watch?v=..."
}
```
Then use `list_formats` to see quality options, then `download_video` with your preferred quality.

### Download with Subtitles
1. Use `download_video` to get the video
2. Use `download_subtitles` to get captions in multiple languages

### Create Video Archive
Use `download_channel` with `dateAfter` to download recent uploads from your favorite creators.

## Supported Platforms

yt-dlp supports 1000+ websites including:

**Video Platforms:**
- YouTube (videos, playlists, channels, shorts)
- Vimeo
- Dailymotion
- Twitch (VODs and clips)

**Social Media:**
- Twitter/X
- Instagram
- Facebook
- TikTok
- Reddit

**Educational:**
- Coursera
- Udemy
- Khan Academy
- edX

**And many more...**

For full list: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

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
- **yt-dlp not found** - Install yt-dlp and add to PATH
- **Invalid URL** - Check that the URL is from a supported platform
- **Video unavailable** - Video may be private, deleted, or geo-restricted
- **Download errors** - Check internet connection and disk space

## Performance Tips

1. **Use quality presets** - "720p" or "1080p" instead of "best" for faster downloads
2. **Audio-only downloads** - Much faster when you only need audio
3. **Playlist ranges** - Use startIndex/endIndex to download specific videos
4. **Parallel downloads** - yt-dlp handles concurrent downloads efficiently

## Advanced Features

### Custom Format Strings
For advanced users, use the `format` parameter with yt-dlp format codes:
```json
{
  "format": "bestvideo[height<=1080]+bestaudio/best"
}
```

### Date Filtering
Download only recent videos from a channel:
```json
{
  "dateAfter": "20240601"
}
```

### Multiple Subtitles
Download subtitles in multiple languages:
```json
{
  "languages": "en,es,fr,de,ja"
}
```

## Limitations

- Download speeds depend on your internet connection
- Some platforms may rate-limit downloads
- Geo-restricted content requires appropriate network configuration
- Very large playlists may take significant time
- Some features may not work on all platforms

## Troubleshooting

### yt-dlp Not Found
Ensure yt-dlp is installed and in PATH. Test with:
```bash
yt-dlp --version
```

### Path Issues on Windows
Use double backslashes in JSON: `"C:\\Videos\\Downloads"`

### Permission Errors
Ensure the output directory is writable and you have sufficient disk space.

### Video Unavailable
- Check if video is public
- Try accessing the video in a browser
- Some content may be geo-restricted

## Updating yt-dlp

Keep yt-dlp updated for best compatibility:
```bash
# pip
pip install --upgrade yt-dlp

# Homebrew
brew upgrade yt-dlp

# Windows (winget)
winget upgrade yt-dlp
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All 10 tools remain functional
- Error handling follows existing patterns
- Documentation is updated for any changes

## Legal Notice

This tool is for personal use only. Respect copyright laws and terms of service of the platforms you download from. The developers are not responsible for misuse of this software.

## Support

For issues related to:
- **This MCP server** - Open an issue in the repository
- **yt-dlp usage** - Consult [yt-dlp documentation](https://github.com/yt-dlp/yt-dlp)
- **MCP protocol** - See [Model Context Protocol docs](https://modelcontextprotocol.io)

## Credits

Built on:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Universal video downloader
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP TypeScript SDK
