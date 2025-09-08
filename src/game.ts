import { GameState, Player, TILE_EMPTY, TILE_MOUNTAIN, TILE_LOOKOUT_TOWER, TILE_CITY } from './types';

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
    
    // Add strategic mountains (avoid blocking paths) - do this FIRST
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
      lookoutTowers: [],
      towerDefense: new Array(size).fill(0),
      turn: 0,
      players: [],
      gameStarted: false,
      gameEnded: false
    };
  }

  addPlayer(id: string, username: string, isBot: boolean = false): number {
    console.log(`🎮 addPlayer called: id=${id}, username=${username}, isBot=${isBot}`);
    console.log(`   Current game state: started=${this.state.gameStarted}, players=${this.state.players.length}`);
    
    if (this.state.gameStarted) {
      console.log(`❌ Cannot add player - game already started`);
      return -1;
    }
    
    const playerIndex = this.state.players.length;
    console.log(`   Assigning player index: ${playerIndex}`);
    
    this.state.players.push({ id, username, index: playerIndex, isBot });
    console.log(`   Player added to array, new length: ${this.state.players.length}`);
    
    // Place general - this should always succeed with proper map size
    console.log(`   Finding position for general...`);
    const generalPos = this.findEmptyPosition();
    console.log(`   General position found: ${generalPos}`);
    
    this.state.generals[playerIndex] = generalPos;
    this.state.terrain[generalPos] = playerIndex;
    this.state.armies[generalPos] = 1;
    
    console.log(`   General placed: generals[${playerIndex}]=${generalPos}, terrain[${generalPos}]=${playerIndex}, armies[${generalPos}]=1`);
    console.log(`   Final state: ${this.state.players.length} players, ${this.state.generals.length} generals`);
    
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
        console.log(`   Map stats: ${this.state.armies.length} total tiles`);
        
        // Count terrain types
        const terrainCounts: { [key: number]: number } = {};
        this.state.terrain.forEach(t => {
          terrainCounts[t] = (terrainCounts[t] || 0) + 1;
        });
        console.log(`   Terrain distribution:`, terrainCounts);
        
        // Return first empty position found
        for (let i = 0; i < this.state.terrain.length; i++) {
          if (this.state.terrain[i] === TILE_EMPTY) {
            console.log(`   Found empty position at ${i} after exhaustive search`);
            return i;
          }
        }
        throw new Error('No empty positions available on map!');
      }
    } while (this.state.terrain[pos] !== TILE_EMPTY);
    return pos;
  }

  startGame(): void {
    console.log(`🚀 startGame called`);
    console.log(`   Players before start: ${this.state.players.length}`);
    console.log(`   Generals before start: ${this.state.generals.length}`);
    
    // Log all current generals
    this.state.generals.forEach((pos, index) => {
      console.log(`   General ${index}: position=${pos}, terrain[${pos}]=${this.state.terrain[pos]}, armies[${pos}]=${this.state.armies[pos]}`);
    });
    
    this.spawnCities();
    this.spawnLookoutTowers();
    this.state.gameStarted = true;
    
    console.log(`   Game started with ${this.state.players.length} players`);
    
    this.gameInterval = setInterval(() => {
      this.processTurn();
    }, 500); // 2 moves per second
  }

  private spawnCities(): void {
    const cityCount = Math.max(1, Math.floor(this.state.players.length * 3.0));
    console.log(`🏙️  Spawning ${cityCount} cities...`);
    
    for (let i = 0; i < cityCount; i++) {
      try {
        const pos = this.findEmptyPosition();
        this.state.cities.push(pos);
        this.state.terrain[pos] = TILE_CITY;
        this.state.armies[pos] = 40;
        console.log(`   City ${i} placed at position ${pos}`);
      } catch (error) {
        console.warn(`   Could not place city ${i}, map may be full`);
        break;
      }
    }
    console.log(`   Cities spawned: ${this.state.cities.length}`);
  }

  private spawnLookoutTowers(): void {
    const towerCount = Math.max(2, this.state.players.length * 2);
    console.log(`🗼 Spawning ${towerCount} lookout towers...`);
    
    for (let i = 0; i < towerCount; i++) {
      try {
        const pos = this.findEmptyPosition();
        this.state.lookoutTowers.push(pos);
        this.state.terrain[pos] = TILE_LOOKOUT_TOWER;
        this.state.towerDefense[pos] = 10;
        this.state.armies[pos] = 0;
        console.log(`   Tower ${i} placed at position ${pos}`);
      } catch (error) {
        console.warn(`   Could not place lookout tower ${i}, map may be full`);
        break;
      }
    }
    console.log(`   Towers spawned: ${this.state.lookoutTowers.length}`);
    
    // Final verification - check all generals are still intact
    console.log(`🔍 Post-spawn verification:`);
    this.state.generals.forEach((pos, index) => {
      if (pos >= 0) {
        console.log(`   General ${index}: position=${pos}, terrain[${pos}]=${this.state.terrain[pos]}, armies[${pos}]=${this.state.armies[pos]}`);
        if (this.state.terrain[pos] !== index) {
          console.error(`❌ GENERAL ${index} OVERWRITTEN! Expected terrain=${index}, got=${this.state.terrain[pos]}`);
        }
      }
    });
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

  attack(playerIndex: number, from: number, to: number): { success: boolean, events: string[] } {
    // Validate move
    if (!this.isValidMove(playerIndex, from, to)) {
      return { success: false, events: [] };
    }

    const attackerArmies = this.state.armies[from];
    const defenderArmies = this.state.armies[to];
    const defenderOwner = this.state.terrain[to];
    const events: string[] = [];

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
        return { success: false, events };
      }
    } else if (defenderOwner === TILE_CITY) {
      // Attack city
      if (attackForce > defenderArmies) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = attackForce - defenderArmies;
        events.push(`${this.state.players[playerIndex]?.username || `Player ${playerIndex}`} captured a city!`);
      } else {
        // City damaged but not captured - reduce defense like towers
        this.state.armies[to] = Math.max(0, defenderArmies - attackForce);
        return { success: false, events };
      }
    } else if (defenderOwner === TILE_LOOKOUT_TOWER) {
      // Attack lookout tower
      const towerDefense = this.state.towerDefense[to] || 0;
      const remaining = towerDefense - attackForce;
      if (remaining <= 0) {
        // Tower captured
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = Math.abs(remaining);
        this.state.towerDefense[to] = 0;
        events.push(`${this.state.players[playerIndex]?.username || `Player ${playerIndex}`} captured a lookout tower!`);
      } else {
        // Tower damaged but not captured
        this.state.towerDefense[to] = remaining;
        return { success: false, events };
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
          events.push(`${this.state.players[playerIndex]?.username || `Player ${playerIndex}`} eliminated ${this.state.players[defenderOwner]?.username || `Player ${defenderOwner}`}!`);
          
          // Check for victory
          const remainingPlayers = this.state.players.filter(p => !p.eliminated);
          if (remainingPlayers.length === 1) {
            this.endGame(playerIndex);
          }
        }
      } else {
        this.state.armies[to] = remaining;
        return { success: false, events };
      }
    }

    return { success: true, events };
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
    
    // Can't attack mountains or neutral villages
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

  endGame(winner: number): void {
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
      ...this.state.terrain,
      ...this.state.towerDefense
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
