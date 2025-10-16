import { BaseBot } from "./BaseBot";

export class ArrowBot extends BaseBot {
  private targetPosition: number | null = null;

  makeMove() {
    const { armies, terrain } = this.gameState;

    // Priority 1: Counter-attack threats near our capital
    const counterAttack = this.defendCapital();
    if (counterAttack) {
      this.attack(counterAttack.from, counterAttack.to);
      return;
    }

    // Priority 2: Capture high-value targets
    const priorityCapture = this.capturePriorityTargets();
    if (priorityCapture) {
      this.attack(priorityCapture.from, priorityCapture.to);
      return;
    }

    // Priority 3: Attack enemy territories aggressively
    const enemyAttack = this.attackEnemiesAggressive();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }

    // Priority 4: Expand toward enemy positions
    const seekMove = this.seekAndDestroy();
    if (seekMove) {
      this.attack(seekMove.from, seekMove.to);
      return;
    }

    // Priority 5: Explore fog of war
    const explore = this.exploreFog();
    if (explore) {
      this.attack(explore.from, explore.to);
    }
  }

  private defendCapital(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return null;

    // Check for enemies within 5 tiles of capital
    const threatsNearCapital: Array<{ tile: number; distance: number }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        const distance = this.getDistance(i, ourCapital);
        if (distance <= 5) {
          threatsNearCapital.push({ tile: i, distance });
        }
      }
    }

    if (threatsNearCapital.length === 0) return null;

    // Find closest threat
    threatsNearCapital.sort((a, b) => a.distance - b.distance);
    const closestThreat = threatsNearCapital[0].tile;

    // Attack if we can
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        if (
          adjacent.includes(closestThreat) &&
          armies[i] > armies[closestThreat] + 1 &&
          !this.wouldCreateLoop(i, closestThreat)
        ) {
          return { from: i, to: closestThreat };
        }
      }
    }

    return null;
  }

  private capturePriorityTargets(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 2) {
        const targets = this.getPriorityTargets(i);
        if (targets.length > 0) {
          return { from: i, to: targets[0] };
        }
      }
    }

    return null;
  }

  private attackEnemiesAggressive(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const attacks: Array<{
      from: number;
      to: number;
      priority: number;
      advantage: number;
    }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] >= 0 &&
            terrain[adj] !== this.gameState.playerIndex
          ) {
            const canWin = armies[i] > armies[adj] + 1;
            if (canWin && !this.wouldCreateLoop(i, adj)) {
              const isCapital = this.gameState.capitals.includes(adj);
              const isCity = this.gameState.cities.includes(adj);
              const advantage = armies[i] - armies[adj];

              let priority = 50;
              if (isCapital) priority = 100;
              else if (isCity) priority = 80;
              priority += advantage;

              attacks.push({ from: i, to: adj, priority, advantage });
            }
          }
        }
      }
    }

    if (attacks.length > 0) {
      attacks.sort((a, b) => b.priority - a.priority);
      return { from: attacks[0].from, to: attacks[0].to };
    }

    return null;
  }

  private seekAndDestroy(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find enemy positions
    const enemies: number[] = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        enemies.push(i);
      }
    }

    if (enemies.length === 0) return null;

    // Find our strongest tiles
    const ourStrongTiles: Array<{ tile: number; armies: number }> = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 3) {
        ourStrongTiles.push({ tile: i, armies: armies[i] });
      }
    }

    if (ourStrongTiles.length === 0) return null;

    // Sort by army count
    ourStrongTiles.sort((a, b) => b.armies - a.armies);

    // Move strongest armies toward closest enemy
    for (const { tile } of ourStrongTiles) {
      const closestEnemy = this.findClosestEnemy(tile, enemies);
      if (closestEnemy !== -1) {
        const move = this.moveToward(tile, closestEnemy);
        if (move) return move;
      }
    }

    return null;
  }

  private findClosestEnemy(from: number, enemies: number[]): number {
    let closest = -1;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.getDistance(from, enemy);
      if (distance < minDistance) {
        minDistance = distance;
        closest = enemy;
      }
    }

    return closest;
  }

  private moveToward(
    from: number,
    target: number
  ): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(from);

    let bestMove: { tile: number; distance: number } | null = null;
    let bestDistance = Infinity;

    for (const adj of adjacent) {
      if (
        (terrain[adj] === -1 ||
          terrain[adj] === -3 ||
          terrain[adj] === this.gameState.playerIndex) &&
        !this.wouldCreateLoop(from, adj)
      ) {
        const distance = this.getDistance(adj, target);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMove = { tile: adj, distance };
        }
      }
    }

    if (bestMove) {
      return { from, to: bestMove.tile };
    }

    return null;
  }

  private exploreFog(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find tiles on the edge of fog
    const fogExpansion: Array<{ from: number; to: number; priority: number }> =
      [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (terrain[adj] === -3 && !this.wouldCreateLoop(i, adj)) {
            // Count how many fog neighbors this tile has
            const adjOfAdj = this.getAdjacentTiles(adj);
            const fogNeighbors = adjOfAdj.filter(
              (tile) => terrain[tile] === -3
            ).length;

            fogExpansion.push({
              from: i,
              to: adj,
              priority: fogNeighbors * 10 + armies[i],
            });
          }
        }
      }
    }

    if (fogExpansion.length > 0) {
      fogExpansion.sort((a, b) => b.priority - a.priority);
      return { from: fogExpansion[0].from, to: fogExpansion[0].to };
    }

    // Fallback: expand to neutral territory
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (terrain[adj] === -1 && !this.wouldCreateLoop(i, adj)) {
            return { from: i, to: adj };
          }
        }
      }
    }

    return null;
  }

  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
}
