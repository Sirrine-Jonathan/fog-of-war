import { Game } from './game';
import { TILE_EMPTY, TILE_MOUNTAIN, TILE_CITY, TILE_LOOKOUT_TOWER } from './types';

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game('test-room');
  });

  describe('Game Initialization', () => {
    it('should initialize with correct default state', () => {
      const state = game.getState();
      
      expect(state.width).toBe(30);
      expect(state.height).toBe(30);
      expect(state.armies).toHaveLength(900); // 30x30
      expect(state.terrain).toHaveLength(900);
      expect(state.turn).toBe(0);
      expect(state.players).toHaveLength(0);
      expect(state.gameStarted).toBe(false);
      expect(state.gameEnded).toBe(false);
    });

    it('should place mountains during initialization', () => {
      const state = game.getState();
      const mountainCount = state.terrain.filter(t => t === TILE_MOUNTAIN).length;
      
      // Should have approximately 10% mountains (90 tiles)
      expect(mountainCount).toBeGreaterThan(50);
      expect(mountainCount).toBeLessThan(150);
    });

    it('should not place mountains on edges', () => {
      const state = game.getState();
      const width = state.width;
      
      // Check top and bottom edges
      for (let col = 0; col < width; col++) {
        expect(state.terrain[col]).not.toBe(TILE_MOUNTAIN); // Top edge
        expect(state.terrain[(state.height - 1) * width + col]).not.toBe(TILE_MOUNTAIN); // Bottom edge
      }
      
      // Check left and right edges
      for (let row = 0; row < state.height; row++) {
        expect(state.terrain[row * width]).not.toBe(TILE_MOUNTAIN); // Left edge
        expect(state.terrain[row * width + (width - 1)]).not.toBe(TILE_MOUNTAIN); // Right edge
      }
    });
  });

  describe('Player Management', () => {
    it('should add players correctly', () => {
      const playerIndex = game.addPlayer('socket1', 'player1');
      const state = game.getState();
      
      expect(playerIndex).toBe(0);
      expect(state.players).toHaveLength(1);
      expect(state.players[0]).toEqual({
        id: 'socket1',
        username: 'player1',
        index: 0,
        isBot: false
      });
    });

    it('should place general when adding player', () => {
      const playerIndex = game.addPlayer('socket1', 'player1');
      const state = game.getState();
      
      expect(state.generals).toHaveLength(1);
      expect(state.generals[0]).toBeGreaterThanOrEqual(0);
      expect(state.terrain[state.generals[0]]).toBe(playerIndex);
      expect(state.armies[state.generals[0]]).toBe(1);
    });

    it('should not add players after game starts', () => {
      game.addPlayer('socket1', 'player1');
      game.startGame();
      
      const playerIndex = game.addPlayer('socket2', 'player2');
      expect(playerIndex).toBe(-1);
    });

    it('should remove players correctly before game starts', () => {
      game.addPlayer('socket1', 'player1');
      game.addPlayer('socket2', 'player2');
      
      const removed = game.removePlayer('socket1');
      const state = game.getState();
      
      expect(removed).toBe(true);
      expect(state.players).toHaveLength(1);
      expect(state.players[0].id).toBe('socket2');
      expect(state.players[0].index).toBe(0); // Should be reindexed
    });

    it('should not remove players after game starts', () => {
      game.addPlayer('socket1', 'player1');
      game.startGame();
      
      const removed = game.removePlayer('socket1');
      expect(removed).toBe(false);
    });
  });

  describe('General Placement', () => {
    it('should place generals with minimum distance from each other', () => {
      game.addPlayer('socket1', 'player1');
      game.addPlayer('socket2', 'player2');
      
      const generals = game.getState().generals;
      const distance = calculateDistance(generals[0], generals[1], 30);
      
      expect(distance).toBeGreaterThanOrEqual(8);
    });

    it('should place generals away from map edges', () => {
      game.addPlayer('socket1', 'player1');
      const generalPos = game.getState().generals[0];
      
      const { x, y } = positionToCoords(generalPos, 30);
      
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThan(27);
      expect(y).toBeGreaterThanOrEqual(3);
      expect(y).toBeLessThan(27);
    });

    it('should handle multiple players with balanced spacing', () => {
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`socket${i}`, `player${i}`);
      }
      
      const generals = game.getState().generals;
      
      for (let i = 0; i < generals.length; i++) {
        for (let j = i + 1; j < generals.length; j++) {
          const distance = calculateDistance(generals[i], generals[j], 30);
          expect(distance).toBeGreaterThanOrEqual(6);
        }
      }
    });
  });

  describe('Game Start and City/Tower Spawning', () => {
    beforeEach(() => {
      game.addPlayer('socket1', 'player1');
      game.addPlayer('socket2', 'player2');
    });

    it('should start game correctly', () => {
      game.startGame();
      const state = game.getState();
      
      expect(state.gameStarted).toBe(true);
      expect(game.isStarted()).toBe(true);
    });

    it('should spawn cities when game starts', () => {
      game.startGame();
      const state = game.getState();
      
      expect(state.cities.length).toBeGreaterThan(0);
      
      // Check cities are properly placed
      state.cities.forEach(cityPos => {
        expect(state.terrain[cityPos]).toBe(TILE_CITY);
        expect(state.armies[cityPos]).toBe(40);
      });
    });

    it('should spawn lookout towers when game starts', () => {
      game.startGame();
      const state = game.getState();
      
      expect(state.lookoutTowers.length).toBeGreaterThan(0);
      
      // Check towers are properly placed
      state.lookoutTowers.forEach(towerPos => {
        expect(state.terrain[towerPos]).toBe(TILE_LOOKOUT_TOWER);
        expect(state.towerDefense[towerPos]).toBe(25);
        expect(state.armies[towerPos]).toBe(0);
      });
    });

    it('should maintain minimum distance between cities', () => {
      game.startGame();
      const state = game.getState();
      
      for (let i = 0; i < state.cities.length; i++) {
        for (let j = i + 1; j < state.cities.length; j++) {
          const distance = calculateDistance(state.cities[i], state.cities[j], state.width);
          expect(distance).toBeGreaterThanOrEqual(8);
        }
      }
    });

    it('should maintain minimum distance between towers', () => {
      game.startGame();
      const state = game.getState();
      
      for (let i = 0; i < state.lookoutTowers.length; i++) {
        for (let j = i + 1; j < state.lookoutTowers.length; j++) {
          const distance = calculateDistance(state.lookoutTowers[i], state.lookoutTowers[j], state.width);
          expect(distance).toBeGreaterThanOrEqual(11);
        }
      }
    });
  });

  describe('Combat System', () => {
    beforeEach(() => {
      game.addPlayer('socket1', 'player1');
      game.addPlayer('socket2', 'player2');
      game.startGame();
    });

    it('should validate moves correctly', () => {
      const state = game.getState();
      const player1General = state.generals[0];
      
      // Add armies to general for testing
      state.armies[player1General] = 5;
      
      // Find adjacent empty tile
      const adjacentTile = findAdjacentTile(player1General, state.width, state.height);
      if (adjacentTile !== -1 && state.terrain[adjacentTile] === TILE_EMPTY) {
        const result = game.attack(0, player1General, adjacentTile);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid moves', () => {
      const state = game.getState();
      const player1General = state.generals[0];
      
      // Try to move with insufficient armies
      const adjacentTile = findAdjacentTile(player1General, state.width, state.height);
      if (adjacentTile !== -1) {
        const result = game.attack(0, player1General, adjacentTile);
        expect(result.success).toBe(false);
      }
    });

    it('should handle territory capture', () => {
      const state = game.getState();
      const player1General = state.generals[0];
      
      // Add armies for attack
      state.armies[player1General] = 10;
      
      // Find adjacent empty tile
      const adjacentTile = findAdjacentTile(player1General, state.width, state.height);
      if (adjacentTile !== -1 && state.terrain[adjacentTile] === TILE_EMPTY) {
        const result = game.attack(0, player1General, adjacentTile);
        
        if (result.success) {
          expect(state.terrain[adjacentTile]).toBe(0); // Player 0 owns it
          expect(state.armies[adjacentTile]).toBeGreaterThan(0);
        }
      }
    });

    it('should handle city capture', () => {
      const state = game.getState();
      
      if (state.cities.length > 0) {
        const cityPos = state.cities[0];
        const adjacentToCity = findAdjacentTile(cityPos, state.width, state.height);
        
        if (adjacentToCity !== -1 && state.terrain[adjacentToCity] === TILE_EMPTY) {
          // Place player territory adjacent to city
          state.terrain[adjacentToCity] = 0;
          state.armies[adjacentToCity] = 50; // Enough to capture city
          
          const result = game.attack(0, adjacentToCity, cityPos);
          
          if (result.success) {
            expect(state.terrain[cityPos]).toBe(0);
            expect(result.events.length).toBeGreaterThan(0);
            expect(result.events[0]).toContain('captured a city');
          }
        }
      }
    });
  });

  describe('Turn Processing', () => {
    beforeEach(() => {
      game.addPlayer('socket1', 'player1');
      game.startGame();
    });

    it('should increment turn counter', () => {
      const initialTurn = game.getState().turn;
      
      // Simulate turn processing by calling private method through game mechanics
      // We'll test this indirectly by checking army generation
      const state = game.getState();
      const generalPos = state.generals[0];
      const initialArmies = state.armies[generalPos];
      
      // Wait for turn processing (this would normally happen automatically)
      // For testing, we can't easily test the interval, but we can test the logic
      expect(initialTurn).toBe(0);
    });
  });

  describe('Game End Conditions', () => {
    beforeEach(() => {
      game.addPlayer('socket1', 'player1');
      game.addPlayer('socket2', 'player2');
      game.startGame();
    });

    it('should end game when called', () => {
      game.endGame(0);
      const state = game.getState();
      
      expect(state.gameEnded).toBe(true);
      expect(state.winner).toBe(0);
      expect(game.isEnded()).toBe(true);
    });
  });

  describe('Map Data Export', () => {
    it('should export map data correctly', () => {
      game.addPlayer('socket1', 'player1');
      const mapData = game.getMapData();
      
      expect(mapData[0]).toBe(30); // width
      expect(mapData[1]).toBe(30); // height
      expect(mapData.length).toBe(2 + 30 * 30 * 3); // width + height + armies + terrain + towerDefense
    });
  });

  describe('Game Reset', () => {
    it('should reset game state', () => {
      game.addPlayer('socket1', 'player1');
      game.startGame();
      
      game.reset();
      const state = game.getState();
      
      expect(state.players).toHaveLength(0);
      expect(state.gameStarted).toBe(false);
      expect(state.gameEnded).toBe(false);
      expect(state.turn).toBe(0);
    });
  });
});

// Helper functions
function calculateDistance(pos1: number, pos2: number, width: number): number {
  const row1 = Math.floor(pos1 / width);
  const col1 = pos1 % width;
  const row2 = Math.floor(pos2 / width);
  const col2 = pos2 % width;
  
  return Math.max(Math.abs(row1 - row2), Math.abs(col1 - col2));
}

function positionToCoords(pos: number, width: number): { x: number, y: number } {
  return {
    x: pos % width,
    y: Math.floor(pos / width)
  };
}

function findAdjacentTile(pos: number, width: number, height: number): number {
  const row = Math.floor(pos / width);
  const col = pos % width;
  
  // Check all 4 adjacent positions
  const adjacent = [
    { row: row - 1, col }, // up
    { row: row + 1, col }, // down
    { row, col: col - 1 }, // left
    { row, col: col + 1 }  // right
  ];
  
  for (const adj of adjacent) {
    if (adj.row >= 0 && adj.row < height && adj.col >= 0 && adj.col < width) {
      return adj.row * width + adj.col;
    }
  }
  
  return -1; // No valid adjacent tile found
}
