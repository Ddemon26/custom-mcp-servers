# ImageMagick MCP Server

A comprehensive Model Context Protocol (MCP) server that provides powerful image processing capabilities powered by ImageMagick. Perfect for complementing the FFmpeg server to create a complete media processing pipeline.

## Features

### Image Operations
- **Resize & Scale** - Resize images with aspect ratio preservation
- **Crop** - Extract specific regions from images
- **Rotate** - Rotate images by any degree
- **Flip** - Horizontal and vertical image flipping
- **Format Conversion** - Convert between image formats (JPG, PNG, GIF, BMP, TIFF, WebP)

### Quality & Compression
- **Quality Adjustment** - Control JPEG/PNG compression
- **Thumbnail Generation** - Create thumbnails with custom sizes
- **Batch Processing** - Process multiple images with the same settings

### Image Enhancement
- **Brightness Adjustment** - Lighten or darken images
- **Contrast Adjustment** - Enhance image contrast
- **Saturation Control** - Adjust color saturation
- **Blur Effects** - Apply Gaussian blur with customizable parameters
- **Sharpening** - Enhance image detail and clarity

### Advanced Features
- **Watermarking** - Add image watermarks with positioning and opacity control
- **Image Information** - Extract detailed metadata (dimensions, format, colorspace, resolution)
- **Batch Operations** - Process multiple images efficiently
- **File Size Optimization** - Monitor and report file size changes

## Prerequisites

**ImageMagick must be installed and available in your system PATH.**

### Installation Instructions

#### Windows
Download from [ImageMagick.org](https://imagemagick.org/script/download.php) or use:
```bash
# Using Chocolatey
choco install imagemagick.app

# Using Scoop
scoop install imagemagick
```

#### macOS
```bash
# Using Homebrew
brew install imagemagick

# Using MacPorts
sudo port install ImageMagick
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install imagemagick

# CentOS/RHEL/Fedora
sudo dnf install ImageMagick

# Arch Linux
sudo pacman -S imagemagick
```

## Installation

```bash
# Navigate to the imagemagick-mcp directory
cd imagemagick-mcp

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
    "imagemagick": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\path\\to\\mcp-servers\\imagemagick-mcp\\dist\\server.js"
      ]
    }
  }
}
```

### Configuration for VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "imagemagick": {
    "command": "node",
    "args": ["C:\\Users\\YourUsername\\path\\to\\mcp-servers\\imagemagick-mcp\\dist\\server.js"]
  }
}
```

## Tools Reference

### 1. get_image_info

Get detailed information about an image.

**Parameters:**
- `inputPath` (string, required) - Path to the image file

**Example:**
```json
{
  "inputPath": "C:\\images\\photo.jpg"
}
```

**Returns:** Format, dimensions, resolution, file size, colorspace, bit depth, channel count

---

### 2. resize_image

Resize an image to specified dimensions.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where resized image will be saved
- `width` (number, optional) - Target width in pixels
- `height` (number, optional) - Target height in pixels
- `maintainAspect` (boolean, optional) - Maintain aspect ratio (default: true)
- `quality` (number, optional) - Output quality (1-100)

**Example:**
```json
{
  "inputPath": "C:\\images\\large.jpg",
  "outputPath": "C:\\images\\resized.jpg",
  "width": 800,
  "height": 600,
  "maintainAspect": true,
  "quality": 85
}
```

---

### 3. crop_image

Extract a rectangular region from an image.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where cropped image will be saved
- `x` (number, required) - X coordinate of top-left corner
- `y` (number, required) - Y coordinate of top-left corner
- `width` (number, required) - Width of crop area
- `height` (number, required) - Height of crop area

**Example:**
```json
{
  "inputPath": "C:\\images\\full.jpg",
  "outputPath": "C:\\images\\crop.jpg",
  "x": 100,
  "y": 50,
  "width": 400,
  "height": 300
}
```

---

### 4. rotate_image

Rotate an image by specified degrees.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where rotated image will be saved
- `degrees` (number, required) - Rotation degrees (positive = clockwise)

**Example:**
```json
{
  "inputPath": "C:\\images\\sideways.jpg",
  "outputPath": "C:\\images\\upright.jpg",
  "degrees": 90
}
```

---

### 5. flip_image

Flip an image horizontally or vertically.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where flipped image will be saved
- `direction` (string, required) - Flip direction: "horizontal" or "vertical"

**Example:**
```json
{
  "inputPath": "C:\\images\\mirror.jpg",
  "outputPath": "C:\\images\\flipped.jpg",
  "direction": "horizontal"
}
```

---

### 6. convert_format

Convert image to different format.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where converted image will be saved
- `format` (string, required) - Target format (jpg, png, gif, bmp, tiff, webp)
- `quality` (number, optional) - Output quality (1-100)

**Example:**
```json
{
  "inputPath": "C:\\images\\photo.png",
  "outputPath": "C:\\images\\photo.jpg",
  "format": "jpg",
  "quality": 90
}
```

---

### 7. adjust_quality

Adjust image quality/compression.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where adjusted image will be saved
- `quality` (number, required) - Quality level (1-100)

**Example:**
```json
{
  "inputPath": "C:\\images\\original.jpg",
  "outputPath": "C:\\images\\compressed.jpg",
  "quality": 75
}
```

---

### 8. create_thumbnail

Create thumbnail of specified size.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where thumbnail will be saved
- `width` (number, optional) - Thumbnail width (default: 150)
- `height` (number, optional) - Thumbnail height (default: 150)
- `quality` (number, optional) - Thumbnail quality (default: 85)

**Example:**
```json
{
  "inputPath": "C:\\images\\large.jpg",
  "outputPath": "C:\\images\\thumb.jpg",
  "width": 200,
  "height": 200,
  "quality": 80
}
```

---

### 9. add_watermark

Add watermark image to another image.

**Parameters:**
- `inputPath` (string, required) - Path to main image
- `watermarkPath` (string, required) - Path to watermark image
- `outputPath` (string, required) - Path where output image will be saved
- `position` (string, optional) - Position: northwest, north, northeast, west, center, east, southwest, south, southeast
- `opacity` (number, optional) - Watermark opacity (0.0 to 1.0, default: 0.7)

**Example:**
```json
{
  "inputPath": "C:\\images\\photo.jpg",
  "watermarkPath": "C:\\images\\logo.png",
  "outputPath": "C:\\images\\watermarked.jpg",
  "position": "southeast",
  "opacity": 0.8
}
```

---

### 10. batch_resize

Resize multiple images with the same settings.

**Parameters:**
- `inputPaths` (string, required) - Comma-separated or JSON array of image paths
- `outputDir` (string, required) - Directory where resized images will be saved
- `width` (number, optional) - Target width in pixels
- `height` (number, optional) - Target height in pixels
- `maintainAspect` (boolean, optional) - Maintain aspect ratio (default: true)
- `quality` (number, optional) - Output quality (1-100)

**Example:**
```json
{
  "inputPaths": "[\"C:\\\\images\\\\photo1.jpg\", \"C:\\\\images\\\\photo2.png\", \"C:\\\\images\\\\photo3.bmp\"]",
  "outputDir": "C:\\images\\resized",
  "width": 800,
  "maintainAspect": true,
  "quality": 85
}
```

Or comma-separated:
```json
{
  "inputPaths": "C:\\images\\photo1.jpg, C:\\images\\photo2.png, C:\\images\\photo3.bmp",
  "outputDir": "C:\\images\\resized",
  "width": 800,
  "maintainAspect": true,
  "quality": 85
}
```

---

### 11. adjust_brightness

Adjust image brightness.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where adjusted image will be saved
- `adjustment` (number, required) - Brightness adjustment (-100 to 100, 0 = no change)

**Example:**
```json
{
  "inputPath": "C:\\images\\dark.jpg",
  "outputPath": "C:\\images\\brightened.jpg",
  "adjustment": 30
}
```

---

### 12. adjust_contrast

Adjust image contrast.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where adjusted image will be saved
- `adjustment` (number, required) - Contrast adjustment (-100 to 100, 0 = no change)

**Example:**
```json
{
  "inputPath": "C:\\images\\flat.jpg",
  "outputPath": "C:\\images\\enhanced.jpg",
  "adjustment": 20
}
```

---

### 13. adjust_saturation

Adjust image saturation.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where adjusted image will be saved
- `adjustment` (number, required) - Saturation adjustment (0-200, 100 = no change)

**Example:**
```json
{
  "inputPath": "C:\\images\\desaturated.jpg",
  "outputPath": "C:\\images\\vibrant.jpg",
  "adjustment": 150
}
```

---

### 14. blur_image

Apply blur effect to image.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where blurred image will be saved
- `radius` (number, optional) - Blur radius (default: 1)
- `sigma` (number, optional) - Blur standard deviation (default: 1)

**Example:**
```json
{
  "inputPath": "C:\\images\\sharp.jpg",
  "outputPath": "C:\\images\\soft.jpg",
  "radius": 2,
  "sigma": 2
}
```

---

### 15. sharpen_image

Apply sharpen effect to image.

**Parameters:**
- `inputPath` (string, required) - Path to input image
- `outputPath` (string, required) - Path where sharpened image will be saved
- `radius` (number, optional) - Sharpen radius (default: 0)
- `sigma` (number, optional) - Sharpen standard deviation (default: 1.0)

**Example:**
```json
{
  "inputPath": "C:\\images\\soft.jpg",
  "outputPath": "C:\\images\\sharp.jpg",
  "radius": 1,
  "sigma": 1.5
}
```

## Common Use Cases

### Web Image Optimization
```json
{
  "tool": "resize_image",
  "inputPath": "C:\\images\\original.jpg",
  "outputPath": "C:\\images\\web.jpg",
  "width": 1200,
  "height": 800,
  "quality": 75
}
```

### Create Multiple Thumbnails
```json
{
  "tool": "create_thumbnail",
  "inputPath": "C:\\images\\gallery\\photo1.jpg",
  "outputPath": "C:\\images\\thumbnails\\thumb1.jpg",
  "width": 300,
  "height": 300,
  "quality": 80
}
```

### Batch Processing for Photo Gallery
```json
{
  "tool": "batch_resize",
  "inputPaths": "[\"C:\\\\photos\\\\*.jpg\"]",
  "outputDir": "C:\\processed",
  "width": 1920,
  "maintainAspect": true,
  "quality": 85
}
```

### Add Branding Watermark
```json
{
  "tool": "add_watermark",
  "inputPath": "C:\\images\\product.jpg",
  "watermarkPath": "C:\\images\\logo.png",
  "outputPath": "C:\\images\\branded.jpg",
  "position": "southeast",
  "opacity": 0.6
}
```

### Photo Enhancement Workflow
1. Use `adjust_brightness` to correct exposure
2. Use `adjust_contrast` to improve dynamic range
3. Use `adjust_saturation` to enhance colors
4. Use `sharpen_image` for final detail enhancement

### Format Conversion Pipeline
```json
{
  "tool": "convert_format",
  "inputPath": "C:\\images\\lossless.png",
  "outputPath": "C:\\images\\compressed.jpg",
  "format": "jpg",
  "quality": 90
}
```

## Supported Image Formats

### Input Formats
- **JPEG** - `.jpg`, `.jpeg`
- **PNG** - `.png`
- **GIF** - `.gif`
- **BMP** - `.bmp`
- **TIFF** - `.tiff`, `.tif`
- **WebP** - `.webp`
- **SVG** - `.svg` (via ImageMagick)
- **HEIC/HEIF** - `.heic`, `.heif` (if supported)

### Output Formats
- All input formats plus additional formats supported by ImageMagick
- Quality settings available for lossy formats (JPEG, WebP)
- Compression options for PNG

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
- **ImageMagick not found** - Install ImageMagick and add to PATH
- **File not found** - Check that input file paths are correct
- **Invalid parameters** - Verify all required parameters are provided
- **Permission errors** - Check file permissions and output directory access
- **Unsupported format** - Some formats may not be supported by your ImageMagick installation

## Performance Tips

1. **Batch Processing** - Use batch operations for multiple images
2. **Quality Settings** - Lower quality for web, higher for archival
3. **Thumbnail Generation** - Generate thumbnails first, then resize as needed
4. **Output Directory** - Use SSD storage for faster I/O
5. **Parallel Operations** - Run multiple instances for large batches

## Integration with FFmpeg MCP

This ImageMagick server perfectly complements the FFmpeg MCP server:

1. **Video Frame Extraction** - Extract frames from videos with FFmpeg, then process with ImageMagick
2. **Media Pipeline** - Complete workflow: video → frames → image processing → compilation
3. **Thumbnail Generation** - Create thumbnails for video files
4. **Batch Media Processing** - Process entire media libraries efficiently

## Limitations

- **Memory Usage** - Large images may require significant RAM
- **Processing Time** - Complex operations on large images can be time-consuming
- **Format Support** - Depends on ImageMagick installation and configuration
- **Animated GIFs** - Frame-by-frame processing not directly supported
- **Vector Graphics** - SVG support depends on ImageMagick configuration

## Troubleshooting

### Common Issues

**ImageMagick Not Found**
```bash
# Test ImageMagick installation
convert -version
```

**Command Not Found**
- Ensure ImageMagick is in system PATH
- On Windows, verify installation includes command-line tools
- On macOS/Linux, verify `convert` command is accessible

**Permission Denied**
- Check write permissions on output directory
- Verify input files are readable
- Use absolute paths when in doubt

**Out of Memory**
- Reduce image size before processing
- Close other memory-intensive applications
- Increase system RAM if processing large batches

### ImageMagick Configuration

Check supported formats:
```bash
convert -list format
```

Verify installation:
```bash
identify -version
```

Test basic operations:
```bash
convert input.jpg output.png
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All 15 tools remain functional
- Error handling follows existing patterns
- Documentation is updated for any changes
- Cross-platform compatibility is maintained

## Support

For issues related to:
- **This MCP server** - Open an issue in the repository
- **ImageMagick usage** - Consult [ImageMagick Documentation](https://imagemagick.org/script/api.php)
- **MCP protocol** - See [Model Context Protocol docs](https://modelcontextprotocol.io)

## Credits

Built on:
- [ImageMagick](https://imagemagick.org/) - Comprehensive image processing suite
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP TypeScript SDK