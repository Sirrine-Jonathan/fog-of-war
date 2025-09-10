import { io, Socket } from 'socket.io-client';

interface GameState {
  playerIndex: number;
  gameMap: number[];
  generals: number[];
  cities: number[];
  width: number;
  height: number;
  armies: number[];
  terrain: number[];
}

abstract class BaseBot {
  protected socket: Socket;
  protected gameState: GameState;
  protected botName: string;
  protected gameRoom: string;
  protected userId: string;
  protected lastMove: { from: number; to: number } | null = null;
  protected moveHistory: Array<{ from: number; to: number; turn: number }> = [];
  protected currentTurn: number = 0;

  constructor(baseName: string, gameRoom: string, serverUrl: string) {
    this.botName = baseName;
    this.gameRoom = gameRoom;
    this.userId = `bot_${baseName}_${Date.now()}`;
    this.socket = io(serverUrl);
    this.gameState = {
      playerIndex: -1,
      gameMap: [],
      generals: [],
      cities: [],
      width: 0,
      height: 0,
      armies: [],
      terrain: []
    };

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.socket.on('connect', () => {
      this.socket.emit('set_username', this.userId, this.botName);
      this.socket.emit('join_private', this.gameRoom, this.userId);
    });

    this.socket.on('game_start', (data) => {
      this.gameState.playerIndex = data.playerIndex;
      this.currentTurn = 0;
      this.moveHistory = [];
      this.lastMove = null;
    });

    this.socket.on('game_update', (data) => {
      this.gameState.cities = this.patch(this.gameState.cities, data.cities_diff);
      this.gameState.gameMap = this.patch(this.gameState.gameMap, data.map_diff);
      this.gameState.generals = data.generals;
      
      const { width, height, armies, terrain } = this.parseMap();
      this.gameState.width = width;
      this.gameState.height = height;
      this.gameState.armies = armies;
      this.gameState.terrain = terrain;

      this.currentTurn++;
      this.makeMove();
    });

    this.socket.on('username_taken', () => {
      const counter = this.extractCounter(this.botName) + 1;
      const baseName = this.botName.split(' ')[0];
      this.botName = `${baseName} ${counter}`;
      this.socket.emit('set_username', this.userId, this.botName);
    });
  }

  private extractCounter(name: string): number {
    const match = name.match(/(\d+)$/);
    return match ? parseInt(match[1]) : 1;
  }

  private patch(old: number[], diff: number[]): number[] {
    const result = [...old];
    let i = 0;
    while (i < diff.length) {
      const start = diff[i++];
      const deleteCount = diff[i++];
      const newItems = diff.slice(i, i + deleteCount);
      result.splice(start, deleteCount, ...newItems);
      i += deleteCount;
    }
    return result;
  }

  private parseMap() {
    const width = this.gameState.gameMap[0];
    const height = this.gameState.gameMap[1];
    const size = width * height;
    const armies = this.gameState.gameMap.slice(2, size + 2);
    const terrain = this.gameState.gameMap.slice(size + 2, size * 2 + 2);
    return { width, height, armies, terrain };
  }

  protected getAdjacentTiles(index: number): number[] {
    const row = Math.floor(index / this.gameState.width);
    const col = index % this.gameState.width;
    const adjacent = [];
    
    if (row > 0) adjacent.push(index - this.gameState.width);
    if (row < this.gameState.height - 1) adjacent.push(index + this.gameState.width);
    if (col > 0) adjacent.push(index - 1);
    if (col < this.gameState.width - 1) adjacent.push(index + 1);
    
    return adjacent;
  }

  protected wouldCreateLoop(from: number, to: number): boolean {
    // Check if this move reverses the last move
    if (this.lastMove && this.lastMove.from === to && this.lastMove.to === from) {
      return true;
    }
    
    // Check if we've made this exact move recently (within last 3 turns)
    const recentMoves = this.moveHistory.slice(-3);
    return recentMoves.some(move => 
      move.from === from && move.to === to && 
      this.currentTurn - move.turn < 3
    );
  }

  protected recordMove(from: number, to: number) {
    this.lastMove = { from, to };
    this.moveHistory.push({ from, to, turn: this.currentTurn });
    
    // Keep only last 10 moves to prevent memory bloat
    if (this.moveHistory.length > 10) {
      this.moveHistory.shift();
    }
  }

  protected attack(from: number, to: number) {
    if (!this.wouldCreateLoop(from, to)) {
      this.recordMove(from, to);
      this.socket.emit('attack', from, to);
    }
  }

  protected getPriorityTargets(from: number): number[] {
    const adjacent = this.getAdjacentTiles(from);
    const { armies, terrain } = this.gameState;
    const targets = [];

    for (const adj of adjacent) {
      if (this.wouldCreateLoop(from, adj)) continue;

      const targetTerrain = terrain[adj];
      const canCapture = armies[from] > armies[adj] + 1;

      // Priority 1: Cities (high value)
      if (targetTerrain === -6 && canCapture) {
        targets.push({ tile: adj, priority: 3, armies: armies[adj] });
      }
      // Priority 2: Enemy territory
      else if (targetTerrain >= 0 && targetTerrain !== this.gameState.playerIndex && canCapture) {
        targets.push({ tile: adj, priority: 2, armies: armies[adj] });
      }
      // Priority 3: Empty territory
      else if (targetTerrain === -1) {
        targets.push({ tile: adj, priority: 1, armies: armies[adj] });
      }
    }

    // Sort by priority (high to low), then by weakest target first
    return targets
      .sort((a, b) => b.priority - a.priority || a.armies - b.armies)
      .map(t => t.tile);
  }

  abstract makeMove(): void;

  disconnect() {
    this.socket.disconnect();
  }
}

export class BlobBot extends BaseBot {
  private generationSources: Set<number> = new Set();
  private frontlineTiles: Set<number> = new Set();
  private pathCache: Map<string, number[]> = new Map();
  
  makeMove() {
    const { armies, terrain } = this.gameState;
    
    // DIVIDE AND CONQUER: Lightning fast expansion with robust pathfinding
    this.updateSources();
    this.updateFrontlines();
    
    // Strategy 1: Attack enemy territory (priority)
    const enemyAttack = this.attackEnemiesStrategic();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }
    
    // Strategy 2: Lightning fast expansion
    const expansion = this.expandLightningFast();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
      return;
    }
    
    // Strategy 3: Robust army flow from sources to frontlines
    const armyFlow = this.flowArmiesRobust();
    if (armyFlow) {
      this.attack(armyFlow.from, armyFlow.to);
    }
  }
  
  private updateSources() {
    const { terrain, armies } = this.gameState;
    this.generationSources.clear();
    
    // Add our general
    const ourGeneral = this.gameState.generals[this.gameState.playerIndex];
    if (ourGeneral !== -1) {
      this.generationSources.add(ourGeneral);
    }
    
    // Add cities we control
    for (let i = 0; i < this.gameState.cities.length; i++) {
      const city = this.gameState.cities[i];
      if (terrain[city] === this.gameState.playerIndex) {
        this.generationSources.add(city);
      }
    }
    
    // Add high-army tiles as potential sources
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
        const hasExpansionTarget = adjacent.some(adj => 
          terrain[adj] === -1 || terrain[adj] === -3 || 
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
          if (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex) {
            if (armies[i] > armies[adj] + 1 && !this.wouldCreateLoop(i, adj)) {
              attacks.push({
                from: i,
                to: adj,
                armyAdvantage: armies[i] - armies[adj],
                isGeneral: this.gameState.generals.includes(adj),
                isCity: this.gameState.cities.includes(adj)
              });
            }
          }
        }
      }
    }
    
    if (attacks.length > 0) {
      // Prioritize: generals > cities > highest advantage
      attacks.sort((a, b) => {
        if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
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
    
    // Prioritize expansion from frontlines with most armies, but be more selective
    for (const frontTile of this.frontlineTiles) {
      if (armies[frontTile] > 2) { // Require more armies before expanding
        const adjacent = this.getAdjacentTiles(frontTile);
        
        for (const adj of adjacent) {
          if ((terrain[adj] === -1 || terrain[adj] === -3) && !this.wouldCreateLoop(frontTile, adj)) {
            let priority = this.getExpansionPriority(adj);
            
            // PRIORITIZE CITIES for increased army generation
            if (this.gameState.cities.includes(adj)) {
              priority += 1000; // Highest priority for cities
            }
            
            expansions.push({
              from: frontTile,
              to: adj,
              armies: armies[frontTile],
              priority: priority
            });
          }
        }
      }
    }
    
    if (expansions.length > 0) {
      // Sort by priority, then by army strength, but limit to top 3 options for more strategic play
      expansions.sort((a, b) => b.priority - a.priority || b.armies - a.armies);
      const topExpansions = expansions.slice(0, 3);
      return { from: topExpansions[0].from, to: topExpansions[0].to };
    }
    
    return null;
  }
  
  private flowArmiesRobust(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Flow ALL excess armies to frontlines, not just small amounts
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        // Skip if this is already a frontline tile
        if (this.frontlineTiles.has(i)) continue;
        
        const pathMove = this.findPathToFrontlineRobust(i);
        if (pathMove) {
          return pathMove;
        }
      }
    }
    
    return null;
  }
  
  private findPathToFrontlineRobust(from: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Use BFS to find path to nearest frontline
    const visited = new Set<number>();
    const queue = [{ tile: from, path: [from] }];
    visited.add(from);
    
    while (queue.length > 0) {
      const { tile, path } = queue.shift()!;
      
      // If we reached a frontline, trace back the path
      if (this.frontlineTiles.has(tile) && tile !== from) {
        // Return the first move in the path
        if (path.length > 1) {
          const nextTile = path[1];
          if (armies[from] > armies[nextTile] + 1 && !this.wouldCreateLoop(from, nextTile)) {
            return { from, to: nextTile };
          }
        }
      }
      
      // Explore adjacent tiles
      const adjacent = this.getAdjacentTiles(tile);
      for (const adj of adjacent) {
        if (!visited.has(adj) && terrain[adj] === this.gameState.playerIndex) {
          visited.add(adj);
          queue.push({ tile: adj, path: [...path, adj] });
        }
      }
      
      // Limit search depth to prevent infinite loops
      if (path.length > 10) break;
    }
    
    // Fallback: move to adjacent tile with fewer armies
    const adjacent = this.getAdjacentTiles(from);
    for (const adj of adjacent) {
      if (terrain[adj] === this.gameState.playerIndex && 
          armies[adj] < armies[from] &&
          !this.wouldCreateLoop(from, adj)) {
        return { from, to: adj };
      }
    }
    
    return null;
  }
  
  private getExpansionPriority(position: number): number {
    const { terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(position);
    
    let priority = 10; // Base priority
    
    // Higher priority for tiles that reveal more territory
    const unknownNeighbors = adjacent.filter(adj => terrain[adj] === -3).length;
    priority += unknownNeighbors * 5;
    
    // Higher priority for tiles near neutral territory
    const neutralNeighbors = adjacent.filter(adj => terrain[adj] === -1).length;
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
    
    return Math.max(0, 50 - minDistance); // Higher score for closer tiles
  }
  
  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
}

export class ArrowBot extends BaseBot {
  private explorationTargets: number[] = [];
  private currentTarget: number = -1;
  private failedTargets: Set<number> = new Set();
  
  makeMove() {
    // SEARCH AND DESTROY: Robust pathfinding with imagination
    
    // Strategy 1: Counter-attack if under attack
    const counterAttack = this.findCounterAttack();
    if (counterAttack) {
      this.attack(counterAttack.from, counterAttack.to);
      return;
    }
    
    // Determine strategy based on frontline analysis
    const shouldExplore = this.shouldContinueExploring();
    
    if (!shouldExplore) {
      // Strategy 2: Attack mode - enemy territory available
      const enemyAttack = this.findStrategicEnemyAttack();
      if (enemyAttack) {
        this.attack(enemyAttack.from, enemyAttack.to);
        return;
      }
    }
    
    // Strategy 3: Exploration mode - more unknown territory available
    const exploration = this.findSystematicExploration();
    if (exploration) {
      this.attack(exploration.from, exploration.to);
      return;
    }
    
    // Strategy 4: Fallback - any valid expansion
    const fallback = this.findAnyValidMove();
    if (fallback) {
      this.attack(fallback.from, fallback.to);
    }
  }
  
  private findLookoutTowerCapture(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find adjacent lookout towers we can capture
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          // Check if this is a lookout tower (terrain -3)
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
    
    // Count adjacent tiles from frontlines
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        const hasUnknown = adjacent.some(adj => terrain[adj] === -1 || terrain[adj] === -3);
        const hasEnemy = adjacent.some(adj => terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex);
        
        if (hasUnknown) unknownAdjacent++;
        if (hasEnemy) enemyAdjacent++;
      }
    }
    
    // Continue exploring if more unknown territory than enemy territory
    return unknownAdjacent > enemyAdjacent;
  }
  
  private findCounterAttack(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find enemy tiles adjacent to our territory that we can attack
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
    
    // Prioritize high-army tiles for attacks
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
      // Prioritize generals, then attacks with most total armies (concentrated force)
      attacks.sort((a, b) => {
        if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
        return b.totalArmies - a.totalArmies;
      });
      return { from: attacks[0].from, to: attacks[0].to };
    }
    
    return null;
  }
  
  private findSystematicExploration(): { from: number; to: number } | null {
    // Update exploration targets - imagine directions to explore
    this.updateExplorationTargets();
    
    // PRIORITIZE LOOKOUT TOWERS for map knowledge
    const towerMove = this.findLookoutTowerCapture();
    if (towerMove) {
      return towerMove;
    }
    
    // Try current target first
    if (this.currentTarget !== -1 && !this.failedTargets.has(this.currentTarget)) {
      const pathMove = this.findPathToTarget(this.currentTarget);
      if (pathMove) {
        return pathMove;
      } else {
        // Mark target as failed and try next
        this.failedTargets.add(this.currentTarget);
        this.currentTarget = -1;
      }
    }
    
    // Pick new exploration target
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
    
    // If all targets failed, expand to any fog of war
    return this.expandToFog();
  }
  
  private updateExplorationTargets() {
    const { terrain, width, height } = this.gameState;
    this.explorationTargets = [];
    
    // Find all fog of war tiles (-3) and prioritize by strategic value
    const fogTiles = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === -3) {
        fogTiles.push({
          position: i,
          priority: this.calculateExplorationPriority(i)
        });
      }
    }
    
    // Sort by priority and take top targets
    fogTiles.sort((a, b) => b.priority - a.priority);
    this.explorationTargets = fogTiles.slice(0, 10).map(t => t.position);
    
    // If no fog tiles, target map edges
    if (this.explorationTargets.length === 0) {
      this.addEdgeTargets();
    }
  }
  
  private calculateExplorationPriority(position: number): number {
    const { terrain, width } = this.gameState;
    const row = Math.floor(position / width);
    const col = position % width;
    
    let priority = 10;
    
    // Higher priority for tiles near our territory
    const ourTiles = this.getOurTiles();
    if (ourTiles.length > 0) {
      const minDistance = Math.min(...ourTiles.map(tile => this.getDistance(tile, position)));
      priority += Math.max(0, 20 - minDistance); // Closer = higher priority
    }
    
    // Higher priority for central areas
    const centerRow = Math.floor(this.gameState.height / 2);
    const centerCol = Math.floor(width / 2);
    const distanceFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
    priority += Math.max(0, 10 - distanceFromCenter);
    
    return priority;
  }
  
  private findPathToTarget(target: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find our tiles that can move toward the target
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
      // Sort by distance to target, then by army strength
      candidates.sort((a, b) => a.distance - b.distance || b.armies - a.armies);
      return { from: candidates[0].from, to: candidates[0].to };
    }
    
    return null;
  }
  
  private expandToFog(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find any move toward fog of war
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
    
    // Find ANY valid expansion move
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
    
    // If no expansion possible, consolidate armies
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
    
    // Add map edge positions as targets
    for (let i = 0; i < width; i++) {
      this.explorationTargets.push(i); // Top edge
      this.explorationTargets.push((height - 1) * width + i); // Bottom edge
    }
    
    for (let i = 0; i < height; i++) {
      this.explorationTargets.push(i * width); // Left edge
      this.explorationTargets.push(i * width + width - 1); // Right edge
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
