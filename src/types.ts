export interface Player {
  id: string;
  username: string;
  index: number;
  isBot: boolean;
  eliminated?: boolean;
}

export interface GameState {
  width: number;
  height: number;
  armies: number[];
  terrain: number[];
  generals: number[];
  cities: number[];
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
