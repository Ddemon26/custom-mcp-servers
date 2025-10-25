# HTML Tools — Web Content Processing Test Design

You are running inside CI for the `html-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__html__parse_html,mcp__html__select_elements,mcp__html__extract_text,mcp__html__extract_attributes,mcp__html__validate_html,mcp__html__minify_html,mcp__html__prettify_html,mcp__html__extract_metadata,mcp__html__convert_to_markdown

---

## Mission
1) Set up HTML test environment:
   - Use test HTML files or fetch sample web content
2) Execute HTML processing tests HT-0..HT-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with content accuracy and structure verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="HT-0 — Baseline HTML Parsing" classname="HTMLMCP.HT-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: HT-0, HT-1, HT-2, HT-3, HT-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test HTML: `test-data/` directory for HTML test files
  - Output files: `output/` directory for processed HTML content

CI provides:
- `$JUNIT_OUT=reports/junit-ht-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-ht-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full HTML content. For matches, include only key element counts.
- Prefer element counts and metadata over full HTML dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- HTML evidence: extract essential properties (element count, structure validity, content length) and include ≤ 3 key fields in the fragment.
- Avoid quoting long HTML content; reference structural summaries only.
- Content scans: verify HTML validity and include ≤ 3 critical properties (elements, validity, size) or simply state "HTML processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **HTML Parsing**: `mcp__html__parse_html` — parse and validate HTML structure
- **Element Selection**: `mcp__html__select_elements` — select elements using CSS selectors
- **Text Extraction**: `mcp__html__extract_text` — extract clean text content
- **Attribute Extraction**: `mcp__html__extract_attributes` — extract element attributes
- **HTML Validation**: `mcp__html__validate_html` — validate HTML against standards
- **HTML Minification**: `mcp__html__minify_html` — compress HTML by removing whitespace
- **HTML Prettification**: `mcp__html__prettify_html` — format HTML with proper indentation
- **Metadata Extraction**: `mcp__html__extract_metadata` — extract title, description, keywords
- **Markdown Conversion**: `mcp__html__convert_to_markdown` — convert HTML to Markdown format

**STRICT OP GUARDRAILS**
- Always verify HTML content accessibility before processing
- Use test HTML that is well-formed and contains various element types
- Limit HTML processing to reasonable sizes to avoid resource exhaustion
- Use appropriate CSS selectors that are reliable and specific
- Include proper error handling for malformed HTML or invalid selectors

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive HTML Processing**: Each test uses HTML content from previous operations
2. **State Awareness**: Each test expects HTML content state left by previous test
3. **Content-Based Operations**: Target specific HTML elements and structures, not hardcoded content
4. **Cumulative Validation**: Ensure HTML accuracy and structure throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track HTML properties after each test (element counts, structure validity, content length) for potential preconditions in later passes
- Use HTML signatures (doctype, key elements, structural patterns) to verify expected state
- Validate HTML structure and content integrity after each major operation

---

## Execution Order & Additive Test Specs

### HT-0. Baseline HTML Parsing
**Goal**: Establish basic HTML parsing and structure analysis
**Actions**:
- Parse test HTML file using `parse_html`
- Validate HTML structure using `validate_html`
- Extract basic metadata using `extract_metadata`
- Verify HTML is accessible and properly structured
- **Expected final state**: HTML parsed with structure validation and metadata extraction

### HT-1. Element Selection and Extraction (Additive State A)
**Goal**: Demonstrate element selection and content extraction
**Actions**:
- Select specific elements using `select_elements` with CSS selectors
- Extract text content using `extract_text`
- Extract element attributes using `extract_attributes`
- Verify selection accuracy and content completeness
- **Expected final state**: Elements selected with text and attributes extracted

### HT-2. Content Transformation (Additive State B)
**Goal**: Demonstrate HTML content transformation
**Actions**:
- Convert HTML to Markdown using `convert_to_markdown`
- Minify HTML using `minify_html`
- Prettify HTML using `prettify_html`
- Compare different transformation results
- **Expected final state**: HTML transformed into multiple formats

### HT-3. Advanced Processing (Additive State C)
**Goal**: Demonstrate advanced HTML processing features
**Actions**:
- Extract specific metadata patterns from HTML
- Select complex element combinations with advanced selectors
- Validate transformed HTML maintains essential structure
- Verify content preservation across transformations
- **Expected final state**: Advanced processing completed with content integrity maintained

### HT-4. Integration Validation (No New Processing)
**Goal**: Verify HTML processing integration and validate all operations
**Actions**:
- Cross-validate results across different transformation methods
- Verify that extracted content is consistent across operations
- Check that HTML structure remains valid throughout processing
- Validate that all operations preserve essential content
- **Expected final state**: All HTML operations validated and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/HT-4_results.xml` (no extra text). The `<testcase name>` must start with `HT-4`. Include at most 3 key properties across all operations, or simply state "all HTML operations valid; integration OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded selectors:**
```json
{"selector": "h1, h2, h3", "attribute": "text"}
```

**Use content-aware targeting:**
```json
# Parse and then select elements
parse_html(html_content: testHtml)
select_elements(selector: "article", source: "parsed")
# Then extract content from selected elements
```

**HTML operations:**
```json
{"selector": "meta[name='description']", "attribute": "content"}
{"selector": ".content", "extract": "text", "clean": true}
{"format": "markdown", "preserve_links": true}
{"validation": "html5", "strict": false}
```

---

## State Verification Patterns

**After each test:**
1. Verify HTML accuracy: check structure validity, content preservation, element counts
2. Check processing quality: validate transformations, extraction accuracy, metadata completeness
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied HTML conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual HTML processing pipelines
2. **Robust Operations**: Proves HTML processing works on evolving content state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or content snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative HTML operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual HTML processing usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-data/`, `output/`, and `reports/` exist.

---