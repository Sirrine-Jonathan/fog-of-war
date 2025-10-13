# Perfect Bot Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for creating the optimal Fog of War bot based on the algorithm defined in `best_algorithm.md`. The bot will be named **"OptimalBot"** and will inherit from the `BaseBot` class.

## File Structure

```
src/bots/
├── BaseBot.ts           (existing - no changes)
├── OptimalBot.ts        (NEW - main bot implementation)
├── utils/
│   ├── PathfindingUtil.ts    (NEW - A* pathfinding)
│   ├── TerritoryAnalyzer.ts  (NEW - map analysis)
│   ├── TargetScorer.ts       (NEW - target prioritization)
│   └── MoveHistory.ts        (NEW - loop prevention)
└── index.ts             (update to export OptimalBot)
```

## Implementation Phases

### Phase 1: Core Infrastructure (Priority: HIGH)

**Goal**: Set up the basic bot structure and essential utilities

#### Step 1.1: Create OptimalBot Class

**File**: `src/bots/OptimalBot.ts`

```typescript
import { BaseBot } from "./BaseBot";
import { PathfindingUtil } from "./utils/PathfindingUtil";
import { TerritoryAnalyzer } from "./utils/TerritoryAnalyzer";
import { TargetScorer } from "./utils/TargetScorer";
import { MoveHistory } from "./utils/MoveHistory";

export class OptimalBot extends BaseBot {
  private pathfinder: PathfindingUtil;
  private territoryAnalyzer: TerritoryAnalyzer;
  private targetScorer: TargetScorer;
  private moveHistory: MoveHistory;
  private currentPhase: "expand" | "consolidate" | "conquer";
  private rallyPoint: number | null;
  private primaryTarget: number | null;

  constructor(gameRoom: string, serverUrl: string) {
    super("Optimal", gameRoom, serverUrl);
    this.pathfinder = new PathfindingUtil();
    this.territoryAnalyzer = new TerritoryAnalyzer();
    this.targetScorer = new TargetScorer();
    this.moveHistory = new MoveHistory();
    this.currentPhase = "expand";
    this.rallyPoint = null;
    this.primaryTarget = null;
  }

  makeMove(): void {
    this.updatePhase();

    switch (this.currentPhase) {
      case "expand":
        this.executeExpansionPhase();
        break;
      case "consolidate":
        this.executeConsolidationPhase();
        break;
      case "conquer":
        this.executeConquestPhase();
        break;
    }
  }

  private updatePhase(): void {
    if (this.currentTurn <= 25) {
      this.currentPhase = "expand";
    } else if (this.currentTurn <= 50) {
      this.currentPhase = "consolidate";
    } else {
      this.currentPhase = "conquer";
    }
  }

  private executeExpansionPhase(): void {
    // Implementation in Phase 2
  }

  private executeConsolidationPhase(): void {
    // Implementation in Phase 3
  }

  private executeConquestPhase(): void {
    // Implementation in Phase 4
  }
}
```

#### Step 1.2: Create MoveHistory Utility

**File**: `src/bots/utils/MoveHistory.ts`

```typescript
interface Move {
  from: number;
  to: number;
  turn: number;
}

export class MoveHistory {
  private recentMoves: Move[] = [];
  private positionFrequency: Map<string, number> = new Map();
  private maxHistorySize: number = 10;

  wouldCreateLoop(from: number, to: number): boolean {
    // Immediate reversal check
    const lastMove = this.recentMoves[this.recentMoves.length - 1];
    if (lastMove && lastMove.from === to && lastMove.to === from) {
      return true;
    }

    // Position oscillation check
    const posKey = `${from}-${to}`;
    const frequency = this.positionFrequency.get(posKey) || 0;
    return frequency > 2;
  }

  recordMove(from: number, to: number, turn: number): void {
    this.recentMoves.push({ from, to, turn });

    if (this.recentMoves.length > this.maxHistorySize) {
      const oldMove = this.recentMoves.shift()!;
      const oldKey = `${oldMove.from}-${oldMove.to}`;
      const count = (this.positionFrequency.get(oldKey) || 1) - 1;

      if (count <= 0) {
        this.positionFrequency.delete(oldKey);
      } else {
        this.positionFrequency.set(oldKey, count);
      }
    }

    const posKey = `${from}-${to}`;
    this.positionFrequency.set(
      posKey,
      (this.positionFrequency.get(posKey) || 0) + 1
    );
  }

  clear(): void {
    this.recentMoves = [];
    this.positionFrequency.clear();
  }
}
```

#### Step 1.3: Create Basic PathfindingUtil

**File**: `src/bots/utils/PathfindingUtil.ts`

```typescript
interface PathNode {
  position: number;
  gScore: number;
  fScore: number;
  parent: number | null;
}

export class PathfindingUtil {
  findPath(
    start: number,
    goal: number,
    gameState: any,
    allowEnemyTiles: boolean = false
  ): number[] | null {
    // A* implementation - details in Phase 2
    return null;
  }

  manhattanDistance(pos1: number, pos2: number, width: number): number {
    const row1 = Math.floor(pos1 / width);
    const col1 = pos1 % width;
    const row2 = Math.floor(pos2 / width);
    const col2 = pos2 % width;
    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
  }

  getAdjacentTiles(position: number, width: number, height: number): number[] {
    const row = Math.floor(position / width);
    const col = position % width;
    const adjacent: number[] = [];

    if (row > 0) adjacent.push((row - 1) * width + col);
    if (row < height - 1) adjacent.push((row + 1) * width + col);
    if (col > 0) adjacent.push(row * width + (col - 1));
    if (col < width - 1) adjacent.push(row * width + (col + 1));

    return adjacent;
  }
}
```

### Phase 2: Expansion Logic (Priority: HIGH)

**Goal**: Implement the aggressive expansion strategy for turns 1-25

#### Step 2.1: Create TerritoryAnalyzer

**File**: `src/bots/utils/TerritoryAnalyzer.ts`

```typescript
interface TileInfo {
  position: number;
  armies: number;
  terrain: number;
  isOwned: boolean;
  isFrontline: boolean;
  adjacentUnexplored: number;
}

export class TerritoryAnalyzer {
  private tileCache: Map<number, TileInfo> = new Map();

  analyzeTile(position: number, gameState: any, playerIndex: number): TileInfo {
    // Implementation details
    return {
      position,
      armies: gameState.armies[position],
      terrain: gameState.terrain[position],
      isOwned: gameState.terrain[position] === playerIndex,
      isFrontline: this.isFrontline(position, gameState, playerIndex),
      adjacentUnexplored: this.countAdjacentUnexplored(position, gameState),
    };
  }

  private isFrontline(
    position: number,
    gameState: any,
    playerIndex: number
  ): boolean {
    if (gameState.terrain[position] !== playerIndex) return false;

    const adjacent = this.getAdjacent(
      position,
      gameState.width,
      gameState.height
    );
    return adjacent.some(
      (adj) =>
        gameState.terrain[adj] === -1 ||
        gameState.terrain[adj] === -3 ||
        (gameState.terrain[adj] >= 0 && gameState.terrain[adj] !== playerIndex)
    );
  }

  private countAdjacentUnexplored(position: number, gameState: any): number {
    const adjacent = this.getAdjacent(
      position,
      gameState.width,
      gameState.height
    );
    return adjacent.filter((adj) => gameState.terrain[adj] === -3).length;
  }

  getOwnedTiles(gameState: any, playerIndex: number): number[] {
    const owned: number[] = [];
    for (let i = 0; i < gameState.terrain.length; i++) {
      if (gameState.terrain[i] === playerIndex) {
        owned.push(i);
      }
    }
    return owned;
  }

  getFrontlineTiles(gameState: any, playerIndex: number): number[] {
    return this.getOwnedTiles(gameState, playerIndex).filter((tile) =>
      this.isFrontline(tile, gameState, playerIndex)
    );
  }

  private getAdjacent(
    position: number,
    width: number,
    height: number
  ): number[] {
    const row = Math.floor(position / width);
    const col = position % width;
    const adjacent: number[] = [];

    if (row > 0) adjacent.push((row - 1) * width + col);
    if (row < height - 1) adjacent.push((row + 1) * width + col);
    if (col > 0) adjacent.push(row * width + (col - 1));
    if (col < width - 1) adjacent.push(row * width + (col + 1));

    return adjacent;
  }

  clearCache(): void {
    this.tileCache.clear();
  }
}
```

#### Step 2.2: Implement Expansion Logic in OptimalBot

```typescript
private executeExpansionPhase(): void {
  const expandMove = this.findBestExpansionMove();
  if (expandMove) {
    this.moveHistory.recordMove(expandMove.from, expandMove.to, this.currentTurn);
    this.attack(expandMove.from, expandMove.to);
  }
}

private findBestExpansionMove(): { from: number; to: number } | null {
  const { armies, terrain, width, height } = this.gameState;
  const ownedTiles = this.territoryAnalyzer.getOwnedTiles(this.gameState, this.gameState.playerIndex);

  interface ExpansionCandidate {
    from: number;
    to: number;
    value: number;
  }

  const candidates: ExpansionCandidate[] = [];

  for (const tile of ownedTiles) {
    if (armies[tile] <= 1) continue;

    const adjacent = this.pathfinder.getAdjacentTiles(tile, width, height);

    for (const adj of adjacent) {
      // Only expand to empty or fog tiles
      if (terrain[adj] !== -1 && terrain[adj] !== -3) continue;

      // Check for loop
      if (this.moveHistory.wouldCreateLoop(tile, adj)) continue;

      // Calculate expansion value
      const value = this.calculateExpansionValue(adj);

      candidates.push({ from: tile, to: adj, value });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by value and return best
  candidates.sort((a, b) => b.value - a.value);
  return { from: candidates[0].from, to: candidates[0].to };
}

private calculateExpansionValue(position: number): number {
  const { terrain, width, height } = this.gameState;

  let value = 10; // Base value

  // Count unexplored neighbors (high value)
  const adjacent = this.pathfinder.getAdjacentTiles(position, width, height);
  const unexploredCount = adjacent.filter((adj) => terrain[adj] === -3).length;
  value += unexploredCount * 5;

  // Distance to center (slightly favor center)
  const centerRow = Math.floor(height / 2);
  const centerCol = Math.floor(width / 2);
  const centerPos = centerRow * width + centerCol;
  const distanceToCenter = this.pathfinder.manhattanDistance(position, centerPos, width);
  value -= distanceToCenter * 0.3;

  // Count neutral neighbors (moderate value)
  const neutralCount = adjacent.filter((adj) => terrain[adj] === -1).length;
  value += neutralCount * 3;

  return value;
}
```

### Phase 3: Consolidation Logic (Priority: MEDIUM)

**Goal**: Implement strike force assembly and target acquisition for turns 26-50

#### Step 3.1: Create TargetScorer

**File**: `src/bots/utils/TargetScorer.ts`

```typescript
interface Target {
  position: number;
  type: "general" | "city" | "tower" | "enemy" | "neutral";
  priority: number;
  armies: number;
  distance: number;
}

export class TargetScorer {
  scoreTargets(gameState: any, playerIndex: number): Target[] {
    const targets: Target[] = [];

    // Find all potential targets
    for (let i = 0; i < gameState.terrain.length; i++) {
      const terrain = gameState.terrain[i];
      const armies = gameState.armies[i];

      // Enemy generals
      if (
        gameState.generals.includes(i) &&
        terrain !== playerIndex &&
        terrain >= 0
      ) {
        targets.push({
          position: i,
          type: "general",
          priority: 10,
          armies: armies,
          distance: this.getDistanceToNearestOwned(i, gameState, playerIndex),
        });
      }

      // Cities
      if (terrain === -6) {
        targets.push({
          position: i,
          type: "city",
          priority: 8,
          armies: armies,
          distance: this.getDistanceToNearestOwned(i, gameState, playerIndex),
        });
      }

      // Towers
      if (terrain === -5) {
        targets.push({
          position: i,
          type: "tower",
          priority: 7,
          armies: gameState.towerDefense[i],
          distance: this.getDistanceToNearestOwned(i, gameState, playerIndex),
        });
      }

      // Enemy cities (captured by opponents)
      if (terrain >= 0 && terrain !== playerIndex) {
        // Check if it's a city position
        if (gameState.cities.includes(i)) {
          targets.push({
            position: i,
            type: "city",
            priority: 9,
            armies: armies,
            distance: this.getDistanceToNearestOwned(i, gameState, playerIndex),
          });
        } else {
          // Regular enemy territory
          targets.push({
            position: i,
            type: "enemy",
            priority: 5,
            armies: armies,
            distance: this.getDistanceToNearestOwned(i, gameState, playerIndex),
          });
        }
      }
    }

    // Calculate final scores
    targets.forEach((target) => {
      let score = target.priority * 100;
      score -= target.distance * 2; // Closer is better
      score -= target.armies * 0.5; // Weaker is better
      target.priority = score;
    });

    return targets.sort((a, b) => b.priority - a.priority);
  }

  private getDistanceToNearestOwned(
    position: number,
    gameState: any,
    playerIndex: number
  ): number {
    let minDistance = Infinity;

    for (let i = 0; i < gameState.terrain.length; i++) {
      if (gameState.terrain[i] === playerIndex) {
        const distance = this.manhattanDistance(position, i, gameState.width);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    return minDistance;
  }

  private manhattanDistance(pos1: number, pos2: number, width: number): number {
    const row1 = Math.floor(pos1 / width);
    const col1 = pos1 % width;
    const row2 = Math.floor(pos2 / width);
    const col2 = pos2 % width;
    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
  }
}
```

#### Step 3.2: Implement Consolidation Logic

```typescript
private executeConsolidationPhase(): void {
  // Update primary target if needed
  if (!this.primaryTarget) {
    this.updatePrimaryTarget();
  }

  // Calculate rally point for strike force
  if (!this.rallyPoint && this.primaryTarget) {
    this.rallyPoint = this.calculateRallyPoint(this.primaryTarget);
  }

  // Move armies toward rally point
  const consolidationMove = this.findConsolidationMove();
  if (consolidationMove) {
    this.moveHistory.recordMove(
      consolidationMove.from,
      consolidationMove.to,
      this.currentTurn
    );
    this.attack(consolidationMove.from, consolidationMove.to);
  }
}

private updatePrimaryTarget(): void {
  const targets = this.targetScorer.scoreTargets(
    this.gameState,
    this.gameState.playerIndex
  );

  if (targets.length > 0) {
    this.primaryTarget = targets[0].position;
  }
}

private calculateRallyPoint(target: number): number {
  // Find owned tile closest to target with good army access
  const ownedTiles = this.territoryAnalyzer.getOwnedTiles(
    this.gameState,
    this.gameState.playerIndex
  );

  let bestRallyPoint = -1;
  let bestScore = -Infinity;

  for (const tile of ownedTiles) {
    const distanceToTarget = this.pathfinder.manhattanDistance(
      tile,
      target,
      this.gameState.width
    );

    // Score based on distance to target and current armies
    const score = -distanceToTarget * 2 + this.gameState.armies[tile] * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestRallyPoint = tile;
    }
  }

  return bestRallyPoint;
}

private findConsolidationMove(): { from: number; to: number } | null {
  if (!this.rallyPoint) return null;

  const { armies, terrain, width, height } = this.gameState;
  const ownedTiles = this.territoryAnalyzer.getOwnedTiles(
    this.gameState,
    this.gameState.playerIndex
  );

  // Find tiles with armies that can move toward rally point
  for (const tile of ownedTiles) {
    if (armies[tile] <= 1) continue;
    if (tile === this.rallyPoint) continue;

    // Find next step toward rally point
    const adjacent = this.pathfinder.getAdjacentTiles(tile, width, height);

    for (const adj of adjacent) {
      if (terrain[adj] !== this.gameState.playerIndex) continue;
      if (this.moveHistory.wouldCreateLoop(tile, adj)) continue;

      const currentDistance = this.pathfinder.manhattanDistance(
        tile,
        this.rallyPoint,
        width
      );
      const nextDistance = this.pathfinder.manhattanDistance(
        adj,
        this.rallyPoint,
        width
      );

      if (nextDistance < currentDistance) {
        return { from: tile, to: adj };
      }
    }
  }

  return null;
}
```

### Phase 4: Conquest Logic (Priority: MEDIUM)

**Goal**: Implement adaptive conquest strategy for turns 51+

#### Step 4.1: Complete A\* Pathfinding Implementation

```typescript
// In PathfindingUtil.ts - complete implementation
findPath(
  start: number,
  goal: number,
  gameState: any,
  allowEnemyTiles: boolean = false
): number[] | null {
  interface QueueNode {
    position: number;
    fScore: number;
  }

  const openSet: QueueNode[] = [{ position: start, fScore: 0 }];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(start, 0);
  fScore.set(start, this.manhattanDistance(start, goal, gameState.width));

  while (openSet.length > 0) {
    // Get node with lowest fScore
    openSet.sort((a, b) => a.fScore - b.fScore);
    const current = openSet.shift()!.position;

    if (current === goal) {
      return this.reconstructPath(cameFrom, current);
    }

    const adjacent = this.getAdjacentTiles(
      current,
      gameState.width,
      gameState.height
    );

    for (const neighbor of adjacent) {
      // Skip impassable tiles
      if (this.isImpassable(neighbor, gameState, allowEnemyTiles) && neighbor !== goal) {
        continue;
      }

      const tentativeGScore = (gScore.get(current) || Infinity) + 1;

      if (!gScore.has(neighbor) || tentativeGScore < gScore.get(neighbor)!) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        const f = tentativeGScore + this.manhattanDistance(neighbor, goal, gameState.width);
        fScore.set(neighbor, f);

        if (!openSet.some((node) => node.position === neighbor)) {
          openSet.push({ position: neighbor, fScore: f });
        }
      }
    }
  }

  return null; // No path found
}

private reconstructPath(cameFrom: Map<number, number>, current: number): number[] {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

private isImpassable(
  position: number,
  gameState: any,
  allowEnemyTiles: boolean
): boolean {
  const terrain = gameState.terrain[position];

  // Mountains are always impassable
  if (terrain === -2) return true;

  // Enemy tiles are impassable unless allowed
  if (!allowEnemyTiles && terrain >= 0 && terrain !== gameState.playerIndex) {
    return true;
  }

  return false;
}
```

#### Step 4.2: Implement Conquest Logic

```typescript
private executeConquestPhase(): void {
  // Re-evaluate targets every 5 turns
  if (this.currentTurn % 5 === 0) {
    this.updatePrimaryTarget();
    this.rallyPoint = null;
  }

  // Check for threats first
  const defensiveMove = this.handleThreats();
  if (defensiveMove) {
    this.moveHistory.recordMove(defensiveMove.from, defensiveMove.to, this.currentTurn);
    this.attack(defensiveMove.from, defensiveMove.to);
    return;
  }

  // Attack primary target if ready
  if (this.primaryTarget) {
    const attackMove = this.executeAttack(this.primaryTarget);
    if (attackMove) {
      this.moveHistory.recordMove(attackMove.from, attackMove.to, this.currentTurn);
      this.attack(attackMove.from, attackMove.to);
      return;
    }
  }

  // Continue consolidation if not ready to attack
  this.executeConsolidationPhase();
}

private handleThreats(): { from: number; to: number } | null {
  const threats = this.detectThreats();

  if (threats.length === 0) return null;

  const highestThreat = threats[0];

  // Find our tile that can counter-attack
  const adjacent = this.pathfinder.getAdjacentTiles(
    highestThreat.position,
    this.gameState.width,
    this.gameState.height
  );

  for (const adj of adjacent) {
    if (this.gameState.terrain[adj] === this.gameState.playerIndex) {
      if (this.gameState.armies[adj] > highestThreat.armies + 1) {
        if (!this.moveHistory.wouldCreateLoop(adj, highestThreat.position)) {
          return { from: adj, to: highestThreat.position };
        }
      }
    }
  }

  return null;
}

private detectThreats(): Array<{
  position: number;
  armies: number;
  distance: number;
  priority: number;
}> {
  const threats = [];
  const ourGeneral = this.gameState.generals[this.gameState.playerIndex];

  for (let i = 0; i < this.gameState.terrain.length; i++) {
    if (
      this.gameState.terrain[i] >= 0 &&
      this.gameState.terrain[i] !== this.gameState.playerIndex
    ) {
      const enemyArmies = this.gameState.armies[i];
      if (enemyArmies <= 5) continue;

      const distanceToGeneral = this.pathfinder.manhattanDistance(
        i,
        ourGeneral,
        this.gameState.width
      );

      if (distanceToGeneral <= 5) {
        threats.push({
          position: i,
          armies: enemyArmies,
          distance: distanceToGeneral,
          priority: enemyArmies / distanceToGeneral,
        });
      }
    }
  }

  return threats.sort((a, b) => b.priority - a.priority);
}

private executeAttack(target: number): { from: number; to: number } | null {
  const targetArmies = this.gameState.armies[target];
  const requiredArmies = targetArmies + 10;

  // Find path to target
  const ownedTiles = this.territoryAnalyzer.getOwnedTiles(
    this.gameState,
    this.gameState.playerIndex
  );

  let bestAttack: { from: number; to: number } | null = null;
  let bestArmies = 0;

  for (const tile of ownedTiles) {
    if (this.gameState.armies[tile] <= 1) continue;

    const path = this.pathfinder.findPath(tile, target, this.gameState, true);

    if (path && path.length >= 2
```
