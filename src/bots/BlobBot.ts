import { BaseBot } from "./BaseBot";

export class BlobBot extends BaseBot {
  makeMove() {
    const { armies, terrain } = this.gameState;

    // Priority 1: Capture high-value targets
    const priorityMove = this.capturePriorityTargets();
    if (priorityMove) {
      this.attack(priorityMove.from, priorityMove.to);
      return;
    }

    // Priority 2: Even expansion from all fronts
    const expansion = this.expandEvenly();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
      return;
    }

    // Priority 3: Attack weak enemies
    const enemyAttack = this.attackWeakEnemies();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }

    // Priority 4: Redistribute armies to maintain even front
    const redistribute = this.redistributeArmies();
    if (redistribute) {
      this.attack(redistribute.from, redistribute.to);
    }
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

  private expandEvenly(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return null;

    // Get all frontier tiles (tiles with unexpanded neighbors)
    const frontierTiles = this.getFrontierTiles();

    if (frontierTiles.length === 0) return null;

    // Calculate center of our territory
    const { centerX, centerY } = this.getTerritoryCenter();

    // Score each expansion opportunity by how it contributes to even expansion
    const expansions: Array<{
      from: number;
      to: number;
      score: number;
      distance: number;
    }> = [];

    for (const frontTile of frontierTiles) {
      if (armies[frontTile] <= 1) continue;

      const adjacent = this.getAdjacentTiles(frontTile);

      for (const adj of adjacent) {
        if (
          (terrain[adj] === -1 || terrain[adj] === -3) &&
          !this.wouldCreateLoop(frontTile, adj)
        ) {
          const adjRow = Math.floor(adj / this.gameState.width);
          const adjCol = adj % this.gameState.width;

          // Distance from our center - we want even expansion in all directions
          const distFromCenter = Math.sqrt(
            Math.pow(adjCol - centerX, 2) + Math.pow(adjRow - centerY, 2)
          );

          // Count how many of our tiles surround this position
          const adjOfAdj = this.getAdjacentTiles(adj);
          const ourNeighbors = adjOfAdj.filter(
            (tile) => terrain[tile] === this.gameState.playerIndex
          ).length;

          // Score: prefer tiles that are:
          // - At similar distance from center (even expansion)
          // - Have fewer of our tiles around them (filling gaps)
          // - Have more fog/unexplored around them (exploration bonus)
          const fogNeighbors = adjOfAdj.filter(
            (tile) => terrain[tile] === -3
          ).length;

          const score =
            distFromCenter * 100 -
            ourNeighbors * 50 +
            fogNeighbors * 10 +
            armies[frontTile];

          expansions.push({
            from: frontTile,
            to: adj,
            score,
            distance: distFromCenter,
          });
        }
      }
    }

    if (expansions.length === 0) return null;

    // Find the average distance of all expansion opportunities
    const avgDistance =
      expansions.reduce((sum, e) => sum + e.distance, 0) / expansions.length;

    // Prefer expansions closest to the average distance (maintains circular shape)
    expansions.sort((a, b) => {
      const aDistDiff = Math.abs(a.distance - avgDistance);
      const bDistDiff = Math.abs(b.distance - avgDistance);
      return aDistDiff - bDistDiff || b.score - a.score;
    });

    return { from: expansions[0].from, to: expansions[0].to };
  }

  private getFrontierTiles(): number[] {
    const { terrain } = this.gameState;
    const frontier: number[] = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        const hasUnexplored = adjacent.some(
          (adj) => terrain[adj] === -1 || terrain[adj] === -3
        );

        if (hasUnexplored) {
          frontier.push(i);
        }
      }
    }

    return frontier;
  }

  private getTerritoryCenter(): { centerX: number; centerY: number } {
    const { terrain } = this.gameState;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const row = Math.floor(i / this.gameState.width);
        const col = i % this.gameState.width;
        sumX += col;
        sumY += row;
        count++;
      }
    }

    return {
      centerX: count > 0 ? sumX / count : this.gameState.width / 2,
      centerY: count > 0 ? sumY / count : this.gameState.height / 2,
    };
  }

  private attackWeakEnemies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const attacks: Array<{
      from: number;
      to: number;
      advantage: number;
      priority: number;
    }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 2) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] >= 0 &&
            terrain[adj] !== this.gameState.playerIndex
          ) {
            const canWin = armies[i] > armies[adj] + 1;
            if (canWin && !this.wouldCreateLoop(i, adj)) {
              const advantage = armies[i] - armies[adj];
              const isCapital = this.gameState.capitals.includes(adj);
              const isCity = this.gameState.cities.includes(adj);

              let priority = 50 + advantage;
              if (isCapital) priority = 200;
              else if (isCity) priority = 150;

              attacks.push({ from: i, to: adj, advantage, priority });
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

  private redistributeArmies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const frontierTiles = this.getFrontierTiles();

    if (frontierTiles.length === 0) return null;

    // Find the weakest frontier tile
    let weakestFrontier = -1;
    let minArmies = Infinity;

    for (const tile of frontierTiles) {
      if (armies[tile] < minArmies) {
        minArmies = armies[tile];
        weakestFrontier = tile;
      }
    }

    if (weakestFrontier === -1) return null;

    // Find interior tiles with excess armies to redistribute
    const interiorTiles: Array<{ tile: number; armies: number; dist: number }> =
      [];

    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === this.gameState.playerIndex &&
        armies[i] > 3 &&
        !frontierTiles.includes(i)
      ) {
        const dist = this.getDistance(i, weakestFrontier);
        interiorTiles.push({ tile: i, armies: armies[i], dist });
      }
    }

    if (interiorTiles.length === 0) return null;

    // Sort by proximity to weakest frontier
    interiorTiles.sort((a, b) => a.dist - b.dist || b.armies - a.armies);

    // Move armies toward weakest frontier
    const source = interiorTiles[0].tile;
    const adjacent = this.getAdjacentTiles(source);

    for (const adj of adjacent) {
      if (
        terrain[adj] === this.gameState.playerIndex &&
        !this.wouldCreateLoop(source, adj)
      ) {
        const adjDist = this.getDistance(adj, weakestFrontier);
        const sourceDist = this.getDistance(source, weakestFrontier);

        // Move if it gets us closer to the weak point
        if (adjDist < sourceDist) {
          return { from: source, to: adj };
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
