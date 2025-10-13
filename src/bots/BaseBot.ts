import { io, Socket } from "socket.io-client";

interface GameState {
  playerIndex: number;
  gameMap: number[];
  capitals: number[];
  cities: number[];
  width: number;
  height: number;
  armies: number[];
  terrain: number[];
}

export abstract class BaseBot {
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
      capitals: [],
      cities: [],
      width: 0,
      height: 0,
      armies: [],
      terrain: [],
    };

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.socket.on("connect", () => {
      this.socket.emit("set_username", this.userId, this.botName);
      this.socket.emit("join_private", this.gameRoom, this.userId);
    });

    this.socket.on("game_start", (data) => {
      this.gameState.playerIndex = data.playerIndex;
      this.currentTurn = 0;
      this.moveHistory = [];
      this.lastMove = null;
    });

    this.socket.on("game_update", (data) => {
      this.gameState.cities = this.patch(
        this.gameState.cities,
        data.cities_diff
      );
      this.gameState.gameMap = this.patch(
        this.gameState.gameMap,
        data.map_diff
      );
      this.gameState.capitals = data.capitals;

      const { width, height, armies, terrain } = this.parseMap();
      this.gameState.width = width;
      this.gameState.height = height;
      this.gameState.armies = armies;
      this.gameState.terrain = terrain;

      this.currentTurn++;
      this.makeMove();
    });

    this.socket.on("username_taken", () => {
      const counter = this.extractCounter(this.botName) + 1;
      const baseName = this.botName.split(" ")[0];
      this.botName = `${baseName} ${counter}`;
      this.socket.emit("set_username", this.userId, this.botName);
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
    if (row < this.gameState.height - 1)
      adjacent.push(index + this.gameState.width);
    if (col > 0) adjacent.push(index - 1);
    if (col < this.gameState.width - 1) adjacent.push(index + 1);

    return adjacent;
  }

  protected wouldCreateLoop(from: number, to: number): boolean {
    if (
      this.lastMove &&
      this.lastMove.from === to &&
      this.lastMove.to === from
    ) {
      return true;
    }

    const recentMoves = this.moveHistory.slice(-3);
    return recentMoves.some(
      (move) =>
        move.from === from && move.to === to && this.currentTurn - move.turn < 3
    );
  }

  protected recordMove(from: number, to: number) {
    this.lastMove = { from, to };
    this.moveHistory.push({ from, to, turn: this.currentTurn });

    if (this.moveHistory.length > 10) {
      this.moveHistory.shift();
    }
  }

  protected attack(from: number, to: number) {
    if (!this.wouldCreateLoop(from, to)) {
      this.recordMove(from, to);
      this.socket.emit("attack", from, to);
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

      if (targetTerrain === -6 && canCapture) {
        targets.push({ tile: adj, priority: 3, armies: armies[adj] });
      } else if (
        targetTerrain >= 0 &&
        targetTerrain !== this.gameState.playerIndex &&
        canCapture
      ) {
        targets.push({ tile: adj, priority: 2, armies: armies[adj] });
      } else if (targetTerrain === -1) {
        targets.push({ tile: adj, priority: 1, armies: armies[adj] });
      }
    }

    return targets
      .sort((a, b) => b.priority - a.priority || a.armies - b.armies)
      .map((t) => t.tile);
  }

  abstract makeMove(): void;

  disconnect() {
    this.socket.disconnect();
  }
}
