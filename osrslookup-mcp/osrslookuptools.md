# OSRS Lookup Tools — Game Data Test Design

You are running inside CI for the `osrslookup-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__osrslookup__lookup_ge_item,mcp__osrslookup__lookup_hiscores,mcp__osrslookup__search_ge_items

---

## Mission
1) Set up OSRS test environment:
   - Use known test items and player usernames for reliable lookups
2) Execute OSRS lookup operation tests OS-0..OS-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with data accuracy and API response verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="OS-0 — Baseline OSRS Setup" classname="OSRSLookupMCP.OS-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: OS-0, OS-1, OS-2, OS-3, OS-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- All OSRS operations are network-based and don't require file system paths
- **API endpoints**: Use official OSRS APIs and public game data sources
- **Test data**: Use reliable test items and usernames that are stable

CI provides:
- `$JUNIT_OUT=reports/junit-os-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-os-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full API responses. For matches, include only key game data.
- Prefer item IDs and statistics over full response dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- OSRS evidence: extract essential properties (item ID, price, rank, level) and include ≤ 3 key fields in the fragment.
- Avoid quoting long API responses; reference key game statistics only.
- Data scans: verify lookup success and include ≤ 3 critical properties (item, price, availability) or simply state "lookup successful" (≤ 400 chars).

---

## Tool Mapping
- **Grand Exchange Lookup**: `mcp__osrslookup__lookup_ge_item` — look up item prices and data from Grand Exchange
- **Hiscores Lookup**: `mcp__osrslookup__lookup_hiscores` — look up player stats and rankings
- **Item Search**: `mcp__osrslookup__search_ge_items` — search for items on Grand Exchange

**STRICT OP GUARDRAILS**
- Always verify API accessibility before making requests
- Use reliable test items that are commonly traded and have stable data
- Use test usernames that are public or designed for automated testing
- Include proper error handling for API failures or invalid lookups
- Respect rate limits and be conservative with request frequency

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Data Discovery**: Each test uses game data knowledge from previous lookups
2. **State Awareness**: Each test expects API knowledge and data patterns from previous test
3. **Content-Based Operations**: Target specific game items and statistics, not hardcoded IDs
4. **Cumulative Validation**: Ensure data accuracy and API consistency throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track lookup results after each test (item prices, player stats, search patterns) for potential preconditions in later passes
- Use data signatures (item IDs, stat types, price ranges) to verify expected state
- Validate API response accuracy and data consistency after each major operation

---

## Execution Order & Additive Test Specs

### OS-0. Baseline OSRS Setup
**Goal**: Establish basic API connectivity and data retrieval
**Actions**:
- Look up a common item using `lookup_ge_item`
- Verify API connectivity and data accessibility
- Record baseline item data structure for tracking
- Verify response format and data completeness
- **Expected final state**: Basic item lookup completed with verified data structure

### OS-1. Item Search and Discovery (Additive State A)
**Goal**: Demonstrate item search and discovery capabilities
**Actions**:
- Search for items using `search_ge_items` with common terms
- Look up multiple items from search results using `lookup_ge_item`
- Compare search result data with detailed item data
- Verify search accuracy and data consistency
- **Expected final state**: Multiple items searched and detailed data retrieved

### OS-2. Player Statistics (Additive State B)
**Goal**: Demonstrate player data and hiscores lookup
**Actions**:
- Look up player statistics using `lookup_hiscores`
- Verify player skill levels and rankings
- Check different skill categories and combat levels
- Verify hiscores data structure and completeness
- **Expected final state**: Player statistics retrieved with verified skill data

### OS-3. Cross-Reference Operations (Additive State C)
**Goal**: Demonstrate cross-referencing between different data types
**Actions**:
- Use item data from previous searches to inform related item lookups
- Verify price trends and item relationships
- Cross-reference item categories and player equipment possibilities
- Validate data consistency across different lookup types
- **Expected final state**: Cross-referenced data validated with consistent relationships

### OS-4. API Validation (No New Lookups)
**Goal**: Verify API reliability and validate all lookup operations
**Actions**:
- Cross-validate all retrieved data for consistency
- Verify that API responses maintain consistent structure
- Check that all lookup operations provide accurate and current data
- Validate that all data types are properly handled and formatted
- **Expected final state**: All OSRS lookup operations validated with data accuracy confirmed
- **IMMEDIATELY** write clean XML fragment to `reports/OS-4_results.xml` (no extra text). The `<testcase name>` must start with `OS-4`. Include at most 3 key properties across all operations, or simply state "all lookups valid; data accurate" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded IDs:**
```json
{"item_id": 4151, "item_name": "abyssal whip"}
```

**Use content-aware targeting:**
```json
# Search and then lookup details
search_ge_items(query: "dragon", limit: 5)
lookup_ge_item(item_id: search_results[0].id)
# Then analyze related data
```

**OSRS operations:**
```json
{"item_name": "dragon scimitar", "include_trends": true}
{"username": "zezima", "skills": ["overall", "attack", "strength"]}
{"search_query": "rare", "category": "weapons", "limit": 10}
```

---

## State Verification Patterns

**After each test:**
1. Verify lookup accuracy: check data completeness, format consistency, value validity
2. Check API reliability: validate response times, data freshness, error handling
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied API conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual OSRS data lookup workflows
2. **Robust Operations**: Proves lookup operations work on evolving API state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or API snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative lookup operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual OSRS lookup usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system operations required.

---