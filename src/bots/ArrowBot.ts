import { BaseBot } from './BaseBot';

export class ArrowBot extends BaseBot {
  private explorationTargets: number[] = [];
  private currentTarget: number = -1;
  private failedTargets: Set<number> = new Set();
  
  makeMove() {
    const counterAttack = this.findCounterAttack();
    if (counterAttack) {
      this.attack(counterAttack.from, counterAttack.to);
      return;
    }
    
    const shouldExplore = this.shouldContinueExploring();
    
    if (!shouldExplore) {
      const enemyAttack = this.findStrategicEnemyAttack();
      if (enemyAttack) {
        this.attack(enemyAttack.from, enemyAttack.to);
        return;
      }
    }
    
    const exploration = this.findSystematicExploration();
    if (exploration) {
      this.attack(exploration.from, exploration.to);
      return;
    }
    
    const fallback = this.findAnyValidMove();
    if (fallback) {
      this.attack(fallback.from, fallback.to);
    }
  }
  
  private findLookoutTowerCapture(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] === -3 && !this.wouldCreateLoop(i, adj)) {
            return { from: i, to: adj };
          }
        }
      }
    }
    
    return null;
  }

  private shouldContinueExploring(): boolean {
    const { terrain } = this.gameState;
    let unknownAdjacent = 0;
    let enemyAdjacent = 0;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        const hasUnknown = adjacent.some(adj => terrain[adj] === -1 || terrain[adj] === -3);
        const hasEnemy = adjacent.some(adj => terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex);
        
        if (hasUnknown) unknownAdjacent++;
        if (hasEnemy) enemyAdjacent++;
      }
    }
    
    return unknownAdjacent > enemyAdjacent;
  }
  
  private findCounterAttack(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] === this.gameState.playerIndex && armies[adj] > armies[i] + 1) {
            if (!this.wouldCreateLoop(adj, i)) {
              return { from: adj, to: i };
            }
          }
        }
      }
    }
    return null;
  }
  
  private findStrategicEnemyAttack(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const attacks = [];
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex) {
            if (armies[i] > armies[adj] + 1 && !this.wouldCreateLoop(i, adj)) {
              attacks.push({
                from: i,
                to: adj,
                armyAdvantage: armies[i] - armies[adj],
                isGeneral: this.gameState.generals.includes(adj),
                totalArmies: armies[i]
              });
            }
          }
        }
      }
    }
    
    if (attacks.length > 0) {
      attacks.sort((a, b) => {
        if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
        return b.totalArmies - a.totalArmies;
      });
      return { from: attacks[0].from, to: attacks[0].to };
    }
    
    return null;
  }
  
  private findSystematicExploration(): { from: number; to: number } | null {
    this.updateExplorationTargets();
    
    const towerMove = this.findLookoutTowerCapture();
    if (towerMove) {
      return towerMove;
    }
    
    if (this.currentTarget !== -1 && !this.failedTargets.has(this.currentTarget)) {
      const pathMove = this.findPathToTarget(this.currentTarget);
      if (pathMove) {
        return pathMove;
      } else {
        this.failedTargets.add(this.currentTarget);
        this.currentTarget = -1;
      }
    }
    
    for (const target of this.explorationTargets) {
      if (!this.failedTargets.has(target)) {
        this.currentTarget = target;
        const pathMove = this.findPathToTarget(target);
        if (pathMove) {
          return pathMove;
        } else {
          this.failedTargets.add(target);
        }
      }
    }
    
    return this.expandToFog();
  }
  
  private updateExplorationTargets() {
    const { terrain, width, height } = this.gameState;
    this.explorationTargets = [];
    
    const fogTiles = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === -3) {
        fogTiles.push({
          position: i,
          priority: this.calculateExplorationPriority(i)
        });
      }
    }
    
    fogTiles.sort((a, b) => b.priority - a.priority);
    this.explorationTargets = fogTiles.slice(0, 10).map(t => t.position);
    
    if (this.explorationTargets.length === 0) {
      this.addEdgeTargets();
    }
  }
  
  private calculateExplorationPriority(position: number): number {
    const { terrain, width } = this.gameState;
    const row = Math.floor(position / width);
    const col = position % width;
    
    let priority = 10;
    
    const ourTiles = this.getOurTiles();
    if (ourTiles.length > 0) {
      const minDistance = Math.min(...ourTiles.map(tile => this.getDistance(tile, position)));
      priority += Math.max(0, 20 - minDistance);
    }
    
    const centerRow = Math.floor(this.gameState.height / 2);
    const centerCol = Math.floor(width / 2);
    const distanceFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
    priority += Math.max(0, 10 - distanceFromCenter);
    
    return priority;
  }
  
  private findPathToTarget(target: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const candidates = [];
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if ((terrain[adj] === -1 || terrain[adj] === -3) && !this.wouldCreateLoop(i, adj)) {
            const distanceToTarget = this.getDistance(adj, target);
            candidates.push({
              from: i,
              to: adj,
              distance: distanceToTarget,
              armies: armies[i]
            });
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance || b.armies - a.armies);
      return { from: candidates[0].from, to: candidates[0].to };
    }
    
    return null;
  }
  
  private expandToFog(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] === -3 && !this.wouldCreateLoop(i, adj)) {
            return { from: i, to: adj };
          }
        }
      }
    }
    
    return null;
  }
  
  private findAnyValidMove(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if ((terrain[adj] === -1 || terrain[adj] === -3) && !this.wouldCreateLoop(i, adj)) {
            return { from: i, to: adj };
          }
        }
      }
    }
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 2) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] === this.gameState.playerIndex && 
              armies[adj] < armies[i] && 
              !this.wouldCreateLoop(i, adj)) {
            return { from: i, to: adj };
          }
        }
      }
    }
    
    return null;
  }
  
  private addEdgeTargets() {
    const { width, height } = this.gameState;
    
    for (let i = 0; i < width; i++) {
      this.explorationTargets.push(i);
      this.explorationTargets.push((height - 1) * width + i);
    }
    
    for (let i = 0; i < height; i++) {
      this.explorationTargets.push(i * width);
      this.explorationTargets.push(i * width + width - 1);
    }
  }
  
  private getOurTiles(): number[] {
    const { terrain } = this.gameState;
    const ourTiles = [];
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        ourTiles.push(i);
      }
    }
    
    return ourTiles;
  }
  
  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
}
