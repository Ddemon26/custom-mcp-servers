# Browser Tools — Web Automation Test Design

You are running inside CI for the `browser-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__browser__navigate,mcp__browser__screenshot,mcp__browser__get_html,mcp__browser__get_text,mcp__browser__click,mcp__browser__type,mcp__browser__wait_for_selector,mcp__browser__pdf,mcp__browser__get_cookies,mcp__browser__set_cookies,mcp__browser__extract_data,mcp__browser__fill_form,mcp__browser__close_browser

---

## Mission
1) Set up browser automation environment:
   - Use a reliable test website (e.g., example.com or a test page)
2) Execute browser automation tests BR-0..BR-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with page content and state verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="BR-0 — Baseline Browser Setup" classname="BrowserMCP.BR-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: BR-0, BR-1, BR-2, BR-3, BR-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Screenshots: `screenshots/` directory for captured images
  - PDFs: `pdfs/` directory for generated PDFs
  - HTML exports: `html/` directory for saved page content

CI provides:
- `$JUNIT_OUT=reports/junit-br-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-br-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full HTML content. For matches, include only key elements or text snippets.
- Prefer `mcp__browser__get_text` for verification; avoid full HTML dumps unless necessary.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Browser evidence: extract essential properties (page title, URL, element count) and include ≤ 3 key fields in the fragment.
- Avoid quoting full page source; reference markers instead.
- Page scans: verify navigation and include ≤ 3 critical properties (title, URL, content type) or simply state "navigation successful" (≤ 400 chars).

---

## Tool Mapping
- **Navigation**: `mcp__browser__navigate` — navigate to URLs and load pages
- **Screenshots**: `mcp__browser__screenshot` — capture page or element screenshots
- **HTML Extraction**: `mcp__browser__get_html` — extract page source or element HTML
- **Text Extraction**: `mcp__browser__get_text` — extract visible text content
- **Element Interaction**: `mcp__browser__click` — click elements by selectors
- **Text Input**: `mcp__browser__type` — input text into form fields
- **Waiting**: `mcp__browser__wait_for_selector` — wait for elements to appear
- **PDF Generation**: `mcp__browser__pdf` — generate PDF from current page
- **Cookie Management**: `mcp__browser__get_cookies`, `mcp__browser__set_cookies` — handle cookies
- **Data Extraction**: `mcp__browser__extract_data` — extract structured data
- **Form Operations**: `mcp__browser__fill_form` — fill complete forms
- **Browser Control**: `mcp__browser__close_browser` — cleanup browser sessions

**STRICT OP GUARDRAILS**
- Always verify page load completion before operations
- Use robust selectors (ID, class, data attributes) over fragile XPath
- Limit file output sizes (screenshots, PDFs) to reasonable dimensions
- Use test websites that are stable and designed for automation
- Include proper waits for dynamic content loading

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Navigation**: Each test builds on the browser state from previous operations
2. **State Awareness**: Each test expects page/Browser state left by previous test
3. **Content-Based Operations**: Target specific page elements and content, not hardcoded positions
4. **Cumulative Validation**: Ensure browser remains responsive and functional throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track page properties after each test (URL, title, element count) for potential preconditions in later passes
- Use content signatures (headings, form IDs, specific text) to verify expected state
- Validate browser health and session integrity after each major operation

---

## Execution Order & Additive Test Specs

### BR-0. Baseline Browser Setup
**Goal**: Establish browser session and basic navigation
**Actions**:
- Navigate to test website (example.com or test page)
- Capture initial screenshot using `screenshot`
- Extract page title and basic text content using `get_text`
- Verify page loaded successfully and content is accessible
- **Expected final state**: Browser open with test page loaded, initial content captured

### BR-1. Content Extraction (Additive State A)
**Goal**: Demonstrate various content extraction methods
**Actions**:
- Extract full HTML content using `get_html`
- Extract structured text using `get_text`
- Extract specific data using `extract_data` with CSS selectors
- Compare different extraction methods and validate consistency
- **Expected final state**: Multiple content formats extracted from same page

### BR-2. Form Interaction (Additive State B)
**Goal**: Demonstrate form filling and interaction capabilities
**Actions**:
- Locate form elements on current page or navigate to a form test page
- Fill form fields using `fill_form` with test data
- Use `type` for individual text input if needed
- Click submit button using `click`
- Wait for response using `wait_for_selector`
- **Expected final state**: Form submitted and response page loaded

### BR-3. Advanced Operations (Additive State C)
**Goal**: Demonstrate advanced browser operations
**Actions**:
- Generate PDF of current page using `pdf`
- Manage cookies using `get_cookies` and `set_cookies`
- Take targeted screenshot of specific elements
- Extract data from loaded response page
- Validate all operations completed successfully
- **Expected final state**: PDF generated, cookies managed, additional data extracted

### BR-4. Session Cleanup (No New Content)
**Goal**: Verify session integrity and perform cleanup
**Actions**:
- Verify browser is still responsive and on expected page
- Validate all generated files (screenshots, PDFs) exist and have expected properties
- Check that session cookies and state are maintained correctly
- Clean up browser session using `close_browser`
- **Expected final state**: Browser session properly closed, all files validated
- **IMMEDIATELY** write clean XML fragment to `reports/BR-4_results.xml` (no extra text). The `<testcase name>` must start with `BR-4`. Include at most 3 key properties across all operations, or simply state "session closed cleanly; all files OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded URLs:**
```json
{"url": "https://example.com"}
```

**Use content-aware targeting:**
```json
# Navigate and verify content before proceeding
navigate(url: testUrl)
get_text(selector: "h1")
# Then use extracted content for subsequent operations
```

**Selector-based operations:**
```json
{"selector": "#submit-button", "method": "css"}
{"selector": "form.contact-form", "data": {"name": "Test User", "email": "test@example.com"}}
{"wait_for": ".success-message", "timeout": 5000}
```

---

## State Verification Patterns

**After each test:**
1. Verify expected page state: check URL, title, key elements
2. Check browser health: validate responsiveness and session integrity
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied web conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual browser automation pipelines
2. **Robust Operations**: Proves automation works on evolving page state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or page snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative browser operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual browser automation usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `screenshots/`, `pdfs/`, `html/`, and `reports/` exist.

---