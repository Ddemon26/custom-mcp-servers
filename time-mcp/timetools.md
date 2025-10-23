# Time Tools — Temporal Processing Test Design

You are running inside CI for the `time-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__time__get_current_time,mcp__time__convert_timezone,mcp__time__format_time,mcp__time__parse_time,mcp__time__calculate_duration,mcp__time__add_subtract_time

---

## Mission
1) Set up temporal test environment:
   - Use various time formats, timezones, and test scenarios
2) Execute time processing tests TM-0..TM-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with temporal accuracy and conversion verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="TM-0 — Baseline Time Setup" classname="TimeMCP.TM-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: TM-0, TM-1, TM-2, TM-3, TM-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- All time operations are computational and don't require file system paths
- **Timezone data**: Use standard IANA timezone database and common timezones
- **Time formats**: Use ISO 8601, Unix timestamps, and common human-readable formats

CI provides:
- `$JUNIT_OUT=reports/junit-tm-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-tm-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full time objects. For matches, include only key temporal information.
- Prefer timestamps and timezone offsets over full date objects.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Time evidence: extract essential properties (timestamp, timezone, format) and include ≤ 3 key fields in the fragment.
- Avoid quoting long date strings; reference key temporal components only.
- Temporal scans: verify time accuracy and include ≤ 3 critical properties (timestamp, zone, format) or simply state "time processed successfully" (≤ 400 chars).

---

## Tool Mapping
- **Current Time**: `mcp__time__get_current_time` — get current time in specified timezone
- **Timezone Conversion**: `mcp__time__convert_timezone` — convert time between timezones
- **Time Formatting**: `mcp__time__format_time` — format time according to specified patterns
- **Time Parsing**: `mcp__time__parse_time` — parse time strings into standardized format
- **Duration Calculation**: `mcp__time__calculate_duration` — calculate time between two points
- **Time Arithmetic**: `mcp__time__add_subtract_time` — add or subtract time periods

**STRICT OP GUARDRAILS**
- Always use valid timezone identifiers from IANA database
- Use reasonable date ranges that avoid overflow or precision issues
- Include proper error handling for invalid time formats or timezones
- Use consistent time precision across operations (seconds, milliseconds)
- Include proper validation for edge cases (leap years, DST transitions)

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Temporal Processing**: Each test uses time data from previous operations
2. **State Awareness**: Each test expects temporal knowledge from previous test
3. **Content-Based Operations**: Target specific time formats and timezones, not hardcoded values
4. **Cumulative Validation**: Ensure temporal accuracy and consistency throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track temporal data after each test (timestamps, timezone offsets, calculated durations) for potential preconditions in later passes
- Use temporal signatures (timezone patterns, format types, duration ranges) to verify expected state
- Validate temporal accuracy and consistency after each major operation

---

## Execution Order & Additive Test Specs

### TM-0. Baseline Time Setup
**Goal**: Establish basic time retrieval and formatting
**Actions**:
- Get current time in multiple timezones using `get_current_time`
- Format current time using different patterns with `format_time`
- Verify time accessibility and basic structure
- Record baseline temporal properties for tracking
- **Expected final state**: Current time retrieved with various formats and timezones

### TM-1. Timezone Conversions (Additive State A)
**Goal**: Demonstrate timezone conversion capabilities
**Actions**:
- Convert time between multiple timezones using `convert_timezone`
- Use previously retrieved times as conversion sources
- Verify conversion accuracy and timezone offset calculations
- Test conversion across DST boundaries where applicable
- **Expected final state**: Time converted accurately across multiple timezones

### TM-2. Time Parsing and Formatting (Additive State B)
**Goal**: Demonstrate time parsing and advanced formatting
**Actions**:
- Parse various time string formats using `parse_time`
- Format parsed times using different patterns with `format_time`
- Test parsing of ISO 8601, Unix timestamps, and human-readable dates
- Verify parsing accuracy and format consistency
- **Expected final state**: Time parsed from various formats with consistent output

### TM-3. Duration and Arithmetic (Additive State C)
**Goal**: Demonstrate duration calculation and time arithmetic
**Actions**:
- Calculate durations between time points using `calculate_duration`
- Add and subtract time periods using `add_subtract_time`
- Use times from previous operations for duration calculations
- Verify arithmetic accuracy and edge case handling
- **Expected final state**: Duration calculations and time arithmetic completed

### TM-4. Integration Validation (No New Operations)
**Goal**: Verify temporal processing integration and validate all operations
**Actions**:
- Cross-validate results across different temporal operations
- Verify that timezone conversions maintain accurate relationships
- Check that formatting and parsing operations are inverses of each other
- Validate that all temporal operations maintain precision and consistency
- **Expected final state**: All time operations validated with temporal accuracy confirmed
- **IMMEDIATELY** write clean XML fragment to `reports/TM-4_results.xml` (no extra text). The `<testcase name>` must start with `TM-4`. Include at most 3 key properties across all operations, or simply state "all time operations valid; accuracy OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded values:**
```json
{"timezone": "America/New_York", "format": "ISO8601"}
```

**Use content-aware targeting:**
```json
# Get time and then convert
get_current_time(timezone: "UTC")
convert_timezone(source: "current", target_timezone: "Asia/Tokyo")
# Then calculate with converted time
```

**Time operations:**
```json
 {"source_timezone": "America/Los_Angeles", "target_timezone": "Europe/London"}
{"format": "YYYY-MM-DD HH:mm:ss z", "timezone": "UTC"}
{"input_format": "MM/DD/YYYY", "output_timezone": "America/Chicago"}
{"start_time": "2024-01-01T00:00:00Z", "end_time": "2024-01-02T12:30:00Z"}
{"base_time": "current", "add": {"days": 7, "hours": 3}}
```

---

## State Verification Patterns

**After each test:**
1. Verify temporal accuracy: check timestamp validity, timezone correctness, format consistency
2. Check temporal logic: validate conversions, calculations, parsing accuracy
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied temporal conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual temporal processing pipelines
2. **Robust Operations**: Proves time operations work on evolving temporal state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or temporal snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative temporal operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual time usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system operations required.

---