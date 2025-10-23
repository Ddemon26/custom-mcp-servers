# FFmpeg Tools — Media Processing Test Design

You are running inside CI for the `ffmpeg-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__ffmpeg__get_media_info,mcp__ffmpeg__convert_video,mcp__ffmpeg__extract_audio,mcp__ffmpeg__trim_video,mcp__ffmpeg__resize_video,mcp__ffmpeg__merge_videos,mcp__ffmpeg__add_subtitles,mcp__ffmpeg__batch_process

---

## Mission
1) Pick target media file (prefer):
   - Test media file in `test-media/sample.mp4`
2) Execute media processing tests MP-0..MP-4 in order using minimal, precise operations that build on each other.
3) Validate each operation with `mcp__ffmpeg__get_media_info`.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="MP-0 — Baseline Media Analysis" classname="FFmpegMCP.MP-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: MP-0, MP-1, MP-2, MP-3, MP-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical media paths only**:
  - Source: `test-media/sample.mp4`
  - Output: `output/<operation>_result.<ext>`

CI provides:
- `$JUNIT_OUT=reports/junit-mp-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-mp-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full media info. For matches, include only key metadata fields.
- Prefer `mcp__ffmpeg__get_media_info` for verification; avoid full output dumps unless necessary.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Media evidence: extract essential properties (duration, resolution, codecs) and include ≤ 3 key fields in the fragment.
- Avoid quoting full FFmpeg output; reference markers instead.
- Media scans: perform info extraction and include ≤ 3 critical properties total in the fragment; if errors, state "processing failed".

---

## Tool Mapping
- **Media Analysis**: `mcp__ffmpeg__get_media_info` — returns metadata without processing
- **Video Conversion**: `mcp__ffmpeg__convert_video` — change format/codec while preserving content
- **Audio Extraction**: `mcp__ffmpeg__extract_audio` — separate audio track from video
- **Video Trimming**: `mcp__ffmpeg__trim_video` — extract time-based segments
- **Video Resizing**: `mcp__ffmpeg__resize_video` — change resolution with aspect ratio preservation
- **Video Merging**: `mcp__ffmpeg__merge_videos` — combine multiple video files
- **Subtitle Processing**: `mcp__ffmpeg__add_subtitles` — embed subtitle tracks
- **Batch Operations**: `mcp__ffmpeg__batch_process` — apply operations to multiple files

**STRICT OP GUARDRAILS**
- Always verify source file exists before processing
- Use descriptive output filenames that indicate the operation performed
- Validate output files are created and have expected properties
- For batch operations, limit to ≤ 5 files to avoid resource exhaustion

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Processing**: Each test uses output from previous operations when applicable
2. **State Awareness**: Each test expects media state left by previous test
3. **Content-Based Operations**: Target specific media properties, not hardcoded parameters
4. **Cumulative Validation**: Ensure media remains valid and playable throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track file properties after each test (duration, resolution, file size) for potential preconditions in later passes
- Use content signatures (codecs, metadata) to verify expected state
- Validate media integrity after each major change

---

## Execution Order & Additive Test Specs

### MP-0. Baseline Media Analysis
**Goal**: Establish initial media file state and verify accessibility
**Actions**:
- Analyze source media file `test-media/sample.mp4`
- Extract key properties: duration, resolution, codecs, file size
- Record baseline metadata for tracking
- **Expected final state**: Unchanged source file with documented properties

### MP-1. Format Conversion (Additive State A)
**Goal**: Demonstrate basic format conversion
**Actions**:
- Convert source MP4 to WebM format using `convert_video`
- Output: `output/convert_result.webm`
- Verify conversion preserves essential properties (duration, resolution)
- **Expected final state**: New WebM file created with matching content

### MP-2. Audio Extraction (Additive State B)
**Goal**: Demonstrate audio track separation
**Actions**:
- Extract audio from converted WebM file using `extract_audio`
- Output: `output/audio_result.mp3`
- Verify audio duration matches source video
- **Expected final state**: MP3 audio file with matching duration

### MP-3. Video Trimming (Additive State C)
**Goal**: Demonstrate time-based segment extraction
**Actions**:
- Trim first 10 seconds from original MP4 using `trim_video`
- Output: `output/trim_result.mp4`
- Verify trimmed segment has correct duration and maintains quality
- **Expected final state**: Shortened video segment with preserved quality

### MP-4. Batch Processing Validation (No State Change)
**Goal**: Verify batch processing capabilities without modifying previous outputs
**Actions**:
- Analyze all generated output files in `output/` directory
- Validate each file has expected properties and is playable
- Check file sizes and formats match expectations
- **Expected final state**: All outputs validated, no new files created
- **IMMEDIATELY** write clean XML fragment to `reports/MP-4_results.xml` (no extra text). The `<testcase name>` must start with `MP-4`. Include at most 3 key properties across all files, or simply state "all outputs valid; batch OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded parameters:**
```json
{"startTime": "00:00:00", "duration": "00:00:10"}
```

**Use content-aware targeting:**
```json
# Get media info first to determine valid trim points
get_media_info(file: "output/convert_result.webm")
# Then compute trim parameters based on actual duration
```

**Property-based operations:**
```json
{"resolution": "auto", "aspect_ratio": "preserve"}
{"codec": "libx264", "quality": "medium"}
```

---

## State Verification Patterns

**After each test:**
1. Verify expected output file exists: `get_media_info` for output file
2. Check media integrity: validate duration, resolution, codecs match expectations
3. Update property tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied media conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual media processing pipelines
2. **Robust Operations**: Proves processing works on evolving files, not just pristine sources
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative media modifications correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual FFmpeg usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `output/` and `reports/` exist.

---