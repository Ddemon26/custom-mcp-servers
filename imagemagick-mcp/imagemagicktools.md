# ImageMagick Tools — Image Processing Test Design

You are running inside CI for the `imagemagick-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__imagemagick__resize_image,mcp__imagemagick__crop_image,mcp__imagemagick__convert_format,mcp__imagemagick__apply_filter,mcp__imagemagick__add_watermark,mcp__imagemagick__adjust_brightness_contrast,mcp__imagemagick__batch_process,mcp__imagemagick__create_thumbnail

---

## Mission
1) Set up image processing test environment:
   - Use test images of various formats and sizes
2) Execute image processing tests IM-0..IM-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with image integrity and processing verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="IM-0 — Baseline Image Setup" classname="ImageMagickMCP.IM-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: IM-0, IM-1, IM-2, IM-3, IM-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test images: `test-images/` directory for source images
  - Output images: `output/` directory for processed images
  - Thumbnails: `thumbnails/` directory for generated thumbnails

CI provides:
- `$JUNIT_OUT=reports/junit-im-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-im-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full image data. For matches, include only key image properties.
- Prefer image metadata and dimensions over full binary data.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Image evidence: extract essential properties (dimensions, format, file size) and include ≤ 3 key fields in the fragment.
- Avoid quoting image data; reference dimension and format information only.
- Processing scans: verify image success and include ≤ 3 critical properties (size, format, dimensions) or simply state "image processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **Image Resizing**: `mcp__imagemagick__resize_image` — change image dimensions with aspect ratio options
- **Image Cropping**: `mcp__imagemagick__crop_image` — crop images to specified dimensions or regions
- **Format Conversion**: `mcp__imagemagick__convert_format` — convert between image formats (JPEG, PNG, WebP, etc.)
- **Filter Application**: `mcp__imagemagick__apply_filter` — apply various filters and effects
- **Watermarking**: `mcp__imagemagick__add_watermark` — add text or image watermarks
- **Color Adjustment**: `mcp__imagemagick__adjust_brightness_contrast` — adjust brightness, contrast, saturation
- **Batch Processing**: `mcp__imagemagick__batch_process` — apply operations to multiple images
- **Thumbnail Creation**: `mcp__imagemagick__create_thumbnail` — generate thumbnails of specified sizes

**STRICT OP GUARDRAILS**
- Always verify source image accessibility before processing
- Use test images that are reasonable in size to avoid resource exhaustion
- Limit batch operations to small numbers of images (≤ 10)
- Use appropriate output formats and quality settings
- Include proper error handling for corrupted images or unsupported formats

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Image Processing**: Each test uses images processed in previous operations
2. **State Awareness**: Each test expects image state left by previous test
3. **Content-Based Operations**: Target specific image properties and regions, not hardcoded dimensions
4. **Cumulative Validation**: Ensure image integrity and quality throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track image properties after each test (dimensions, format, file size, quality) for potential preconditions in later passes
- Use image signatures (dimensions, color profiles, metadata) to verify expected state
- Validate image quality and integrity after each major operation

---

## Execution Order & Additive Test Specs

### IM-0. Baseline Image Setup
**Goal**: Establish basic image processing capabilities
**Actions**:
- Create thumbnails from test images using `create_thumbnail`
- Convert images to different formats using `convert_format`
- Verify image accessibility and basic properties
- Record baseline image characteristics for tracking
- **Expected final state**: Test images processed with thumbnails and format conversions

### IM-1. Image Resizing and Cropping (Additive State A)
**Goal**: Demonstrate image dimension manipulation
**Actions**:
- Resize images using `resize_image` with different dimensions
- Crop images using `crop_image` to specific regions
- Maintain aspect ratios in some operations, change in others
- Verify dimension accuracy and quality preservation
- **Expected final state**: Images resized and cropped with various dimensions

### IM-2. Image Enhancement (Additive State B)
**Goal**: Demonstrate image enhancement and adjustment
**Actions**:
- Adjust brightness and contrast using `adjust_brightness_contrast`
- Apply various filters using `apply_filter` (blur, sharpen, etc.)
- Add watermarks using `add_watermark` with text and images
- Verify enhancement effectiveness and quality
- **Expected final state**: Enhanced images with adjustments and watermarks

### IM-3. Batch Processing (Additive State C)
**Goal**: Demonstrate batch processing capabilities
**Actions**:
- Apply consistent operations to multiple images using `batch_process`
- Process images with the same resize, format, and filter settings
- Verify batch operation consistency and completeness
- Check that all images are processed uniformly
- **Expected final state**: Multiple images processed consistently in batch

### IM-4. Final Validation (No New Processing)
**Goal**: Verify image processing workflow and validate all operations
**Actions**:
- Cross-validate image properties across all operations
- Verify that image quality is maintained throughout processing
- Check that all output formats are valid and accessible
- Validate that all transformations preserve essential image content
- **Expected final state**: All image operations validated with quality preserved
- **IMMEDIATELY** write clean XML fragment to `reports/IM-4_results.xml` (no extra text). The `<testcase name>` must start with `IM-4`. Include at most 3 key properties across all operations, or simply state "all image operations valid; quality OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded dimensions:**
```json
{"width": 800, "height": 600, "maintain_aspect": true}
```

**Use content-aware targeting:**
```json
# Resize based on original image properties
resize_image(source: "processed.jpg", scale_factor: 0.5)
# Then apply filters to resized image
```

**Image operations:**
```json
 {"width": 200, "height": 200, "crop": "center"}
{"format": "webp", "quality": 85}
{"filter": "gaussian_blur", "radius": 2}
{"watermark": "© Test", "position": "bottom-right", "opacity": 0.7}
{"brightness": 10, "contrast": 5, "saturation": 0}
```

---

## State Verification Patterns

**After each test:**
1. Verify image integrity: check dimensions, format validity, file accessibility
2. Check processing quality: validate transformations, enhancement effectiveness, batch consistency
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied image conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual image processing pipelines
2. **Robust Operations**: Proves image processing works on evolving image state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or image snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative image operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual ImageMagick usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-images/`, `output/`, `thumbnails/`, and `reports/` exist.

---