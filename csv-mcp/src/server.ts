#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readFile, writeFile } from "fs/promises";
import { resolve, relative } from "path";

const CsvTools = {
  PARSE: "parse_csv",
  SUMMARIZE: "summarize_csv",
  FILTER: "filter_csv",
  SELECT_COLUMNS: "select_columns",
  CREATE: "create_csv",
  APPEND_ROWS: "append_rows",
  UPDATE_ROWS: "update_rows",
  DELETE_ROWS: "delete_rows",
  UPDATE_CELL: "update_cell",
  ADD_COLUMN: "add_column",
  REMOVE_COLUMN: "remove_column",
  SORT: "sort_csv",
} as const;

type CsvRecord = Record<string, string>;

interface LoadCsvOptions {
  csv?: string;
  filePath?: string;
  delimiter?: string;
  hasHeaders?: boolean;
  customHeaders?: string[];
  limit?: number;
}

interface LoadedCsv {
  rows: CsvRecord[];
  columns: string[];
  totalRows: number;
  truncated: boolean;
}

async function loadCsvData(options: LoadCsvOptions): Promise<LoadedCsv> {
  const { csv, filePath, delimiter, hasHeaders = true, customHeaders, limit } = options;

  if (!csv && !filePath) {
    throw new Error("Provide either `csv` content or `filePath`.");
  }

  const rawContent = csv ?? (await readFile(resolve(filePath!), "utf8"));

  const parserOptions: Record<string, unknown> = {
    skip_empty_lines: true,
    trim: true,
    delimiter: delimiter || undefined,
    columns: hasHeaders ? true : customHeaders,
  };

  const parsed = parse(rawContent, parserOptions);
  let rows: CsvRecord[];
  let columns: string[];

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        rows: [],
        columns: hasHeaders ? customHeaders ?? [] : customHeaders ?? [],
        totalRows: 0,
        truncated: false,
      };
    }

    if (Array.isArray(parsed[0])) {
      // Should only happen if custom headers not provided
      const headerCount = (parsed[0] as string[]).length;
      const headers =
        customHeaders?.length === headerCount
          ? customHeaders
          : Array.from({ length: headerCount }, (_, index) => `column_${index + 1}`);
      rows = (parsed as string[][]).map((row) =>
        headers.reduce<CsvRecord>((acc, header, idx) => {
          acc[header] = row[idx] ?? "";
          return acc;
        }, {}),
      );
      columns = headers;
    } else {
      rows = parsed as CsvRecord[];
      columns = Object.keys(rows[0]);
    }
  } else {
    throw new Error("Unexpected parser output format.");
  }

  const limitValue = typeof limit === "number" && limit > 0 ? limit : undefined;
  const truncated = typeof limitValue === "number" ? rows.length > limitValue : false;

  return {
    rows: truncated && typeof limitValue === "number" ? rows.slice(0, limitValue) : rows,
    columns,
    totalRows: rows.length,
    truncated,
  };
}

function guessColumnType(values: string[]): string {
  let hasNumber = false;
  let hasInteger = true;
  let hasBoolean = true;
  let hasDate = true;

  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed === "" || trimmed === undefined) {
      continue;
    }

    if (hasBoolean && !/^(true|false|0|1)$/i.test(trimmed)) {
      hasBoolean = false;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      hasNumber = true;
      if (!Number.isInteger(numeric)) {
        hasInteger = false;
      }
    } else {
      hasNumber = false;
      hasInteger = false;
    }

    if (hasDate) {
      const parsedDate = Date.parse(trimmed);
      if (Number.isNaN(parsedDate)) {
        hasDate = false;
      }
    }
  }

  if (hasBoolean) return "boolean";
  if (hasInteger && hasNumber) return "integer";
  if (hasNumber) return "number";
  if (hasDate) return "date";
  return "string";
}

function summariseCsv(rows: CsvRecord[], columns: string[]) {
  const sampleSize = Math.min(rows.length, 5);
  const samples = rows.slice(0, sampleSize);

  const columnSummaries = columns.map((column) => {
    const values = rows.map((row) => row[column] ?? "");
    const uniqueValues = new Set(values.filter((value) => value !== ""));
    const type = guessColumnType(values);

    return {
      column,
      type,
      nonEmpty: values.filter((value) => value !== "").length,
      unique: uniqueValues.size,
      sampleValues: values.slice(0, 5),
    };
  });

  return {
    rowsInspected: rows.length,
    columnCount: columns.length,
    columnSummaries,
    samples,
  };
}

type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

function applyFilter(
  rows: CsvRecord[],
  column: string,
  operator: FilterOperator,
  value: string,
): CsvRecord[] {
  const target = value ?? "";
  return rows.filter((row) => {
    const raw = row[column] ?? "";
    switch (operator) {
      case "equals":
        return raw === target;
      case "not_equals":
        return raw !== target;
      case "contains":
        return raw.includes(target);
      case "starts_with":
        return raw.startsWith(target);
      case "ends_with":
        return raw.endsWith(target);
      case "gt":
        return Number(raw) > Number(target);
      case "gte":
        return Number(raw) >= Number(target);
      case "lt":
        return Number(raw) < Number(target);
      case "lte":
        return Number(raw) <= Number(target);
      default:
        return false;
    }
  });
}

function validateFilePath(filePath: string): string {
  const absolutePath = resolve(filePath);
  const workingDir = process.cwd();
  const relativePath = relative(workingDir, absolutePath);

  if (relativePath.startsWith("..") || resolve(relativePath) !== absolutePath) {
    throw new Error(
      `File path must be within the working directory. Path: ${filePath}`,
    );
  }

  return absolutePath;
}

async function writeCsvData(
  filePath: string,
  rows: CsvRecord[],
  columns: string[],
  delimiter = ",",
): Promise<void> {
  const validatedPath = validateFilePath(filePath);

  const csvContent = stringify(rows, {
    header: true,
    columns: columns,
    delimiter,
  });

  await writeFile(validatedPath, csvContent, "utf8");
}

const server = new Server(
  {
    name: "csv-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: CsvTools.PARSE,
        description: "Parse CSV input (string or file) and return JSON preview.",
        inputSchema: {
          type: "object",
          properties: {
            csv: {
              type: "string",
              description: "Raw CSV content (optional when filePath provided).",
            },
            filePath: {
              type: "string",
              description: "Path to a CSV file on disk.",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter override (e.g. ';').",
            },
            hasHeaders: {
              type: "boolean",
              description: "Set false if the CSV does not include a header row.",
              default: true,
            },
            customHeaders: {
              type: "array",
              description: "Column headers to apply when hasHeaders is false.",
              items: { type: "string" },
            },
            limit: {
              type: "number",
              description: "Maximum number of rows to include in response (default 200).",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.SUMMARIZE,
        description: "Summarise CSV structure (columns, data types, sample rows).",
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string", description: "Raw CSV content." },
            filePath: { type: "string", description: "Path to a CSV file on disk." },
            delimiter: { type: "string", description: "Optional delimiter override." },
            hasHeaders: {
              type: "boolean",
              description: "Set false if the CSV lacks headers.",
              default: true,
            },
            customHeaders: {
              type: "array",
              description: "Column headers to use when headers are absent.",
              items: { type: "string" },
            },
            limit: {
              type: "number",
              description: "Maximum rows to inspect for summary (default 500).",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.FILTER,
        description: "Return rows matching a simple column filter.",
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string", description: "Raw CSV content." },
            filePath: { type: "string", description: "Path to a CSV file on disk." },
            delimiter: { type: "string", description: "Optional delimiter override." },
            hasHeaders: {
              type: "boolean",
              description: "Set false if the CSV lacks headers.",
              default: true,
            },
            customHeaders: {
              type: "array",
              description: "Column headers to use when headers are absent.",
              items: { type: "string" },
            },
            column: {
              type: "string",
              description: "Column name to filter on.",
            },
            operator: {
              type: "string",
              description: "Comparison operator.",
              enum: [
                "equals",
                "not_equals",
                "contains",
                "starts_with",
                "ends_with",
                "gt",
                "gte",
                "lt",
                "lte",
              ],
              default: "equals",
            },
            value: {
              type: "string",
              description: "Comparison value (string form).",
            },
            limit: {
              type: "number",
              description: "Maximum number of matching rows to return (default 200).",
            },
          },
          required: ["column", "value"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.SELECT_COLUMNS,
        description: "Project a CSV onto a subset of columns.",
        inputSchema: {
          type: "object",
          properties: {
            csv: { type: "string", description: "Raw CSV content." },
            filePath: { type: "string", description: "Path to a CSV file on disk." },
            delimiter: { type: "string", description: "Optional delimiter override." },
            hasHeaders: {
              type: "boolean",
              description: "Set false if the CSV lacks headers.",
              default: true,
            },
            customHeaders: {
              type: "array",
              description: "Column headers to use when headers are absent.",
              items: { type: "string" },
            },
            columns: {
              type: "array",
              description: "Subset of columns to include in the output.",
              items: { type: "string" },
            },
            limit: {
              type: "number",
              description: "Maximum number of rows to include (default 200).",
            },
          },
          required: ["columns"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.CREATE,
        description: "Create a new CSV file from an array of objects.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path where the CSV file should be created (within working directory).",
            },
            data: {
              type: "array",
              description: "Array of objects to convert to CSV rows.",
              items: { type: "object" },
            },
            columns: {
              type: "array",
              description: "Optional custom column order. If omitted, uses keys from first object.",
              items: { type: "string" },
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "data"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.APPEND_ROWS,
        description: "Append new rows to an existing CSV file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to append to.",
            },
            newRows: {
              type: "array",
              description: "Array of objects representing new rows to append.",
              items: { type: "object" },
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "newRows"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.UPDATE_ROWS,
        description: "Update rows matching a filter condition.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to update.",
            },
            column: {
              type: "string",
              description: "Column name to filter on.",
            },
            operator: {
              type: "string",
              description: "Comparison operator.",
              enum: [
                "equals",
                "not_equals",
                "contains",
                "starts_with",
                "ends_with",
                "gt",
                "gte",
                "lt",
                "lte",
              ],
              default: "equals",
            },
            value: {
              type: "string",
              description: "Filter value to match.",
            },
            updates: {
              type: "object",
              description: "Object with column names as keys and new values.",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "column", "value", "updates"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.DELETE_ROWS,
        description: "Delete rows matching a filter condition.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to modify.",
            },
            column: {
              type: "string",
              description: "Column name to filter on.",
            },
            operator: {
              type: "string",
              description: "Comparison operator.",
              enum: [
                "equals",
                "not_equals",
                "contains",
                "starts_with",
                "ends_with",
                "gt",
                "gte",
                "lt",
                "lte",
              ],
              default: "equals",
            },
            value: {
              type: "string",
              description: "Filter value to match for deletion.",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "column", "value"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.UPDATE_CELL,
        description: "Update specific cell(s) by row index and column name.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to modify.",
            },
            rowIndex: {
              description: "Row index (0-based) or array of indices to update.",
            },
            column: {
              type: "string",
              description: "Column name of the cell(s) to update.",
            },
            newValue: {
              type: "string",
              description: "New value to set.",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "rowIndex", "column", "newValue"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.ADD_COLUMN,
        description: "Add a new column to a CSV file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to modify.",
            },
            columnName: {
              type: "string",
              description: "Name of the new column.",
            },
            defaultValue: {
              type: "string",
              description: "Default value for the new column (default empty string).",
            },
            position: {
              type: "number",
              description: "Position index to insert column (default: end).",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "columnName"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.REMOVE_COLUMN,
        description: "Remove column(s) from a CSV file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to modify.",
            },
            columns: {
              description: "Column name (string) or array of column names to remove.",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "columns"],
          additionalProperties: false,
        },
      },
      {
        name: CsvTools.SORT,
        description: "Sort CSV rows by column value(s).",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the CSV file to sort.",
            },
            sortBy: {
              description: "Column name (string) or array of column names to sort by.",
            },
            order: {
              type: "string",
              description: "Sort order: 'asc' or 'desc' (default 'asc').",
              enum: ["asc", "desc"],
              default: "asc",
            },
            delimiter: {
              type: "string",
              description: "Single-character delimiter (default comma).",
            },
          },
          required: ["filePath", "sortBy"],
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, "Missing arguments.");
  }

  try {
    switch (name) {
      case CsvTools.PARSE: {
        const limit =
          typeof args.limit === "number" && args.limit > 0 ? (args.limit as number) : 200;
        const data = await loadCsvData({
          csv: typeof args.csv === "string" ? args.csv : undefined,
          filePath: typeof args.filePath === "string" ? args.filePath : undefined,
          delimiter: typeof args.delimiter === "string" ? args.delimiter : undefined,
          hasHeaders:
            typeof args.hasHeaders === "boolean" ? args.hasHeaders : true,
          customHeaders: Array.isArray(args.customHeaders)
            ? (args.customHeaders as string[])
            : undefined,
          limit,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  columns: data.columns,
                  rowCount: data.rows.length,
                  totalRows: data.totalRows,
                  truncated: data.truncated,
                  rows: data.rows,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.SUMMARIZE: {
        const limitValue =
          typeof args.limit === "number" && args.limit > 0 ? (args.limit as number) : 1000;
        const data = await loadCsvData({
          csv: typeof args.csv === "string" ? args.csv : undefined,
          filePath: typeof args.filePath === "string" ? args.filePath : undefined,
          delimiter: typeof args.delimiter === "string" ? args.delimiter : undefined,
          hasHeaders:
            typeof args.hasHeaders === "boolean" ? args.hasHeaders : true,
          customHeaders: Array.isArray(args.customHeaders)
            ? (args.customHeaders as string[])
            : undefined,
          limit: limitValue,
        });

        const summary = summariseCsv(data.rows, data.columns);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  totalRows: data.totalRows,
                  rowsInspected: summary.rowsInspected,
                  columnCount: summary.columnCount,
                  truncated: data.truncated,
                  columnSummaries: summary.columnSummaries,
                  samples: summary.samples,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.FILTER: {
        if (typeof args.column !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`column` must be a string.");
        }
        if (typeof args.value !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`value` must be provided as a string.");
        }

        const data = await loadCsvData({
          csv: typeof args.csv === "string" ? args.csv : undefined,
          filePath: typeof args.filePath === "string" ? args.filePath : undefined,
          delimiter: typeof args.delimiter === "string" ? args.delimiter : undefined,
          hasHeaders:
            typeof args.hasHeaders === "boolean" ? args.hasHeaders : true,
          customHeaders: Array.isArray(args.customHeaders)
            ? (args.customHeaders as string[])
            : undefined,
          limit:
            typeof args.limit === "number" && args.limit > 0
              ? (args.limit as number)
              : undefined,
        });

        const operator: FilterOperator =
          typeof args.operator === "string"
            ? ((args.operator as FilterOperator) || "equals")
            : "equals";

        if (!data.columns.includes(args.column)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown column "${args.column}". Available: ${data.columns.join(", ")}`,
          );
        }

        const filtered = applyFilter(data.rows, args.column, operator, args.value);
        const limitValue = typeof args.limit === "number" ? args.limit : 200;
        const truncated = filtered.length > limitValue;
        const outputRows = truncated ? filtered.slice(0, limitValue) : filtered;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  column: args.column,
                  operator,
                  value: args.value,
                  matchCount: filtered.length,
                  truncated,
                  rows: outputRows,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.SELECT_COLUMNS: {
        const columns = Array.isArray(args.columns)
          ? (args.columns as string[])
          : undefined;
        if (!columns || columns.length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "`columns` must be a non-empty array of column names.",
          );
        }

        const data = await loadCsvData({
          csv: typeof args.csv === "string" ? args.csv : undefined,
          filePath: typeof args.filePath === "string" ? args.filePath : undefined,
          delimiter: typeof args.delimiter === "string" ? args.delimiter : undefined,
          hasHeaders:
            typeof args.hasHeaders === "boolean" ? args.hasHeaders : true,
          customHeaders: Array.isArray(args.customHeaders)
            ? (args.customHeaders as string[])
            : undefined,
          limit:
            typeof args.limit === "number" && args.limit > 0
              ? (args.limit as number)
              : 200,
        });

        const missing = columns.filter((column) => !data.columns.includes(column));
        if (missing.length > 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Columns not found: ${missing.join(", ")}.`,
          );
        }

        const selected = data.rows.map((row) =>
          columns.reduce<CsvRecord>((acc, column) => {
            acc[column] = row[column] ?? "";
            return acc;
          }, {}),
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  columns,
                  rowCount: selected.length,
                  totalRows: data.totalRows,
                  truncated: data.truncated,
                  rows: selected,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.CREATE: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (!Array.isArray(args.data) || args.data.length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "`data` must be a non-empty array of objects.",
          );
        }

        const data = args.data as CsvRecord[];
        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";

        const columns = Array.isArray(args.columns)
          ? (args.columns as string[])
          : Object.keys(data[0]);

        await writeCsvData(args.filePath, data, columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  rowCount: data.length,
                  columns,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.APPEND_ROWS: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (!Array.isArray(args.newRows) || args.newRows.length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "`newRows` must be a non-empty array of objects.",
          );
        }

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";

        const existing = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        const newRows = args.newRows as CsvRecord[];
        const combinedRows = [...existing.rows, ...newRows];

        await writeCsvData(args.filePath, combinedRows, existing.columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  rowsAppended: newRows.length,
                  totalRows: combinedRows.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.UPDATE_ROWS: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (typeof args.column !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`column` must be a string.");
        }
        if (typeof args.value !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`value` must be a string.");
        }
        if (typeof args.updates !== "object" || args.updates === null) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "`updates` must be an object with column names as keys.",
          );
        }

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";
        const operator: FilterOperator =
          typeof args.operator === "string"
            ? ((args.operator as FilterOperator) || "equals")
            : "equals";

        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        if (!data.columns.includes(args.column)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown column "${args.column}". Available: ${data.columns.join(", ")}`,
          );
        }

        const updates = args.updates as Record<string, string>;
        const matchedIndices = new Set<number>();
        const column = args.column as string;
        const value = args.value as string;

        const updatedRows = data.rows.map((row, index) => {
          const matches = applyFilter([row], column, operator, value).length > 0;
          if (matches) {
            matchedIndices.add(index);
            return { ...row, ...updates };
          }
          return row;
        });

        await writeCsvData(args.filePath, updatedRows, data.columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  rowsUpdated: matchedIndices.size,
                  updates,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.DELETE_ROWS: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (typeof args.column !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`column` must be a string.");
        }
        if (typeof args.value !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`value` must be a string.");
        }

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";
        const operator: FilterOperator =
          typeof args.operator === "string"
            ? ((args.operator as FilterOperator) || "equals")
            : "equals";

        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        if (!data.columns.includes(args.column)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown column "${args.column}". Available: ${data.columns.join(", ")}`,
          );
        }

        const originalCount = data.rows.length;
        const column = args.column as string;
        const value = args.value as string;
        const filteredRows = data.rows.filter((row) => {
          const matches = applyFilter([row], column, operator, value).length > 0;
          return !matches;
        });

        await writeCsvData(args.filePath, filteredRows, data.columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  rowsDeleted: originalCount - filteredRows.length,
                  remainingRows: filteredRows.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.UPDATE_CELL: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (typeof args.column !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`column` must be a string.");
        }
        if (typeof args.newValue !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`newValue` must be a string.");
        }

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";
        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        if (!data.columns.includes(args.column)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown column "${args.column}". Available: ${data.columns.join(", ")}`,
          );
        }

        const indices = Array.isArray(args.rowIndex)
          ? (args.rowIndex as number[])
          : [args.rowIndex as number];

        const column = args.column as string;
        const newValue = args.newValue as string;

        let updatedCount = 0;
        const updatedRows = data.rows.map((row, index) => {
          if (indices.includes(index)) {
            updatedCount++;
            return { ...row, [column]: newValue };
          }
          return row;
        });

        await writeCsvData(args.filePath, updatedRows, data.columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  cellsUpdated: updatedCount,
                  column: args.column,
                  newValue: args.newValue,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.ADD_COLUMN: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }
        if (typeof args.columnName !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`columnName` must be a string.");
        }

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";
        const defaultValue = typeof args.defaultValue === "string" ? args.defaultValue : "";
        const position = typeof args.position === "number" ? args.position : undefined;

        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        const columnName = args.columnName as string;

        if (data.columns.includes(columnName)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Column "${columnName}" already exists.`,
          );
        }

        const updatedRows = data.rows.map((row) => ({
          ...row,
          [columnName]: defaultValue,
        }));

        let newColumns: string[];
        if (typeof position === "number") {
          newColumns = [...data.columns];
          newColumns.splice(position, 0, columnName);
        } else {
          newColumns = [...data.columns, columnName];
        }

        await writeCsvData(args.filePath, updatedRows, newColumns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  columnAdded: columnName,
                  columnCount: newColumns.length,
                  columns: newColumns,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.REMOVE_COLUMN: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }

        const columnsToRemove = Array.isArray(args.columns)
          ? (args.columns as string[])
          : [args.columns as string];

        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";

        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        const missing = columnsToRemove.filter((col) => !data.columns.includes(col));
        if (missing.length > 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Columns not found: ${missing.join(", ")}`,
          );
        }

        const newColumns = data.columns.filter((col) => !columnsToRemove.includes(col));

        if (newColumns.length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Cannot remove all columns from CSV.",
          );
        }

        const updatedRows = data.rows.map((row) =>
          newColumns.reduce<CsvRecord>((acc, col) => {
            acc[col] = row[col] ?? "";
            return acc;
          }, {}),
        );

        await writeCsvData(args.filePath, updatedRows, newColumns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  columnsRemoved: columnsToRemove,
                  remainingColumns: newColumns,
                  columnCount: newColumns.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case CsvTools.SORT: {
        if (typeof args.filePath !== "string") {
          throw new McpError(ErrorCode.InvalidParams, "`filePath` must be a string.");
        }

        const sortColumns = Array.isArray(args.sortBy)
          ? (args.sortBy as string[])
          : [args.sortBy as string];
        const order = args.order === "desc" ? "desc" : "asc";
        const delimiter = typeof args.delimiter === "string" ? args.delimiter : ",";

        const data = await loadCsvData({
          filePath: args.filePath,
          delimiter,
        });

        const missing = sortColumns.filter((col) => !data.columns.includes(col));
        if (missing.length > 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Sort columns not found: ${missing.join(", ")}`,
          );
        }

        const sortedRows = [...data.rows].sort((a, b) => {
          for (const col of sortColumns) {
            const aVal = a[col] ?? "";
            const bVal = b[col] ?? "";

            const aNum = Number(aVal);
            const bNum = Number(bVal);

            let comparison: number;
            if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
              comparison = aNum - bNum;
            } else {
              comparison = aVal.localeCompare(bVal);
            }

            if (comparison !== 0) {
              return order === "asc" ? comparison : -comparison;
            }
          }
          return 0;
        });

        await writeCsvData(args.filePath, sortedRows, data.columns, delimiter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: args.filePath,
                  sortedBy: sortColumns,
                  order,
                  rowCount: sortedRows.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : String(error),
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CSV MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
