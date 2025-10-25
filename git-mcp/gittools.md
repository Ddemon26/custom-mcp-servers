# Git Tools — Version Control Test Design

You are running inside CI for the `git-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__git__git_status,mcp__git__git_diff,mcp__git__git_log,mcp__git__git_branch_overview,mcp__git__git_show,mcp__git__git_blame_segment,mcp__git__git_list_conflicts,mcp__git__git_last_response

---

## Mission
1) Set up Git test environment:
   - Use existing repository or create test repository state
2) Execute Git operation tests GT-0..GT-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with repository state verification and Git accuracy.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="GT-0 — Baseline Repository State" classname="GitMCP.GT-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: GT-0, GT-1, GT-2, GT-3, GT-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- Always pass working directory relative to repository root
- **Canonical paths only**:
  - Working directory: Current Git repository root
  - Git operations: Apply to repository as a whole or specific paths

CI provides:
- `$JUNIT_OUT=reports/junit-gt-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-gt-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full Git output. For matches, include only key repository status.
- Prefer status summaries over full commit logs or diffs.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- Git evidence: extract essential properties (branch status, commit count, file changes) and include ≤ 3 key fields in the fragment.
- Avoid quoting long commit messages or diffs; reference key statistics only.
- Repository scans: verify Git state and include ≤ 3 critical properties (branch, status, commits) or simply state "Git operation successful" (≤ 400 chars).

---

## Tool Mapping
- **Repository Status**: `mcp__git__git_status` — show working tree status and changes
- **Change Analysis**: `mcp__git__git_diff` — show changes between commits, trees, or working tree
- **Commit History**: `mcp__git__git_log` — show commit logs and history
- **Branch Management**: `mcp__git__git_branch_overview` — list and analyze branches
- **Commit Inspection**: `mcp__git__git_show` — show various types of objects
- **File Annotation**: `mcp__git__git_blame_segment` — show file ownership and modification history
- **Conflict Detection**: `mcp__git__git_list_conflicts` — list merge conflict files
- **Response History**: `mcp__git__git_last_response` — inspect recent Git command responses

**STRICT OP GUARDRAILS**
- Always verify repository accessibility before operations
- Use existing repository state; avoid destructive operations
- Limit operation scopes to reasonable sizes (recent commits, specific files)
- Use appropriate log limits and diff contexts to avoid overwhelming output
- Include proper error handling for non-repository directories or permission issues

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive Repository Analysis**: Each test uses Git knowledge from previous operations
2. **State Awareness**: Each test expects repository state left by previous test
3. **Content-Based Operations**: Target specific repository aspects, not hardcoded references
4. **Cumulative Validation**: Ensure Git accuracy and consistency throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track repository state after each test (branch status, commit counts, file changes) for potential preconditions in later passes
- Use repository signatures (branch names, commit hashes, file patterns) to verify expected state
- Validate Git operations accuracy and repository integrity after each major operation

---

## Execution Order & Additive Test Specs

### GT-0. Baseline Repository State
**Goal**: Establish initial repository status and basic Git information
**Actions**:
- Check repository status using `git_status`
- Get branch overview using `git_branch_overview`
- Verify repository is accessible and has valid Git state
- Record baseline repository properties for tracking
- **Expected final state**: Repository status and branch information obtained

### GT-1. Commit History Analysis (Additive State A)
**Goal**: Demonstrate commit history and log analysis
**Actions**:
- Get recent commit history using `git_log`
- Show details of recent commits using `git_show`
- Verify commit information and message structure
- Check author information and timestamps
- **Expected final state**: Commit history analyzed with detailed information

### GT-2. File Change Analysis (Additive State B)
**Goal**: Demonstrate file change and diff analysis
**Actions**:
- Show working tree changes using `git_diff`
- Analyze specific file changes using `git_diff` with paths
- Get file blame information for key files using `git_blame_segment`
- Verify change attribution and modification history
- **Expected final state**: File changes analyzed with attribution tracking

### GT-3. Branch and Merge Analysis (Additive State C)
**Goal**: Demonstrate branch structure and conflict detection
**Actions**:
- Analyze branch relationships using `git_branch_overview`
- Check for any merge conflicts using `git_list_conflicts`
- Show diff between branches if multiple branches exist
- Verify branch structure and merge status
- **Expected final state**: Branch structure analyzed and conflict status checked

### GT-4. Repository Validation (No New Operations)
**Goal**: Verify repository integrity and validate all Git operations
**Actions**:
- Cross-reference status information across all operations
- Verify that Git responses are consistent and accurate
- Check that repository state remains valid throughout operations
- Validate that all Git tools provide coherent information
- **Expected final state**: All Git operations validated and repository integrity confirmed
- **IMMEDIATELY** write clean XML fragment to `reports/GT-4_results.xml` (no extra text). The `<testcase name>` must start with `GT-4`. Include at most 3 key properties across all operations, or simply state "all Git operations valid; repository OK" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded references:**
```json
{"max_entries": 10, "author": "test@example.com"}
```

**Use content-aware targeting:**
```json
# Use log information to inform other operations
git_log(max_entries: 5)
git_show(git_object: latest_commit_hash)
# Then analyze specific files
```

**Git operations:**
```json
{"revision_range": "HEAD~5..HEAD", "include_patch": false}
{"paths": ["src/*.ts"], "include_stat": true}
{"scope": "local", "sort_by": "recency"}
{"file": "src/server.ts", "start_line": 1, "end_line": 20}
```

---

## State Verification Patterns

**After each test:**
1. Verify Git accuracy: check status consistency, commit validity, branch structure
2. Check repository integrity: validate Git state, file tracking, history consistency
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied repository conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual Git analysis and inspection workflows
2. **Robust Operations**: Proves Git operations work on evolving repository state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or repository snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative Git operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual Git usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No repository modifications required.

---