import { BlobBot, ArrowBot, SpiralBot } from './bots';

export class BotManager {
  private bots: Map<string, any> = new Map();
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  inviteBot(botType: 'blob' | 'arrow' | 'spiral', gameRoom: string): string {
    const botKey = `${botType}_${gameRoom}`;
    
    // Don't create duplicate bots for the same room
    if (this.bots.has(botKey)) {
      return `${botType} bot already in room`;
    }

    let bot;
    if (botType === 'blob') {
      bot = new BlobBot('Blob', gameRoom, this.serverUrl);
    } else if (botType === 'arrow') {
      bot = new ArrowBot('Arrow', gameRoom, this.serverUrl);
    } else if (botType === 'spiral') {
      bot = new SpiralBot('Spiral', gameRoom, this.serverUrl);
    }

    this.bots.set(botKey, bot);
    return `${botType} bot invited to ${gameRoom}`;
  }

  hasBot(botType: 'blob' | 'arrow' | 'spiral', gameRoom: string): boolean {
    const botKey = `${botType}_${gameRoom}`;
    const exists = this.bots.has(botKey);
    console.log(`🎯 BOTMANAGER.hasBot(${botType}, ${gameRoom}): key=${botKey}, exists=${exists}`);
    return exists;
  }

  removeBot(botType: 'blob' | 'arrow' | 'spiral', gameRoom: string) {
    const botKey = `${botType}_${gameRoom}`;
    const bot = this.bots.get(botKey);
    
    console.log(`🎯 BOTMANAGER.removeBot START: ${botType} from ${gameRoom}`);
    console.log(`   Bot key: ${botKey}, Bot found: ${!!bot}`);
    console.log(`   Current bots:`, Array.from(this.bots.keys()));
    
    if (bot) {
      console.log(`🎯 BOTMANAGER calling bot.disconnect()`);
      bot.disconnect();
      console.log(`🎯 BOTMANAGER calling this.bots.delete(${botKey})`);
      this.bots.delete(botKey);
      console.log(`   ✅ Bot ${botKey} removed successfully`);
      console.log(`   Remaining bots:`, Array.from(this.bots.keys()));
    } else {
      console.log(`   ❌ Bot ${botKey} not found in manager`);
    }
    console.log(`🎯 BOTMANAGER.removeBot END`);
  }

  removeAllBotsFromRoom(gameRoom: string) {
    this.removeBot('blob', gameRoom);
    this.removeBot('arrow', gameRoom);
    this.removeBot('spiral', gameRoom);
  }

  cleanup() {
    for (const bot of this.bots.values()) {
      bot.disconnect();
    }
    this.bots.clear();
  }
}
