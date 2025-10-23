#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://services.runescape.com";
const HISCORES_URL = "https://secure.runescape.com";

/**
 * Fetch wrapper with error handling
 */
async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch data: ${error.message}`
      );
    }
    throw new McpError(ErrorCode.InternalError, "Failed to fetch data");
  }
}

/**
 * GE Category response type
 */
interface GECategoryResponse {
  types: string[];
  alpha: Array<{
    letter: string;
    items: number;
  }>;
}

/**
 * GE Item Detail response type
 */
interface GEItemDetailResponse {
  item: {
    icon: string;
    icon_large: string;
    id: number;
    type: string;
    typeIcon: string;
    name: string;
    description: string;
    current: {
      trend: string;
      price: string | number;
    };
    today: {
      trend: string;
      price: string | number;
    };
    members: string;
    day30?: {
      trend: string;
      change: string;
    };
    day90?: {
      trend: string;
      change: string;
    };
    day180?: {
      trend: string;
      change: string;
    };
  };
}

/**
 * GE Items List response type
 */
interface GEItemsListResponse {
  total: number;
  items: Array<{
    icon: string;
    icon_large: string;
    id: number;
    type: string;
    typeIcon: string;
    name: string;
    description: string;
    current: {
      trend: string;
      price: string | number;
    };
    today: {
      trend: string;
      price: string | number;
    };
    members: string;
  }>;
}

/**
 * GE Graph response type
 */
interface GEGraphResponse {
  daily: Record<string, number>;
  average: Record<string, number>;
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "runescape-lookup",
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
      {
        name: "ge_category",
        description:
          "Get Grand Exchange category information showing the number of items by first letter. Category 1 is used for OSRS (all items).",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "number",
              description: "Category ID (use 1 for OSRS to get all items)",
              default: 1,
            },
          },
          required: [],
        },
      },
      {
        name: "ge_item_detail",
        description:
          "Get detailed information about a specific Grand Exchange item including current price, trends, and historical data.",
        inputSchema: {
          type: "object",
          properties: {
            item_id: {
              type: "number",
              description: "The item ID to look up",
            },
          },
          required: ["item_id"],
        },
      },
      {
        name: "ge_items_search",
        description:
          "Search for items in the Grand Exchange by category, starting letter, and page. Returns up to 12 items per page.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "number",
              description: "Category ID (use 1 for OSRS)",
              default: 1,
            },
            alpha: {
              type: "string",
              description:
                "Starting letter for items (a-z, or use '%23' for items starting with numbers)",
            },
            page: {
              type: "number",
              description: "Page number (starts at 1)",
              default: 1,
            },
          },
          required: ["alpha"],
        },
      },
      {
        name: "ge_price_graph",
        description:
          "Get price history graph data for an item over the past 180 days. Returns daily prices and 30-day moving averages.",
        inputSchema: {
          type: "object",
          properties: {
            item_id: {
              type: "number",
              description: "The item ID to get price history for",
            },
          },
          required: ["item_id"],
        },
      },
      {
        name: "player_highscore",
        description:
          "Get Old School RuneScape highscore data for a specific player including all skill levels and activity scores.",
        inputSchema: {
          type: "object",
          properties: {
            player_name: {
              type: "string",
              description: "The player's display name (case-insensitive)",
            },
          },
          required: ["player_name"],
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
      case "ge_category": {
        const category = (args.category as number) || 1;
        const url = `${BASE_URL}/m=itemdb_oldschool/api/catalogue/category.json?category=${category}`;
        const data = await fetchJson<GECategoryResponse>(url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "ge_item_detail": {
        if (typeof args.item_id !== "number") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "item_id must be a number"
          );
        }

        const url = `${BASE_URL}/m=itemdb_oldschool/api/catalogue/detail.json?item=${args.item_id}`;
        const data = await fetchJson<GEItemDetailResponse>(url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "ge_items_search": {
        if (typeof args.alpha !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "alpha must be a string"
          );
        }

        const category = (args.category as number) || 1;
        const page = (args.page as number) || 1;
        const alpha = args.alpha as string;

        const url = `${BASE_URL}/m=itemdb_oldschool/api/catalogue/items.json?category=${category}&alpha=${alpha}&page=${page}`;
        const data = await fetchJson<GEItemsListResponse>(url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "ge_price_graph": {
        if (typeof args.item_id !== "number") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "item_id must be a number"
          );
        }

        const url = `${BASE_URL}/m=itemdb_oldschool/api/graph/${args.item_id}.json`;
        const data = await fetchJson<GEGraphResponse>(url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "player_highscore": {
        if (typeof args.player_name !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "player_name must be a string"
          );
        }

        const playerName = encodeURIComponent(args.player_name as string);
        const url = `${HISCORES_URL}/m=hiscore_oldschool/index_lite.json?player=${playerName}`;
        const data = await fetchJson<any>(url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
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
  console.error("Old School RuneScape MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});