# Markdown Tools — Document Processing Test Design

You are running inside CI for the `markdown-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__markdown__convert_to_html,mcp__markdown__convert_from_html,mcp__markdown__extract_headers,mcp__markdown__extract_links,mcp__markdown__extract_images,mcp__markdown__validate_markdown,mcp__markdown__prettify_markdown,mcp__markdown__get_word_count

---

## Mission
1) Set up Markdown test environment:
   - Use test Markdown files with various elements and complexity
2) Execute Markdown processing tests MD-0..MD-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with document integrity and content verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="MD-0 — Baseline Markdown Setup" classname="MarkdownMCP.MD-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: MD-0, MD-1, MD-2, MD-3, MD-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test Markdown: `test-data/` directory for Markdown test files
  - Output files: `output/` directory for processed documents and conversions

CI provides:
- `$JUNIT_OUT=reports/junit-md-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-md-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full Markdown content. For matches, include only key structure information.
- Prefer element counts and metadata over full document dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Markdown evidence: extract essential properties (word count, header count, link count) and include ≤ 3 key fields in the fragment.
- Avoid quoting long document content; reference structural summaries only.
- Document scans: verify Markdown validity and include ≤ 3 critical properties (words, headers, links) or simply state "Markdown processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **HTML Conversion**: `mcp__markdown__convert_to_html` — convert Markdown to HTML
- **HTML to Markdown**: `mcp__markdown__convert_from_html` — convert HTML to Markdown
- **Header Extraction**: `mcp__markdown__extract_headers` — extract document headers and structure
- **Link Extraction**: `mcp__markdown__extract_links` — extract all links from document
- **Image Extraction**: `mcp__markdown__extract_images` — extract image references and metadata
- **Markdown Validation**: `mcp__markdown__validate_markdown` — validate Markdown syntax
- **Document Prettification**: `mcp__markdown__prettify_markdown` — format Markdown with proper spacing
- **Word Counting**: `mcp__markdown__get_word_count` — count words, characters, and reading time

**STRICT OP GUARDRAILS**
- Always verify Markdown accessibility before processing
- Use test Markdown that is well-formed and contains various elements
- Limit document processing to reasonable sizes to avoid resource exhaustion
- Use appropriate extraction patterns that are reliable and specific
- Include proper error handling for malformed Markdown or invalid content

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Document Processing**: Each test uses document content from previous operations
2. **State Awareness**: Each test expects document state left by previous test
3. **Content-Based Operations**: Target specific document elements and structures, not hardcoded content
4. **Cumulative Validation**: Ensure document accuracy and structure throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track document properties after each test (word count, header structure, link counts) for potential preconditions in later passes
- Use document signatures (header patterns, link types, content structure) to verify expected state
- Validate document structure and content integrity after each major operation

---

## Execution Order & Additive Test Specs

### MD-0. Baseline Markdown Setup
**Goal**: Establish basic Markdown processing and validation
**Actions**:
- Validate test Markdown files using `validate_markdown`
- Get word count and statistics using `get_word_count`
- Extract document headers using `extract_headers`
- Verify Markdown is accessible and properly structured
- **Expected final state**: Markdown validated with structure analysis and word count

### MD-1. Content Extraction (Additive State A)
**Goal**: Demonstrate content extraction and link analysis
**Actions**:
- Extract links using `extract_links`
- Extract images using `extract_images`
- Analyze link types and destinations
- Verify extraction accuracy and completeness
- **Expected final state**: Links and images extracted with detailed analysis

### MD-2. Format Conversion (Additive State B)
**Goal**: Demonstrate Markdown format conversion capabilities
**Actions**:
- Convert Markdown to HTML using `convert_to_html`
- Convert HTML back to Markdown using `convert_from_html`
- Verify conversion accuracy and structure preservation
- Compare original and round-trip converted documents
- **Expected final state**: Markdown converted to HTML and back with structure preserved

### MD-3. Document Enhancement (Additive State C)
**Goal**: Demonstrate document enhancement and formatting
**Actions**:
- Prettify Markdown using `prettify_markdown`
- Apply formatting improvements and consistency fixes
- Validate enhanced document maintains original content
- Verify formatting improvements and readability enhancements
- **Expected final state**: Enhanced Markdown document with improved formatting

### MD-4. Integration Validation (No New Processing)
**Goal**: Verify Markdown processing integration and validate all operations
**Actions**:
- Cross-validate results across different conversion operations
- Verify that extracted content is consistent across operations
- Check that document structure remains valid throughout processing
- Validate that all operations preserve essential content and formatting
- **Expected final state**: All Markdown operations validated and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/MD-4_results.xml` (no extra text). The `<testcase name>` must start with `MD-4`. Include at most 3 key properties across all operations, or simply state "all Markdown operations valid; integration OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded content:**
```json
{"source": "test.md", "extract": "headers", "level": "all"}
```

**Use content-aware targeting:**
```json
# Validate and then extract
validate_markdown(markdown_content: testMd)
extract_headers(source: "validated", max_level: 3)
# Then convert enhanced content
```

**Markdown operations:**
```json
{"source": "document.md", "output": "document.html", "format": "github"}
{"html_source": "content.html", "output": "converted.md", "flavor": "commonmark"}
{"extract": "links", "include_anchors": true, "filter_external": true}
{"prettify": true, "normalize_spacing": true, "fix_headers": true}
```

---

## State Verification Patterns

**After each test:**
1. Verify document accuracy: check content preservation, structure validity, extraction completeness
2. Check processing quality: validate conversion accuracy, formatting improvements, link analysis
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied document conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual Markdown processing pipelines
2. **Robust Operations**: Proves Markdown processing works on evolving document state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or document snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative Markdown operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual Markdown usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-data/`, `output/`, and `reports/` exist.

---