# Bot.Generals.io Socket.IO API Documentation

*Reverse-engineered from existing bot implementations*

## Overview

The bot.generals.io API uses Socket.IO for real-time communication between bots and the game server. This documentation covers the complete API based on analysis of working bot implementations.

## Connection

```javascript
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');
```

## Authentication & Setup

### Set Username
```javascript
socket.emit('set_username', user_id, username);
```
- `user_id`: Unique identifier for your bot (keep this secret!)
- `username`: Display name for your bot
- **Important**: Only call this once per connection

## Game Modes

### Join Custom/Private Game
```javascript
socket.emit('join_private', custom_game_id, user_id);
socket.emit('set_force_start', custom_game_id, true);
```
- `custom_game_id`: Your custom game identifier
- Useful for testing and development
- Game URL: `http://bot.generals.io/games/${encodeURIComponent(custom_game_id)}`

### Join 1v1 Queue
```javascript
socket.emit('join_1v1', user_id);
```

### Join FFA (Free For All) Queue
```javascript
socket.emit('play', user_id);
```

### Join Team Game
```javascript
socket.emit('join_team', 'team_name', user_id);
```

## Game Events

### Connection Events
```javascript
socket.on('connect', function() {
    console.log('Connected to server.');
});

socket.on('disconnect', function() {
    console.error('Disconnected from server.');
});
```

### Game Start
```javascript
socket.on('game_start', function(data) {
    // data.playerIndex - Your player index in the game
    // data.replay_id - ID for replay URL
    const replay_url = `http://bot.generals.io/replays/${encodeURIComponent(data.replay_id)}`;
});
```

### Game Updates
```javascript
socket.on('game_update', function(data) {
    // data.cities_diff - Differential update for cities
    // data.map_diff - Differential update for map
    // data.generals - Array of general positions
});
```

### Game End Events
```javascript
socket.on('game_won', function() {
    // You won the game
});

socket.on('game_lost', function() {
    // You lost the game
});
```

## Game Actions

### Attack/Move
```javascript
socket.emit('attack', startIndex, endIndex);
```
- `startIndex`: Starting tile index (1D array index)
- `endIndex`: Target tile index (1D array index)

### Leave Game
```javascript
socket.emit('leave_game');
```

## Map Data Structure

The game map is represented as a 1D array with the following structure:

```javascript
// After patching diffs:
const width = map[0];
const height = map[1];
const size = width * height;

// Army values for each tile
const armies = map.slice(2, size + 2);

// Terrain values for each tile  
const terrain = map.slice(size + 2, size + 2 + size);
```

### Terrain Constants
```javascript
const TILE_EMPTY = -1;        // Empty/neutral tile
const TILE_MOUNTAIN = -2;     // Impassable mountain
const TILE_FOG = -3;          // Fog of war
const TILE_FOG_OBSTACLE = -4; // Cities/Mountains in fog
```

### Tile Ownership
- Non-negative values indicate player ownership
- `terrain[index] === playerIndex` means you own that tile
- `terrain[index] === 0` means player 0 owns that tile, etc.

## Coordinate System

Convert between 1D array index and 2D coordinates:

```javascript
// Index to coordinates
const row = Math.floor(index / width);
const col = index % width;

// Coordinates to index
const index = row * width + col;

// Adjacent tiles
const leftIndex = index - 1;      // if col > 0
const rightIndex = index + 1;     // if col < width - 1  
const upIndex = index - width;    // if row > 0
const downIndex = index + width;  // if row < height - 1
```

## Differential Updates

The API uses differential updates to efficiently transmit map changes:

```javascript
function patch(old, diff) {
    const out = [];
    let i = 0;
    while (i < diff.length) {
        if (diff[i]) {  // matching elements
            Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
        }
        i++;
        if (i < diff.length && diff[i]) {  // mismatching elements
            Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
            i += diff[i];
        }
        i++;
    }
    return out;
}

// Apply updates
cities = patch(cities, data.cities_diff);
map = patch(map, data.map_diff);
```

## Game State Variables

```javascript
let playerIndex;  // Your player index (0, 1, 2, etc.)
let generals;     // Array of general positions we can see
let cities = [];  // Array of city positions we can see  
let map = [];     // Current map state
```

## Best Practices

1. **Secure your user_id**: Never expose it in public code
2. **Use environment variables**: `const user_id = process.env.BOT_USER_ID;`
3. **Handle disconnections**: Implement reconnection logic
4. **Validate moves**: Check tile ownership before attacking
5. **Avoid attacking cities**: They're heavily defended
6. **Test in custom games**: Use private games for development

## Example Bot Structure

```javascript
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

// Game state
let playerIndex;
let generals = [];
let cities = [];
let map = [];

// Connection handling
socket.on('connect', () => {
    const user_id = process.env.BOT_USER_ID;
    const username = 'My Bot';
    
    socket.emit('set_username', user_id, username);
    socket.emit('join_1v1', user_id);
});

// Game events
socket.on('game_start', (data) => {
    playerIndex = data.playerIndex;
    console.log(`Game started! Player index: ${playerIndex}`);
});

socket.on('game_update', (data) => {
    // Update game state
    cities = patch(cities, data.cities_diff);
    map = patch(map, data.map_diff);
    generals = data.generals;
    
    // Make your move
    makeMove();
});

function makeMove() {
    // Your bot logic here
    const move = calculateBestMove();
    if (move) {
        socket.emit('attack', move.start, move.end);
    }
}
```

## Dependencies

```json
{
  "dependencies": {
    "socket.io-client": "^1.7.2"
  }
}
```

## Server Endpoints

- **Bot WebSocket**: `http://botws.generals.io`
- **Game URLs**: `http://bot.generals.io/games/{game_id}`
- **Replay URLs**: `http://bot.generals.io/replays/{replay_id}`

---

*This documentation was reverse-engineered from existing bot implementations. The official API may have additional features not covered here.*
