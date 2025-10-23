#!/usr/bin/env node

import { DateTime, IANAZone } from "luxon";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

// Constants
const TimeTools = {
  GET_CURRENT_TIME: "get_current_time",
  CONVERT_TIME: "convert_time",
} as const;

// Models
interface TimeResult {
  timezone: string;
  datetime: string;
  day_of_week: string;
  is_dst: boolean;
}

interface TimeConversionResult {
  source: TimeResult;
  target: TimeResult;
  time_difference: string;
}

// Utility functions
function getLocalTz(localTzOverride?: string): string {
  if (localTzOverride) return localTzOverride;

  // Try system TZ from Intl API
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function validateTimezone(timezone: string): string {
  if (!IANAZone.isValidZone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
  return timezone;
}

// Core time functions
function getCurrentTime(timezoneName: string): TimeResult {
  const tz = validateTimezone(timezoneName);
  const now = DateTime.now().setZone(tz);

  return {
    timezone: tz,
    datetime: now.toISO({ suppressMilliseconds: true }) || '',
    day_of_week: now.toFormat("EEEE"),
    is_dst: now.isInDST,
  };
}

function convertTime(source_tz: string, timeStr: string, target_tz: string): TimeConversionResult {
  const sourceZone = validateTimezone(source_tz);
  const targetZone = validateTimezone(target_tz);

  const [hourStr, minuteStr] = timeStr.split(":");
  if (!hourStr || !minuteStr) {
    throw new Error("Invalid time format. Expected HH:MM [24-hour format]");
  }

  const sourceTime = DateTime.now().setZone(sourceZone)
    .set({ hour: parseInt(hourStr, 10), minute: parseInt(minuteStr, 10), second: 0 });

  const targetTime = sourceTime.setZone(targetZone);
  const diffHours = (targetTime.offset - sourceTime.offset) / 60;

  const diffFormatted =
    Number.isInteger(diffHours)
      ? `${diffHours >= 0 ? "+" : ""}${diffHours.toFixed(1)}h`
      : `${diffHours >= 0 ? "+" : ""}${diffHours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h`;

  return {
    source: {
      timezone: source_tz,
      datetime: sourceTime.toISO({ suppressMilliseconds: true }) || '',
      day_of_week: sourceTime.toFormat("EEEE"),
      is_dst: sourceTime.isInDST,
    },
    target: {
      timezone: target_tz,
      datetime: targetTime.toISO({ suppressMilliseconds: true }) || '',
      day_of_week: targetTime.toFormat("EEEE"),
      is_dst: targetTime.isInDST,
    },
    time_difference: diffFormatted,
  };
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "time-mcp-server",
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
  const localTz = getLocalTz();

  return {
    tools: [
      {
        name: TimeTools.GET_CURRENT_TIME,
        description: "Get current time in a specific timezone",
        inputSchema: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: `IANA timezone name (e.g., 'America/New_York', 'Europe/London'). Default: '${localTz}'.`,
            },
          },
          required: ["timezone"],
        },
      },
      {
        name: TimeTools.CONVERT_TIME,
        description: "Convert time between timezones",
        inputSchema: {
          type: "object",
          properties: {
            source_timezone: {
              type: "string",
              description: `Source timezone. Default: '${localTz}'.`,
            },
            time: { type: "string", description: "Time in 24-hour format (HH:MM)" },
            target_timezone: {
              type: "string",
              description: `Target timezone. Default: '${localTz}'.`,
            },
          },
          required: ["source_timezone", "time", "target_timezone"],
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
    switch (name) {
      case TimeTools.GET_CURRENT_TIME: {
        if (typeof args.timezone !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "timezone must be a string"
          );
        }

        const result = getCurrentTime(args.timezone);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case TimeTools.CONVERT_TIME: {
        if (typeof args.source_timezone !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "source_timezone must be a string"
          );
        }
        if (typeof args.time !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "time must be a string"
          );
        }
        if (typeof args.target_timezone !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "target_timezone must be a string"
          );
        }

        const result = convertTime(
          args.source_timezone,
          args.time,
          args.target_timezone
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error}`
    );
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Time MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});