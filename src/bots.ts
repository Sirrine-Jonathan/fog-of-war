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
  makeMove() {
    const { armies, terrain } = this.gameState;
    
    // Find all tiles with armies > 1 that we own, sorted by army count (strongest first)
    const myTiles = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        myTiles.push({ tile: i, armies: armies[i] });
      }
    }
    
    // Sort by army count (strongest first) for more aggressive expansion
    myTiles.sort((a, b) => b.armies - a.armies);
    
    // Try to make a move from each tile, prioritizing high-value targets
    for (const { tile } of myTiles) {
      const priorityTargets = this.getPriorityTargets(tile);
      
      if (priorityTargets.length > 0) {
        this.attack(tile, priorityTargets[0]);
        return;
      }
    }
  }
}

export class ArrowBot extends BaseBot {
  private targetDirection: number = -1;
  private stuckCounter: number = 0;

  makeMove() {
    const { armies, terrain } = this.gameState;
    
    // Find our general first
    const generalPos = this.gameState.generals[this.gameState.playerIndex];
    if (generalPos === -1) return;

    // Set initial direction towards center if not set
    if (this.targetDirection === -1) {
      const centerX = Math.floor(this.gameState.width / 2);
      const centerY = Math.floor(this.gameState.height / 2);
      const generalX = generalPos % this.gameState.width;
      const generalY = Math.floor(generalPos / this.gameState.width);
      
      if (generalX < centerX) this.targetDirection = 1; // Right
      else if (generalX > centerX) this.targetDirection = -1; // Left
      else if (generalY < centerY) this.targetDirection = this.gameState.width; // Down
      else this.targetDirection = -this.gameState.width; // Up
    }

    // Find strongest tile that can move in target direction
    let bestMove = null;
    let bestArmies = 0;
    
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const targetTile = i + this.targetDirection;
        const adjacent = this.getAdjacentTiles(i);
        
        if (adjacent.includes(targetTile)) {
          const canCapture = terrain[targetTile] === -1 || 
            (terrain[targetTile] >= 0 && terrain[targetTile] !== this.gameState.playerIndex && 
             armies[i] > armies[targetTile] + 1);
             
          if (canCapture && armies[i] > bestArmies && !this.wouldCreateLoop(i, targetTile)) {
            bestMove = { from: i, to: targetTile };
            bestArmies = armies[i];
          }
        }
      }
    }

    if (bestMove) {
      this.stuckCounter = 0;
      this.attack(bestMove.from, bestMove.to);
      return;
    }

    // If stuck, try any good move or change direction
    this.stuckCounter++;
    if (this.stuckCounter > 3) {
      // Change direction after being stuck
      const directions = [1, -1, this.gameState.width, -this.gameState.width];
      this.targetDirection = directions[Math.floor(Math.random() * directions.length)];
      this.stuckCounter = 0;
    }

    // Fallback: make any good move available
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const priorityTargets = this.getPriorityTargets(i);
        
        if (priorityTargets.length > 0) {
          this.attack(i, priorityTargets[0]);
          return;
        }
      }
    }
  }
}
