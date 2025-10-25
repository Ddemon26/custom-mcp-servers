# cURL Tools — HTTP Request Test Design

You are running inside CI for the `curl-mcp` repo. Use only the tools allowed by the workflow. Work autonomously; do not prompt the user. Do NOT spawn subagents.

**Print this once, verbatim, early in the run:**
AllowedTools: Write,mcp__curl__http_request,mcp__curl__get_cached_response,mcp__curl__list_cached_requests,mcp__curl__clear_cache

---

## Mission
1) Set up HTTP testing environment:
   - Use reliable test APIs and endpoints (e.g., httpbin.org, jsonplaceholder.typicode.com)
2) Execute HTTP operation tests CU-0..CU-4 in order using minimal, precise operations that build on each other.
3. Validate each operation with response verification and caching behavior.
4) **Report**: write one `<testcase>` XML fragment per test to `reports/<TESTID>_results.xml`. Do **not** read or edit `$JUNIT_OUT`.

**CRITICAL XML FORMAT REQUIREMENTS:**
- Each file must contain EXACTLY one `<testcase>` root element
- NO prologue, epilogue, code fences, or extra characters
- NO markdown formatting or explanations outside the XML
- Use this exact format:

```xml
<testcase name="CU-0 — Baseline HTTP Setup" classname="CurlMCP.CU-T">
  <system-out><![CDATA[
(evidence of what was accomplished)
  ]]></system-out>
</testcase>
```

- If test fails, include: `<failure message="reason"/>`
- TESTID must be one of: CU-0, CU-1, CU-2, CU-3, CU-4
5) **NO RESTORATION** - tests build additively on previous state.
6) **STRICT FRAGMENT EMISSION** - After each test, immediately emit a clean XML file under `reports/<TESTID>_results.xml` with exactly one `<testcase>` whose `name` begins with the exact test id. No prologue/epilogue or fences. If the test fails, include a `<failure message="..."/>` and still emit.

---

## Environment & Paths (CI)
- All HTTP operations are network-based and don't require file system paths
- **Cache management**: Responses are cached internally by the MCP server
- **Test endpoints**: Use publicly available test APIs that are reliable and stable

CI provides:
- `$JUNIT_OUT=reports/junit-cu-suite.xml` (pre‑created; leave alone)
- `$MD_OUT=reports/junit-cu-suite.md` (synthesized from JUnit)

---

## Transcript Minimization Rules
- Do not restate tool JSON; summarize in ≤ 2 short lines.
- Never paste full HTTP responses. For matches, include only key response data.
- Prefer status codes and response metadata over full response bodies.
- Per‑test `system-out` ≤ 400 chars: brief status only (no full specs).
- HTTP evidence: extract essential properties (status code, response time, content type) and include ≤ 3 key fields in the fragment.
- Avoid quoting long response bodies; reference key headers or metadata only.
- Response scans: verify HTTP success and include ≤ 3 critical properties (status, method, cache hit) or simply state "HTTP request successful" (≤ 400 chars).

---

## Tool Mapping
- **HTTP Requests**: `mcp__curl__http_request` — perform GET, POST, PUT, DELETE requests with headers and data
- **Cache Retrieval**: `mcp__curl__get_cached_response` — retrieve cached responses for previous requests
- **Cache Listing**: `mcp__curl__list_cached_requests` — list all cached requests and their metadata
- **Cache Management**: `mcp__curl__clear_cache` — clear response cache

**STRICT OP GUARDRAILS**
- Always verify endpoint accessibility before making requests
- Use reliable test APIs that are designed for automated testing
- Include proper error handling for network failures and HTTP errors
- For POST/PUT requests, use small payloads to avoid resource exhaustion
- Respect rate limits and be conservative with request frequency

---

## Additive Test Design Principles

**Key Changes from Reset-Based:**
1. **Progressive HTTP Operations**: Each test uses cache or knowledge from previous HTTP requests
2. **State Awareness**: Each test expects cache state left by previous test
3. **Content-Based Operations**: Target specific HTTP methods and response types, not hardcoded endpoints
4. **Cumulative Validation**: Ensure HTTP functionality and caching work correctly throughout sequence
5. **Composability**: Tests demonstrate how operations work together in real workflows

**State Tracking:**
- Track HTTP cache state after each test (cached responses, metadata) for potential preconditions in later passes
- Use response signatures (status codes, content types, response times) to verify expected state
- Validate caching behavior and HTTP consistency after each major operation

---

## Execution Order & Additive Test Specs

### CU-0. Baseline HTTP Setup
**Goal**: Establish basic HTTP functionality and cache initialization
**Actions**:
- Perform GET request to test endpoint using `http_request`
- Verify successful response (200 status code)
- Check response headers and basic metadata
- Record baseline HTTP behavior and response characteristics
- **Expected final state**: Successful HTTP request with response cached

### CU-1. HTTP Methods Testing (Additive State A)
**Goal**: Demonstrate different HTTP methods and request types
**Actions**:
- Perform POST request with JSON payload using `http_request`
- Perform PUT request to update data using `http_request`
- Perform DELETE request to remove data using `http_request`
- Verify each method returns appropriate status codes and responses
- **Expected final state**: Multiple HTTP methods tested with responses cached

### CU-2. Cache Operations (Additive State B)
**Goal**: Demonstrate caching functionality
**Actions**:
- List all cached requests using `list_cached_requests`
- Retrieve specific cached response using `get_cached_response`
- Compare cached response with original request metadata
- Verify cache hit/miss behavior and response consistency
- **Expected final state**: Cache operations verified with response retrieval

### CU-3. Advanced HTTP Features (Additive State C)
**Goal**: Demonstrate advanced HTTP request features
**Actions**:
- Make requests with custom headers using `http_request`
- Test requests with query parameters and URL encoding
- Perform requests with different content types (JSON, form-data)
- Verify response handling for various content types
- **Expected final state**: Advanced HTTP features tested with proper caching

### CU-4. Cache Management (No New Requests)
**Goal**: Verify cache management and validate all HTTP operations
**Actions**:
- List final cache state using `list_cached_requests`
- Verify all previous requests are properly cached with correct metadata
- Validate cache consistency and response integrity across all operations
- Clear cache using `clear_cache` and verify successful cleanup
- **Expected final state**: All HTTP operations validated, cache cleared successfully
- **IMMEDIATELY** write clean XML fragment to `reports/CU-4_results.xml` (no extra text). The `<testcase name>` must start with `CU-4`. Include at most 3 key properties across all operations, or simply state "all HTTP operations valid; cache cleared" (≤ 400 chars).

## Dynamic Targeting Examples

**Instead of hardcoded endpoints:**
```json
{"url": "https://api.example.com/data", "method": "GET"}
```

**Use content-aware targeting:**
```json
# Use cached responses for verification
get_cached_response(cache_key: "GET:https://api.example.com/data")
# Then compare with fresh request
```

**HTTP operations:**
```json
{"method": "POST", "url": "https://httpbin.org/post", "data": {"key": "value"}, "headers": {"Content-Type": "application/json"}}
{"method": "GET", "url": "https://jsonplaceholder.typicode.com/posts/1", "cache_ttl": 300}
{"cache_key": "POST:https://api.example.com/data"}
```

---

## State Verification Patterns

**After each test:**
1. Verify HTTP success: check status codes, response times, content types
2. Check cache behavior: validate caching, retrieval, and metadata
3. Update tracking for next test's preconditions
4. Emit a per‑test fragment to `reports/<TESTID>_results.xml` immediately. If the test failed, still write a single `<testcase>` with a `<failure message="..."/>` and evidence in `system-out`.
5. Log cumulative changes in test evidence (keep concise per Transcript Minimization Rules; never paste raw tool JSON)

**Error Recovery:**
- If test fails, log current state but continue (don't restore)
- Next test adapts to actual current state, not expected state
- Demonstrates resilience of operations on varied network conditions

---

## Benefits of Additive Design

1. **Realistic Workflows**: Tests mirror actual HTTP request pipelines
2. **Robust Operations**: Proves HTTP operations work on evolving cache state
3. **Composability Validation**: Shows operations coordinate well together
4. **Simplified Infrastructure**: No restore scripts or network snapshots needed
5. **Better Failure Analysis**: Failures don't cascade - each test adapts to current reality
6. **State Evolution Testing**: Validates SDK handles cumulative HTTP operations correctly

This additive approach produces a more realistic and maintainable test suite that better represents actual cURL usage patterns.

---

BAN ON EXTRA TOOLS AND DIRS
- Do not use any tools outside `AllowedTools`. No file system operations required.

---