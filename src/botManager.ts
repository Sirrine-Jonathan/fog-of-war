import { BlobBot, ArrowBot, SpiralBot } from "./bots";

export class BotManager {
  private bots: Map<string, any> = new Map();
  private serverUrl: string;

  constructor(serverUrl: string = "http://localhost:3000") {
    this.serverUrl = serverUrl;
  }

  inviteBot(botType: "blob" | "arrow" | "spiral", gameRoom: string): string {
    const botKey = `${botType}_${gameRoom}`;

    // Don't create duplicate bots for the same room
    if (this.bots.has(botKey)) {
      return `${botType} bot already in room`;
    }

    let bot;
    if (botType === "blob") {
      bot = new BlobBot("Blob", gameRoom, this.serverUrl);
    } else if (botType === "arrow") {
      bot = new ArrowBot("Arrow", gameRoom, this.serverUrl);
    } else if (botType === "spiral") {
      bot = new SpiralBot("Spiral", gameRoom, this.serverUrl);
    }

    this.bots.set(botKey, bot);
    return `${botType} bot invited to ${gameRoom}`;
  }

  hasBot(botType: "blob" | "arrow" | "spiral", gameRoom: string): boolean {
    const botKey = `${botType}_${gameRoom}`;
    const exists = this.bots.has(botKey);
    return exists;
  }

  removeBot(botType: "blob" | "arrow" | "spiral", gameRoom: string) {
    const botKey = `${botType}_${gameRoom}`;
    const bot = this.bots.get(botKey);

    if (bot) {
      bot.disconnect();
      this.bots.delete(botKey);
    }
  }

  removeAllBotsFromRoom(gameRoom: string) {
    this.removeBot("blob", gameRoom);
    this.removeBot("arrow", gameRoom);
    this.removeBot("spiral", gameRoom);
  }

  cleanup() {
    for (const bot of this.bots.values()) {
      bot.disconnect();
    }
    this.bots.clear();
  }
}
