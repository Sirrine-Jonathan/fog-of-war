import { GameState, Player, TILE_EMPTY, TILE_MOUNTAIN, TILE_LOOKOUT_TOWER, TILE_CITY } from './types';

export class Game {
  private state: GameState;
  private gameInterval?: NodeJS.Timeout;
  private roomId: string;

  constructor(roomId: string) {
    this.roomId = roomId;
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
      ghostTerrain: new Array(size).fill(TILE_EMPTY),
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
    const generalPos = this.findOptimalGeneralPosition();
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

  private findOptimalGeneralPosition(): number {
    // Special testing layout: place generals exactly 5 tiles apart
    if (this.roomId === 'testing') {
      const existingGenerals = this.state.generals.filter(pos => pos >= 0);
      
      if (existingGenerals.length === 0) {
        // First general: place in center-left area
        const centerRow = Math.floor(this.state.height / 2);
        const centerCol = Math.floor(this.state.width / 2) - 3;
        return centerRow * this.state.width + centerCol;
      } else if (existingGenerals.length === 1) {
        // Second general: place exactly 5 tiles to the right
        const firstGeneral = existingGenerals[0];
        const secondGeneral = firstGeneral + 5;
        
        // Validate position is within bounds and empty
        if (secondGeneral < this.state.terrain.length && 
            this.state.terrain[secondGeneral] === TILE_EMPTY) {
          return secondGeneral;
        }
      }
      
      // Fallback for additional players in testing mode
      return this.findEmptyPosition();
    }
    
    // Normal general placement logic
    const width = 30;
    const height = 30;
    const minEdgeDistance = 3;
    const existingGenerals = this.state.generals.filter(pos => pos >= 0);
    
    // Calculate minimum distance based on number of players
    const getMinDistance = (playerCount: number): number => {
      if (playerCount <= 2) return 8;
      if (playerCount <= 4) return 6;
      return 4;
    };
    
    const minGeneralDistance = getMinDistance(existingGenerals.length + 1);
    
    let bestPosition = -1;
    let bestScore = -1;
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (attempts < maxAttempts) {
      const pos = Math.floor(Math.random() * (width * height));
      attempts++;
      
      // Skip if position is not empty
      if (this.state.terrain[pos] !== TILE_EMPTY) continue;
      
      const { x, y } = this.positionToCoords(pos, width);
      
      // Check edge distance
      const edgeDistance = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (edgeDistance < minEdgeDistance) continue;
      
      // Check distance from existing generals
      let minDistanceFromGenerals = Infinity;
      let validPosition = true;
      
      for (const generalPos of existingGenerals) {
        const distance = this.calculateDistance(pos, generalPos);
        minDistanceFromGenerals = Math.min(minDistanceFromGenerals, distance);
        
        if (distance < minGeneralDistance) {
          validPosition = false;
          break;
        }
      }
      
      if (!validPosition) continue;
      
      // Calculate score (higher is better)
      // Favor positions with good edge distance and far from other generals
      const score = edgeDistance + (minDistanceFromGenerals === Infinity ? 20 : minDistanceFromGenerals);
      
      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
      
      // If we found a really good position, use it
      if (edgeDistance >= minEdgeDistance + 2 && minDistanceFromGenerals >= minGeneralDistance + 2) {
        break;
      }
    }
    
    // Fallback to original method if no optimal position found
    if (bestPosition === -1) {
      console.warn('Could not find optimal general position, falling back to random placement');
      return this.findEmptyPosition();
    }
    
    return bestPosition;
  }

  private positionToCoords(pos: number, width: number): { x: number, y: number } {
    return {
      x: pos % width,
      y: Math.floor(pos / width)
    };
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
    
    if (this.roomId === 'testing') {
      this.createTestingLayout();
    } else {
      this.spawnCities();
      this.spawnLookoutTowers();
    }
    
    this.state.gameStarted = true;
    
    console.log(`   Game started with ${this.state.players.length} players`);
    
    this.gameInterval = setInterval(() => {
      this.processTurn();
    }, 500); // 2 moves per second
  }

  private createTestingLayout(): void {
    console.log(`🧪 Creating testing layout for room: ${this.roomId}`);
    
    // Clear existing terrain (keep generals)
    for (let i = 0; i < this.state.terrain.length; i++) {
      if (this.state.terrain[i] !== TILE_EMPTY && !this.state.generals.includes(i)) {
        this.state.terrain[i] = TILE_EMPTY;
        this.state.armies[i] = 0;
      }
    }
    
    // Clear existing cities and towers
    this.state.cities = [];
    this.state.lookoutTowers = [];
    
    if (this.state.generals.length >= 2) {
      const gen1 = this.state.generals[0];
      const gen2 = this.state.generals[1];
      
      // Calculate center point between generals
      const gen1Row = Math.floor(gen1 / this.state.width);
      const gen1Col = gen1 % this.state.width;
      const gen2Row = Math.floor(gen2 / this.state.width);
      const gen2Col = gen2 % this.state.width;
      
      const centerRow = Math.floor((gen1Row + gen2Row) / 2);
      const centerCol = Math.floor((gen1Col + gen2Col) / 2);
      const centerPos = centerRow * this.state.width + centerCol;
      
      // Place towers 1 tile away from each general
      const tower1 = gen1 + 2; // Right of gen1
      const tower2 = gen2 - 2; // Left of gen2
      
      // Place cities 1 tile away from each general (different direction)
      const city1 = gen1 + (this.state.width * 2); // Below gen1
      const city2 = gen2 - (this.state.width * 2); // Above gen2
      
      // Place mountains 1 tile away from each general (third direction)
      const mountain1 = gen1 - 2; // Left of gen1
      const mountain2 = gen2 + 2; // Right of gen2
      
      // Validate and place elements
      const elements = [
        { pos: city1, type: TILE_CITY, armies: 40, name: 'City 1' },
        { pos: city2, type: TILE_CITY, armies: 40, name: 'City 2' },
        { pos: tower1, type: TILE_LOOKOUT_TOWER, armies: 0, name: 'Tower 1' },
        { pos: tower2, type: TILE_LOOKOUT_TOWER, armies: 0, name: 'Tower 2' },
        { pos: mountain1, type: TILE_MOUNTAIN, armies: 0, name: 'Mountain 1' },
        { pos: mountain2, type: TILE_MOUNTAIN, armies: 0, name: 'Mountain 2' }
      ];
      
      elements.forEach(element => {
        if (element.pos >= 0 && element.pos < this.state.terrain.length && 
            this.state.terrain[element.pos] === TILE_EMPTY) {
          this.state.terrain[element.pos] = element.type;
          this.state.armies[element.pos] = element.armies;
          
          if (element.type === TILE_CITY) {
            this.state.cities.push(element.pos);
          } else if (element.type === TILE_LOOKOUT_TOWER) {
            this.state.lookoutTowers.push(element.pos);
            this.state.towerDefense[element.pos] = 40;
          }
          
          console.log(`   ${element.name} placed at position ${element.pos}`);
        }
      });
    }
    
    console.log(`🧪 Testing layout complete: ${this.state.cities.length} cities, ${this.state.lookoutTowers.length} towers`);
  }

  private spawnCities(): void {
    const cityCount = Math.max(1, Math.floor(this.state.players.length * 6.0));
    const MIN_CITY_DISTANCE = 3; // Cities must be at least n tiles apart
    console.log(`🏙️  Spawning ${cityCount} cities with ${MIN_CITY_DISTANCE} tile separation...`);
    
    const placedCities: number[] = [];
    const maxAttempts = this.state.width * this.state.height;
    
    for (let attempt = 0; attempt < maxAttempts && placedCities.length < cityCount; attempt++) {
      try {
        const pos = this.findEmptyPosition();
        
        // Check if this position conflicts with existing cities
        const conflicts = placedCities.some(existingPos => {
          const distance = this.calculateDistance(pos, existingPos);
          return distance < MIN_CITY_DISTANCE;
        });
        
        if (!conflicts) {
          placedCities.push(pos);
          this.state.cities.push(pos);
          this.state.terrain[pos] = TILE_CITY;
          this.state.armies[pos] = 40;
          console.log(`   City ${placedCities.length} placed at position ${pos}`);
        }
      } catch (error) {
        console.warn(`   Could not find more valid city positions after ${attempt} attempts`);
        break;
      }
    }
    console.log(`   Cities spawned: ${this.state.cities.length}`);
  }

  private spawnLookoutTowers(): void {
    const TOWER_SIGHT_RADIUS = 5;
    const MIN_TOWER_DISTANCE = TOWER_SIGHT_RADIUS * 2 + 1; // 11 tiles apart
    
    console.log(`🗼 Spawning maximum lookout towers with ${MIN_TOWER_DISTANCE} tile separation...`);
    
    const placedTowers: number[] = [];
    const maxAttempts = this.state.width * this.state.height;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const pos = this.findEmptyPosition();
        
        // Check if this position conflicts with existing towers
        const conflicts = placedTowers.some(existingPos => {
          const distance = this.calculateDistance(pos, existingPos);
          return distance < MIN_TOWER_DISTANCE;
        });
        
        if (!conflicts) {
          placedTowers.push(pos);
          this.state.lookoutTowers.push(pos);
          this.state.terrain[pos] = TILE_LOOKOUT_TOWER;
          this.state.towerDefense[pos] = 25;
          this.state.armies[pos] = 0;
          console.log(`   Tower ${placedTowers.length} placed at position ${pos}`);
        }
      } catch (error) {
        console.warn(`   Could not find more valid tower positions after ${attempt} attempts`);
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

  private calculateDistance(pos1: number, pos2: number): number {
    const row1 = Math.floor(pos1 / this.state.width);
    const col1 = pos1 % this.state.width;
    const row2 = Math.floor(pos2 / this.state.width);
    const col2 = pos2 % this.state.width;
    
    return Math.max(Math.abs(row1 - row2), Math.abs(col1 - col2));
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

  attack(playerIndex: number, from: number, to: number): { success: boolean, events: string[], attackInfo?: { attackForce: number, defenderLoss: number, isPlayerVsPlayer: boolean, territoryType: string, generalCaptured?: number, territoryCaptured?: number } } {
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

    // Track attack info for player vs player attacks
    let attackInfo: { attackForce: number, defenderLoss: number, isPlayerVsPlayer: boolean, territoryType: string, generalCaptured?: number, territoryCaptured?: number } | undefined;

    if (defenderOwner === playerIndex) {
      // Moving to own territory - transfer armies
      this.state.armies[to] += attackForce;
      
      // Set attack info for own territory move
      attackInfo = {
        attackForce: attackForce,
        defenderLoss: 0,
        isPlayerVsPlayer: false,
        territoryType: 'owned'
      };
      console.log('🏠 Move to owned territory detected');
    } else if (defenderOwner === TILE_EMPTY) {
      // Capture neutral territory
      if (attackForce > defenderArmies) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = attackForce - defenderArmies;
        
        // Set attack info for neutral territory capture
        attackInfo = {
          attackForce: attackForce,
          defenderLoss: defenderArmies,
          isPlayerVsPlayer: false,
          territoryType: 'neutral'
        };
      } else {
        // Failed to capture, armies are lost
        return { success: false, events };
      }
    } else if (defenderOwner === TILE_CITY) {
      // Attack city
      console.log('🏰 Attacking city');
      if (attackForce > defenderArmies) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = attackForce - defenderArmies;
        events.push(`${this.state.players[playerIndex]?.username || `Player ${playerIndex}`} captured a city!`);
        
        // Set attack info for city capture
        attackInfo = {
          attackForce: attackForce,
          defenderLoss: defenderArmies,
          isPlayerVsPlayer: false,
          territoryType: 'city'
        };
        console.log('🏰 City attack info set:', attackInfo);
      } else {
        // City damaged but not captured - reduce defense like towers
        this.state.armies[to] = Math.max(0, defenderArmies - attackForce);
        
        // Still set attack info for failed city attack
        attackInfo = {
          attackForce: attackForce,
          defenderLoss: Math.min(defenderArmies, attackForce),
          isPlayerVsPlayer: false,
          territoryType: 'city'
        };
        console.log('🏰 Failed city attack info set:', attackInfo);
        return { success: false, events, attackInfo };
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
        
        // Set attack info for tower capture
        attackInfo = {
          attackForce: attackForce,
          defenderLoss: towerDefense,
          isPlayerVsPlayer: false,
          territoryType: 'tower'
        };
        console.log('🗼 Successful tower attack info set:', attackInfo);
      } else {
        // Tower damaged but not captured
        this.state.towerDefense[to] = remaining;
        
        // Still set attack info for failed tower attack
        attackInfo = {
          attackForce: attackForce,
          defenderLoss: Math.min(towerDefense, attackForce),
          isPlayerVsPlayer: false,
          territoryType: 'tower'
        };
        console.log('🗼 Failed tower attack info set:', attackInfo);
        return { success: false, events, attackInfo };
      }
    } else if (defenderOwner >= 0 && defenderOwner !== playerIndex) {
      // Attack enemy territory
      console.log('⚔️ Attacking enemy territory');
      const remaining = defenderArmies - attackForce;
      const defenderLoss = Math.min(defenderArmies, attackForce);
      
      // Set attack info for player vs player attacks
      const isGeneralCapture = this.state.generals[defenderOwner] === to;
      attackInfo = {
        attackForce: attackForce,
        defenderLoss: defenderLoss,
        isPlayerVsPlayer: true,
        territoryType: isGeneralCapture ? 'general' : 'enemy'
      };
      console.log('⚔️ Enemy attack info set:', attackInfo);
      
      if (remaining <= 0) {
        this.state.terrain[to] = playerIndex;
        this.state.armies[to] = Math.abs(remaining);
        
        // Mark territory capture for the defender
        attackInfo.territoryCaptured = defenderOwner;
        
        // Check if general was captured
        if (this.state.generals[defenderOwner] === to) {
          this.eliminatePlayer(defenderOwner);
          events.push(`${this.state.players[playerIndex]?.username || `Player ${playerIndex}`} eliminated ${this.state.players[defenderOwner]?.username || `Player ${defenderOwner}`}!`);
          
          // Mark that a general was captured for the server to handle
          attackInfo.generalCaptured = defenderOwner;
          
          // Check for victory
          const remainingPlayers = this.state.players.filter(p => !p.eliminated);
          if (remainingPlayers.length === 1) {
            this.endGame(playerIndex);
          }
        }
      } else {
        this.state.armies[to] = remaining;
        return { success: false, events, attackInfo };
      }
    }

    return { success: true, events, attackInfo };
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
    // Calculate stats before elimination
    let territories = 0;
    let armies = 0;
    for (let i = 0; i < this.state.terrain.length; i++) {
      if (this.state.terrain[i] === playerIndex) {
        territories++;
        armies += this.state.armies[i];
      }
    }
    
    // Mark player as eliminated and store their stats
    this.state.players[playerIndex].eliminated = true;
    this.state.players[playerIndex].eliminationStats = { territories, armies };
    
    // Remove their general
    this.state.generals[playerIndex] = -1;
    
    // Convert their territory to ghost territory (keep player color but make it neutral)
    for (let i = 0; i < this.state.terrain.length; i++) {
      if (this.state.terrain[i] === playerIndex) {
        this.state.ghostTerrain[i] = playerIndex; // Remember the eliminated player
        this.state.terrain[i] = TILE_EMPTY; // Make it neutral
        // Halve the armies as ghost defense
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
      ...this.state.towerDefense,
      ...this.state.ghostTerrain
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
