# Fog of War Game Technical Specification

## Overview

Fog of War is a real-time strategy game where players control armies on a grid-based map to capture territory and eliminate opponents. This specification defines the technical implementation for bot developers and game officials.

## Game Constants

```typescript
// Terrain Types
TILE_EMPTY = -1          // Neutral/unclaimed territory
TILE_MOUNTAIN = -2       // Impassable terrain
TILE_FOG = -3           // Hidden from view
TILE_FOG_OBSTACLE = -4  // Hidden obstacle
TILE_LOOKOUT_TOWER = -5 // Defensive structure with vision
TILE_CITY = -6          // High-value capture target

// Player indices: 0, 1, 2, ... (positive integers)
```

## Map Structure

### Dimensions
- Default: 30x30 grid (900 tiles)
- Tiles indexed 0-899 in row-major order
- Position calculation: `row = floor(index / width)`, `col = index % width`

### Map Data Format
```javascript
[width, height, ...armies, ...terrain, ...towerDefense]
```

- **width/height**: Map dimensions
- **armies**: Army count per tile (900 values)
- **terrain**: Tile ownership/type (900 values)
- **towerDefense**: Tower defense values (900 values, 0 for non-towers)

## Game Initialization

### Mountain Placement
- 10% of map tiles become mountains
- No mountains on map edges (first/last row/column)
- Mountains block movement and vision

### Player Spawning
- Generals placed with minimum distances:
  - 2 players: ≥8 tiles apart
  - 3-4 players: ≥6 tiles apart  
  - 5+ players: ≥4 tiles apart
- Generals spawn ≥3 tiles from map edges
- Each general starts with 1 army

### Structure Spawning (Game Start)
- **Cities**: `players.length * 3` cities, ≥8 tiles apart, 40 armies each
- **Towers**: Maximum possible, ≥11 tiles apart, 25 defense each

## Game Mechanics

### Turn System
- 500ms per turn (2 turns/second)
- Turn counter increments each cycle
- All player moves processed simultaneously

### Army Generation
- **Generals**: +1 army every turn
- **Cities**: +1 army every turn  
- **Regular territory**: +1 army every 25 turns

### Movement Rules
- Move from owned tile with >1 army
- Target must be adjacent (4-directional, no diagonals)
- Cannot move to mountains
- All armies except 1 participate in move/attack

### Combat Resolution

#### vs Empty Territory (-1)
```
if (attackingArmies > defendingArmies) {
    capture territory
    remainingArmies = attackingArmies - defendingArmies
} else {
    attack fails, armies lost
}
```

#### vs Enemy Territory (player index ≥ 0)
```
if (attackingArmies > defendingArmies) {
    capture territory
    remainingArmies = attackingArmies - defendingArmies
    if (target was enemy general) {
        eliminate player
        check victory condition
    }
} else {
    attack fails
    defendingArmies = defendingArmies - attackingArmies
}
```

#### vs City (-6)
```
if (attackingArmies > cityArmies) {
    capture city
    remainingArmies = attackingArmies - cityArmies
    emit "captured city" event
} else {
    attack fails
    cityArmies = max(0, cityArmies - attackingArmies)
}
```

#### vs Lookout Tower (-5)
```
if (attackingArmies > towerDefense) {
    capture tower
    remainingArmies = attackingArmies - towerDefense
    towerDefense = 0
    emit "captured tower" event
} else {
    attack fails
    towerDefense = towerDefense - attackingArmies
}
```

### Victory Conditions
- Game ends when only 1 player remains (others eliminated)
- Player eliminated when their general is captured
- Upon elimination:
  - All player territory becomes neutral
  - Army counts halved
  - General position set to -1

## Network Protocol

### Connection
```javascript
const socket = io('server-url');
socket.emit('set_username', userId, username);
socket.emit('join_private', roomId, userId);
```

### Game Events

#### Incoming Events
```javascript
// Game starts
socket.on('game_start', (data) => {
    // data.playerIndex: your player number
});

// Game state updates
socket.on('game_update', (data) => {
    // data.map_diff: differential map update
    // data.cities_diff: differential cities update  
    // data.turn: current turn number
    // data.generals: visible general positions
});

// Game ends
socket.on('game_end', (data) => {
    // data.winner: winning player info
});

// Player list changes
socket.on('players_update', (players) => {
    // Array of player objects
});
```

#### Outgoing Events
```javascript
// Make a move/attack
socket.emit('attack', fromTileIndex, toTileIndex);

// Set force start (host only)
socket.emit('set_force_start', roomId, true);
```

### Differential Updates
Game state transmitted via patches to reduce bandwidth:

```javascript
function patch(oldArray, diffArray) {
    const result = [...oldArray];
    let i = 0;
    while (i < diffArray.length) {
        const index = diffArray[i++];
        const value = diffArray[i++];
        result[index] = value;
    }
    return result;
}
```

## Visibility System

### Fog of War Rules
- Players see only their own territory + adjacent tiles
- Cities provide 2-tile vision radius when owned
- Towers provide 3-tile vision radius when owned
- Discovered tiles remain visible permanently
- Enemy generals visible only when in vision range

### Vision Calculation
```javascript
// Adjacent tiles (4-directional)
function getAdjacentTiles(tileIndex, width, height) {
    const row = Math.floor(tileIndex / width);
    const col = tileIndex % width;
    const adjacent = [];
    
    if (row > 0) adjacent.push((row-1) * width + col);      // up
    if (row < height-1) adjacent.push((row+1) * width + col); // down
    if (col > 0) adjacent.push(row * width + (col-1));      // left
    if (col < width-1) adjacent.push(row * width + (col+1)); // right
    
    return adjacent;
}

// Circular radius for cities/towers
function getTilesInRadius(centerIndex, radius, width, height) {
    const centerRow = Math.floor(centerIndex / width);
    const centerCol = centerIndex % width;
    const tiles = [];
    
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            if (Math.sqrt(dr*dr + dc*dc) <= radius) {
                const row = centerRow + dr;
                const col = centerCol + dc;
                if (row >= 0 && row < height && col >= 0 && col < width) {
                    tiles.push(row * width + col);
                }
            }
        }
    }
    return tiles;
}
```

## Bot Development Guidelines

### Performance Requirements
- Bots must respond to moves within 500ms turn window
- Excessive delays may result in missed turns
- Memory usage should remain reasonable for long games

### Fair Play Rules
- No communication between bots
- No access to hidden game state
- No exploitation of server vulnerabilities
- Bots must use official API only

### Error Handling
- Invalid moves are ignored (no penalty)
- Network disconnections handled gracefully
- Bots should validate all inputs

## Example Bot Implementation

```javascript
const io = require('socket.io-client');

class FogOfWarBot {
    constructor(name, room, serverUrl) {
        this.name = name;
        this.room = room;
        this.socket = io(serverUrl);
        this.playerIndex = -1;
        this.gameMap = [];
        this.cities = [];
        this.generals = [];
        this.setupEventHandlers();
        this.connect();
    }
    
    connect() {
        const userId = `bot_${this.name}_${Date.now()}`;
        this.socket.emit('set_username', userId, this.name);
        this.socket.emit('join_private', this.room, userId);
    }
    
    setupEventHandlers() {
        this.socket.on('game_start', (data) => {
            this.playerIndex = data.playerIndex;
        });
        
        this.socket.on('game_update', (data) => {
            this.updateGameState(data);
            this.makeMove();
        });
    }
    
    updateGameState(data) {
        this.cities = this.patch(this.cities, data.cities_diff);
        this.gameMap = this.patch(this.gameMap, data.map_diff);
        this.generals = data.generals;
    }
    
    makeMove() {
        const { width, height, armies, terrain } = this.parseMap();
        
        // Find tiles with moveable armies
        for (let i = 0; i < terrain.length; i++) {
            if (terrain[i] === this.playerIndex && armies[i] > 1) {
                const targets = this.getAdjacentTiles(i, width, height);
                
                for (const target of targets) {
                    if (this.isValidTarget(target, terrain, armies)) {
                        this.socket.emit('attack', i, target);
                        return;
                    }
                }
            }
        }
    }
    
    isValidTarget(target, terrain, armies) {
        // Expand to empty or attack weaker enemies
        return terrain[target] === -1 || 
               (terrain[target] >= 0 && 
                terrain[target] !== this.playerIndex && 
                armies[target] < armies[this.findSourceTile(target)]);
    }
    
    parseMap() {
        const width = this.gameMap[0];
        const height = this.gameMap[1];
        const size = width * height;
        return {
            width,
            height,
            armies: this.gameMap.slice(2, size + 2),
            terrain: this.gameMap.slice(size + 2, size * 2 + 2),
            towerDefense: this.gameMap.slice(size * 2 + 2, size * 3 + 2)
        };
    }
    
    patch(old, diff) {
        const result = [...old];
        let i = 0;
        while (i < diff.length) {
            const index = diff[i++];
            const value = diff[i++];
            result[index] = value;
        }
        return result;
    }
    
    getAdjacentTiles(index, width, height) {
        const row = Math.floor(index / width);
        const col = index % width;
        const adjacent = [];
        
        if (row > 0) adjacent.push((row-1) * width + col);
        if (row < height-1) adjacent.push((row+1) * width + col);
        if (col > 0) adjacent.push(row * width + (col-1));
        if (col < width-1) adjacent.push(row * width + (col+1));
        
        return adjacent;
    }
}
```

## Testing and Validation

### Unit Test Requirements
- Map initialization validation
- Combat resolution accuracy
- Vision system correctness
- Network protocol compliance

### Integration Testing
- Multi-bot game scenarios
- Network latency handling
- Error recovery mechanisms
- Performance under load

## Appendix

### Distance Calculations
```javascript
// Manhattan distance
function manhattanDistance(pos1, pos2, width) {
    const row1 = Math.floor(pos1 / width);
    const col1 = pos1 % width;
    const row2 = Math.floor(pos2 / width);
    const col2 = pos2 % width;
    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
}

// Chebyshev distance (used for general placement)
function chebyshevDistance(pos1, pos2, width) {
    const row1 = Math.floor(pos1 / width);
    const col1 = pos1 % width;
    const row2 = Math.floor(pos2 / width);
    const col2 = pos2 % width;
    return Math.max(Math.abs(row1 - row2), Math.abs(col1 - col2));
}
```

### Common Pitfalls
1. **Off-by-one errors** in tile indexing
2. **Diagonal movement** attempts (not allowed)
3. **Invalid army counts** (must leave 1 army behind)
4. **Mountain pathfinding** (mountains block movement)
5. **Vision assumptions** (fog of war limits visibility)

---

*This specification is authoritative for tournament play and bot development. Version 1.0 - Generated from game server analysis.*