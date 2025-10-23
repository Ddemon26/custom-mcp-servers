# EasyView Tools — File Explorer Test Design

You are running inside CI for the `easyview-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__easyview__scan_directory,mcp__easyview__list_files,mcp__easyview__search_files,mcp__easyview__view_file,mcp__easyview__analyze_structure,mcp__easyview__find_large_files,mcp__easyview__file_info

---

## Mission
1) Set up file system test environment:
   - Use existing repository structure as test data
2) Execute file exploration tests EV-0..EV-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with file system accuracy and content verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="EV-0 — Baseline Directory Scan" classname="EasyViewMCP.EV-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: EV-0, EV-1, EV-2, EV-3, EV-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Working directory: Current repository root
  - Search targets: Various file types and patterns within the repository
  - Analysis scope: Different directory depths and structures

CI provides:
- `$JUNIT_OUT=reports/junit-ev-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-ev-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full file listings. For matches, include only key file counts and patterns.
- Prefer file statistics over full content dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- File system evidence: extract essential properties (file count, directory depth, total size) and include ≤ 3 key fields in the fragment.
- Avoid quoting long file paths; reference summary statistics only.
- Directory scans: verify structure and include ≤ 3 critical properties (files, directories, depth) or simply state "directory scanned successfully" (≤ 400 chars).

---

## Tool Mapping
- **Directory Scanning**: `mcp__easyview__scan_directory` — index and cache directory structure
- **File Listing**: `mcp__easyview__list_files` — list files with filtering and sorting options
- **Content Searching**: `mcp__easyview__search_files` — search for patterns across files
- **File Viewing**: `mcp__easyview__view_file` — read file contents with smart chunking
- **Structure Analysis**: `mcp__easyview__analyze_structure` — analyze project structure and statistics
- **Large File Discovery**: `mcp__easyview__find_large_files` — identify large files in directory
- **File Information**: `mcp__easyview__file_info` — get detailed file metadata

**STRICT OP GUARDRAILS**
- Always verify directory accessibility before scanning
- Use reasonable search patterns that won't overwhelm the system
- Limit file reading to reasonable sizes and chunk counts
- Use repository content that is appropriate for automated exploration
- Include proper error handling for permission issues or missing files

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Exploration**: Each test uses knowledge and cache from previous explorations
2. **State Awareness**: Each test expects file system cache and knowledge left by previous test
3. **Content-Based Operations**: Target specific file types and patterns, not hardcoded paths
4. **Cumulative Validation**: Ensure file system accuracy throughout exploration sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track exploration state after each test (file counts, search results, cache status) for potential preconditions in later passes
- Use file system signatures (directory structure, file patterns, content types) to verify expected state
- Validate exploration accuracy and cache consistency after each major operation

---

## Execution Order & Additive Test Specs

### EV-0. Baseline Directory Scan
**Goal**: Establish initial directory structure and basic scanning
**Actions**:
- Scan current directory using `scan_directory`
- List files with basic filtering using `list_files`
- Verify directory structure and file accessibility
- Record baseline file system properties for tracking
- **Expected final state**: Directory scanned and basic file listing obtained

### EV-1. File Pattern Discovery (Additive State A)
**Goal**: Demonstrate file filtering and pattern matching
**Actions**:
- List specific file types using `list_files` with patterns
- Find configuration files (*.json, *.md, *.ts)
- Sort files by different criteria (size, name, modified date)
- Verify filtering and sorting operations work correctly
- **Expected final state**: File patterns identified and sorted properly

### EV-2. Content Searching (Additive State B)
**Goal**: Demonstrate content search capabilities
**Actions**:
- Search for specific patterns in files using `search_files`
- Search for common code patterns (function definitions, imports)
- Search for documentation patterns (headings, TODO comments)
- Verify search accuracy and result relevance
- **Expected final state**: Content patterns located and search results validated

### EV-3. File Analysis (Additive State C)
**Goal**: Demonstrate detailed file and structure analysis
**Actions**:
- Analyze project structure using `analyze_structure`
- Find large files using `find_large_files`
- Get detailed information about specific files using `file_info`
- View specific file contents using `view_file` with smart chunking
- **Expected final state**: Detailed file system analysis completed

### EV-4. Integration Validation (No New Exploration)
**Goal**: Verify integration of all exploration capabilities
**Actions**:
- Cross-reference search results with file listings
- Validate that directory cache remains consistent across operations
- Verify that large file detection works with structure analysis
- Check that file viewing works with discovered content patterns
- **Expected final state**: All exploration operations validated and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/EV-4_results.xml` (no extra text). The `<testcase name>` must start with `EV-4`. Include at most 3 key properties across all operations, or simply state "all exploration valid; integration OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded paths:**
```json
{"pattern": "*.ts", "sort_by": "size"}
```

**Use content-aware targeting:**
```json
# Use scan results to inform searches
scan_directory()
search_files(pattern: "function.*{", file_pattern: "*.ts")
# Then analyze the structure
```

**File operations:**
```json
{"pattern": "*.json", "sort_by": "modified", "limit": 10}
{"search_pattern": "class.*Controller", "file_pattern": "*.ts", "max_results": 20}
{"file_path": "package.json", "info_level": "detailed"}
{"analysis_depth": 3, "show_extensions": true}
```

---

## State Verification Patterns

**After each test:**
1. Verify exploration accuracy: check file counts, pattern matches, structure consistency
2. Check cache behavior: validate directory scanning and result caching
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied file system conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual file exploration pipelines
2. **Robust Operations**: Proves exploration works on evolving file system knowledge
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or file system snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative exploration operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual file explorer usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system modifications required.

---