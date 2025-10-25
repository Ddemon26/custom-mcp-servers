# .NET Tools — CLI Operations Test Design

You are running inside CI for the `dotnet-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__dotnet__dotnet_restore,mcp__dotnet__dotnet_build,mcp__dotnet__dotnet_test,mcp__dotnet__dotnet_run,mcp__dotnet__dotnet_new,mcp__dotnet__dotnet_add_package,mcp__dotnet__dotnet_clean,mcp__dotnet__dotnet_publish

---

## Mission
1) Set up .NET test environment:
   - Create or use existing test .NET projects
2) Execute .NET CLI operation tests DN-0..DN-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with build results, test outcomes, and project verification.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="DN-0 — Baseline .NET Setup" classname="DotNetMCP.DN-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: DN-0, DN-1, DN-2, DN-3, DN-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Test projects: `test-projects/` directory for .NET test projects
  - Build outputs: `build-output/` directory for compiled artifacts
  - Publish outputs: `publish/` directory for published applications

CI provides:
- `$JUNIT_OUT=reports/junit-dn-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-dn-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full build output. For matches, include only key build status.
- Prefer build success indicators over full compilation logs.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- .NET evidence: extract essential properties (build status, project type, output path) and include ≤ 3 key fields in the fragment.
- Avoid quoting long error messages; reference key status indicators only.
- Build scans: verify build success and include ≤ 3 critical properties (status, project, framework) or simply state "build successful" (≤ 400 chars).

---

## Tool Mapping
- **Package Restore**: `mcp__dotnet__dotnet_restore` — restore NuGet packages
- **Project Building**: `mcp__dotnet__dotnet_build` — compile .NET projects
- **Test Execution**: `mcp__dotnet__dotnet_test` — run unit and integration tests
- **Application Running**: `mcp__dotnet__dotnet_run` — execute .NET applications
- **Project Creation**: `mcp__dotnet__dotnet_new` — create new .NET projects
- **Package Management**: `mcp__dotnet__dotnet_add_package` — add NuGet dependencies
- **Cleanup Operations**: `mcp__dotnet__dotnet_clean` — clean build artifacts
- **Application Publishing**: `mcp__dotnet__dotnet_publish` — publish applications for deployment

**STRICT OP GUARDRAILS**
- Always verify .NET SDK availability before operations
- Use simple project templates that build quickly and reliably
- Limit build operations to reasonable completion times
- Use test projects with minimal dependencies to avoid network issues
- Include proper error handling for missing SDKs or build failures

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Project Development**: Each test builds on project state from previous operations
2. **State Awareness**: Each test expects project state left by previous test
3. **Content-Based Operations**: Target specific project types and configurations, not hardcoded paths
4. **Cumulative Validation**: Ensure project integrity throughout the development lifecycle
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track project properties after each test (build status, dependencies, output files) for potential preconditions in later passes
- Use project signatures (project type, framework, dependencies) to verify expected state
- Validate project structure and build integrity after each major operation

---

## Execution Order & Additive Test Specs

### DN-0. Baseline .NET Setup
**Goal**: Create initial .NET project and verify basic structure
**Actions**:
- Create new console application using `dotnet_new`
- Restore project dependencies using `dotnet_restore`
- Verify project structure and basic configuration
- Record baseline project properties for tracking
- **Expected final state**: New .NET console project created and restored

### DN-1. Build Operations (Additive State A)
**Goal**: Demonstrate project building and compilation
**Actions**:
- Build the project using `dotnet_build`
- Add NuGet package dependency using `dotnet_add_package`
- Rebuild project with new dependency using `dotnet_build`
- Verify build success and output generation
- **Expected final state**: Project built successfully with added dependency

### DN-2. Test Operations (Additive State B)
**Goal**: Demonstrate testing capabilities
**Actions**:
- Create test project using `dotnet_new` with test template
- Add reference between main project and test project
- Run tests using `dotnet_test`
- Verify test execution and results
- **Expected final state**: Test project created and tests executed successfully

### DN-3. Advanced Operations (Additive State C)
**Goal**: Demonstrate application execution and publishing
**Actions**:
- Run the console application using `dotnet_run`
- Publish application using `dotnet_publish`
- Verify published application structure and outputs
- Validate both development and published versions work correctly
- **Expected final state**: Application runs successfully and is published

### DN-4. Cleanup and Validation (No New Projects)
**Goal**: Verify project management and cleanup operations
**Actions**:
- Clean build artifacts using `dotnet_clean`
- Verify project structure remains intact after cleanup
- Validate that all previous operations completed successfully
- Check that clean operation doesn't affect source files
- **Expected final state**: All .NET operations validated, cleanup completed
- **IMMEDIATELY** write clean XML fragment to `reports/DN-4_results.xml` (no extra text). The `<testcase name>` must start with `DN-4`. Include at most 3 key properties across all operations, or simply state "all .NET operations valid; cleanup OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded project paths:**
```json
{"template": "console", "name": "TestApp"}
```

**Use content-aware targeting:**
```json
# Build and then test the same project
dotnet_build(project: "TestApp")
dotnet_test(project: "TestApp.Tests")
# Then publish the built application
```

**.NET operations:**
```json
{"template": "xunit", "name": "TestApp.Tests", "framework": "net8.0"}
{"package": "Newtonsoft.Json", "version": "13.0.3"}
{"configuration": "Release", "framework": "net8.0", "output": "publish/"}
{"runtime": "win-x64", "self_contained": true}
```

---

## State Verification Patterns

**After each test:**
1. Verify project state: check build status, dependencies, output files
2. Check .NET functionality: validate compilation, execution, testing
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied .NET conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual .NET development pipelines
2. **Robust Operations**: Proves .NET operations work on evolving project state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or project snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative .NET operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual .NET CLI usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. Do not create directories; assume `test-projects/`, `build-output/`, `publish/`, and `reports/` exist.

---