import { BaseBot } from "./BaseBot";

export class BlobBot extends BaseBot {
  private generationSources: Set<number> = new Set();
  private frontlineTiles: Set<number> = new Set();
  private pathCache: Map<string, number[]> = new Map();

  makeMove() {
    const { armies, terrain } = this.gameState;

    this.updateSources();
    this.updateFrontlines();

    const enemyAttack = this.attackEnemiesStrategic();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }

    const expansion = this.expandLightningFast();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
      return;
    }

    const armyFlow = this.flowArmiesRobust();
    if (armyFlow) {
      this.attack(armyFlow.from, armyFlow.to);
    }
  }

  private updateSources() {
    const { terrain, armies } = this.gameState;
    this.generationSources.clear();

    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];
    if (ourCapital !== -1) {
      this.generationSources.add(ourCapital);
    }

    for (let i = 0; i < this.gameState.cities.length; i++) {
      const city = this.gameState.cities[i];
      if (terrain[city] === this.gameState.playerIndex) {
        this.generationSources.add(city);
      }
    }

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 5) {
        this.generationSources.add(i);
      }
    }
  }

  private updateFrontlines() {
    const { terrain } = this.gameState;
    this.frontlineTiles.clear();

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        const hasExpansionTarget = adjacent.some(
          (adj) =>
            terrain[adj] === -1 ||
            terrain[adj] === -3 ||
            (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex)
        );

        if (hasExpansionTarget) {
          this.frontlineTiles.add(i);
        }
      }
    }
  }

  private attackEnemiesStrategic(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const attacks = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] >= 0 &&
            terrain[adj] !== this.gameState.playerIndex
          ) {
            if (armies[i] > armies[adj] + 1 && !this.wouldCreateLoop(i, adj)) {
              attacks.push({
                from: i,
                to: adj,
                armyAdvantage: armies[i] - armies[adj],
                isCapital: this.gameState.capitals.includes(adj),
                isCity: this.gameState.cities.includes(adj),
              });
            }
          }
        }
      }
    }

    if (attacks.length > 0) {
      attacks.sort((a, b) => {
        if (a.isCapital !== b.isCapital) return a.isCapital ? -1 : 1;
        if (a.isCity !== b.isCity) return a.isCity ? -1 : 1;
        return b.armyAdvantage - a.armyAdvantage;
      });
      return { from: attacks[0].from, to: attacks[0].to };
    }

    return null;
  }

  private expandLightningFast(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const expansions = [];

    for (const frontTile of this.frontlineTiles) {
      if (armies[frontTile] > 2) {
        const adjacent = this.getAdjacentTiles(frontTile);

        for (const adj of adjacent) {
          if (
            (terrain[adj] === -1 || terrain[adj] === -3) &&
            !this.wouldCreateLoop(frontTile, adj)
          ) {
            let priority = this.getExpansionPriority(adj);

            if (this.gameState.cities.includes(adj)) {
              priority += 1000;
            }

            expansions.push({
              from: frontTile,
              to: adj,
              armies: armies[frontTile],
              priority: priority,
            });
          }
        }
      }
    }

    if (expansions.length > 0) {
      expansions.sort((a, b) => b.priority - a.priority || b.armies - a.armies);
      const topExpansions = expansions.slice(0, 3);
      return { from: topExpansions[0].from, to: topExpansions[0].to };
    }

    return null;
  }

  private flowArmiesRobust(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        if (this.frontlineTiles.has(i)) continue;

        const pathMove = this.findPathToFrontlineRobust(i);
        if (pathMove) {
          return pathMove;
        }
      }
    }

    return null;
  }

  private findPathToFrontlineRobust(
    from: number
  ): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    const visited = new Set<number>();
    const queue = [{ tile: from, path: [from] }];
    visited.add(from);

    while (queue.length > 0) {
      const { tile, path } = queue.shift()!;

      if (this.frontlineTiles.has(tile) && tile !== from) {
        if (path.length > 1) {
          const nextTile = path[1];
          if (
            armies[from] > armies[nextTile] + 1 &&
            !this.wouldCreateLoop(from, nextTile)
          ) {
            return { from, to: nextTile };
          }
        }
      }

      const adjacent = this.getAdjacentTiles(tile);
      for (const adj of adjacent) {
        if (!visited.has(adj) && terrain[adj] === this.gameState.playerIndex) {
          visited.add(adj);
          queue.push({ tile: adj, path: [...path, adj] });
        }
      }

      if (path.length > 10) break;
    }

    const adjacent = this.getAdjacentTiles(from);
    for (const adj of adjacent) {
      if (
        terrain[adj] === this.gameState.playerIndex &&
        armies[adj] < armies[from] &&
        !this.wouldCreateLoop(from, adj)
      ) {
        return { from, to: adj };
      }
    }

    return null;
  }

  private getExpansionPriority(position: number): number {
    const { terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(position);

    let priority = 10;

    const unknownNeighbors = adjacent.filter(
      (adj) => terrain[adj] === -3
    ).length;
    priority += unknownNeighbors * 5;

    const neutralNeighbors = adjacent.filter(
      (adj) => terrain[adj] === -1
    ).length;
    priority += neutralNeighbors * 3;

    return priority;
  }

  private getDistanceToNearestFrontline(position: number): number {
    if (this.frontlineTiles.size === 0) return 0;

    let minDistance = Infinity;
    for (const frontTile of this.frontlineTiles) {
      const distance = this.getDistance(position, frontTile);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return Math.max(0, 50 - minDistance);
  }

  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
}
