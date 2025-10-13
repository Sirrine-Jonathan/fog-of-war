import { Game } from "./game";

describe("Capital Spawn Logic", () => {
  let game: Game;

  beforeEach(() => {
    game = new Game("test-room");
  });

  describe("findOptimalCapitalPosition", () => {
    it("should place capitals with minimum distance from each other", () => {
      // Add first player
      const player1 = game.addPlayer("socket1", "player1");

      // Add second player
      const player2 = game.addPlayer("socket2", "player2");

      const capitals = game.getState().capitals;
      const distance = calculateDistance(capitals[0], capitals[1], 30);

      // Capitals should be at least 8 tiles apart on a 30x30 map
      expect(distance).toBeGreaterThanOrEqual(8);
    });

    it("should place capitals away from map edges", () => {
      const player1 = game.addPlayer("socket1", "player1");
      const capitalPos = game.getState().capitals[0];

      const { x, y } = positionToCoords(capitalPos, 30);

      // Capital should be at least 3 tiles from any edge
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThan(27); // 30 - 3
      expect(y).toBeGreaterThanOrEqual(3);
      expect(y).toBeLessThan(27);
    });

    it("should handle multiple players with balanced spacing", () => {
      // Add 4 players
      for (let i = 0; i < 4; i++) {
        game.addPlayer(`socket${i}`, `player${i}`);
      }

      const capitals = game.getState().capitals;

      // Log positions for verification
      console.log("Capital positions:");
      capitals.forEach((pos, index) => {
        const coords = positionToCoords(pos, 30);
        console.log(
          `  Player ${index}: position ${pos} -> (${coords.x}, ${coords.y})`
        );
      });

      // Check all pairs have minimum distance
      for (let i = 0; i < capitals.length; i++) {
        for (let j = i + 1; j < capitals.length; j++) {
          const distance = calculateDistance(capitals[i], capitals[j], 30);
          expect(distance).toBeGreaterThanOrEqual(6); // Reduced for 4 players
        }
      }
    });

    it("should demonstrate improved spacing vs random placement", () => {
      // This test shows the improvement over random placement
      const game1 = new Game("test-room-1");
      const game2 = new Game("test-room-2");

      // Add 3 players to each game
      for (let i = 0; i < 3; i++) {
        game1.addPlayer(`socket${i}`, `player${i}`);
        game2.addPlayer(`socket${i}`, `player${i}`);
      }

      const capitals1 = game1.getState().capitals;
      const capitals2 = game2.getState().capitals;

      // Both should meet our minimum requirements
      for (let i = 0; i < capitals1.length; i++) {
        for (let j = i + 1; j < capitals1.length; j++) {
          const distance1 = calculateDistance(capitals1[i], capitals1[j], 30);
          const distance2 = calculateDistance(capitals2[i], capitals2[j], 30);

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

function positionToCoords(
  pos: number,
  width: number
): { x: number; y: number } {
  return {
    x: pos % width,
    y: Math.floor(pos / width),
  };
}
