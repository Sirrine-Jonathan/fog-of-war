import { BaseBot } from "./BaseBot";

export class SpiralBot extends BaseBot {
  makeMove() {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return;

    // Priority 1: Capture adjacent high-value targets
    const priorityMove = this.capturePriorityTargets();
    if (priorityMove) {
      this.attack(priorityMove.from, priorityMove.to);
      return;
    }

    // Priority 2: Spiral expansion
    const spiralMove = this.spiralExpansion();
    if (spiralMove) {
      this.attack(spiralMove.from, spiralMove.to);
      return;
    }

    // Priority 3: Attack enemies
    const attackMove = this.attackEnemies();
    if (attackMove) {
      this.attack(attackMove.from, attackMove.to);
      return;
    }

    // Priority 4: Consolidate armies toward frontier
    const consolidateMove = this.consolidateArmies();
    if (consolidateMove) {
      this.attack(consolidateMove.from, consolidateMove.to);
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

  private spiralExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    // Find the frontier of our territory (tiles with unexplored neighbors)
    const frontierTiles = this.getFrontierTiles();

    if (frontierTiles.length === 0) return null;

    // Sort frontier tiles by distance from capital in spiral pattern
    const capitalRow = Math.floor(ourCapital / this.gameState.width);
    const capitalCol = ourCapital % this.gameState.width;

    const spiralScored = frontierTiles.map((tile) => {
      const row = Math.floor(tile / this.gameState.width);
      const col = tile % this.gameState.width;
      const dx = col - capitalCol;
      const dy = row - capitalRow;

      // Calculate angle for spiral ordering
      const angle = Math.atan2(dy, dx);
      const distance = Math.abs(dx) + Math.abs(dy);

      // Score based on spiral pattern: prioritize moving outward in a circular fashion
      const spiralScore = distance * 100 + (angle + Math.PI) * 10;

      return { tile, score: spiralScore, distance };
    });

    // Sort by spiral score to expand in spiral pattern
    spiralScored.sort((a, b) => a.score - b.score);

    // Try to expand from the best spiral position
    for (const { tile } of spiralScored) {
      if (armies[tile] > 1) {
        const adjacent = this.getAdjacentTiles(tile);

        for (const adj of adjacent) {
          if (
            (terrain[adj] === -1 || terrain[adj] === -3) &&
            !this.wouldCreateLoop(tile, adj)
          ) {
            return { from: tile, to: adj };
          }
        }
      }
    }

    return null;
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

  private consolidateArmies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const frontierTiles = this.getFrontierTiles();

    if (frontierTiles.length === 0) return null;

    // Find interior tiles with armies to move
    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === this.gameState.playerIndex &&
        armies[i] > 2 &&
        !frontierTiles.includes(i)
      ) {
        // Find path to nearest frontier
        const adjacent = this.getAdjacentTiles(i);
        for (const adj of adjacent) {
          if (
            terrain[adj] === this.gameState.playerIndex &&
            !this.wouldCreateLoop(i, adj)
          ) {
            return { from: i, to: adj };
          }
        }
      }
    }

    return null;
  }

  private attackEnemies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] >= 0 &&
            terrain[adj] !== this.gameState.playerIndex &&
            armies[i] > armies[adj] + 1 &&
            !this.wouldCreateLoop(i, adj)
          ) {
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
