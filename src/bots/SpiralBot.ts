import { BaseBot } from "./BaseBot";

export class SpiralBot extends BaseBot {
  private phase: "expand" | "collect" | "attack" = "expand";
  private conqueredDirections: Set<string> = new Set();
  private spiralPath = [
    "north",
    "east",
    "south",
    "south",
    "west",
    "west",
    "north",
    "north",
  ];
  private spiralStep = 0;

  makeMove() {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return;

    if (this.currentTurn <= 25) {
      this.phase = "expand";
      const expansion = this.spiralExpansion();
      if (expansion) {
        this.attack(expansion.from, expansion.to);
      }
      return;
    }

    if (this.currentTurn > 25 && this.currentTurn <= 50) {
      this.phase = "collect";
      const collection = this.collectArmies();
      if (collection) {
        this.attack(collection.from, collection.to);
      }
      return;
    }

    if (this.currentTurn > 50) {
      this.phase = "attack";
      const attack = this.seekAndDestroy();
      if (attack) {
        this.attack(attack.from, attack.to);
      }
    }
  }

  private spiralExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    // Step 1: Conquer adjacent tiles in strict N->E->S->W order
    if (this.conqueredDirections.size < 4) {
      const adjacentMove = this.conquerAdjacentSequential(ourCapital);
      if (adjacentMove) return adjacentMove;
    }

    // Step 2: Follow the exact spiral path
    if (this.spiralStep < this.spiralPath.length) {
      const spiralMove = this.followSpiralPath();
      if (spiralMove) return spiralMove;
    }

    // Step 3: Stop expanding (all territory around capital conquered)
    return null;
  }

  private conquerAdjacentSequential(
    capital: number
  ): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    if (armies[capital] <= 1) return null;

    const directions = this.getDirectionalTargets(capital);

    // Try directions in strict order: north, east, south, west
    for (const direction of ["north", "east", "south", "west"]) {
      if (!this.conqueredDirections.has(direction)) {
        const target = directions[direction];
        if (
          target !== -1 &&
          this.isEmptyTile(target) &&
          !this.wouldCreateLoop(capital, target)
        ) {
          this.conqueredDirections.add(direction);
          return { from: capital, to: target };
        } else if (target !== -1) {
          // Mark as conquered even if we can't move there (mountain/obstacle)
          this.conqueredDirections.add(direction);
        }
      }
    }
    return null;
  }

  private followSpiralPath(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find any tile with >1 army to continue the spiral
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const direction = this.spiralPath[this.spiralStep];
        const target = this.getTargetInDirection(i, direction);

        if (
          target !== -1 &&
          this.isEmptyTile(target) &&
          !this.wouldCreateLoop(i, target)
        ) {
          this.spiralStep++;
          return { from: i, to: target };
        }
      }
    }

    // If can't follow exact path, mark step as complete
    this.spiralStep++;
    return null;
  }

  private getTargetInDirection(from: number, direction: string): number {
    const directions = this.getDirectionalTargets(from);
    return directions[direction] || -1;
  }

  private findNearestDiagonal(from: number, capital: number): number {
    const { terrain } = this.gameState;
    const row = Math.floor(from / this.gameState.width);
    const col = from % this.gameState.width;

    // Check all 4 diagonals
    const diagonals = [
      { row: row - 1, col: col - 1 }, // NW
      { row: row - 1, col: col + 1 }, // NE
      { row: row + 1, col: col - 1 }, // SW
      { row: row + 1, col: col + 1 }, // SE
    ];

    for (const diag of diagonals) {
      if (
        diag.row >= 0 &&
        diag.row < this.gameState.height &&
        diag.col >= 0 &&
        diag.col < this.gameState.width
      ) {
        const target = diag.row * this.gameState.width + diag.col;
        if (this.isEmptyTile(target)) {
          return target;
        }
      }
    }
    return -1;
  }

  private findNorthernmostEmpty(): number {
    const { terrain } = this.gameState;

    // Scan from top row down
    for (let row = 0; row < this.gameState.height; row++) {
      for (let col = 0; col < this.gameState.width; col++) {
        const tile = row * this.gameState.width + col;
        if (this.isEmptyTile(tile)) {
          return tile;
        }
      }
    }
    return -1;
  }

  private findPathToTarget(
    target: number
  ): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find closest owned tile with >1 army
    let bestMove = null;
    let bestDistance = Infinity;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        for (const adj of adjacent) {
          if (this.isEmptyTile(adj) && !this.wouldCreateLoop(i, adj)) {
            const distance = this.getDistance(adj, target);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestMove = { from: i, to: adj };
            }
          }
        }
      }
    }
    return bestMove;
  }

  private isEmptyTile(tile: number): boolean {
    const { terrain } = this.gameState;
    return terrain[tile] === -1 || terrain[tile] === -3;
  }

  private getDirectionalTargets(from: number): Record<string, number> {
    const row = Math.floor(from / this.gameState.width);
    const col = from % this.gameState.width;

    return {
      north: row > 0 ? (row - 1) * this.gameState.width + col : -1,
      east:
        col < this.gameState.width - 1
          ? row * this.gameState.width + (col + 1)
          : -1,
      south:
        row < this.gameState.height - 1
          ? (row + 1) * this.gameState.width + col
          : -1,
      west: col > 0 ? row * this.gameState.width + (col - 1) : -1,
    };
  }

  private collectArmies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const frontlineTile = this.findFrontlineTile();
    if (frontlineTile === -1) return null;

    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === this.gameState.playerIndex &&
        armies[i] > 1 &&
        i !== frontlineTile
      ) {
        const pathMove = this.findPathToTarget(frontlineTile);
        if (pathMove) return pathMove;
      }
    }
    return null;
  }

  private findFrontlineTile(): number {
    const { terrain } = this.gameState;
    const centerRow = Math.floor(this.gameState.height / 2);
    const centerCol = Math.floor(this.gameState.width / 2);
    const centerTile = centerRow * this.gameState.width + centerCol;

    let bestTile = -1;
    let bestDistance = Infinity;

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
          const distance = this.getDistance(i, centerTile);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestTile = i;
          }
        }
      }
    }
    return bestTile;
  }

  private seekAndDestroy(): { from: number; to: number } | null {
    const structureAttack = this.attackStructures();
    if (structureAttack) return structureAttack;

    const enemyAttack = this.attackEnemies();
    if (enemyAttack) return enemyAttack;

    const centerMove = this.moveTowardCenter();
    if (centerMove) return centerMove;

    return null;
  }

  private attackStructures(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            (terrain[adj] === -6 || terrain[adj] === -5) &&
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

  private moveTowardCenter(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const centerRow = Math.floor(this.gameState.height / 2);
    const centerCol = Math.floor(this.gameState.width / 2);
    const centerTile = centerRow * this.gameState.width + centerCol;

    let maxArmies = 0;
    let strongestTile = -1;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > maxArmies) {
        maxArmies = armies[i];
        strongestTile = i;
      }
    }

    if (strongestTile !== -1 && armies[strongestTile] > 1) {
      const pathMove = this.findPathToTarget(centerTile);
      if (pathMove) return pathMove;
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
