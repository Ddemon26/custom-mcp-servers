# File Download Tools — File Management Test Design

You are running inside CI for the `filedownload-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__filedownload__download_file,mcp__filedownload__list_downloads,mcp__filedownload__delete_file,mcp__filedownload__get_file_info

---

## Mission
1) Set up file download test environment:
   - Use test URLs and content for downloading
2) Execute file download operation tests FD-0..FD-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with file integrity and download verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="FD-0 — Baseline Download Setup" classname="FileDownloadMCP.FD-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: FD-0, FD-1, FD-2, FD-3, FD-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Download directory: `~/.claude/downloads/` (default download location)
  - Test files: Use reliable test URLs for content downloading

CI provides:
- `$JUNIT_OUT=reports/junit-fd-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-fd-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full file content. For matches, include only key file metadata.
- Prefer file information and download status over full content dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Download evidence: extract essential properties (file size, content type, download time) and include ≤ 3 key fields in the fragment.
- Avoid quoting long file contents; reference file metadata only.
- Download scans: verify download success and include ≤ 3 critical properties (size, type, status) or simply state "download successful" (≤ 400 chars).

---

## Tool Mapping
- **File Downloading**: `mcp__filedownload__download_file` — download files from URLs to local directory
- **Download Listing**: `mcp__filedownload__list_downloads` — list all downloaded files
- **File Deletion**: `mcp__filedownload__delete_file` — delete downloaded files
- **File Information**: `mcp__filedownload__get_file_info` — get detailed file metadata

**STRICT OP GUARDRAILS**
- Always verify URL accessibility before downloading
- Use reliable test URLs that are designed for automated testing
- Limit file sizes to reasonable amounts to avoid resource exhaustion
- Use appropriate content types (text, JSON, small images) for testing
- Include proper error handling for network failures and invalid URLs

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Download Operations**: Each test uses files downloaded in previous operations
2. **State Awareness**: Each test expects download directory state left by previous test
3. **Content-Based Operations**: Target specific file types and sources, not hardcoded URLs
4. **Cumulative Validation**: Ensure download integrity throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track download state after each test (file counts, total size, content types) for potential preconditions in later passes
- Use download signatures (file names, sizes, content types) to verify expected state
- Validate download directory integrity and file consistency after each major operation

---

## Execution Order & Additive Test Specs

### FD-0. Baseline Download Setup
**Goal**: Establish basic download functionality
**Actions**:
- Download a small test file (JSON or text) using `download_file`
- List downloaded files using `list_downloads`
- Get file information using `get_file_info`
- Verify download success and file integrity
- **Expected final state**: Test file downloaded successfully with verified metadata

### FD-1. Multiple File Downloads (Additive State A)
**Goal**: Demonstrate multiple file handling
**Actions**:
- Download multiple files of different types using `download_file`
- Download text files, JSON files, and small images
- List all downloads using `list_downloads`
- Verify all files downloaded correctly with appropriate content types
- **Expected final state**: Multiple files of different types downloaded successfully

### FD-2. File Management Operations (Additive State B)
**Goal**: Demonstrate file management capabilities
**Actions**:
- Get detailed information about each downloaded file using `get_file_info`
- Verify file sizes, content types, and download timestamps
- Check download directory organization and file naming
- Validate file accessibility and read permissions
- **Expected final state**: All downloaded files cataloged with verified metadata

### FD-3. File Deletion Operations (Additive State C)
**Goal**: Demonstrate file deletion and cleanup
**Actions**:
- Delete specific downloaded files using `delete_file`
- List remaining downloads using `list_downloads`
- Verify that deleted files are removed from download directory
- Check that remaining files are unaffected by deletion operations
- **Expected final state**: Selected files deleted, remaining files intact

### FD-4. Final Validation (No New Downloads)
**Goal**: Verify complete download workflow and state management
**Actions**:
- List final download directory state using `list_downloads`
- Verify remaining files have correct metadata using `get_file_info`
- Validate that download directory is properly maintained
- Check that all operations completed without corruption or errors
- **Expected final state**: Download workflow validated, directory state consistent
- **IMMEDIATELY** write clean XML fragment to `reports/FD-4_results.xml` (no extra text). The `<testcase name>` must start with `FD-4`. Include at most 3 key properties across all operations, or simply state "all downloads valid; directory OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded URLs:**
```json
{"url": "https://example.com/test.json", "filename": "test.json"}
```

**Use content-aware targeting:**
```json
# Download and then verify
download_file(url: testUrl, filename: "data.json")
get_file_info(filename: "data.json")
# Then manage the downloaded file
```

**File operations:**
```json
{"url": "https://httpbin.org/json", "filename": "response.json"}
{"url": "https://httpbin.org/uuid", "filename": "uuid.txt"}
{"filename": "test.json", "verify_content": true}
{"filename_pattern": "*.json", "operation": "list"}
```

---

## State Verification Patterns

**After each test:**
1. Verify download integrity: check file sizes, content types, accessibility
2. Check directory state: validate file counts, naming conventions, organization
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied network conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual file download and management pipelines
2. **Robust Operations**: Proves download operations work on evolving directory state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or directory snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative download operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual file download usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume download directory exists.

---