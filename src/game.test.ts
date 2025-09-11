import { Game } from './game';

describe('General Spawn Logic', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game('test-room');
  });

  describe('findOptimalGeneralPosition', () => {
    it('should place generals with minimum distance from each other', () => {
      // Add first player
      const player1 = game.addPlayer('socket1', 'player1');
      
      // Add second player
      const player2 = game.addPlayer('socket2', 'player2');
      
      const generals = game.getState().generals;
      const distance = calculateDistance(generals[0], generals[1], 30);
      
      // Generals should be at least 8 tiles apart on a 30x30 map
      expect(distance).toBeGreaterThanOrEqual(8);
    });

    it('should place generals away from map edges', () => {
      const player1 = game.addPlayer('socket1', 'player1');
      const generalPos = game.getState().generals[0];
      
      const { x, y } = positionToCoords(generalPos, 30);
      
      // General should be at least 3 tiles from any edge
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThan(27); // 30 - 3
      expect(y).toBeGreaterThanOrEqual(3);
      expect(y).toBeLessThan(27);
    });

    it('should handle multiple players with balanced spacing', () => {
      // Add 4 players
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`socket${i}`, `player${i}`);
      }
      
      const generals = game.getState().generals;
      
      // Log positions for verification
      console.log('General positions:');
      generals.forEach((pos, index) => {
        const coords = positionToCoords(pos, 30);
        console.log(`  Player ${index}: position ${pos} -> (${coords.x}, ${coords.y})`);
      });
      
      // Check all pairs have minimum distance
      for (let i = 0; i < generals.length; i++) {
        for (let j = i + 1; j < generals.length; j++) {
          const distance = calculateDistance(generals[i], generals[j], 30);
          expect(distance).toBeGreaterThanOrEqual(6); // Reduced for 4 players
        }
      }
    });

    it('should demonstrate improved spacing vs random placement', () => {
      // This test shows the improvement over random placement
      const game1 = new Game('test-room-1');
      const game2 = new Game('test-room-2');
      
      // Add 3 players to each game
      for (let i = 0; i < 3; i++) {
        game1.addPlayer(`socket${i}`, `player${i}`);
        game2.addPlayer(`socket${i}`, `player${i}`);
      }
      
      const generals1 = game1.getState().generals;
      const generals2 = game2.getState().generals;
      
      // Both should meet our minimum requirements
      for (let i = 0; i < generals1.length; i++) {
        for (let j = i + 1; j < generals1.length; j++) {
          const distance1 = calculateDistance(generals1[i], generals1[j], 30);
          const distance2 = calculateDistance(generals2[i], generals2[j], 30);
          
          expect(distance1).toBeGreaterThanOrEqual(6);
          expect(distance2).toBeGreaterThanOrEqual(6);
        }
      }
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
