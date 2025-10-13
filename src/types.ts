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
  capitals: number[];
  cities: number[];
  lookoutTowers: number[];
  towerDefense: number[];
  turn: number;
  players: Player[];
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: number;
}

export const TILE_EMPTY = -1;
export const TILE_MOUNTAIN = -2;
export const TILE_FOG = -3;
export const TILE_FOG_OBSTACLE = -4;
export const TILE_LOOKOUT_TOWER = -5;
export const TILE_CITY = -6;
