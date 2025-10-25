# Calculator MCP Server

A comprehensive Model Context Protocol (MCP) server providing mathematical calculation tools through stdio transport.

## Features

### Basic Arithmetic
- **add** - Add two numbers
- **subtract** - Subtract second number from first
- **multiply** - Multiply two numbers
- **divide** - Divide first number by second (with zero division protection)
- **modulo** - Calculate remainder of division
- **absolute_value** - Calculate absolute value

### Advanced Mathematics
- **power** - Raise base to exponent
- **square_root** - Calculate square root (non-negative only)
- **nth_root** - Calculate nth root (e.g., cube root)
- **logarithm** - Calculate logarithm with custom base (default: natural log)
- **factorial** - Calculate factorial (max n=170)

### Trigonometric Functions
All trigonometric functions support both radians and degrees:
- **sine** - Calculate sine of angle
- **cosine** - Calculate cosine of angle
- **tangent** - Calculate tangent of angle
- **arcsine** - Calculate inverse sine
- **arccosine** - Calculate inverse cosine
- **arctangent** - Calculate inverse tangent

### Statistical Operations
- **mean** - Calculate arithmetic mean (average)
- **median** - Find middle value
- **mode** - Find most frequent value(s)
- **standard_deviation** - Calculate standard deviation (sample or population)
- **variance** - Calculate variance (sample or population)
- **sum** - Calculate sum of numbers
- **product** - Calculate product of numbers
- **minimum** - Find minimum value
- **maximum** - Find maximum value
- **range** - Calculate range (max - min)

### Expression Evaluation
- **evaluate** - Safely evaluate mathematical expressions
  - Supports: `+`, `-`, `*`, `/`, `^` (power), `%` (modulo), parentheses
  - Constants: `e`, `π`
  - Example: `"2 * (3 + 4)^2"` or `"sin(π/2)"`

### Percentage Calculations
- **percentage** - Calculate percentage of a value
- **percentage_change** - Calculate percentage change between two values

### Rounding Functions
- **round** - Round to specified decimal places
- **ceil** - Round up to specified decimal places
- **floor** - Round down to specified decimal places

## Installation

```bash
cd calculator-mcp
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": [
        "C:\\Users\\damon\\TsApps\\mcp-servers\\calculator-mcp\\dist\\server.js"
      ]
    }
  }
}
```

## Example Usage

### Basic Arithmetic
```
Tool: add
Arguments: { "a": 5, "b": 3 }
Result: { "result": 8 }
```

### Advanced Math
```
Tool: power
Arguments: { "base": 2, "exponent": 10 }
Result: { "result": 1024 }

Tool: factorial
Arguments: { "n": 5 }
Result: { "result": 120 }
```

### Trigonometry
```
Tool: sine
Arguments: { "angle": 90, "unit": "degrees" }
Result: { "result": 1 }

Tool: arcsine
Arguments: { "value": 0.5, "unit": "degrees" }
Result: { "result": 30 }
```

### Statistics
```
Tool: mean
Arguments: { "numbers": [1, 2, 3, 4, 5] }
Result: { "result": 3 }

Tool: standard_deviation
Arguments: { "numbers": [2, 4, 4, 4, 5, 5, 7, 9], "sample": true }
Result: { "result": 2.138 }
```

### Expression Evaluation
```
Tool: evaluate
Arguments: { "expression": "2 * (3 + 4)^2 + π" }
Result: { "result": 101.14159265358979 }
```

### Percentage
```
Tool: percentage
Arguments: { "value": 200, "percent": 15 }
Result: { "result": 30 }

Tool: percentage_change
Arguments: { "old_value": 50, "new_value": 75 }
Result: { "result": 50 }
```

### Rounding
```
Tool: round
Arguments: { "value": 3.14159, "decimals": 2 }
Result: { "result": 3.14 }
```

## Error Handling

The server provides clear error messages for invalid operations:
- Division by zero
- Square root of negative numbers
- Invalid logarithm domains
- Factorial of non-integers or negative numbers
- Invalid trigonometric domains
- Empty arrays for statistical operations

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Run built version
npm run start
```

## Security

- Expression evaluation uses Function constructor with validation
- Only mathematical operators and constants allowed
- No arbitrary code execution
- Input validation on all operations

## License

MIT
