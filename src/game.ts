import { GameState, Player, TILE_EMPTY, TILE_MOUNTAIN } from './types';

export class Game {
  private state: GameState;
  private gameInterval?: NodeJS.Timeout;

  constructor(roomId: string) {
    this.state = this.initializeGame();
  }

  private initializeGame(): GameState {
    const width = 30;
    const height = 30;
    const size = width * height;
    
    // Initialize empty map
    const armies = new Array(size).fill(0);
    const terrain = new Array(size).fill(TILE_EMPTY);
    
    // Add strategic mountains (avoid blocking paths)
    const mountainCount = Math.floor(size * 0.1); // 10% mountains
    for (let i = 0; i < mountainCount; i++) {
      let pos;
      let attempts = 0;
      do {
        pos = Math.floor(Math.random() * size);
        attempts++;
      } while (attempts < 50 && (
        // Don't place mountains in corners or edges where generals might spawn
        pos < width || pos >= size - width || 
        pos % width === 0 || pos % width === width - 1
      ));
      
      if (attempts < 50) {
        terrain[pos] = TILE_MOUNTAIN;
      }
    }

    return {
      width,
      height,
      armies,
      terrain,
      generals: [],
      cities: [],
      turn: 0,
      players: [],
      gameStarted: false,
      gameEnded: false
    };
  }

  addPlayer(id: string, username: string, isBot: boolean = false): number {
    const playerIndex = this.state.players.length;
    this.state.players.push({ id, username, index: playerIndex, isBot });
    
    // Place general
    const generalPos = this.findEmptyPosition();
    this.state.generals[playerIndex] = generalPos;
    this.state.terrain[generalPos] = playerIndex;
    this.state.armies[generalPos] = 1;
    
    return playerIndex;
  }

  removePlayer(playerId: string): boolean {
    if (this.state.gameStarted) return false; // Can't remove players after game starts
    
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;
    
    // Remove player's general from map
    const generalPos = this.state.generals[playerIndex];
    if (generalPos !== undefined) {
      this.state.terrain[generalPos] = TILE_EMPTY;
      this.state.armies[generalPos] = 0;
    }
    
    // Remove player and reindex
    this.state.players.splice(playerIndex, 1);
    this.state.generals.splice(playerIndex, 1);
    
    // Reindex remaining players and their territories
    this.state.players.forEach((player, newIndex) => {
      player.index = newIndex;
    });
    
    // Update terrain indices
    for (let i = 0; i < this.state.terrain.length; i++) {
      if (this.state.terrain[i] > playerIndex) {
        this.state.terrain[i]--;
      }
    }
    
    return true;
  }

  getPlayers(): Player[] {
    return this.state.players;
  }

  private findEmptyPosition(): number {
    let pos;
    let attempts = 0;
    do {
      pos = Math.floor(Math.random() * this.state.armies.length);
      attempts++;
      if (attempts > 1000) {
        console.error('Could not find empty position after 1000 attempts');
        // Return first empty position found
        for (let i = 0; i < this.state.terrain.length; i++) {
          if (this.state.terrain[i] === TILE_EMPTY) {
            return i;
          }
        }
        return 0; // Fallback
      }
    } while (this.state.terrain[pos] !== TILE_EMPTY);
    return pos;
  }

  startGame(): void {
    this.state.gameStarted = true;
    this.gameInterval = setInterval(() => {
      this.processTurn();
    }, 500); // 2 moves per second
  }

  private processTurn(): void {
    this.state.turn++;
    
    // Generate armies
    for (let i = 0; i < this.state.terrain.length; i++) {
      const owner = this.state.terrain[i];
      if (owner >= 0) {
        // Generals and cities generate every turn
        if (this.state.generals.includes(i) || this.state.cities.includes(i)) {
          this.state.armies[i]++;
        }
        // Regular tiles generate every 25 turns
        else if (this.state.turn % 25 === 0) {
          this.state.armies[i]++;
        }
      }
    }
  }

  attack(playerIndex: number, from: number, to: number): boolean {
    // Validate move
    if (!this.isValidMove(playerIndex, from, to)) {
      return false;
    }

    const attackerArmies = this.state.armies[from];
    const defenderArmies = this.state.armies[to];
    const defenderOwner = this.state.terrain[to];

    // Execute attack/move
    const attackForce = attackerArmies - 1;
    this.state.armies[from] = 1;

    if (defenderOwner === playerIndex) {
      // Moving to own territory - transfer armies
      this.state.armies[to] += attackForce;
    } else if (defenderOwner === TILE_EMPTY) {
      // Capture neutral territory
      if (attackForce > defenderArmies) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = attackForce - defenderArmies;
      } else {
        // Failed to capture, armies are lost
        return false;
      }
    } else if (defenderOwner >= 0 && defenderOwner !== playerIndex) {
      // Attack enemy territory
      const remaining = defenderArmies - attackForce;
      if (remaining <= 0) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = Math.abs(remaining);
        
        // Check if general was captured
        if (this.state.generals[defenderOwner] === to) {
          this.eliminatePlayer(defenderOwner);
          
          // Check for victory
          const remainingPlayers = this.state.players.filter(p => !p.eliminated);
          if (remainingPlayers.length === 1) {
            this.endGame(playerIndex);
          }
        }
      } else {
        this.state.armies[to] = remaining;
        return false; // Attack failed
      }
    }

    return true;
  }

  private isValidMove(playerIndex: number, from: number, to: number): boolean {
    // Check ownership
    if (this.state.terrain[from] !== playerIndex) {
      console.log(`   Invalid: not owned by player ${playerIndex}, terrain[${from}] = ${this.state.terrain[from]}`);
      return false;
    }
    
    // Check army count
    if (this.state.armies[from] <= 1) {
      console.log(`   Invalid: insufficient armies, armies[${from}] = ${this.state.armies[from]}`);
      return false;
    }
    
    // Check adjacency
    if (!this.isAdjacent(from, to)) {
      console.log(`   Invalid: not adjacent, ${from} -> ${to}`);
      return false;
    }
    
    // Can't attack mountains
    if (this.state.terrain[to] === TILE_MOUNTAIN) {
      console.log(`   Invalid: target is mountain, terrain[${to}] = ${this.state.terrain[to]}`);
      return false;
    }
    
    console.log(`   Valid move: ${from}(${this.state.armies[from]}) -> ${to}(${this.state.armies[to]})`);
    return true;
  }

  private isAdjacent(from: number, to: number): boolean {
    const fromRow = Math.floor(from / this.state.width);
    const fromCol = from % this.state.width;
    const toRow = Math.floor(to / this.state.width);
    const toCol = to % this.state.width;
    
    const rowDiff = Math.abs(fromRow - toRow);
    const colDiff = Math.abs(fromCol - toCol);
    
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }

  private eliminatePlayer(playerIndex: number): void {
    // Mark player as eliminated
    this.state.players[playerIndex].eliminated = true;
    
    // Remove their general
    this.state.generals[playerIndex] = -1;
    
    // Convert all their territory to neutral
    for (let i = 0; i < this.state.terrain.length; i++) {
      if (this.state.terrain[i] === playerIndex) {
        this.state.terrain[i] = TILE_EMPTY;
        // Keep half the armies as neutral defense
        this.state.armies[i] = Math.floor(this.state.armies[i] / 2);
      }
    }
  }

  private endGame(winner: number): void {
    this.state.gameEnded = true;
    this.state.winner = winner;
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
  }

  getMapData(): number[] {
    const size = this.state.width * this.state.height;
    return [
      this.state.width,
      this.state.height,
      ...this.state.armies,
      ...this.state.terrain
    ];
  }

  getState(): GameState {
    return { ...this.state };
  }

  reset(): void {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
    this.state = this.initializeGame();
  }

  isStarted(): boolean {
    return this.state.gameStarted;
  }

  isEnded(): boolean {
    return this.state.gameEnded;
  }
}
