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
  
  makeMove() {
    const { armies, terrain } = this.gameState;
    
    // DIVIDE AND CONQUER: Own every tile, move armies from sources to frontlines
    this.updateSources();
    this.updateFrontlines();
    
    // Strategy 1: Attack enemy territory (priority)
    const enemyAttack = this.attackEnemies();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }
    
    // Strategy 2: Expand to own every tile
    const expansion = this.expandTerritory();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
      return;
    }
    
    // Strategy 3: Flow armies from sources to frontlines
    const armyFlow = this.flowArmiesToFrontlines();
    if (armyFlow) {
      this.attack(armyFlow.from, armyFlow.to);
    }
  }
  
  private updateSources() {
    const { terrain } = this.gameState;
    this.generationSources.clear();
    
    // Add our general
    const ourGeneral = this.gameState.generals[this.gameState.playerIndex];
    if (ourGeneral !== -1) {
      this.generationSources.add(ourGeneral);
    }
    
    // Add cities we control (simplified detection)
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        // Cities generate more armies - look for tiles that might be cities
        this.generationSources.add(i); // For now, treat all our tiles as potential sources
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
  
  private attackEnemies(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    let bestAttack = null;
    let bestScore = -1;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex) {
            if (armies[i] > armies[adj] && !this.wouldCreateLoop(i, adj)) {
              const score = armies[i] + armies[adj];
              if (score > bestScore) {
                bestScore = score;
                bestAttack = { from: i, to: adj };
              }
            }
          }
        }
      }
    }
    
    return bestAttack;
  }
  
  private expandTerritory(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Expand from frontline tiles
    const expansionMoves = [];
    
    for (const frontTile of this.frontlineTiles) {
      if (armies[frontTile] > 1) {
        const adjacent = this.getAdjacentTiles(frontTile);
        
        for (const adj of adjacent) {
          if ((terrain[adj] === -1 || terrain[adj] === -3) && !this.wouldCreateLoop(frontTile, adj)) {
            expansionMoves.push({
              from: frontTile,
              to: adj,
              armies: armies[frontTile],
              priority: this.getExpansionPriority(adj)
            });
          }
        }
      }
    }
    
    if (expansionMoves.length > 0) {
      // Sort by priority then by army strength
      expansionMoves.sort((a, b) => b.priority - a.priority || b.armies - a.armies);
      return { from: expansionMoves[0].from, to: expansionMoves[0].to };
    }
    
    return null;
  }
  
  private flowArmiesToFrontlines(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find sources with excess armies
    const sources = [];
    for (const source of this.generationSources) {
      if (armies[source] > 3) {
        sources.push({ tile: source, armies: armies[source] });
      }
    }
    
    sources.sort((a, b) => b.armies - a.armies);
    
    for (const source of sources) {
      const pathToFrontline = this.findPathToFrontline(source.tile);
      if (pathToFrontline) {
        return pathToFrontline;
      }
    }
    
    return null;
  }
  
  private findPathToFrontline(from: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(from);
    
    let bestMove = null;
    let bestScore = -1;
    
    for (const adj of adjacent) {
      if (terrain[adj] === this.gameState.playerIndex && 
          armies[adj] < armies[from] &&
          !this.wouldCreateLoop(from, adj)) {
        
        // Score based on how close this tile is to frontlines
        let score = 0;
        if (this.frontlineTiles.has(adj)) {
          score = 100; // Direct to frontline
        } else {
          // Score based on distance to nearest frontline
          score = this.getDistanceToNearestFrontline(adj);
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = { from, to: adj };
        }
      }
    }
    
    return bestMove;
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
  makeMove() {
    const { armies, terrain } = this.gameState;
    
    // SEARCH AND DESTROY: Simple but reliable exploration
    
    // Strategy 1: Attack any enemy territory
    const enemyAttack = this.findEnemyAttack();
    if (enemyAttack) {
      this.attack(enemyAttack.from, enemyAttack.to);
      return;
    }
    
    // Strategy 2: Expand to any neutral territory
    const expansion = this.findExpansion();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
      return;
    }
    
    // Strategy 3: Move armies toward unexplored areas
    const exploration = this.findExploration();
    if (exploration) {
      this.attack(exploration.from, exploration.to);
    }
  }
  
  private findEnemyAttack(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex) {
            if (armies[i] > armies[adj] && !this.wouldCreateLoop(i, adj)) {
              return { from: i, to: adj };
            }
          }
        }
      }
    }
    return null;
  }
  
  private findExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Find any tile that can expand to neutral territory
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
  
  private findExploration(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    
    // Move armies from interior toward edges/unexplored areas
    const candidates = [];
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);
        
        for (const adj of adjacent) {
          if (terrain[adj] === this.gameState.playerIndex && 
              armies[adj] < armies[i] && 
              !this.wouldCreateLoop(i, adj)) {
            
            // Prefer moving toward edges of our territory
            const isEdgeMove = this.isMovingTowardEdge(adj);
            candidates.push({
              from: i,
              to: adj,
              priority: isEdgeMove ? 2 : 1
            });
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.priority - a.priority);
      return { from: candidates[0].from, to: candidates[0].to };
    }
    
    return null;
  }
  
  private isMovingTowardEdge(position: number): boolean {
    const { terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(position);
    
    // Check if this position is near unexplored territory
    return adjacent.some(adj => 
      terrain[adj] === -1 || terrain[adj] === -3 || 
      (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex)
    );
  }
}
