#!/usr/bin/env node

/**
 * Dice Rolling MCP Server - Roll 100-sided dice and other gaming dice
 * Runs on localhost:3000 for easy access
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class DiceServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'dice-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'roll_d100',
            description: 'Roll a 100-sided die one or more times (max 20 rolls)',
            inputSchema: {
              type: 'object',
              properties: {
                count: {
                  type: 'string',
                  description: 'Number of dice to roll (1-20)',
                  default: '1'
                }
              }
            }
          },
          {
            name: 'roll_custom_die',
            description: 'Roll a custom-sided die (2-1000 sides) one or more times (max 20 rolls)',
            inputSchema: {
              type: 'object',
              properties: {
                sides: {
                  type: 'string',
                  description: 'Number of sides on the die (2-1000)',
                  default: '6'
                },
                count: {
                  type: 'string',
                  description: 'Number of dice to roll (1-20)',
                  default: '1'
                }
              }
            }
          },
          {
            name: 'roll_standard_dice',
            description: 'Roll dice using standard notation like 2d6, 3d20, 1d100 (max 20 dice, max 1000 sides)',
            inputSchema: {
              type: 'object',
              properties: {
                dice_notation: {
                  type: 'string',
                  description: 'Dice notation like "2d6", "3d20", "1d100"',
                  default: '1d6'
                }
              }
            }
          },
          {
            name: 'roll_percentile',
            description: 'Roll percentile dice (00-99) by rolling two d10s for tabletop gaming',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'roll_d100':
            return await this.rollD100((args?.count as string) || '1');
          case 'roll_custom_die':
            return await this.rollCustomDie((args?.sides as string) || '6', (args?.count as string) || '1');
          case 'roll_standard_dice':
            return await this.rollStandardDice((args?.dice_notation as string) || '1d6');
          case 'roll_percentile':
            return await this.rollPercentile();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${errorMessage}`
            }
          ]
        };
      }
    });
  }

  // Utility functions
  private rollDice(sides: number, count: number): number[] {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    return rolls;
  }

  private formatRollResult(rolls: number[], sides: number): string {
    if (rolls.length === 1) {
      return `🎲 D${sides} Roll: **${rolls[0]}**`;
    } else {
      const total = rolls.reduce((sum, roll) => sum + roll, 0);
      const rollsStr = rolls.join(', ');
      const average = (total / rolls.length).toFixed(1);
      return `🎲 ${rolls.length}×D${sides} Rolls: [${rollsStr}]\n📊 Total: **${total}** | Average: **${average}**`;
    }
  }

  private validateRollCount(countStr: string): number {
    const trimmed = countStr.trim();
    if (!trimmed) return 1;

    const count = parseInt(trimmed, 10);
    if (isNaN(count) || count < 1 || count > 20) {
      throw new Error('Count must be a number between 1 and 20');
    }
    return count;
  }

  // Tool implementations
  private async rollD100(countStr: string) {
    console.error(`Rolling d100 ${countStr} times`);

    const count = this.validateRollCount(countStr);
    const rolls = this.rollDice(100, count);
    const result = this.formatRollResult(rolls, 100);

    console.error(`Rolled: ${rolls}`);

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result}`
        }
      ]
    };
  }

  private async rollCustomDie(sidesStr: string, countStr: string) {
    console.error(`Rolling d${sidesStr} ${countStr} times`);

    const trimmedSides = sidesStr.trim();
    if (!trimmedSides) {
      throw new Error('Number of sides is required');
    }

    const sides = parseInt(trimmedSides, 10);
    if (isNaN(sides) || sides < 2 || sides > 1000) {
      throw new Error('Sides must be between 2 and 1000');
    }

    const count = this.validateRollCount(countStr);
    const rolls = this.rollDice(sides, count);
    const result = this.formatRollResult(rolls, sides);

    console.error(`Rolled d${sides}: ${rolls}`);

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result}`
        }
      ]
    };
  }

  private async rollStandardDice(diceNotation: string) {
    console.error(`Rolling dice with notation: ${diceNotation}`);

    const notation = diceNotation.trim().toLowerCase();
    if (!notation) {
      throw new Error('Dice notation is required (e.g., "2d6", "1d20")');
    }

    if (!notation.includes('d')) {
      throw new Error('Invalid dice notation. Use format like "2d6" or "1d20"');
    }

    const parts = notation.split('d');
    if (parts.length !== 2) {
      throw new Error('Invalid dice notation. Use format like "2d6" or "1d20"');
    }

    const countStr = parts[0] || '1';
    const sidesStr = parts[1];

    const count = parseInt(countStr, 10);
    const sides = parseInt(sidesStr, 10);

    if (isNaN(count) || isNaN(sides)) {
      throw new Error('Invalid numbers in dice notation');
    }

    if (count < 1 || count > 20) {
      throw new Error('Number of dice must be between 1 and 20');
    }

    if (sides < 2 || sides > 1000) {
      throw new Error('Number of sides must be between 2 and 1000');
    }

    const rolls = this.rollDice(sides, count);
    const result = this.formatRollResult(rolls, sides);

    console.error(`Rolled ${count}d${sides}: ${rolls}`);

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result}`
        }
      ]
    };
  }

  private async rollPercentile() {
    console.error('Rolling percentile dice');

    const tens = Math.floor(Math.random() * 10) * 10;
    const ones = Math.floor(Math.random() * 10);
    const result = tens + ones;

    const formattedResult = result.toString().padStart(2, '0');

    console.error(`Rolled percentile: ${formattedResult}`);

    return {
      content: [
        {
          type: 'text',
          text: `✅ 🎲 Percentile Roll: **${formattedResult}%** (Tens: ${tens / 10}, Ones: ${ones})`
        }
      ]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Dice Rolling MCP server running on stdio');
  }
}

// Start the server
const server = new DiceServer();
server.run().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
