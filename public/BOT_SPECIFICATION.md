# Fog of War - Bot Developer Specification

## Overview

This document specifies the WebSocket-based protocol for creating bots that can play Fog of War alongside human players. Bots connect to the game server, receive game state updates, and send move commands through a real-time WebSocket connection.

**Live Game:** https://fog-of-war-c771d20fa90e.herokuapp.com/

**GitHub:** https://github.com/Sirrine-Jonathan/fog-of-war

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connection Protocol](#connection-protocol)
3. [Game State](#game-state)
4. [Message Types](#message-types)
5. [Bot Actions](#bot-actions)
6. [Game Rules](#game-rules)
7. [Example Implementations](#example-implementations)
8. [Testing Your Bot](#testing-your-bot)

---

## Getting Started

### Prerequisites

- WebSocket client library for your language
- JSON parsing capability
- Basic pathfinding knowledge (optional, for advanced strategies)

### Quick Start

1. Connect to: `wss://fog-of-war-c771d20fa90e.herokuapp.com` (or `ws://localhost:3000` for local development)
2. Send a `joinAsBot` message with your bot name
3. Listen for `gameState` messages
4. Send `move` commands on your turn
5. Handle game events and adapt your strategy

---

## Connection Protocol

### WebSocket Connection

```javascript
// Example connection (JavaScript)
const ws = new WebSocket("wss://fog-of-war-c771d20fa90e.herokuapp.com");

ws.onopen = () => {
  // Connection established
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle message
};

ws.onerror = (error) => {
  // Handle error
};

ws.onclose = () => {
  // Handle disconnection
};
```

### Joining as a Bot

After connecting, send a join message:

```json
{
  "type": "joinAsBot",
  "playerName": "MyBot"
}
```

**Response:**

```json
{
  "type": "playerJoined",
  "playerName": "MyBot",
  "isBot": true,
  "playerIndex": 1
}
```

---

## Game State

### Game State Message

The server sends `gameState` messages on every update:

```json
{
  "type": "gameState",
  "gameState": {
    "width": 20,
    "height": 20,
    "terrain": [0, 0, 1, -1, ...],
    "armies": [1, 2, 5, 0, ...],
    "cities": [45, 78, 123],
    "capitals": [12, 287],
    "lookoutTowers": [156, 234],
    "turn": 42,
    "alivePlayers": [0, 1, 2]
  },
  "playerIndex": 1
}
```

### Field Descriptions

#### width / height

Map dimensions. Tiles are indexed as: `index = row * width + col`

#### terrain

1D array representing tile ownership:

- `-1`: Mountain (impassable)
- `-2`: Fog of war (unknown)
- `-3`: Empty/neutral territory
- `-4`: Neutral city
- `-5`: Neutral lookout tower
- `0-7`: Owned by player index

#### armies

1D array of army counts on each tile:

- `0`: No armies (or unknown due to fog of war)
- `1+`: Number of armies on tile

#### cities

Array of tile indices representing city locations. Cities generate 1 army per turn.

#### capitals

Array of tile indices for each player's capital. Index matches player index.

- Capturing an enemy capital eliminates that player
- Losing your capital eliminates you

#### lookoutTowers

Array of tile indices for lookout towers. Provide extended vision radius.

#### turn

Current turn number. Players move simultaneously each turn.

#### alivePlayers

Array of player indices still in the game.

---

## Message Types

### Incoming Messages (Server → Bot)

#### gameState

```json
{
  "type": "gameState",
  "gameState": { ... },
  "playerIndex": 1
}
```

Sent every turn with updated game state.

#### gameOver

```json
{
  "type": "gameOver",
  "winner": 0,
  "winnerName": "PlayerName"
}
```

Sent when game ends. Disconnect after receiving this.

#### playerJoined

```json
{
  "type": "playerJoined",
  "playerName": "SomePlayer",
  "playerIndex": 2,
  "isBot": false
}
```

Notification when a player joins.

#### playerLeft

```json
{
  "type": "playerLeft",
  "playerName": "SomePlayer",
  "playerIndex": 2
}
```

Notification when a player leaves.

#### chatMessage

```json
{
  "type": "chatMessage",
  "sender": "PlayerName",
  "message": "Hello!",
  "timestamp": 1234567890
}
```

Chat message from another player (optional to handle).

#### error

```json
{
  "type": "error",
  "message": "Invalid move: source tile not owned"
}
```

Error message for invalid actions.

---

## Bot Actions

### Move Command

Send moves on your turn:

```json
{
  "type": "move",
  "from": 45,
  "to": 46
}
```

**Rules:**

- `from` must be a tile you own
- `from` must have at least 2 armies (1 stays behind)
- `to` must be adjacent (horizontally or vertically)
- `to` cannot be a mountain
- Move is processed at end of turn

**Adjacent Tiles:**

```javascript
function getAdjacentTiles(index, width, height) {
  const row = Math.floor(index / width);
  const col = index % width;
  const adjacent = [];

  // Up
  if (row > 0) adjacent.push(index - width);
  // Down
  if (row < height - 1) adjacent.push(index + width);
  // Left
  if (col > 0) adjacent.push(index - 1);
  // Right
  if (col < width - 1) adjacent.push(index + 1);

  return adjacent;
}
```

### Chat (Optional)

Send chat messages:

```json
{
  "type": "chat",
  "message": "Good game!"
}
```

---

## Game Rules

### Turn System

- All players move simultaneously each turn
- Moves are queued and resolved at turn end
- Turn duration: ~500ms (configurable by host)

### Army Generation

- Capitals generate 1 army per turn
- Cities generate 1 army per turn
- Every 25 turns: all owned tiles receive +1 army

### Combat

When moving to an enemy tile:

- **Attacker wins:** Enemy armies reduced by attacker army count
- **Defender wins:** Attacker armies reduced by defender count
- If armies equal, both reduced to 0 (defender keeps tile)

### Vision

Players can see:

- All tiles they own
- All tiles adjacent to owned tiles
- Extended radius around lookout towers
- Previously discovered tiles remain visible (but may have outdated info)

### Winning Conditions

Last player with their capital alive wins. A player is eliminated when:

- Their capital is captured
- They surrender/disconnect

### Special Tiles

**Cities (`-4` when neutral):**

- Produce 1 army per turn when captured
- Provide strategic production advantage
- Visible to all players when discovered

**Lookout Towers (`-5` when neutral):**

- Provide extended vision radius
- Don't produce armies
- Strategic for map control

**Capitals (indices in `capitals` array):**

- Player's capital
- Produce 1 army per turn
- Losing it eliminates the player
- Priority target for opponents

---

## Example Implementations

### Basic Bot (JavaScript/Node.js)

```javascript
const WebSocket = require("ws");

class BasicBot {
  constructor(name, url) {
    this.name = name;
    this.ws = new WebSocket(url);
    this.playerIndex = -1;
    this.gameState = null;

    this.ws.on("open", () => this.onConnect());
    this.ws.on("message", (data) => this.onMessage(data));
    this.ws.on("error", (error) => console.error("Error:", error));
  }

  onConnect() {
    this.send({ type: "joinAsBot", playerName: this.name });
  }

  onMessage(data) {
    const message = JSON.parse(data);

    switch (message.type) {
      case "playerJoined":
        if (message.playerName === this.name) {
          this.playerIndex = message.playerIndex;
          console.log(`Joined as player ${this.playerIndex}`);
        }
        break;

      case "gameState":
        this.gameState = message.gameState;
        this.playerIndex = message.playerIndex;
        this.makeMove();
        break;

      case "gameOver":
        console.log(`Game over! Winner: ${message.winnerName}`);
        this.ws.close();
        break;
    }
  }

  makeMove() {
    const { terrain, armies, width, height } = this.gameState;

    // Find all owned tiles with 2+ armies
    const movableTiles = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.playerIndex && armies[i] >= 2) {
        movableTiles.push(i);
      }
    }

    if (movableTiles.length === 0) return;

    // Pick random tile
    const from = movableTiles[Math.floor(Math.random() * movableTiles.length)];

    // Get adjacent tiles
    const adjacent = this.getAdjacent(from, width, height);

    // Filter valid targets (not mountains, preferably expand territory)
    const validMoves = adjacent.filter((to) => {
      return terrain[to] !== -1 && terrain[to] !== this.playerIndex;
    });

    if (validMoves.length === 0) return;

    // Pick random move
    const to = validMoves[Math.floor(Math.random() * validMoves.length)];

    this.send({ type: "move", from, to });
  }

  getAdjacent(index, width, height) {
    const row = Math.floor(index / width);
    const col = index % width;
    const adjacent = [];

    if (row > 0) adjacent.push(index - width);
    if (row < height - 1) adjacent.push(index + width);
    if (col > 0) adjacent.push(index - 1);
    if (col < width - 1) adjacent.push(index + 1);

    return adjacent;
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }
}

// Create and run bot
const bot = new BasicBot(
  "RandomBot",
  "wss://fog-of-war-c771d20fa90e.herokuapp.com"
);
```

### Strategy Tips

**Expansion Phase:**

- Prioritize capturing neutral cities early
- Expand territory to increase army generation
- Avoid unnecessary combat initially

**Mid Game:**

- Defend captured cities
- Look for weak enemy territories
- Maintain army reserves

**Late Game:**

- Locate enemy capital
- Mass armies for capital assault
- Defend your own capital

### Advanced Strategies

**Pathfinding:**

```javascript
// A* pathfinding to locate and attack enemy capital
function findPathToCapital(gameState, playerIndex) {
  const enemyCapitals = gameState.capitals.filter(
    (_, i) => i !== playerIndex && gameState.alivePlayers.includes(i)
  );

  // Implement A* to find path to closest enemy capital
  // Consider: terrain ownership, army counts, fog of war
}
```

**Army Management:**

```javascript
// Consolidate armies for stronger attacks
function consolidateArmies(gameState, playerIndex) {
  // Move armies from border tiles toward front lines
  // Leave minimum defense (2-3 armies) on each tile
}
```

**Vision Control:**

```javascript
// Prioritize capturing lookout towers for map awareness
function prioritizeTowers(gameState, playerIndex) {
  const towers = gameState.lookoutTowers;
  const neutralTowers = towers.filter((t) => gameState.terrain[t] === -5);
  // Plan attacks toward neutral towers
}
```

---

## Testing Your Bot

### Local Testing

1. Clone repository:

```bash
git clone https://github.com/Sirrine-Jonathan/fog-of-war.git
cd fog-of-war
npm install
```

2. Start server:

```bash
npm run dev
```

3. Connect bot to `ws://localhost:3000`

4. Open browser to `http://localhost:3000` to watch game

### Production Testing

1. Connect bot to `wss://fog-of-war-c771d20fa90e.herokuapp.com`
2. Create or join game room
3. Invite other bots or play against yourself
4. Monitor performance and adjust strategy

### Debugging

**View Game State:**

```javascript
console.log(JSON.stringify(gameState, null, 2));
```

**Track Moves:**

```javascript
console.log(`Moving from ${from} to ${to}`);
console.log(`Armies: ${armies[from]} -> ${armies[to]}`);
```

**Monitor Errors:**

```javascript
ws.on("message", (data) => {
  const msg = JSON.parse(data);
  if (msg.type === "error") {
    console.error("Server error:", msg.message);
  }
});
```

---

## Built-in Bot Examples

The server includes three example bots you can study:

### BlobBot

- **Strategy:** Expands like a blob, prioritizing adjacency
- **Location:** `src/bots/BlobBot.ts`
- **Difficulty:** Easy

### ArrowBot

- **Strategy:** Focuses expansion in one direction
- **Location:** `src/bots/ArrowBot.ts`
- **Difficulty:** Easy-Medium

### SpiralBot

- **Strategy:** Expands in a spiral pattern from capital
- **Location:** `src/bots/SpiralBot.ts`
- **Difficulty:** Medium

Study these implementations for inspiration!

---

## FAQ

### How do I handle fog of war?

Tiles in fog are marked as `-2` in terrain array. Army counts may be outdated for discovered tiles outside your vision. Make educated guesses based on last known state.

### Can I make multiple moves per turn?

No. One move command per turn. Plan ahead and prioritize your most important move.

### What happens if my move is invalid?

You'll receive an error message and lose that turn's move opportunity. Validate moves before sending.

### How do I find my capital?

Your capital is at `capitals[playerIndex]` where `playerIndex` is your player number.

### Can bots chat?

Yes! Send chat messages with `{ type: "chat", message: "text" }`. Great for taunting opponents or debugging.

### How do I know when it's my turn?

You don't need to know. Send one move command per `gameState` message received. The server queues moves and processes them when the turn ends.

### What if I disconnect?

Your bot will be removed from the game. Implement reconnection logic if needed for production bots.

---

## Support

- **GitHub Issues:** https://github.com/Sirrine-Jonathan/fog-of-war/issues
- **Discussions:** https://github.com/Sirrine-Jonathan/fog-of-war/discussions

---

## License

MIT License - Feel free to create and share your bots!

---

**Happy botting! May your algorithms be efficient and your capitals well-defended! **
