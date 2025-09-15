import { BaseBot } from './BaseBot';

export class SpiralBot extends BaseBot {
  private phase: 'expand' | 'collect' | 'attack' = 'expand';

  makeMove() {
    const { armies, terrain } = this.gameState;
    const ourGeneral = this.gameState.generals[this.gameState.playerIndex];
    
    if (ourGeneral === -1) return;

    if (this.currentTurn <= 25) {
      this.phase = 'expand';
      const expansion = this.spiralExpansion();
      if (expansion) {
        this.attack(expansion.from, expansion.to);
        return;
      }
    }
    
    if (this.currentTurn > 25 && this.currentTurn <= 50) {
      this.phase = 'collect';
      const collection = this.collectArmies();
      if (collection) {
        this.attack(collection.from, collection.to);
        return;
      }
    }
    
    if (this.currentTurn > 50) {
      this.phase = 'attack';
      const attack = this.seekAndDestroy();
      if (attack) {
        this.attack(attack.from, attack.to);
        return;
      }
    }
  }

  private spiralExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const target = this.getNextSpiralTarget(i);
        if (target !== -1 && !this.wouldCreateLoop(i, target)) {
          return { from: i, to: target };
        }
      }
    }
    return null;
  }

  private getNextSpiralTarget(from: number): number {
    const { terrain } = this.gameState;
    const directions = this.getDirectionalTargets(from);
    
    for (const direction of ['north', 'east', 'south', 'west']) {
      const target = directions[direction];
      if (target !== -1 && (terrain[target] === -1 || terrain[target] === -3)) {
        return target;
      }
    }
    
    const adjacent = this.getAdjacentTiles(from);
    for (const adj of adjacent) {
      if (terrain[adj] === -1 || terrain[adj] === -3) {
        return adj;
      }
    }
    
    return -1;
  }

  private getDirectionalTargets(from: number): Record<string, number> {
    const row = Math.floor(from / this.gameState.width);
    const col = from % this.gameState.width;
    
    return {
      north: row > 0 ? (row - 1) * this.gameState.width + col : -1,
      east: col < this.gameState.width - 1 ? row * this.gameState.width + (col + 1) : -1,
      south: row < this.gameState.height - 1 ? (row + 1) * this.gameState.width + col : -1,
      west: col > 0 ? row * this.gameState.width + (col - 1) : -1
    };
  }

  private collectArmies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    const frontlineTile = this.findFrontlineTile();
    if (frontlineTile === -1) return null;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1 && i !== frontlineTile) {
        const pathMove = this.findPathToTarget(i, frontlineTile);
        if (pathMove) {
          return pathMove;
        }
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
        const hasExpansionTarget = adjacent.some(adj => 
          terrain[adj] === -1 || terrain[adj] === -3 || 
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
          if ((terrain[adj] === -6 || terrain[adj] === -5) && 
              armies[i] > armies[adj] + 1 && 
              !this.wouldCreateLoop(i, adj)) {
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
          if (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex &&
              armies[i] > armies[adj] + 1 && 
              !this.wouldCreateLoop(i, adj)) {
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
      const pathMove = this.findPathToTarget(strongestTile, centerTile);
      if (pathMove) return pathMove;
    }
    
    return null;
  }

  private findPathToTarget(from: number, target: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(from);
    
    let bestMove = null;
    let bestDistance = Infinity;
    
    for (const adj of adjacent) {
      if ((terrain[adj] === this.gameState.playerIndex || terrain[adj] === -1 || terrain[adj] === -3) &&
          !this.wouldCreateLoop(from, adj)) {
        const distance = this.getDistance(adj, target);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMove = { from, to: adj };
        }
      }
    }
    
    return bestMove;
  }

  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
}
