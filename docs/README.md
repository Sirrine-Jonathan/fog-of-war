# Generals.io Bot Development Documentation

*Comprehensive reverse-engineered documentation for building bots for bot.generals.io*

## Overview

This documentation provides complete information for developing bots for the generals.io game, reverse-engineered from existing bot implementations since the official documentation is currently unavailable.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install socket.io-client
   ```

2. **Basic Bot Template**
   ```javascript
   const io = require('socket.io-client');
   const socket = io('http://botws.generals.io');
   
   socket.on('connect', () => {
       socket.emit('set_username', process.env.BOT_USER_ID, 'My Bot');
       socket.emit('join_1v1', process.env.BOT_USER_ID);
   });
   
   socket.on('game_update', (data) => {
       // Your bot logic here
   });
   ```

3. **Set Environment Variable**
   ```bash
   export BOT_USER_ID="your_unique_bot_id"
   ```

## Documentation Structure

### 📡 [Socket.IO API Reference](./socket-io-api.md)
Complete API documentation covering:
- Connection and authentication
- Game modes (1v1, FFA, custom games)
- Real-time events and data structures
- Map data format and differential updates
- All available commands and responses

### 🎮 [Game Mechanics Guide](./game-mechanics.md)
In-depth game mechanics covering:
- Tile types and terrain system
- Army generation and combat rules
- Victory/defeat conditions
- Strategic concepts and patterns
- Performance optimization tips

## Key Concepts

### Connection Flow
```
1. Connect to http://botws.generals.io
2. Set username with unique user_id
3. Join game mode (1v1, FFA, custom)
4. Receive game_start event
5. Process game_update events
6. Send attack commands
7. Handle game_won/game_lost events
```

### Map Data Structure
The game uses a 1D array format:
- `map[0]` = width
- `map[1]` = height  
- `map[2...size+1]` = army counts
- `map[size+2...end]` = terrain ownership

### Differential Updates
The API uses efficient delta compression to minimize bandwidth:
```javascript
cities = patch(cities, data.cities_diff);
map = patch(map, data.map_diff);
```

## Example Implementations

### Simple Random Bot
```javascript
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

let playerIndex, map = [], cities = [];

socket.on('connect', () => {
    socket.emit('set_username', process.env.BOT_USER_ID, 'Random Bot');
    socket.emit('join_1v1', process.env.BOT_USER_ID);
});

socket.on('game_update', (data) => {
    cities = patch(cities, data.cities_diff);
    map = patch(map, data.map_diff);
    
    const width = map[0];
    const height = map[1];
    const size = width * height;
    const terrain = map.slice(size + 2, size + 2 + size);
    
    // Find random owned tile and make random move
    for (let i = 0; i < 100; i++) {
        const index = Math.floor(Math.random() * size);
        if (terrain[index] === playerIndex) {
            const moves = getValidMoves(index, width, height);
            if (moves.length > 0) {
                const target = moves[Math.floor(Math.random() * moves.length)];
                socket.emit('attack', index, target);
                break;
            }
        }
    }
});
```

### Strategic Expansion Bot
```javascript
// Prioritize expansion and army building
socket.on('game_update', (data) => {
    updateGameState(data);
    
    const move = findBestMove();
    if (move) {
        socket.emit('attack', move.from, move.to);
    }
});

function findBestMove() {
    // 1. Defend against immediate threats
    const defensiveMove = findDefensiveMove();
    if (defensiveMove) return defensiveMove;
    
    // 2. Expand to neutral territory
    const expansionMove = findExpansionMove();
    if (expansionMove) return expansionMove;
    
    // 3. Attack weak enemy positions
    const attackMove = findAttackMove();
    if (attackMove) return attackMove;
    
    return null;
}
```

## Development Tips

### Security
- **Never hardcode your user_id** - use environment variables
- Keep your user_id secret - anyone with it can control your bot
- Use version control safely by excluding sensitive data

### Testing
- Use custom games for development and testing
- Test against known opponents to measure improvement
- Analyze replays to identify weaknesses

### Performance
- Minimize computation time per turn (games run ~2 moves/second)
- Cache expensive calculations between turns
- Use efficient algorithms for pathfinding and analysis

### Debugging
- Log game state and bot decisions
- Track win/loss statistics
- Use replay URLs for post-game analysis

## Common Patterns

### Map Analysis
```javascript
function analyzeMap() {
    const width = map[0];
    const height = map[1];
    const size = width * height;
    const armies = map.slice(2, size + 2);
    const terrain = map.slice(size + 2, size + 2 + size);
    
    return { width, height, size, armies, terrain };
}
```

### Pathfinding
```javascript
function findPath(start, end, terrain, width) {
    // A* or BFS implementation
    // Consider army strength and terrain ownership
}
```

### Threat Assessment
```javascript
function assessThreats() {
    // Identify enemy armies near your territory
    // Calculate relative strength
    // Prioritize defensive actions
}
```

## Resources

### Server Endpoints
- **WebSocket**: `http://botws.generals.io`
- **Game URLs**: `http://bot.generals.io/games/{game_id}`
- **Replays**: `http://bot.generals.io/replays/{replay_id}`

### Dependencies
```json
{
  "dependencies": {
    "socket.io-client": "^1.7.2"
  }
}
```

### Environment Setup
```bash
# Required environment variable
export BOT_USER_ID="your_unique_identifier"

# Optional for development
export NODE_ENV="development"
```

## Contributing

This documentation was reverse-engineered from existing bot implementations. If you discover additional API features or game mechanics, please contribute by:

1. Testing and documenting new findings
2. Providing example implementations
3. Sharing strategic insights
4. Reporting bugs or inaccuracies

## Disclaimer

This documentation is based on reverse engineering existing bot implementations. The official API may have additional features not covered here. Use this information responsibly and in accordance with the generals.io terms of service.

---

*Happy bot building! 🤖*
