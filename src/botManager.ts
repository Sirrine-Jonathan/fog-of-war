import { BlobBot, ArrowBot } from './bots';

export class BotManager {
  private bots: Map<string, any> = new Map();
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  inviteBot(botType: 'blob' | 'arrow', gameRoom: string): string {
    const botKey = `${botType}_${gameRoom}`;
    
    // Don't create duplicate bots for the same room
    if (this.bots.has(botKey)) {
      return `${botType} bot already in room`;
    }

    let bot;
    if (botType === 'blob') {
      bot = new BlobBot('Blob', gameRoom, this.serverUrl);
    } else {
      bot = new ArrowBot('Arrow', gameRoom, this.serverUrl);
    }

    this.bots.set(botKey, bot);
    return `${botType} bot invited to ${gameRoom}`;
  }

  removeBot(botType: 'blob' | 'arrow', gameRoom: string) {
    const botKey = `${botType}_${gameRoom}`;
    const bot = this.bots.get(botKey);
    
    if (bot) {
      bot.disconnect();
      this.bots.delete(botKey);
    }
  }

  cleanup() {
    for (const bot of this.bots.values()) {
      bot.disconnect();
    }
    this.bots.clear();
  }
}
