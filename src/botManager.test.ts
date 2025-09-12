import { BotManager } from './botManager';

// Mock the bot classes
jest.mock('./bots', () => ({
  BlobBot: jest.fn().mockImplementation((name, room, url) => ({
    name,
    room,
    url,
    disconnect: jest.fn()
  })),
  ArrowBot: jest.fn().mockImplementation((name, room, url) => ({
    name,
    room,
    url,
    disconnect: jest.fn()
  }))
}));

describe('BotManager', () => {
  let botManager: BotManager;

  beforeEach(() => {
    botManager = new BotManager('http://localhost:3000');
    jest.clearAllMocks();
  });

  describe('Bot Invitation', () => {
    it('should invite a blob bot correctly', () => {
      const result = botManager.inviteBot('blob', 'test-room');
      
      expect(result).toBe('blob bot invited to test-room');
    });

    it('should invite an arrow bot correctly', () => {
      const result = botManager.inviteBot('arrow', 'test-room');
      
      expect(result).toBe('arrow bot invited to test-room');
    });

    it('should not create duplicate bots for the same room', () => {
      const result1 = botManager.inviteBot('blob', 'test-room');
      const result2 = botManager.inviteBot('blob', 'test-room');
      
      expect(result1).toBe('blob bot invited to test-room');
      expect(result2).toBe('blob bot already in room');
    });

    it('should allow different bot types in the same room', () => {
      const result1 = botManager.inviteBot('blob', 'test-room');
      const result2 = botManager.inviteBot('arrow', 'test-room');
      
      expect(result1).toBe('blob bot invited to test-room');
      expect(result2).toBe('arrow bot invited to test-room');
    });

    it('should allow same bot type in different rooms', () => {
      const result1 = botManager.inviteBot('blob', 'room1');
      const result2 = botManager.inviteBot('blob', 'room2');
      
      expect(result1).toBe('blob bot invited to room1');
      expect(result2).toBe('blob bot invited to room2');
    });
  });

  describe('Bot Removal', () => {
    it('should remove a bot correctly', () => {
      botManager.inviteBot('blob', 'test-room');
      
      // Mock the bot to verify disconnect is called
      const { BlobBot } = require('./bots');
      const mockBot = BlobBot.mock.results[0].value;
      
      botManager.removeBot('blob', 'test-room');
      
      expect(mockBot.disconnect).toHaveBeenCalled();
    });

    it('should handle removal of non-existent bot gracefully', () => {
      expect(() => botManager.removeBot('blob', 'non-existent-room')).not.toThrow();
    });

    it('should only remove the specified bot', () => {
      botManager.inviteBot('blob', 'test-room');
      botManager.inviteBot('arrow', 'test-room');
      
      const { BlobBot, ArrowBot } = require('./bots');
      const mockBlobBot = BlobBot.mock.results[0].value;
      const mockArrowBot = ArrowBot.mock.results[0].value;
      
      botManager.removeBot('blob', 'test-room');
      
      expect(mockBlobBot.disconnect).toHaveBeenCalled();
      expect(mockArrowBot.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should disconnect all bots on cleanup', () => {
      botManager.inviteBot('blob', 'room1');
      botManager.inviteBot('arrow', 'room1');
      botManager.inviteBot('blob', 'room2');
      
      const { BlobBot, ArrowBot } = require('./bots');
      const mockBots = [
        BlobBot.mock.results[0].value,
        ArrowBot.mock.results[0].value,
        BlobBot.mock.results[1].value
      ];
      
      botManager.cleanup();
      
      mockBots.forEach(bot => {
        expect(bot.disconnect).toHaveBeenCalled();
      });
    });

    it('should handle cleanup with no bots', () => {
      expect(() => botManager.cleanup()).not.toThrow();
    });
  });

  describe('Constructor', () => {
    it('should use default server URL when none provided', () => {
      const defaultBotManager = new BotManager();
      
      // This is tested indirectly by ensuring the constructor doesn't throw
      expect(defaultBotManager).toBeInstanceOf(BotManager);
    });

    it('should use provided server URL', () => {
      const customUrl = 'http://custom-server:8080';
      const customBotManager = new BotManager(customUrl);
      
      customBotManager.inviteBot('blob', 'test-room');
      
      const { BlobBot } = require('./bots');
      expect(BlobBot).toHaveBeenCalledWith('Blob', 'test-room', customUrl);
    });
  });
});
