# Archive MCP Server

A Model Context Protocol (MCP) server for file compression and archiving operations. Supports creating and extracting ZIP, TAR, and TAR.GZ archives, along with single-file gzip compression.

## Features

### Archive Creation
- **ZIP Archives**: Create compressed ZIP files with configurable compression levels
- **TAR Archives**: Create uncompressed TAR archives
- **TAR.GZ Archives**: Create compressed TAR archives with gzip

### Archive Extraction
- **Universal Extractor**: Extract ZIP, TAR, and TAR.GZ archives
- **Strip Components**: Remove leading path components during extraction
- **Automatic Format Detection**: Handles different archive formats automatically

### Compression
- **Gzip Compression**: Compress individual files with gzip
- **Gzip Decompression**: Decompress .gz files

### Archive Management
- **List Contents**: View files in an archive without extracting
- **Multiple Sources**: Add multiple files and directories to archives

## Installation

```bash
npm install
npm run build
```

## Usage

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archive": {
      "command": "node",
      "args": ["/absolute/path/to/archive-mcp/dist/server.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned this repository.

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "archive-mcp": {
    "command": "node",
    "args": ["/absolute/path/to/archive-mcp/dist/server.js"]
  }
}
```

## Available Tools

### create_zip
Create a ZIP archive from files and/or directories.

**Parameters:**
- `sources` (string, required): JSON array of file/directory paths to include
- `outputPath` (string, required): Path where the ZIP file will be created
- `compressionLevel` (number, optional): Compression level 0-9 (default: 9)

**Example:**
```json
{
  "sources": "[\"/path/to/file1.txt\", \"/path/to/folder\"]",
  "outputPath": "/path/to/archive.zip",
  "compressionLevel": 9
}
```

### create_tar
Create a TAR archive from files and/or directories.

**Parameters:**
- `sources` (string, required): JSON array of file/directory paths to include
- `outputPath` (string, required): Path where the TAR file will be created

**Example:**
```json
{
  "sources": "[\"/path/to/file1.txt\", \"/path/to/folder\"]",
  "outputPath": "/path/to/archive.tar"
}
```

### create_targz
Create a compressed TAR.GZ archive from files and/or directories.

**Parameters:**
- `sources` (string, required): JSON array of file/directory paths to include
- `outputPath` (string, required): Path where the TAR.GZ file will be created

**Example:**
```json
{
  "sources": "[\"/path/to/file1.txt\", \"/path/to/folder\"]",
  "outputPath": "/path/to/archive.tar.gz"
}
```

### extract
Extract files from ZIP, TAR, or TAR.GZ archives.

**Parameters:**
- `archivePath` (string, required): Path to the archive file
- `outputDir` (string, required): Directory where files will be extracted
- `stripComponents` (number, optional): Number of leading path components to strip (default: 0)

**Example:**
```json
{
  "archivePath": "/path/to/archive.zip",
  "outputDir": "/path/to/extracted",
  "stripComponents": 1
}
```

**Strip Components Example:**
If archive contains `folder/subfolder/file.txt` and `stripComponents: 1`, the file will be extracted as `subfolder/file.txt`.

### list_contents
List contents of an archive without extracting.

**Parameters:**
- `archivePath` (string, required): Path to the archive file

**Example:**
```json
{
  "archivePath": "/path/to/archive.zip"
}
```

**Returns:**
```json
{
  "archivePath": "/path/to/archive.zip",
  "fileCount": 5,
  "files": [
    "file1.txt",
    "folder/file2.txt",
    "folder/subfolder/file3.txt"
  ]
}
```

### compress_file
Compress a single file using gzip.

**Parameters:**
- `inputPath` (string, required): Path to the file to compress
- `outputPath` (string, optional): Output path (default: adds .gz extension)

**Example:**
```json
{
  "inputPath": "/path/to/largefile.log",
  "outputPath": "/path/to/largefile.log.gz"
}
```

### decompress_file
Decompress a gzip compressed file.

**Parameters:**
- `inputPath` (string, required): Path to the .gz file
- `outputPath` (string, optional): Output path (default: removes .gz extension)

**Example:**
```json
{
  "inputPath": "/path/to/file.txt.gz",
  "outputPath": "/path/to/file.txt"
}
```

## Use Cases

### Backup Creation
```javascript
// Create a compressed backup of project files
create_targz({
  sources: JSON.stringify([
    "/projects/myapp/src",
    "/projects/myapp/config",
    "/projects/myapp/README.md"
  ]),
  outputPath: "/backups/myapp-2024-01-15.tar.gz"
})
```

### Log File Compression
```javascript
// Compress old log files to save space
compress_file({
  inputPath: "/var/logs/app-2024-01-14.log",
  outputPath: "/var/logs/archive/app-2024-01-14.log.gz"
})
```

### Distribution Package Creation
```javascript
// Create a ZIP archive for distribution
create_zip({
  sources: JSON.stringify([
    "/builds/myapp-v1.2.3/",
    "/docs/README.txt",
    "/docs/LICENSE.txt"
  ]),
  outputPath: "/releases/myapp-v1.2.3.zip",
  compressionLevel: 9
})
```

### Archive Inspection
```javascript
// Check what's in an archive before extracting
list_contents({
  archivePath: "/downloads/package.tar.gz"
})

// Extract to specific location
extract({
  archivePath: "/downloads/package.tar.gz",
  outputDir: "/tmp/package-contents",
  stripComponents: 1
})
```

### Batch Compression
```javascript
// Compress multiple log files
const logFiles = [
  "/logs/app.log",
  "/logs/error.log",
  "/logs/access.log"
];

for (const logFile of logFiles) {
  compress_file({
    inputPath: logFile,
    outputPath: `${logFile}.gz`
  });
}
```

### Development Snapshots
```javascript
// Create quick project snapshot
create_zip({
  sources: JSON.stringify([
    "/projects/myapp"
  ]),
  outputPath: `/snapshots/myapp-snapshot-${Date.now()}.zip`,
  compressionLevel: 6  // Faster compression for frequent snapshots
})
```

## Archive Format Support

### Supported Formats

**Creating:**
- `.zip` - ZIP archives with configurable compression
- `.tar` - Uncompressed TAR archives
- `.tar.gz` / `.tgz` - Compressed TAR archives

**Extracting:**
- `.zip` - ZIP archives
- `.tar` - TAR archives
- `.tar.gz` / `.tgz` - Compressed TAR archives

**Single File Compression:**
- `.gz` - Gzip compression/decompression

## Compression Levels

For ZIP archives, you can specify compression level (0-9):
- `0` - No compression (store only)
- `1-3` - Fast compression, larger files
- `4-6` - Balanced compression and speed
- `7-9` - Maximum compression, slower (default: 9)

## Important Notes

### Path Handling
- Use absolute paths for reliability
- Directories are recursively added to archives
- Archive directory structure preserves source structure

### Strip Components
- Useful for extracting archives with extra wrapper directories
- `stripComponents: 1` removes the first directory level
- Commonly used with downloaded packages

### File Overwriting
- Extraction will overwrite existing files
- Ensure backup or use unique output directories

### Performance
- Large archives may take time to create/extract
- Higher compression levels (8-9) are slower but create smaller files
- TAR.GZ is generally smaller than ZIP for multiple files

### Limitations
- Cannot modify existing archives in place
- To add files to existing archive: extract, add files, recreate archive
- Archives created maintain original file permissions (Unix/Linux)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode with hot reload
npm run dev

# Watch mode
npm run watch

# Clean build artifacts
npm run clean
```

## Dependencies

- `@modelcontextprotocol/sdk`: Core MCP framework
- `archiver`: ZIP archive creation
- `decompress`: Universal archive extraction
- `tar`: TAR archive creation and extraction

## License

MIT
