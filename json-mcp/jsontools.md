# JSON Tools — Data Processing Test Design

You are running inside CI for the `json-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__json__format_json,mcp__json__validate_json,mcp__json__convert_to_yaml,mcp__json__convert_to_xml,mcp__json__merge_json,mcp__json__query_jsonpath,mcp__json__extract_keys,mcp__json__sort_json

---

## Mission
1) Set up JSON test environment:
   - Use test JSON files with various structures and complexity
2) Execute JSON processing tests JS-0..JS-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with data integrity and structure verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="JS-0 — Baseline JSON Setup" classname="JSONMCP.JS-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: JS-0, JS-1, JS-2, JS-3, JS-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test JSON: `test-data/` directory for JSON test files
  - Output files: `output/` directory for processed JSON and converted formats

CI provides:
- `$JUNIT_OUT=reports/junit-js-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-js-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full JSON content. For matches, include only key structure information.
- Prefer structure summaries and validation results over full JSON dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- JSON evidence: extract essential properties (validity, structure depth, key count) and include ≤ 3 key fields in the fragment.
- Avoid quoting long JSON content; reference structural summaries only.
- Data scans: verify JSON validity and include ≤ 3 critical properties (valid, keys, depth) or simply state "JSON processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **JSON Formatting**: `mcp__json__format_json` — format JSON with proper indentation
- **JSON Validation**: `mcp__json__validate_json` — validate JSON syntax and structure
- **YAML Conversion**: `mcp__json__convert_to_yaml` — convert JSON to YAML format
- **XML Conversion**: `mcp__json__convert_to_xml` — convert JSON to XML format
- **JSON Merging**: `mcp__json__merge_json` — merge multiple JSON objects
- **JSONPath Queries**: `mcp__json__query_jsonpath` — query JSON using JSONPath expressions
- **Key Extraction**: `mcp__json__extract_keys` — extract all keys from JSON structure
- **JSON Sorting**: `mcp__json__sort_json` — sort JSON keys and array elements

**STRICT OP GUARDRAILS**
- Always verify JSON accessibility before processing
- Use test JSON that is well-formed and contains various data types
- Limit JSON processing to reasonable sizes to avoid resource exhaustion
- Use appropriate JSONPath expressions that are reliable and specific
- Include proper error handling for malformed JSON or invalid queries

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive JSON Processing**: Each test uses JSON content from previous operations
2. **State Awareness**: Each test expects JSON content state left by previous test
3. **Content-Based Operations**: Target specific JSON structures and data types, not hardcoded content
4. **Cumulative Validation**: Ensure JSON accuracy and structure throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track JSON properties after each test (validity, key count, structure depth) for potential preconditions in later passes
- Use JSON signatures (key patterns, data types, structural depth) to verify expected state
- Validate JSON structure and data integrity after each major operation

---

## Execution Order & Additive Test Specs

### JS-0. Baseline JSON Setup
**Goal**: Establish basic JSON processing and validation
**Actions**:
- Validate test JSON files using `validate_json`
- Format JSON content using `format_json`
- Extract key structure information using `extract_keys`
- Verify JSON is accessible and properly structured
- **Expected final state**: JSON validated with formatted structure and key extraction

### JS-1. JSON Querying and Extraction (Additive State A)
**Goal**: Demonstrate JSON querying and data extraction
**Actions**:
- Query JSON using JSONPath expressions with `query_jsonpath`
- Extract specific data types and nested values
- Test complex queries with filters and conditions
- Verify query accuracy and completeness
- **Expected final state**: JSON queried successfully with targeted data extraction

### JS-2. Format Conversion (Additive State B)
**Goal**: Demonstrate JSON format conversion capabilities
**Actions**:
- Convert JSON to YAML using `convert_to_yaml`
- Convert JSON to XML using `convert_to_xml`
- Verify conversion accuracy and structure preservation
- Compare different format representations
- **Expected final state**: JSON converted to YAML and XML formats

### JS-3. Advanced Processing (Additive State C)
**Goal**: Demonstrate advanced JSON processing features
**Actions**:
- Sort JSON keys and array elements using `sort_json`
- Merge multiple JSON objects using `merge_json`
- Apply sorting and merging to previously converted formats
- Verify advanced processing maintains data integrity
- **Expected final state**: Advanced processing completed with data structure optimization

### JS-4. Integration Validation (No New Processing)
**Goal**: Verify JSON processing integration and validate all operations
**Actions**:
- Cross-validate results across different format conversions
- Verify that extracted data is consistent across operations
- Check that JSON structure remains valid throughout processing
- Validate that all operations preserve essential data and relationships
- **Expected final state**: All JSON operations validated and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/JS-4_results.xml` (no extra text). The `<testcase name>` must start with `JS-4`. Include at most 3 key properties across all operations, or simply state "all JSON operations valid; integration OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded paths:**
```json
{"jsonpath": "$.users[*].name", "source": "test.json"}
```

**Use content-aware targeting:**
```json
# Validate and then query
validate_json(json_content: testJson)
query_jsonpath(expression: "$.data.items[*]", source: "validated")
# Then convert extracted data
```

**JSON operations:**
```json
{"jsonpath": "$.store.book[*].author", "filter": "price > 10"}
{"merge_strategy": "deep", "conflict_resolution": "overwrite"}
{"sort_keys": true, "sort_arrays": true, "case_sensitive": false}
{"indent": 2, "sort_keys": true}
```

---

## State Verification Patterns

**After each test:**
1. Verify JSON accuracy: check syntax validity, structure preservation, data integrity
2. Check processing quality: validate query results, conversion accuracy, sorting effectiveness
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied JSON conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual JSON processing pipelines
2. **Robust Operations**: Proves JSON processing works on evolving data state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or data snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative JSON operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual JSON usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-data/`, `output/`, and `reports/` exist.

---