export interface Player {
  id: string;
  username: string;
  index: number;
  isBot: boolean;
  eliminated?: boolean;
  eliminationStats?: {
    territories: number;
    armies: number;
  };
}

export interface GameState {
  width: number;
  height: number;
  armies: number[];
  terrain: number[];
  ghostTerrain: number[]; // Tracks eliminated player territories
  generals: number[];
  cities: number[];
  lookoutTowers: number[];
  towerDefense: number[];
  turn: number;
  players: Player[];
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: number;
  playerMoves: Map<number, number>; // playerIndex -> moves used this turn
}

export const TILE_EMPTY = -1;
export const TILE_MOUNTAIN = -2;
export const TILE_FOG = -3;
export const TILE_FOG_OBSTACLE = -4;
export const TILE_LOOKOUT_TOWER = -5;
export const TILE_CITY = -6;

export const MOVES_PER_TURN = 1;
export const TURN_INTERVAL_MS = 1000; // Default 1 second per turn
