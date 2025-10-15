# Old School RuneScape MCP Server

An MCP (Model Context Protocol) server for accessing Old School RuneScape's Grand Exchange and player highscore data.

## Features

This server provides tools to:
- Look up Grand Exchange item categories and item counts by letter
- Get detailed item information including prices and trends
- Search for items by category, starting letter, and page
- Retrieve price history graphs for the past 180 days
- Look up player highscores and stats

## Installation

```bash
npm install
npm run build
```

## Usage

### Running the Server

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Available Tools

### `ge_category`
Get Grand Exchange category information showing the number of items by first letter.

**Parameters:**
- `category` (number, optional): Category ID (use 1 for OSRS, default: 1)

**Example:**
```json
{
  "category": 1
}
```

### `ge_item_detail`
Get detailed information about a specific Grand Exchange item including current price, trends, and historical data.

**Parameters:**
- `item_id` (number, required): The item ID to look up

**Example:**
```json
{
  "item_id": 21787
}
```

### `ge_items_search`
Search for items in the Grand Exchange by category, starting letter, and page. Returns up to 12 items per page.

**Parameters:**
- `category` (number, optional): Category ID (use 1 for OSRS, default: 1)
- `alpha` (string, required): Starting letter for items (a-z, or '%23' for numbers)
- `page` (number, optional): Page number (starts at 1, default: 1)

**Example:**
```json
{
  "category": 1,
  "alpha": "d",
  "page": 1
}
```

### `ge_price_graph`
Get price history graph data for an item over the past 180 days. Returns daily prices and 30-day moving averages.

**Parameters:**
- `item_id` (number, required): The item ID to get price history for

**Example:**
```json
{
  "item_id": 21787
}
```

### `player_highscore`
Get Old School RuneScape highscore data for a specific player including all skill levels and activity scores.

**Parameters:**
- `player_name` (string, required): The player's display name (case-insensitive)

**Example:**
```json
{
  "player_name": "your_player_name"
}
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "runescape-lookup": {
      "command": "node",
      "args": ["PATH_TO_YOUR_SERVER/src/server.ts"]
    }
  }
}
```

### VS Code MCP

Add to your VS Code MCP settings:

```json
{
  "servers": {
    "runescape-lookup": {
      "command": "node",
      "args": ["PATH_TO_YOUR_SERVER/src/server.ts"]
    }
  }
}
```

## API Endpoints Used

This server uses the following Old School RuneScape API endpoints:

- **Grand Exchange Category:** `https://services.runescape.com/m=itemdb_oldschool/api/catalogue/category.json?category=X`
- **Item Detail:** `https://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=X`
- **Items Search:** `https://services.runescape.com/m=itemdb_oldschool/api/catalogue/items.json?category=X&alpha=Y&page=Z`
- **Price Graph:** `https://services.runescape.com/m=itemdb_oldschool/api/graph/X.json`
- **Player Highscores:** `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=X`

## License

MIT
