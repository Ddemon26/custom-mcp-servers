# yt-dlp Tools — Media Download Test Design

You are running inside CI for the `ytdlp-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__ytdlp__get_video_info,mcp__ytdlp__download_video,mcp__ytdlp__download_audio,mcp__ytdlp__download_playlist,mcp__ytdlp__list_formats,mcp__ytdlp__download_subtitles,mcp__ytdlp__download_thumbnail,mcp__ytdlp__search_videos,mcp__ytdlp__download_channel,mcp__ytdlp__extract_chapters

---

## Mission
1) Pick target video URL (prefer test video):
   - Use a known test video URL for reliable operations
2) Execute media download tests YD-0..YD-4 in order using minimal, precise operations that build on each other.
3) Validate each operation with `mcp__ytdlp__get_video_info`.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="YD-0 — Baseline Video Analysis" classname="YtDlpMCP.YD-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: YD-0, YD-1, YD-2, YD-3, YD-4
5) **NO RESTORATION** - tests build additively on previous state.
6. **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test URL: Use a reliable test video URL
  - Output: `downloads/<operation>/` for organized file management

CI provides:
- `$JUNIT_OUT=reports/junit-yd-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-yd-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full video info. For matches, include only key metadata fields.
- Prefer `mcp__ytdlp__get_video_info` for verification; avoid full output dumps unless necessary.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Video evidence: extract essential properties (title, duration, view count) and include ≤ 3 key fields in the fragment.
- Avoid quoting full yt-dlp output; reference markers instead.
- Download scans: verify file creation and include ≤ 3 critical properties (file size, format, duration) or simply state "download successful" (≤ 400 chars).

---

## Tool Mapping
- **Video Analysis**: `mcp__ytdlp__get_video_info` — returns metadata without downloading
- **Video Download**: `mcp__ytdlp__download_video` — download video in specified quality
- **Audio Extraction**: `mcp__ytdlp__download_audio` — extract audio track only
- **Playlist Processing**: `mcp__ytdlp__download_playlist` — download multiple videos
- **Format Listing**: `mcp__ytdlp__list_formats` — list available download formats
- **Subtitle Processing**: `mcp__ytdlp__download_subtitles` — download subtitle files
- **Thumbnail Extraction**: `mcp__ytdlp__download_thumbnail` — download video thumbnail
- **Video Search**: `mcp__ytdlp__search_videos` — search for videos on YouTube
- **Channel Downloads**: `mcp__ytdlp__download_channel` — download from channel URLs
- **Chapter Extraction**: `mcp__ytdlp__extract_chapters` — get video chapter/timestamp info

**STRICT OP GUARDRAILS**
- Always verify URL accessibility before processing
- Use descriptive output directories that indicate the operation performed
- Validate output files are created and have expected properties
- For playlist/channel operations, limit to ≤ 3 downloads to avoid resource exhaustion
- Use test URLs that are known to be stable and accessible

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Operations**: Each test uses results or knowledge from previous operations when applicable
2. **State Awareness**: Each test expects system state left by previous test
3. **Content-Based Operations**: Target specific media properties, not hardcoded parameters
4. **Cumulative Validation**: Ensure downloads succeed and files are valid throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track video metadata after each test (duration, format, file size) for potential preconditions in later passes
- Use content signatures (title, uploader, duration) to verify expected state
- Validate download integrity after each major operation

---

## Execution Order & Additive Test Specs

### YD-0. Baseline Video Analysis
**Goal**: Establish initial video URL state and verify accessibility
**Actions**:
- Analyze test video URL using `get_video_info`
- Extract key properties: title, duration, uploader, view count, available formats
- Record baseline metadata for tracking
- **Expected final state**: Verified URL with documented properties, no downloads

### YD-1. Format Discovery (Additive State A)
**Goal**: Demonstrate format listing capabilities
**Actions**:
- List available formats for the test video using `list_formats`
- Identify available resolutions and codecs
- Note best available format for later downloads
- **Expected final state**: Format list documented, ready for selective downloads

### YD-2. Thumbnail Extraction (Additive State B)
**Goal**: Demonstrate metadata extraction without full download
**Actions**:
- Download thumbnail using `download_thumbnail` to `downloads/thumbnails/`
- Verify thumbnail file creation and format
- Extract chapter information using `extract_chapters` if available
- **Expected final state**: Thumbnail and chapter data downloaded, video still not downloaded

### YD-3. Audio Extraction (Additive State C)
**Goal**: Demonstrate selective audio download
**Actions**:
- Download audio only using `download_audio` to `downloads/audio/`
- Specify MP3 format with 192kbps quality
- Verify audio file creation and duration match
- **Expected final state**: Audio file downloaded, video still not downloaded

### YD-4. Search and Validate (No New Downloads)
**Goal**: Verify search capabilities and validate previous downloads
**Actions**:
- Perform video search using `search_videos` with relevant query
- Analyze search results and verify structure
- Validate all previously downloaded files exist and have expected properties
- **Expected final state**: Search completed, all downloads validated, no new files created
- **IMMEDIATELY** write clean XML fragment to `reports/YD-4_results.xml` (no extra text). The `<testcase name>` must start with `YD-4`. Include at most 3 key properties across all files, or simply state "all downloads valid; search OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded URLs:**
```json
{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
```

**Use content-aware targeting:**
```json
# Get video info first to verify availability
get_video_info(url: testVideoUrl)
# Then proceed with downloads knowing the video is accessible
```

**Property-based operations:**
```json
{"quality": "best", "format": "mp4"}
{"quality": "192", "format": "mp3"}
{"languages": "en", "autoGenerated": false}
```

---

## State Verification Patterns

**After each test:**
1. Verify expected output files exist: check download directories
2. Check file properties: validate size, format, duration where applicable
3. Update metadata tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied network conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual media downloading pipelines
2. **Robust Operations**: Proves downloads work on evolving system state, not just clean environments
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or cleanup snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative download operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual yt-dlp usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `downloads/` and `reports/` exist.

---