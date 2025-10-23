# Dice Roll Tools — Random Gaming Test Design

You are running inside CI for the `diceroll-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__diceroll__roll_standard_dice,mcp__diceroll__roll_custom_dice,mcp__diceroll__roll_percentile,mcp__diceroll__roll_multiple,mcp__diceroll__roll_with_modifier

---

## Mission
1) Set up dice rolling test environment:
   - Use predefined dice configurations and test scenarios
2) Execute dice operation tests DR-0..DR-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with statistical verification and probability analysis.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="DR-0 — Baseline Dice Setup" classname="DiceRollMCP.DR-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: DR-0, DR-1, DR-2, DR-3, DR-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- All dice operations are stateless and don't require file system paths
- **Random seed management**: Use consistent seeds for reproducible test results where applicable
- **Statistical validation**: Results should fall within expected probability ranges

CI provides:
- `$JUNIT_OUT=reports/junit-dr-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-dr-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full dice roll results. For matches, include only key statistics.
- Prefer result summaries over full roll distributions.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Dice evidence: extract essential properties (dice type, roll count, result range) and include ≤ 3 key fields in the fragment.
- Avoid quoting long roll sequences; reference statistical summaries only.
- Roll scans: verify roll validity and include ≤ 3 critical properties (dice, count, range) or simply state "dice rolls valid" (≤ 400 chars).

---

## Tool Mapping
- **Standard Dice**: `mcp__diceroll__roll_standard_dice` — roll D4, D6, D8, D10, D12, D20, D100
- **Custom Dice**: `mcp__diceroll__roll_custom_dice` — roll dice with custom side counts
- **Percentile Rolls**: `mcp__diceroll__roll_percentile` — roll 1-100 percentile dice
- **Multiple Dice**: `mcp__diceroll__roll_multiple` — roll multiple dice simultaneously
- **Modified Rolls**: `mcp__diceroll__roll_with_modifier` — apply modifiers to dice rolls

**STRICT OP GUARDRAILS**
- Always verify dice configuration is within reasonable bounds (1-1000 sides)
- Use reasonable roll counts to avoid resource exhaustion (≤ 100 rolls per operation)
- Validate results fall within expected ranges for each dice type
- For statistical validation, use sufficient sample sizes but remain efficient
- Include proper validation for negative modifiers and edge cases

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Dice Complexity**: Each test builds on previous dice mechanics and results
2. **State Awareness**: Each test uses dice concepts introduced in previous tests
3. **Content-Based Operations**: Target specific dice types and mechanics, not hardcoded values
4. **Cumulative Validation**: Ensure dice mechanics work correctly throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track dice mechanics after each test (dice types, modifiers, statistical properties) for potential preconditions in later passes
- Use mechanical signatures (dice ranges, modifier types, probability distributions) to verify expected state
- Validate dice system integrity after each major operation

---

## Execution Order & Additive Test Specs

### DR-0. Baseline Dice Setup
**Goal**: Establish basic dice rolling functionality
**Actions**:
- Roll standard D6 dice using `roll_standard_dice`
- Test multiple standard dice types (D4, D8, D20)
- Verify all results fall within expected ranges
- Record baseline dice behavior and statistical properties
- **Expected final state**: Standard dice types verified with valid result ranges

### DR-1. Custom Dice Testing (Additive State A)
**Goal**: Demonstrate custom dice configuration
**Actions**:
- Roll custom dice with various side counts using `roll_custom_dice`
- Test unusual dice configurations (D3, D7, D16, D50)
- Verify results respect custom side ranges
- Test edge cases (D2, D100, D1000)
- **Expected final state**: Custom dice verified with correct range validation

### DR-2. Multiple Dice Operations (Additive State B)
**Goal**: Demonstrate multiple dice rolling mechanics
**Actions**:
- Roll multiple dice simultaneously using `roll_multiple`
- Test different quantities of the same dice type
- Test mixed dice type combinations
- Calculate and verify sum and individual roll results
- **Expected final state**: Multiple dice mechanics verified with proper aggregation

### DR-3. Modified Dice Rolls (Additive State C)
**Goal**: Demonstrate modifier application and advanced mechanics
**Actions**:
- Roll dice with positive modifiers using `roll_with_modifier`
- Roll dice with negative modifiers using `roll_with_modifier`
- Test percentile rolls using `roll_percentile`
- Verify modifier calculations and percentile mechanics
- **Expected final state**: Modified and percentile dice verified with correct calculations

### DR-4. Statistical Validation (No New Mechanics)
**Goal**: Verify statistical properties and validate all dice operations
**Actions**:
- Perform larger sample rolls for statistical validation
- Verify probability distributions match expected patterns
- Validate that all dice mechanics integrate correctly
- Check edge cases and boundary conditions across all operations
- **Expected final state**: All dice operations statistically validated and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/DR-4_results.xml` (no extra text). The `<testcase name>` must start with `DR-4`. Include at most 3 key properties across all operations, or simply state "all dice mechanics valid; statistics OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded dice values:**
```json
{"dice_type": "d6", "count": 3}
```

**Use content-aware targeting:**
```json
# Use previous results as inputs
roll_with_modifier(dice_type: "d20", modifier: previous_sum / 10)
# Then chain operations together
```

**Dice operations:**
```json
{"dice_type": "custom", "sides": 16, "count": 2}
{"dice_type": "d20", "modifier": 5, "operation": "add"}
{"dice_type": "percentile", "count": 1}
{"dice_types": ["d6", "d8", "d10"], "operation": "sum"}
```

---

## State Verification Patterns

**After each test:**
1. Verify dice validity: check result ranges, modifiers, aggregations
2. Check statistical properties: validate distributions, probabilities, edge cases
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied dice conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual dice gaming scenarios
2. **Robust Operations**: Proves dice mechanics work on evolving complexity
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or state snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative dice operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual dice roll usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system operations required.

---