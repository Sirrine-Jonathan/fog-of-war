# Perfect Bot Algorithm for Fog of War

## Executive Summary

This algorithm combines optimal expansion economics, intelligent pathfinding, and adaptive target prioritization to create a near-perfect bot. It builds on lessons from BlobBot (aggressive expansion), ArrowBot (systematic exploration), and SpiralBot (phased approach), while introducing sophisticated decision-making and efficiency optimizations.

## Core Philosophy

**"Maximize territory before turn 25, consolidate intelligently, then strike decisively"**

The perfect bot exploits the fundamental game economics:

- Every tile generates +1 army at turn 25 (and every 25 turns after)
- Generals and cities generate +1 army per turn continuously
- Vision enables strategic decision-making
- Army consolidation beats dispersed forces in combat

## Algorithm Phases

### Phase 1: Explosive Expansion (Turns 1-25)

**Objective**: Capture the maximum number of tiles with minimum army commitment

**Strategy**:

1. **Directional Priority Expansion**
   - Start with general's immediate adjacencies (N, E, S, W)
   - Then expand to diagonals using A\* pathfinding
   - Continue expanding in a "flood fill" pattern prioritizing:
     - Empty tiles with most unexplored neighbors
     - Paths toward map center (resources typically spawn centrally)
     - Avoiding mountain-heavy regions
2. **Resource Awareness**

   - If a CITY (40 armies) is discovered and reachable: IGNORE initially
   - If a TOWER (25 defense) is discovered and reachable: IGNORE initially
   - Rationale: Capturing these before turn 25 consumes armies that could claim 40+ tiles instead
   - Exception: If city/tower is <5 armies away from general by turn 20, consider early capture

3. **Army Management**

   - Keep ALL conquered tiles at exactly 1 army (spread thin)
   - Never stack armies in phase 1 (except on general naturally)
   - Every army used for stacking = one less tile captured

4. **Pathfinding Algorithm**

   ```
   For each tile with >1 army:
     - Calculate "expansion value" for all reachable empty tiles:
       value = (unexplored_neighbors * 3) + (distance_to_center * -0.5) + (has_fog_beyond * 5)
     - Move to highest value tile not already targeted
     - Avoid moves that would create loops
   ```

5. **Expected Outcome**: 60-100 tiles captured by turn 25 (versus ~30-40 for typical bots)

### Phase 2: Intelligent Consolidation (Turns 26-50)

**Objective**: Build strike forces at optimal positions while maintaining map control

**Strategy**:

1. **Target Identification**
   - Scan visible map for high-value targets:
     - Enemy generals (if discovered): Priority 10
     - Neutral cities: Priority 8
     - Neutral towers: Priority 7
     - Enemy cities: Priority 9
     - Enemy territory (weak): Priority 5
2. **Strike Force Assembly**
   - Calculate optimal "rally point" closest to highest priority target
   - Use reverse pathfinding: map paths from all owned tiles to rally point
   - Move armies along shortest paths toward rally point
   - Target army threshold: 2x the target's defense + 10 buffer
3. **Opportunistic Captures**
   - If passing a city/tower during consolidation: capture if armies sufficient
   - Don't detour significantly; stay focused on primary target
4. **Defensive Posture**

   - Keep minimum 5 armies on general at all times
   - If enemy discovered near general: redirect armies for defense

5. **Multi-Target Strategy**

   - If multiple high-value targets exist: create 2-3 smaller strike forces
   - Each force targets different objective
   - Balance between speed and force strength

6. **Vision Expansion**
   - Captured towers reveal large areas
   - Use tower vision to locate enemy generals
   - Update target priorities based on discoveries

### Phase 3: Adaptive Conquest (Turns 51+)

**Objective**: Systematically eliminate opponents while protecting general

**Strategy**:

1. **Dynamic Target Scoring System**

   ```javascript
   function scoreTarget(target) {
     let score = 0;

     // Target type value
     if (isEnemyGeneral(target)) score += 1000;
     if (isCity(target)) score += 100;
     if (isTower(target)) score += 80;
     if (isEnemyTerritory(target)) score += 50;

     // Distance penalty (closer = better)
     score -= manhattanDistance(closestOwnedTile, target) * 2;

     // Army requirement penalty
     const armiesNeeded = target.armies + 1;
     const armiesAvailable = getTotalAvailableArmies();
     if (armiesNeeded > armiesAvailable * 0.8) score -= 200;

     // Strategic value
     if (target.controlsKeyPassage) score += 50;
     if (target.threatsOurGeneral) score += 150;

     return score;
   }
   ```

2. **Attack Execution**
   - Use intent-style pathfinding for multi-turn attacks
   - Calculate optimal path avoiding unnecessary army loss
   - If path blocked by stronger enemy: find alternate route or different target
3. **Army Flow Management**

   - Continuously move armies from rear to front lines
   - Maintain "supply lines" of tiles connecting general to battle fronts
   - Never leave general with <5 armies unless emergency attack

4. **Threat Response**

   - Detect enemy movements toward our territory
   - If enemy force > our defensive capability: redirect nearest armies
   - Counter-attack only if we can win decisively

5. **Fog Exploitation**

   - Use towers and scouting moves to expand vision
   - Track last known enemy positions
   - Anticipate enemy general locations based on territorial patterns

6. **Endgame Efficiency**
   - As opponents are eliminated, accelerate expansion
   - Capture all remaining cities for maximum army generation
   - Push for complete map control

## Advanced Tactics

### Pathfinding Optimization

**A\* Algorithm for Efficient Movement**:

```javascript
function findOptimalPath(start, goal, gameState) {
  const openSet = new PriorityQueue();
  const cameFrom = new Map();
  const gScore = new Map(); // actual cost from start
  const fScore = new Map(); // estimated total cost

  gScore.set(start, 0);
  fScore.set(start, heuristic(start, goal));
  openSet.enqueue(start, fScore.get(start));

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();

    if (current === goal) {
      return reconstructPath(cameFrom, current);
    }

    for (const neighbor of getAdjacentTiles(current)) {
      // Skip mountains and enemy tiles (except goal)
      if (isImpassable(neighbor, gameState) && neighbor !== goal) continue;

      const tentativeGScore = gScore.get(current) + 1;

      if (!gScore.has(neighbor) || tentativeGScore < gScore.get(neighbor)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, tentativeGScore + heuristic(neighbor, goal));
        openSet.enqueue(neighbor, fScore.get(neighbor));
      }
    }
  }

  return null; // no path found
}
```

### Loop Prevention

**Sophisticated Loop Detection**:

```javascript
class MoveHistory {
  constructor() {
    this.recentMoves = []; // last 10 moves
    this.positionFrequency = new Map(); // tile -> frequency
  }

  wouldCreateLoop(from, to) {
    // Immediate reversal
    const lastMove = this.recentMoves[this.recentMoves.length - 1];
    if (lastMove && lastMove.from === to && lastMove.to === from) {
      return true;
    }

    // Position oscillation (moving between same 2-3 positions)
    const posKey = `${from}-${to}`;
    const frequency = this.positionFrequency.get(posKey) || 0;
    if (frequency > 2) return true; // moved this path 3+ times recently

    return false;
  }

  recordMove(from, to) {
    this.recentMoves.push({ from, to, turn: currentTurn });
    if (this.recentMoves.length > 10) this.recentMoves.shift();

    const posKey = `${from}-${to}`;
    this.positionFrequency.set(
      posKey,
      (this.positionFrequency.get(posKey) || 0) + 1
    );

    // Clear old frequency data
    if (this.recentMoves.length === 10) {
      const oldMove = this.recentMoves[0];
      const oldKey = `${oldMove.from}-${oldMove.to}`;
      const count = this.positionFrequency.get(oldKey) - 1;
      if (count <= 0) {
        this.positionFrequency.delete(oldKey);
      } else {
        this.positionFrequency.set(oldKey, count);
      }
    }
  }
}
```

### Threat Detection

**Identify Incoming Attacks**:

```javascript
function detectThreats(gameState) {
  const threats = [];
  const ourGeneral = gameState.generals[gameState.playerIndex];

  // Scan for enemy tiles with high army counts near our territory
  for (let i = 0; i < gameState.terrain.length; i++) {
    if (
      gameState.terrain[i] >= 0 &&
      gameState.terrain[i] !== gameState.playerIndex
    ) {
      const enemyArmies = gameState.armies[i];
      if (enemyArmies <= 5) continue; // not a real threat

      // Check if this enemy tile is near our general
      const distanceToGeneral = manhattanDistance(
        i,
        ourGeneral,
        gameState.width
      );
      if (distanceToGeneral <= 5) {
        threats.push({
          position: i,
          armies: enemyArmies,
          distance: distanceToGeneral,
          priority: enemyArmies / distanceToGeneral, // closer + stronger = higher priority
        });
      }
    }
  }

  return threats.sort((a, b) => b.priority - a.priority);
}
```

## Key Decision Points

### Should I Capture This City Now?

```javascript
function shouldCaptureCity(cityPosition, currentTurn, gameState) {
  const cityArmies = 40;
  const availableArmies = getStrikeForceSize(cityPosition, gameState);

  // Early game (before turn 25): Usually NO
  if (currentTurn < 25) {
    // Exception: If we can capture with <10 armies and it's on our expansion path
    if (availableArmies > cityArmies + 10 && isOnExpansionPath(cityPosition)) {
      return true;
    }
    return false; // Save armies for more tile captures
  }

  // Mid game (25-50): YES if convenient
  if (currentTurn < 50) {
    return availableArmies > cityArmies + 5;
  }

  // Late game: ALWAYS capture cities when possible
  return availableArmies > cityArmies;
}
```

### Should I Attack This Enemy?

```javascript
function shouldAttackEnemy(enemyPosition, currentTurn, gameState) {
  const enemyArmies = gameState.armies[enemyPosition];
  const ourArmies = getAvailableArmiesNear(enemyPosition, gameState);

  // Can we win decisively?
  if (ourArmies <= enemyArmies + 10) return false; // Need buffer for victory

  // Is this the enemy general?
  if (gameState.generals.includes(enemyPosition)) {
    return ourArmies > enemyArmies + 5; // Lower threshold for general
  }

  // Is this threatening our general?
  const distanceToOurGeneral = manhattanDistance(
    enemyPosition,
    gameState.generals[gameState.playerIndex],
    gameState.width
  );
  if (distanceToOurGeneral <= 3) return true; // Defensive priority

  // Is this a strategic position?
  if (controlsKeyTerritory(enemyPosition, gameState)) return true;

  // Otherwise, only attack if we have overwhelming force
  return ourArmies > enemyArmies * 2;
}
```

## Performance Optimizations

1. **Caching**: Cache pathfinding results for frequently used paths
2. **Incremental Updates**: Don't recalculate entire game state each turn
3. **Early Termination**: Stop searching for paths once a good-enough option is found
4. **Spatial Indexing**: Use quadtrees or grid-based indexing for fast proximity queries
5. **Priority Queues**: Use heap-based priority queues for efficient target selection

## Weaknesses & Counters

**Potential Weaknesses**:

1. **Overextension**: Phase 1 aggressive expansion leaves tiles weakly defended
   - Mitigation: Transition to consolidation immediately upon enemy contact
2. **Predictability**: Spiral/center-seeking patterns could be anticipated
   - Mitigation: Add randomization to expansion directions (within optimal paths)
3. **Tunnel Vision**: Focusing on one target may miss opportunities
   - Mitigation: Re-evaluate targets every 5 turns in Phase 3

**Counter Strategies (How opponents might beat this)**:

- Early aggression: Attack during Phase 1 when we're spread thin
- Defensive play: Let us overextend then counter-attack
- Resource denial: Capture cities/towers before we can reach them

## Expected Performance

Against current bots:

- **vs BlobBot**: 80-90% win rate (superior expansion economics)
- **vs ArrowBot**: 85-95% win rate (better target prioritization)
- **vs SpiralBot**: 70-80% win rate (similar strategy but optimized)

Against perfect play:

- Win rate depends on map generation (structure placement) and spawn positions
- Estimated 50-60% win rate against equally optimal opponent

## Testing Metrics

1. **Territory Control**: Should control 60+ tiles by turn 25
2. **Army Efficiency**: <5% wasted moves (loops, redundant stacking)
3. **Target Acquisition Time**: Locate and attack highest value target within 10 turns of phase transition
4. **General Safety**: General should never fall below 3 armies (except final assault)
5. **City Capture Rate**: Capture 80%+ of cities on map by turn 100

## Conclusion

This algorithm represents a near-optimal strategy for Fog of War by exploiting game economics (turn 25 bonus), maintaining aggressive but intelligent expansion, and adapting to game state dynamically. The key innovation is the phased approach with intelligent transitions, combined with sophisticated pathfinding and threat assessment.

The "perfect" bot isn't about never losing—it's about making optimal decisions given available information and maximizing win probability across diverse scenarios.
