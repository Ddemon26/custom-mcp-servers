#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

// Constants
const CalculatorTools = {
  // Basic arithmetic
  ADD: "add",
  SUBTRACT: "subtract",
  MULTIPLY: "multiply",
  DIVIDE: "divide",
  MODULO: "modulo",
  ABSOLUTE_VALUE: "absolute_value",

  // Advanced math
  POWER: "power",
  SQUARE_ROOT: "square_root",
  NTH_ROOT: "nth_root",
  LOGARITHM: "logarithm",
  FACTORIAL: "factorial",

  // Trigonometric
  SINE: "sine",
  COSINE: "cosine",
  TANGENT: "tangent",
  ARCSINE: "arcsine",
  ARCCOSINE: "arccosine",
  ARCTANGENT: "arctangent",

  // Statistics
  MEAN: "mean",
  MEDIAN: "median",
  MODE: "mode",
  STANDARD_DEVIATION: "standard_deviation",
  VARIANCE: "variance",
  SUM: "sum",
  PRODUCT: "product",
  MINIMUM: "minimum",
  MAXIMUM: "maximum",
  RANGE: "range",

  // Expression evaluation
  EVALUATE: "evaluate",

  // Percentage
  PERCENTAGE: "percentage",
  PERCENTAGE_CHANGE: "percentage_change",

  // Rounding
  ROUND: "round",
  CEIL: "ceil",
  FLOOR: "floor",
} as const;

// Basic arithmetic operations
function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero is undefined");
  }
  return a / b;
}

// Advanced math functions
function power(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

function squareRoot(n: number): number {
  if (n < 0) {
    throw new Error("Cannot calculate square root of negative number");
  }
  return Math.sqrt(n);
}

function nthRoot(n: number, root: number): number {
  if (n < 0 && root % 2 === 0) {
    throw new Error("Cannot calculate even root of negative number");
  }
  return Math.pow(n, 1 / root);
}

function logarithm(n: number, base: number = Math.E): number {
  if (n <= 0) {
    throw new Error("Logarithm undefined for non-positive numbers");
  }
  if (base <= 0 || base === 1) {
    throw new Error("Invalid logarithm base");
  }
  return Math.log(n) / Math.log(base);
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error("Factorial only defined for non-negative integers");
  }
  if (n > 170) {
    throw new Error("Factorial too large (maximum n=170)");
  }
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function absoluteValue(n: number): number {
  return Math.abs(n);
}

function modulo(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Modulo by zero is undefined");
  }
  return a % b;
}

// Trigonometric functions (angles in radians by default)
function sine(angle: number, unit: "radians" | "degrees" = "radians"): number {
  const radians = unit === "degrees" ? (angle * Math.PI) / 180 : angle;
  return Math.sin(radians);
}

function cosine(angle: number, unit: "radians" | "degrees" = "radians"): number {
  const radians = unit === "degrees" ? (angle * Math.PI) / 180 : angle;
  return Math.cos(radians);
}

function tangent(angle: number, unit: "radians" | "degrees" = "radians"): number {
  const radians = unit === "degrees" ? (angle * Math.PI) / 180 : angle;
  return Math.tan(radians);
}

function arcSine(value: number, unit: "radians" | "degrees" = "radians"): number {
  if (value < -1 || value > 1) {
    throw new Error("arcsin domain is [-1, 1]");
  }
  const result = Math.asin(value);
  return unit === "degrees" ? (result * 180) / Math.PI : result;
}

function arcCosine(value: number, unit: "radians" | "degrees" = "radians"): number {
  if (value < -1 || value > 1) {
    throw new Error("arccos domain is [-1, 1]");
  }
  const result = Math.acos(value);
  return unit === "degrees" ? (result * 180) / Math.PI : result;
}

function arcTangent(value: number, unit: "radians" | "degrees" = "radians"): number {
  const result = Math.atan(value);
  return unit === "degrees" ? (result * 180) / Math.PI : result;
}

// Statistical operations
function mean(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate mean of empty array");
  }
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate median of empty array");
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mode(numbers: number[]): number[] {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate mode of empty array");
  }
  const frequency = new Map<number, number>();
  numbers.forEach((n) => frequency.set(n, (frequency.get(n) || 0) + 1));

  const maxFreq = Math.max(...frequency.values());
  return Array.from(frequency.entries())
    .filter(([_, freq]) => freq === maxFreq)
    .map(([num, _]) => num);
}

function standardDeviation(numbers: number[], sample: boolean = true): number {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate standard deviation of empty array");
  }
  if (sample && numbers.length === 1) {
    throw new Error("Sample standard deviation requires at least 2 values");
  }

  const avg = mean(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, n) => sum + n, 0) /
    (sample ? numbers.length - 1 : numbers.length);
  return Math.sqrt(avgSquareDiff);
}

function variance(numbers: number[], sample: boolean = true): number {
  const sd = standardDeviation(numbers, sample);
  return sd * sd;
}

function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

function product(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot calculate product of empty array");
  }
  return numbers.reduce((acc, n) => acc * n, 1);
}

function minimum(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot find minimum of empty array");
  }
  return Math.min(...numbers);
}

function maximum(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Cannot find maximum of empty array");
  }
  return Math.max(...numbers);
}

function range(numbers: number[]): number {
  return maximum(numbers) - minimum(numbers);
}

// Expression evaluation with safe eval
function evaluateExpression(expression: string): number {
  // Remove whitespace
  const cleaned = expression.replace(/\s+/g, "");

  // Validate expression contains only allowed characters
  if (!/^[0-9+\-*/.()^%eπ\s]+$/i.test(cleaned)) {
    throw new Error("Expression contains invalid characters");
  }

  // Replace mathematical constants
  let processed = cleaned
    .replace(/π/g, String(Math.PI))
    .replace(/\be\b/gi, String(Math.E));

  // Replace ^ with **
  processed = processed.replace(/\^/g, "**");

  try {
    // Use Function constructor for safer evaluation than eval
    const result = new Function(`"use strict"; return (${processed})`)();
    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Expression did not evaluate to a valid number");
    }
    return result;
  } catch (error) {
    throw new Error(`Failed to evaluate expression: ${(error as Error).message}`);
  }
}

// Percentage calculations
function percentage(value: number, percent: number): number {
  return (value * percent) / 100;
}

function percentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    throw new Error("Cannot calculate percentage change from zero");
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

// Rounding functions
function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

function ceilTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.ceil(value * multiplier) / multiplier;
}

function floorTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(value * multiplier) / multiplier;
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "calculator-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Basic arithmetic
      {
        name: CalculatorTools.ADD,
        description: "Add two numbers together",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number", description: "First number" },
            b: { type: "number", description: "Second number" },
          },
          required: ["a", "b"],
        },
      },
      {
        name: CalculatorTools.SUBTRACT,
        description: "Subtract second number from first number",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number", description: "Number to subtract from" },
            b: { type: "number", description: "Number to subtract" },
          },
          required: ["a", "b"],
        },
      },
      {
        name: CalculatorTools.MULTIPLY,
        description: "Multiply two numbers",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number", description: "First number" },
            b: { type: "number", description: "Second number" },
          },
          required: ["a", "b"],
        },
      },
      {
        name: CalculatorTools.DIVIDE,
        description: "Divide first number by second number",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number", description: "Dividend" },
            b: { type: "number", description: "Divisor" },
          },
          required: ["a", "b"],
        },
      },
      {
        name: CalculatorTools.MODULO,
        description: "Calculate remainder of division (a mod b)",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number", description: "Dividend" },
            b: { type: "number", description: "Divisor" },
          },
          required: ["a", "b"],
        },
      },
      {
        name: CalculatorTools.ABSOLUTE_VALUE,
        description: "Calculate absolute value of a number",
        inputSchema: {
          type: "object",
          properties: {
            n: { type: "number", description: "Number" },
          },
          required: ["n"],
        },
      },
      // Advanced math
      {
        name: CalculatorTools.POWER,
        description: "Raise base to exponent (base^exponent)",
        inputSchema: {
          type: "object",
          properties: {
            base: { type: "number", description: "Base number" },
            exponent: { type: "number", description: "Exponent" },
          },
          required: ["base", "exponent"],
        },
      },
      {
        name: CalculatorTools.SQUARE_ROOT,
        description: "Calculate square root of a number",
        inputSchema: {
          type: "object",
          properties: {
            n: { type: "number", description: "Number (must be non-negative)" },
          },
          required: ["n"],
        },
      },
      {
        name: CalculatorTools.NTH_ROOT,
        description: "Calculate nth root of a number",
        inputSchema: {
          type: "object",
          properties: {
            n: { type: "number", description: "Number" },
            root: { type: "number", description: "Root degree (e.g., 3 for cube root)" },
          },
          required: ["n", "root"],
        },
      },
      {
        name: CalculatorTools.LOGARITHM,
        description: "Calculate logarithm of a number with specified base (default: natural log)",
        inputSchema: {
          type: "object",
          properties: {
            n: { type: "number", description: "Number (must be positive)" },
            base: { type: "number", description: "Logarithm base (default: e)" },
          },
          required: ["n"],
        },
      },
      {
        name: CalculatorTools.FACTORIAL,
        description: "Calculate factorial of a non-negative integer (n!)",
        inputSchema: {
          type: "object",
          properties: {
            n: { type: "number", description: "Non-negative integer (max 170)" },
          },
          required: ["n"],
        },
      },
      // Trigonometric
      {
        name: CalculatorTools.SINE,
        description: "Calculate sine of an angle",
        inputSchema: {
          type: "object",
          properties: {
            angle: { type: "number", description: "Angle value" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Angle unit (default: radians)"
            },
          },
          required: ["angle"],
        },
      },
      {
        name: CalculatorTools.COSINE,
        description: "Calculate cosine of an angle",
        inputSchema: {
          type: "object",
          properties: {
            angle: { type: "number", description: "Angle value" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Angle unit (default: radians)"
            },
          },
          required: ["angle"],
        },
      },
      {
        name: CalculatorTools.TANGENT,
        description: "Calculate tangent of an angle",
        inputSchema: {
          type: "object",
          properties: {
            angle: { type: "number", description: "Angle value" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Angle unit (default: radians)"
            },
          },
          required: ["angle"],
        },
      },
      {
        name: CalculatorTools.ARCSINE,
        description: "Calculate arcsine (inverse sine) of a value",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Value between -1 and 1" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Output unit (default: radians)"
            },
          },
          required: ["value"],
        },
      },
      {
        name: CalculatorTools.ARCCOSINE,
        description: "Calculate arccosine (inverse cosine) of a value",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Value between -1 and 1" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Output unit (default: radians)"
            },
          },
          required: ["value"],
        },
      },
      {
        name: CalculatorTools.ARCTANGENT,
        description: "Calculate arctangent (inverse tangent) of a value",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Value" },
            unit: {
              type: "string",
              enum: ["radians", "degrees"],
              description: "Output unit (default: radians)"
            },
          },
          required: ["value"],
        },
      },
      // Statistics
      {
        name: CalculatorTools.MEAN,
        description: "Calculate arithmetic mean (average) of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.MEDIAN,
        description: "Calculate median (middle value) of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.MODE,
        description: "Find mode (most frequent value(s)) in a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.STANDARD_DEVIATION,
        description: "Calculate standard deviation of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
            sample: {
              type: "boolean",
              description: "Use sample standard deviation (n-1) instead of population (n). Default: true"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.VARIANCE,
        description: "Calculate variance of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
            sample: {
              type: "boolean",
              description: "Use sample variance (n-1) instead of population (n). Default: true"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.SUM,
        description: "Calculate sum of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.PRODUCT,
        description: "Calculate product of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.MINIMUM,
        description: "Find minimum value in a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.MAXIMUM,
        description: "Find maximum value in a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      {
        name: CalculatorTools.RANGE,
        description: "Calculate range (max - min) of a list of numbers",
        inputSchema: {
          type: "object",
          properties: {
            numbers: {
              type: "array",
              items: { type: "number" },
              description: "Array of numbers"
            },
          },
          required: ["numbers"],
        },
      },
      // Expression evaluation
      {
        name: CalculatorTools.EVALUATE,
        description: "Evaluate a mathematical expression (supports +, -, *, /, ^, %, parentheses, e, π)",
        inputSchema: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Mathematical expression (e.g., '2 * (3 + 4)' or '2^3 + π')"
            },
          },
          required: ["expression"],
        },
      },
      // Percentage
      {
        name: CalculatorTools.PERCENTAGE,
        description: "Calculate percentage of a value (value * percent / 100)",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Base value" },
            percent: { type: "number", description: "Percentage" },
          },
          required: ["value", "percent"],
        },
      },
      {
        name: CalculatorTools.PERCENTAGE_CHANGE,
        description: "Calculate percentage change between two values",
        inputSchema: {
          type: "object",
          properties: {
            old_value: { type: "number", description: "Original value" },
            new_value: { type: "number", description: "New value" },
          },
          required: ["old_value", "new_value"],
        },
      },
      // Rounding
      {
        name: CalculatorTools.ROUND,
        description: "Round a number to specified decimal places",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Number to round" },
            decimals: { type: "number", description: "Number of decimal places (default: 0)" },
          },
          required: ["value"],
        },
      },
      {
        name: CalculatorTools.CEIL,
        description: "Round a number up to specified decimal places",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Number to round up" },
            decimals: { type: "number", description: "Number of decimal places (default: 0)" },
          },
          required: ["value"],
        },
      },
      {
        name: CalculatorTools.FLOOR,
        description: "Round a number down to specified decimal places",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "number", description: "Number to round down" },
            decimals: { type: "number", description: "Number of decimal places (default: 0)" },
          },
          required: ["value"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, "Missing arguments");
  }

  try {
    let result: any;

    switch (name) {
      // Basic arithmetic
      case CalculatorTools.ADD:
        if (typeof args.a !== "number" || typeof args.b !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "a and b must be numbers");
        }
        result = add(args.a, args.b);
        break;

      case CalculatorTools.SUBTRACT:
        if (typeof args.a !== "number" || typeof args.b !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "a and b must be numbers");
        }
        result = subtract(args.a, args.b);
        break;

      case CalculatorTools.MULTIPLY:
        if (typeof args.a !== "number" || typeof args.b !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "a and b must be numbers");
        }
        result = multiply(args.a, args.b);
        break;

      case CalculatorTools.DIVIDE:
        if (typeof args.a !== "number" || typeof args.b !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "a and b must be numbers");
        }
        result = divide(args.a, args.b);
        break;

      case CalculatorTools.MODULO:
        if (typeof args.a !== "number" || typeof args.b !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "a and b must be numbers");
        }
        result = modulo(args.a, args.b);
        break;

      case CalculatorTools.ABSOLUTE_VALUE:
        if (typeof args.n !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "n must be a number");
        }
        result = absoluteValue(args.n);
        break;

      // Advanced math
      case CalculatorTools.POWER:
        if (typeof args.base !== "number" || typeof args.exponent !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "base and exponent must be numbers");
        }
        result = power(args.base, args.exponent);
        break;

      case CalculatorTools.SQUARE_ROOT:
        if (typeof args.n !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "n must be a number");
        }
        result = squareRoot(args.n);
        break;

      case CalculatorTools.NTH_ROOT:
        if (typeof args.n !== "number" || typeof args.root !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "n and root must be numbers");
        }
        result = nthRoot(args.n, args.root);
        break;

      case CalculatorTools.LOGARITHM:
        if (typeof args.n !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "n must be a number");
        }
        result = logarithm(args.n, args.base as number);
        break;

      case CalculatorTools.FACTORIAL:
        if (typeof args.n !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "n must be a number");
        }
        result = factorial(args.n);
        break;

      // Trigonometric
      case CalculatorTools.SINE:
        if (typeof args.angle !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "angle must be a number");
        }
        result = sine(args.angle, args.unit as any);
        break;

      case CalculatorTools.COSINE:
        if (typeof args.angle !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "angle must be a number");
        }
        result = cosine(args.angle, args.unit as any);
        break;

      case CalculatorTools.TANGENT:
        if (typeof args.angle !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "angle must be a number");
        }
        result = tangent(args.angle, args.unit as any);
        break;

      case CalculatorTools.ARCSINE:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = arcSine(args.value, args.unit as any);
        break;

      case CalculatorTools.ARCCOSINE:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = arcCosine(args.value, args.unit as any);
        break;

      case CalculatorTools.ARCTANGENT:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = arcTangent(args.value, args.unit as any);
        break;

      // Statistics
      case CalculatorTools.MEAN:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = mean(args.numbers);
        break;

      case CalculatorTools.MEDIAN:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = median(args.numbers);
        break;

      case CalculatorTools.MODE:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = mode(args.numbers);
        break;

      case CalculatorTools.STANDARD_DEVIATION:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = standardDeviation(
          args.numbers,
          typeof args.sample === "boolean" ? args.sample : true
        );
        break;

      case CalculatorTools.VARIANCE:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = variance(
          args.numbers,
          typeof args.sample === "boolean" ? args.sample : true
        );
        break;

      case CalculatorTools.SUM:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = sum(args.numbers);
        break;

      case CalculatorTools.PRODUCT:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = product(args.numbers);
        break;

      case CalculatorTools.MINIMUM:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = minimum(args.numbers);
        break;

      case CalculatorTools.MAXIMUM:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = maximum(args.numbers);
        break;

      case CalculatorTools.RANGE:
        if (!Array.isArray(args.numbers)) {
          throw new McpError(ErrorCode.InvalidParams, "numbers must be an array");
        }
        result = range(args.numbers);
        break;

      // Expression evaluation
      case CalculatorTools.EVALUATE:
        if (typeof args.expression !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "expression must be a string");
        }
        result = evaluateExpression(args.expression);
        break;

      // Percentage
      case CalculatorTools.PERCENTAGE:
        if (typeof args.value !== "number" || typeof args.percent !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value and percent must be numbers");
        }
        result = percentage(args.value, args.percent);
        break;

      case CalculatorTools.PERCENTAGE_CHANGE:
        if (typeof args.old_value !== "number" || typeof args.new_value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "old_value and new_value must be numbers");
        }
        result = percentageChange(args.old_value, args.new_value);
        break;

      // Rounding
      case CalculatorTools.ROUND:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = roundTo(
          args.value,
          typeof args.decimals === "number" ? args.decimals : 0
        );
        break;

      case CalculatorTools.CEIL:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = ceilTo(
          args.value,
          typeof args.decimals === "number" ? args.decimals : 0
        );
        break;

      case CalculatorTools.FLOOR:
        if (typeof args.value !== "number") {
          throw new McpError(ErrorCode.InvalidParams, "value must be a number");
        }
        result = floorTo(
          args.value,
          typeof args.decimals === "number" ? args.decimals : 0
        );
        break;

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ result }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing ${name}: ${(error as Error).message}`
    );
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Calculator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
