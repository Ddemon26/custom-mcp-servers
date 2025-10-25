# Calculator Tools — Mathematical Operations Test Design

You are running inside CI for the `calculator-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__calculator__basic_arithmetic,mcp__calculator__advanced_math,mcp__calculator__trigonometry,mcp__calculator__statistics,mcp__calculator__expression_evaluator,mcp__calculator__percentage_calculator

---

## Mission
1) Set up calculation test environment:
   - Use predefined test values and mathematical expressions
2) Execute calculator operation tests CA-0..CA-4 in order using minimal, precise operations that build on each other.
3) Validate each operation with result verification and mathematical accuracy.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="CA-0 — Baseline Calculator Setup" classname="CalculatorMCP.CA-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: CA-0, CA-1, CA-2, CA-3, CA-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- All calculations are stateless and don't require file system paths
- **Mathematical precision**: Results should be verified against expected values within acceptable floating-point tolerance

CI provides:
- `$JUNIT_OUT=reports/junit-ca-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-ca-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full calculation results. For matches, include only key numerical values.
- Prefer result verification over full output dumps.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Calculation evidence: extract essential properties (operation, result, precision) and include ≤ 3 key fields in the fragment.
- Avoid quoting long decimal expansions; reference key results only.
- Math scans: verify calculation accuracy and include ≤ 3 critical properties (operation, expected, actual) or simply state "calculation accurate" (≤ 400 chars).

---

## Tool Mapping
- **Basic Arithmetic**: `mcp__calculator__basic_arithmetic` — addition, subtraction, multiplication, division
- **Advanced Math**: `mcp__calculator__advanced_math` — logarithms, exponents, roots, factorials
- **Trigonometry**: `mcp__calculator__trigonometry` — sin, cos, tan, inverse functions, unit conversions
- **Statistics**: `mcp__calculator__statistics` — mean, median, mode, standard deviation, variance
- **Expression Evaluation**: `mcp__calculator__expression_evaluator` — complex mathematical expressions
- **Percentage Calculations**: `mcp__calculator__percentage_calculator` — percentage changes, discounts, markups

**STRICT OP GUARDRAILS**
- Always verify mathematical operations are within reasonable bounds
- Use test values that avoid division by zero and other mathematical errors
- Validate floating-point results within acceptable precision tolerance (±0.0001)
- For statistical operations, use datasets with known properties
- Include proper error handling for invalid mathematical expressions

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Calculations**: Each test uses results or knowledge from previous calculations when applicable
2. **State Awareness**: Each test builds mathematical complexity based on previous test results
3. **Content-Based Operations**: Target specific mathematical domains, not hardcoded values
4. **Cumulative Validation**: Ensure mathematical accuracy throughout the sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track calculation results after each test for potential input to later calculations
- Use mathematical signatures (precision, range, data types) to verify expected state
- Validate mathematical consistency across different operation types

---

## Execution Order & Additive Test Specs

### CA-0. Baseline Calculator Setup
**Goal**: Establish basic arithmetic capabilities and precision
**Actions**:
- Perform basic arithmetic operations (add, subtract, multiply, divide) using `basic_arithmetic`
- Test with integers, decimals, and negative numbers
- Verify precision and handle edge cases (division by zero prevention)
- Record baseline calculation behavior and accuracy
- **Expected final state**: Basic arithmetic operations verified with known test values

### CA-1. Advanced Mathematical Operations (Additive State A)
**Goal**: Demonstrate advanced mathematical functions
**Actions**:
- Calculate logarithms (natural and base-10) using `advanced_math`
- Compute exponentials and power functions
- Calculate square roots and cube roots
- Test factorial calculations with small integers
- **Expected final state**: Advanced operations verified with mathematically correct results

### CA-2. Trigonometric Functions (Additive State B)
**Goal**: Demonstrate trigonometric calculations
**Actions**:
- Calculate basic trig functions (sin, cos, tan) using `trigonometry`
- Test with common angles (0°, 30°, 45°, 60°, 90°)
- Convert between degrees and radians
- Calculate inverse trigonometric functions
- **Expected final state**: Trigonometric operations verified with expected values

### CA-3. Statistical Operations (Additive State C)
**Goal**: Demonstrate statistical calculations
**Actions**:
- Calculate mean, median, mode for test datasets using `statistics`
- Compute standard deviation and variance
- Test with both small and larger datasets
- Use results from previous calculations as input datasets where applicable
- **Expected final state**: Statistical operations verified with known datasets

### CA-4. Complex Expression Evaluation (No New Functions)
**Goal**: Verify complex expression parsing and integration
**Actions**:
- Evaluate complex mathematical expressions using `expression_evaluator`
- Combine multiple operation types in single expressions
- Test percentage calculations with results from previous operations
- Verify mathematical consistency across all operation types
- **Expected final state**: All mathematical operations verified and integrated
- **IMMEDIATELY** write clean XML fragment to `reports/CA-4_results.xml` (no extra text). The `<testcase name>` must start with `CA-4`. Include at most 3 key properties across all operations, or simply state "all calculations accurate; integration OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded values:**
```json
{"operation": "add", "operands": [5, 3, 2]}
```

**Use content-aware targeting:**
```json
# Use previous results as inputs
advanced_math(operation: "sqrt", operand: previous_result)
# Then chain operations together
```

**Mathematical operations:**
```json
{"operation": "sin", "angle": 45, "unit": "degrees"}
{"operation": "logarithm", "base": 10, "value": 100}
{"expression": "2 * sin(30°) + log10(100) / sqrt(16)"}
```

---

## State Verification Patterns

**After each test:**
1. Verify calculation accuracy: compare results with expected values
2. Check mathematical properties: precision, range, data types
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied mathematical conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual mathematical calculation pipelines
2. **Robust Operations**: Proves calculations work on evolving mathematical state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or state snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative mathematical operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual calculator usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system operations required.

---