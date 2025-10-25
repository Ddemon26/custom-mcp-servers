# CSV Tools — Data Processing Test Design

You are running inside CI for the `csv-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__csv__create_csv,mcp__csv__read_csv,mcp__csv__update_cell,mcp__csv__add_row,mcp__csv__delete_row,mcp__csv__filter_rows,mcp__csv__sort_csv,mcp__csv__merge_csv,mcp__csv__convert_format

---

## Mission
1) Set up CSV test environment:
   - Create test CSV files with sample data
2) Execute CSV operation tests CS-0..CS-4 in order using minimal, precise operations that build on each other.
3) Validate each operation with data integrity and structure verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="CS-0 — Baseline CSV Setup" classname="CSVMCP.CS-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: CS-0, CS-1, CS-2, CS-3, CS-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test CSVs: `test-data/` directory for source CSV files
  - Output CSVs: `output/` directory for processed files
  - Backups: `backups/` directory for intermediate versions

CI provides:
- `$JUNIT_OUT=reports/junit-cs-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-cs-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full CSV content. For matches, include only key data samples.
- Prefer `mcp__csv__read_csv` for verification; avoid full data dumps unless necessary.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- CSV evidence: extract essential properties (row count, column count, file size) and include ≤ 3 key fields in the fragment.
- Avoid quoting long data sets; reference key statistics only.
- Data scans: verify data integrity and include ≤ 3 critical properties (rows, columns, data type) or simply state "CSV processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **CSV Creation**: `mcp__csv__create_csv` — create new CSV files with headers and data
- **CSV Reading**: `mcp__csv__read_csv` — read and parse CSV content
- **Cell Updates**: `mcp__csv__update_cell` — modify individual cell values
- **Row Operations**: `mcp__csv__add_row`, `mcp__csv__delete_row` — add or remove rows
- **Data Filtering**: `mcp__csv__filter_rows` — filter rows based on conditions
- **Data Sorting**: `mcp__csv__sort_csv` — sort CSV by specified columns
- **CSV Merging**: `mcp__csv__merge_csv` — combine multiple CSV files
- **Format Conversion**: `mcp__csv__convert_format` — convert between CSV, TSV, JSON

**STRICT OP GUARDRAILS**
- Always verify source files exist before processing
- Use descriptive file names that indicate the operation performed
- Validate output CSVs maintain proper structure and formatting
- For large operations, limit to ≤ 100 rows to avoid resource exhaustion
- Use test data that covers various data types (text, numbers, dates)

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Data Operations**: Each test uses CSV files created or modified in previous tests
2. **State Awareness**: Each test expects data state left by previous test
3. **Content-Based Operations**: Target specific data patterns and structures, not hardcoded positions
4. **Cumulative Validation**: Ensure data integrity throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track CSV properties after each test (row count, column count, file size) for potential preconditions in later passes
- Use data signatures (headers, key values, data types) to verify expected state
- Validate CSV formatting and structure after each major operation

---

## Execution Order & Additive Test Specs

### CS-0. Baseline CSV Setup
**Goal**: Create initial CSV files and verify basic structure
**Actions**:
- Create test CSV file with sample data using `create_csv`
- Include mixed data types (text, numbers, dates, booleans)
- Read CSV content using `read_csv` to verify structure
- Record baseline CSV properties for tracking
- **Expected final state**: Test CSV created with verified structure and content

### CS-1. Data Modification (Additive State A)
**Goal**: Demonstrate cell and row modification operations
**Actions**:
- Update specific cells using `update_cell` with new values
- Add new rows using `add_row` with test data
- Delete specific rows using `delete_row`
- Read modified CSV to verify all changes applied correctly
- **Expected final state**: CSV with modified cells, added rows, and removed rows

### CS-2. Data Filtering and Sorting (Additive State B)
**Goal**: Demonstrate data filtering and sorting capabilities
**Actions**:
- Filter rows based on numeric conditions using `filter_rows`
- Sort CSV by different columns using `sort_csv`
- Apply multiple filters and sorting operations in sequence
- Verify filtered and sorted results match expected criteria
- **Expected final state**: CSV with filtered data and sorted structure

### CS-3. Advanced Operations (Additive State C)
**Goal**: Demonstrate advanced CSV operations
**Actions**:
- Create a second CSV file with related data
- Merge CSVs using `merge_csv` with different join strategies
- Convert CSV format to JSON and TSV using `convert_format`
- Verify merged data maintains integrity across formats
- **Expected final state**: Multiple CSV formats and merged dataset

### CS-4. Data Integrity Validation (No New Files)
**Goal**: Verify data integrity and validate all operations
**Actions**:
- Read all generated CSV files and verify data consistency
- Cross-reference row counts and data types across operations
- Validate that all transformations preserved data integrity
- Check that merged files contain expected combined data
- **Expected final state**: All CSV operations validated, data integrity confirmed
- **IMMEDIATELY** write clean XML fragment to `reports/CS-4_results.xml` (no extra text). The `<testcase name>` must start with `CS-4`. Include at most 3 key properties across all files, or simply state "all CSVs valid; data integrity OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded cell references:**
```json
{"row": 5, "column": "name", "value": "John Doe"}
```

**Use content-aware targeting:**
```json
# Filter based on data content
filter_rows(csv_file: "test.csv", condition: "age > 25", column: "age")
# Then sort the filtered results
```

**Data operations:**
```json
{"operation": "merge", "files": ["file1.csv", "file2.csv"], "key": "id"}
{"operation": "convert", "format": "json", "output": "data.json"}
{"condition": "status = 'active'", "sort_by": "created_date"}
```

---

## State Verification Patterns

**After each test:**
1. Verify expected CSV structure: check row counts, column counts, headers
2. Check data integrity: validate data types, formatting, key values
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied data conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual CSV processing pipelines
2. **Robust Operations**: Proves CSV operations work on evolving data state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or data snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative CSV operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual CSV usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-data/`, `output/`, `backups/`, and `reports/` exist.

---