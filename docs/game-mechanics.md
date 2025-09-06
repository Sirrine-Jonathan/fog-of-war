# Generals.io Game Mechanics

*Understanding the game rules and mechanics for bot development*

## Game Overview

Generals.io is a real-time strategy game where players control armies on a grid-based map. The goal is to capture the enemy general while protecting your own.

## Core Concepts

### Tiles and Terrain

- **Empty Tiles** (`-1`): Neutral territory that can be captured
- **Mountains** (`-2`): Impassable obstacles
- **Fog of War** (`-3`): Unexplored areas
- **Fog Obstacles** (`-4`): Mountains/cities visible through fog
- **Player Tiles** (`0, 1, 2, ...`): Owned by respective players

### Army Mechanics

- Each tile has an army count (stored in `armies` array)
- Armies grow automatically on owned tiles every turn
- **Cities** generate 1 army per turn
- **Generals** generate 1 army per turn
- **Regular tiles** generate 1 army every 25 turns

### Movement and Combat

- Move armies from one tile to an adjacent tile
- Can only move from tiles you own
- Must leave at least 1 army on the source tile
- When attacking:
  - If target is neutral: capture if you have more armies
  - If target is enemy: reduce their armies by your attack force
  - If you have more armies than they have remaining, capture the tile

## Game Flow

### Turn Structure
1. Receive `game_update` event with current state
2. Process map changes using differential updates
3. Calculate and execute your move
4. Send `attack` command to server

### Victory Conditions
- Capture the enemy general
- Eliminate all enemy armies (rare)

### Defeat Conditions
- Your general is captured
- You have no armies remaining

## Strategic Elements

### Early Game
- Expand territory to increase army generation
- Locate enemy positions through exploration
- Secure cities for additional army production

### Mid Game
- Build up army concentrations
- Control key strategic positions
- Prepare for assault on enemy territory

### Late Game
- Execute coordinated attacks
- Protect your general while hunting enemy general
- Manage army distribution efficiently

## Map Analysis

### Important Positions
```javascript
// Find your general
const myGeneralIndex = generals[playerIndex];

// Find enemy generals (if visible)
const enemyGenerals = generals.filter((pos, idx) => 
    idx !== playerIndex && pos !== -1
);

// Identify cities
const visibleCities = cities.filter(cityIndex => 
    terrain[cityIndex] !== TILE_FOG
);
```

### Territory Analysis
```javascript
// Count your tiles and armies
let myTiles = 0;
let myArmies = 0;
let enemyTiles = 0;
let enemyArmies = 0;

for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === playerIndex) {
        myTiles++;
        myArmies += armies[i];
    } else if (terrain[i] >= 0 && terrain[i] !== playerIndex) {
        enemyTiles++;
        enemyArmies += armies[i];
    }
}
```

### Pathfinding Considerations
- Mountains block movement
- Enemy tiles require combat to pass through
- Fog of war hides enemy positions
- Consider army strength when planning routes

## Combat Calculations

### Attack Outcomes
```javascript
function simulateAttack(attackerArmies, defenderArmies, defenderOwned) {
    const attackForce = attackerArmies - 1; // Must leave 1 behind
    
    if (!defenderOwned) {
        // Attacking neutral/empty tile
        return attackForce > defenderArmies;
    } else {
        // Attacking enemy tile
        const remaining = defenderArmies - attackForce;
        return remaining <= 0;
    }
}
```

### Army Management
- Always leave 1 army on source tile
- Consider army generation rates
- Plan multi-turn attacks for heavily defended positions

## Advanced Mechanics

### Differential Updates
The game uses efficient delta compression:
- Only changed tiles are transmitted
- Patch function reconstructs full state
- Reduces bandwidth and improves performance

### Fog of War
- Only see tiles adjacent to your territory
- Enemy movements in fog are hidden
- Plan for unknown enemy positions

### Turn Timing
- Games run at approximately 2 moves per second
- Quick decision making is crucial
- Pre-calculate common scenarios

## Bot Strategy Framework

### Decision Making Process
1. **Assess Situation**: Analyze current map state
2. **Identify Threats**: Find immediate dangers
3. **Find Opportunities**: Locate expansion/attack targets  
4. **Plan Movement**: Calculate optimal moves
5. **Execute**: Send attack command

### Common Patterns
```javascript
// Expansion priority
function findExpansionTargets() {
    return neutralTiles
        .filter(tile => isAdjacent(tile, myTerritory))
        .sort((a, b) => armies[a] - armies[b]); // Easiest first
}

// Defensive moves
function findThreats() {
    return myBorderTiles
        .filter(tile => hasEnemyNeighbor(tile))
        .filter(tile => isOutnumbered(tile));
}

// Offensive opportunities  
function findAttackTargets() {
    return enemyTiles
        .filter(tile => isAdjacent(tile, myTerritory))
        .filter(tile => canDefeat(tile));
}
```

## Performance Considerations

- Minimize computation time per turn
- Cache expensive calculations
- Use efficient data structures
- Profile your bot's performance

## Testing and Development

### Custom Games
- Use private games for testing
- Test against known opponents
- Iterate on strategy quickly

### Debugging
- Log game state and decisions
- Analyze replays for improvement opportunities
- Track win/loss statistics

### Common Pitfalls
- Attacking cities (heavily defended)
- Leaving general undefended
- Poor army distribution
- Ignoring fog of war threats

---

*This guide covers the fundamental mechanics needed to build effective generals.io bots.*
