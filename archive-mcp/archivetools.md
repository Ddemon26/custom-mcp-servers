# Archive Tools — Compression Test Design

You are running inside CI for the `archive-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__archive__create_zip,mcp__archive__create_tar,mcp__archive__create_targz,mcp__archive__extract,mcp__archive__list_contents,mcp__archive__compress_file,mcp__archive__decompress_file,mcp__archive__add_to_zip

---

## Mission
1) Prepare test files (prefer):
   - Create test directory structure with sample files
2) Execute archive operations tests AR-0..AR-4 in order using minimal, precise operations that build on each other.
3) Validate each operation with file system checks and content verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="AR-0 — Baseline Archive Setup" classname="ArchiveMCP.AR-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: AR-0, AR-1, AR-2, AR-3, AR-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test files: `test-data/` directory with sample content
  - Archives: `archives/` directory for created archives
  - Extraction: `extracted/` directory for extracted content

CI provides:
- `$JUNIT_OUT=reports/junit-ar-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-ar-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full file listings. For matches, include only key file counts and sizes.
- Prefer `mcp__archive__list_contents` for verification; avoid full directory dumps unless necessary.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Archive evidence: extract essential properties (file count, archive size, compression ratio) and include ≤ 3 key fields in the fragment.
- Avoid quoting full archive listings; reference markers instead.
- Archive scans: verify file creation and include ≤ 3 critical properties (archive size, file count, compression ratio) or simply state "archive created successfully" (≤ 400 chars).

---

## Tool Mapping
- **ZIP Creation**: `mcp__archive__create_zip` — create ZIP archives from multiple files
- **TAR Creation**: `mcp__archive__create_tar` — create uncompressed TAR archives
- **TAR.GZ Creation**: `mcp__archive__create_targz` — create compressed TAR.GZ archives
- **Archive Extraction**: `mcp__archive__extract` — extract archives preserving structure
- **Content Listing**: `mcp__archive__list_contents` — list archive contents without extraction
- **File Compression**: `mcp__archive__compress_file` — compress single files with GZIP
- **File Decompression**: `mcp__archive__decompress_file` — decompress GZIP files
- **ZIP Addition**: `mcp__archive__add_to_zip` — add files to existing ZIP archives

**STRICT OP GUARDRAILS**
- Always verify source files exist before archiving
- Use descriptive archive names that indicate the operation performed
- Validate output archives are created and contain expected files
- For multi-file operations, limit to ≤ 10 files to avoid resource exhaustion
- Use test files that are small but varied (text, JSON, etc.)

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Operations**: Each test uses archives or files created in previous tests
2. **State Awareness**: Each test expects file system state left by previous test
3. **Content-Based Operations**: Target specific file types and structures, not hardcoded names
4. **Cumulative Validation**: Ensure archives remain valid and extractable throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track archive properties after each test (size, file count, compression ratio) for potential preconditions in later passes
- Use content signatures (file names, sizes, checksums) to verify expected state
- Validate archive integrity after each major operation

---

## Execution Order & Additive Test Specs

### AR-0. Baseline Archive Setup
**Goal**: Establish initial test files and verify basic archiving
**Actions**:
- Create test directory structure with sample files (text, JSON, etc.)
- Create initial ZIP archive using `create_zip` with all test files
- List archive contents using `list_contents` to verify structure
- Record baseline archive properties for tracking
- **Expected final state**: Test files created and archived in ZIP format

### AR-1. Format Comparison (Additive State A)
**Goal**: Demonstrate different archive formats and their properties
**Actions**:
- Create TAR archive from same files using `create_tar`
- Create TAR.GZ archive using `create_targz`
- Compare sizes and properties across all three formats (ZIP, TAR, TAR.GZ)
- List contents of each archive to verify consistency
- **Expected final state**: Three archive formats created with identical content

### AR-2. File Compression (Additive State B)
**Goal**: Demonstrate single file compression operations
**Actions**:
- Compress a single test file using `compress_file` (GZIP)
- Decompress the same file using `decompress_file`
- Verify decompressed file matches original content
- Add additional file to existing ZIP using `add_to_zip`
- **Expected final state**: Compressed/decompressed file pair, updated ZIP archive

### AR-3. Archive Extraction (Additive State C)
**Goal**: Demonstrate extraction capabilities and integrity verification
**Actions**:
- Extract each archive format to separate directories using `extract`
- Verify extracted content matches original test files
- Compare extraction results across formats
- Validate file permissions and structure preservation
- **Expected final state**: All archives extracted with verified content integrity

### AR-4. Advanced Operations Validation (No New Archives)
**Goal**: Verify complex operations and validate previous work
**Actions**:
- List contents of all created archives to verify they remain valid
- Cross-reference file counts and sizes across all operations
- Validate extraction directories contain complete, uncorrupted files
- Verify no file system artifacts or corruption from operations
- **Expected final state**: All archives and extractions validated, no new files created
- **IMMEDIATELY** write clean XML fragment to `reports/AR-4_results.xml` (no extra text). The `<testcase name>` must start with `AR-4`. Include at most 3 key properties across all archives, or simply state "all archives valid; extractions OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded file names:**
```json
{"sources": "test-data/file1.txt test-data/file2.json"}
```

**Use content-aware targeting:**
```json
# Create archives based on file patterns
create_zip(sources: "test-data/*.txt test-data/*.json")
# Then verify contents match expected patterns
```

**Property-based operations:**
```json
{"format": "zip", "compression": "deflate"}
{"format": "targz", "compression": "gzip"}
{"extraction": "preserve_structure"}
```

---

## State Verification Patterns

**After each test:**
1. Verify expected archives exist: check file creation and sizes
2. Check archive properties: validate file counts, compression ratios
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied file system conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual archive management pipelines
2. **Robust Operations**: Proves archives work on evolving file system state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or cleanup snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative archive operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual archive usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-data/`, `archives/`, `extracted/`, and `reports/` exist.

---