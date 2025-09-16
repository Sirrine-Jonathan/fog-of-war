import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { Game } from './game';
import { BotManager } from './botManager';

const app = express();
const server = createServer(app);
const io = new Server(server);

function getPersonalizedGenerals(allGenerals: number[], playerIndex: number, gameState: any): number[] {
  const personalizedGenerals = new Array(allGenerals.length).fill(-1);
  
  // Player always knows their own general position
  personalizedGenerals[playerIndex] = allGenerals[playerIndex];
  
  // Check if player can see enemy generals through vision or discovery
  for (let i = 0; i < allGenerals.length; i++) {
    if (i === playerIndex) continue; // Skip own general
    
    const enemyGeneralPos = allGenerals[i];
    if (enemyGeneralPos === -1) continue; // General doesn't exist or is eliminated
    
    // Validate general position is not a mountain and is within bounds
    if (enemyGeneralPos < 0 || enemyGeneralPos >= gameState.terrain.length) continue;
    if (gameState.terrain[enemyGeneralPos] === -2) continue; // Skip mountains
    
    // Check if enemy general is visible (on player's territory or adjacent to it)
    if (isPositionVisibleToPlayer(enemyGeneralPos, playerIndex, gameState)) {
      personalizedGenerals[i] = enemyGeneralPos;
    }
  }
  
  return personalizedGenerals;
}

function isPositionVisibleToPlayer(position: number, playerIndex: number, gameState: any): boolean {
  // Enemy general is visible if:
  // 1. It's on player's territory (captured)
  // 2. It's adjacent to player's territory (normal vision)
  // 3. It's within lookout tower vision range
  
  if (gameState.terrain[position] === playerIndex) {
    return true; // On player's territory
  }
  
  // Check if position is within normal vision range (adjacent to any player tile)
  const width = gameState.width;
  const height = gameState.height;
  const x = position % width;
  const y = Math.floor(position / width);
  
  // Check all tiles for player ownership and if they provide vision to this position
  for (let i = 0; i < gameState.terrain.length; i++) {
    if (gameState.terrain[i] === playerIndex) {
      const tileX = i % width;
      const tileY = Math.floor(i / width);
      
      // Check if this player tile provides vision to the general position
      // Normal tiles provide adjacent vision (8-directional)
      const dx = Math.abs(tileX - x);
      const dy = Math.abs(tileY - y);
      
      if (dx <= 1 && dy <= 1) {
        return true; // Within normal adjacent vision
      }
      
      // Check if this is a lookout tower providing extended vision
      if (gameState.lookoutTowers && gameState.lookoutTowers.includes(i)) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 5) {
          return true; // Within lookout tower vision (5-tile radius)
        }
      }
    }
  }
  
  return false;
}

const games = new Map<string, Game>();
const playerRooms = new Map<string, string>();
const gameHosts = new Map<string, string>(); // gameId -> socketId of host
const gameHistory = new Map<string, any[]>(); // gameId -> array of completed games

// Game event tracking
const gameFirstBlood = new Map<string, boolean>(); // gameId -> has first blood occurred
const playerTerritoryHistory = new Map<string, Map<number, number[]>>(); // gameId -> playerIndex -> territory counts over time
const playerComebackCooldown = new Map<string, Map<number, number>>(); // gameId -> playerIndex -> last comeback timestamp

// Helper function to send system messages
function sendSystemMessage(gameId: string, message: string) {
  io.to(gameId).emit('chat_message', {
    username: 'System',
    message: message,
    playerIndex: -1,
    timestamp: new Date().toISOString(),
    isSystem: true
  });
}

// Enhanced bot detection function
function isBot(socket: any, userId: string, username: string): boolean {
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const referer = socket.handshake.headers['referer'] || '';
  
  // Strong bot indicators (high confidence)
  const hasNodeUserAgent = userAgent.includes('node') || userAgent.includes('Node');
  const hasSocketIOClient = userAgent.includes('socket.io-client');
  const explicitBotName = username.toLowerCase().includes('bot') && (userId.toLowerCase().includes('bot') || userAgent.includes('node'));
  
  // Only flag as bot if we have strong evidence
  const result = hasNodeUserAgent || hasSocketIOClient || explicitBotName;
  
  console.log(`🤖 Bot detection for ${username}:`, {
    userAgent: userAgent.substring(0, 50) + (userAgent.length > 50 ? '...' : ''),
    referer: referer.substring(0, 30) + (referer.length > 30 ? '...' : ''),
    hasNodeUserAgent,
    hasSocketIOClient,
    explicitBotName,
    isBot: result
  });
  
  return result;
}

// Helper function to find best available host using priority system
async function findBestHost(gameId: string, excludeSocketId?: string): Promise<any> {
  const sockets = await io.in(gameId).fetchSockets();
  
  // Priority 1: Non-bot players (existing behavior)
  const playerHost = sockets.find(s => 
    s.id !== excludeSocketId &&
    !s.data.isViewer &&
    s.data.playerIndex !== undefined &&
    s.data.playerIndex >= 0 &&
    !isBot(s, s.data.userId || '', s.data.username || '') &&
    !s.data.username?.includes('Viewer')
  );
  
  if (playerHost) {
    return playerHost;
  }
  
  // Priority 2: Non-bot viewers/spectators (new behavior for bot-only games)
  const viewerHost = sockets.find(s => 
    s.id !== excludeSocketId &&
    !isBot(s, s.data.userId || '', s.data.username || '') &&
    !s.data.username?.includes('Viewer')
  );
  
  return viewerHost;
}

// Helper function to calculate territory and check for milestones
function checkTerritoryMilestones(gameId: string, game: Game) {
  const gameState = game.getState();
  const totalTiles = gameState.terrain.length;
  const playerCounts = new Map<number, number>();
  
  // Count territory for each player
  gameState.terrain.forEach(owner => {
    if (owner >= 0) {
      playerCounts.set(owner, (playerCounts.get(owner) || 0) + 1);
    }
  });
  
  // Initialize history if needed
  if (!playerTerritoryHistory.has(gameId)) {
    playerTerritoryHistory.set(gameId, new Map());
  }
  const gameHistory = playerTerritoryHistory.get(gameId)!;
  
  // Check each player for milestones and comebacks
  playerCounts.forEach((count, playerIndex) => {
    const player = gameState.players[playerIndex];
    if (!player || player.eliminated) return;
    
    const percentage = Math.floor((count / totalTiles) * 100);
    
    // Initialize player history if needed
    if (!gameHistory.has(playerIndex)) {
      gameHistory.set(playerIndex, []);
    }
    const playerHistory = gameHistory.get(playerIndex)!;
    playerHistory.push(count);
    
    // Check for territory milestones (25%, 50%, 75%)
    const milestones = [25, 50, 75];
    milestones.forEach(milestone => {
      if (percentage >= milestone) {
        const prevCount = playerHistory.length > 1 ? playerHistory[playerHistory.length - 2] : 0;
        const prevPercentage = Math.floor((prevCount / totalTiles) * 100);
        
        if (prevPercentage < milestone) {
          sendSystemMessage(gameId, `🏆 ${player.username} controls ${milestone}% of the map!`);
        }
      }
    });
    
    // Check for comeback (territory tripled from lowest point in last 15 moves, with cooldown)
    if (playerHistory.length >= 15) {
      const recentHistory = playerHistory.slice(-15);
      const minRecent = Math.min(...recentHistory.slice(0, -1));
      const current = count;
      
      // Initialize cooldown map if needed
      if (!playerComebackCooldown.has(gameId)) {
        playerComebackCooldown.set(gameId, new Map());
      }
      const comebackMap = playerComebackCooldown.get(gameId)!;
      const lastComeback = comebackMap.get(playerIndex) || 0;
      const now = Date.now();
      
      // Require 3x growth from low point, 60 second cooldown, and must have been under 10% control
      if (minRecent > 0 && current >= minRecent * 3 && minRecent < totalTiles * 0.1 && (now - lastComeback) > 60000) {
        sendSystemMessage(gameId, `🔥 ${player.username} is making a comeback!`);
        comebackMap.set(playerIndex, now);
      }
    }
  });
}

// Clean up disconnected players every 5 seconds
// Serve static files with no-cache headers for development
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, path) => {
    // Disable caching for all static files in development
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Root route - serve welcome page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Bot documentation route
app.get('/docs/bot', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/bot-docs.html'));
});

// Game history API
app.get('/api/history/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const history = gameHistory.get(gameId) || [];
  res.json({
    gameId,
    totalGames: history.length,
    games: history
  });
});

// Game viewer route
app.get('/game/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});

io.on('connection', (socket) => {
  console.log('🔌 Player connected:', socket.id);
  console.log('   User-Agent:', socket.handshake.headers['user-agent']);
  console.log('   Remote Address:', socket.handshake.address);
  
  // System message for client connection (will be sent when they join a game)

  socket.on('set_username', (userId: string, username: string) => {
    socket.data.userId = userId;
    socket.data.username = username;
    console.log(`👤 User ${userId} set username: ${username}`);
  });

  socket.on('get_current_room', () => {
    const currentRoom = playerRooms.get(socket.id);
    socket.emit('current_room', { room: currentRoom || null });
  });

  socket.on('join_private', async (gameId: string, userId: string) => {
    console.log(`🎮 Join private game request: gameId=${gameId}, userId=${userId}`);
    
    // Leave previous room if any
    const previousRoom = playerRooms.get(socket.id);
    if (previousRoom) {
      console.log(`   Leaving previous room: ${previousRoom}`);
      
      // Remove player from previous game
      const previousGame = games.get(previousRoom);
      if (previousGame && socket.data.userId) {
        const removed = previousGame.removePlayer(socket.data.userId);
        if (removed) {
          console.log(`   Removed player ${socket.data.userId} from game ${previousRoom}`);
          // Clear socket player data
          delete socket.data.playerIndex;
          socket.data.isViewer = true;
          // Notify remaining players in previous room
          io.to(previousRoom).emit('player_left', {
            players: previousGame.getState().players
          });
        }
      }
      
      socket.leave(previousRoom);
    }

    // Join new room
    socket.join(gameId);
    playerRooms.set(socket.id, gameId);
    console.log(`   Joined room: ${gameId}`);

    // Create game if it doesn't exist
    if (!games.has(gameId)) {
      console.log(`   Creating new game: ${gameId}`);
      games.set(gameId, new Game(gameId));
    }

    const game = games.get(gameId)!;
    const username = socket.data.username || 'Player';
    const botDetected = isBot(socket, userId, username);
    
    // Check if this is a viewer (username contains "Viewer" or game is actively running)
    const isViewer = username.includes('Viewer') || (game.isStarted() && !game.isEnded());
    
    if (isViewer) {
      console.log(`👁️ Viewer ${userId} (${username}) joined game ${gameId} [Game State: Started=${game.isStarted()}, Ended=${game.isEnded()}]`);
      socket.data.isViewer = true;
      
      // Viewers cannot be hosts - check if this socket was previously a host
      socket.data.isHost = (gameHosts.get(gameId) === socket.id);
      
      // Send current players list to viewer
      const gameState = game.getState();
      socket.emit('player_joined', {
        players: gameState.players
      });
      
      // Send host and spectator info
      await sendGameInfo(gameId);
      
      // Send current game state to viewer if game is running
      if (game.isStarted()) {
        const mapData = game.getMapData();
        socket.emit('game_start', {
          playerIndex: -1, // Viewer has no player index
          replay_id: gameId,
          usernames: gameState.players.map(p => p.username)
        });
        socket.emit('game_update', mapData);
      }
    } else {
      // Check if this socket is already a player in this game
      if (socket.data.playerIndex !== undefined && !socket.data.isViewer) {
        console.log(`❌ Socket ${socket.id} already joined as player ${socket.data.playerIndex}`);
        return;
      }
      
      // Check for reconnection FIRST, before adding as new player
      if (game.isStarted()) {
        const gameState = game.getState();
        const existingPlayerIndex = gameState.players.findIndex(p => p.id === userId);
        
        if (existingPlayerIndex >= 0) {
          // Player already exists in active game - check if eliminated
          const existingPlayer = gameState.players[existingPlayerIndex];
          if (existingPlayer.eliminated) {
            console.log(`❌ Player ${username} was eliminated and cannot rejoin active game ${gameId}`);
            socket.emit('game_full', { reason: 'Player was eliminated' });
            return;
          }
          
          // Allow reconnection by setting up socket data
          socket.data.playerIndex = existingPlayerIndex;
          socket.data.userId = userId;
          socket.data.isViewer = false;
          
          sendSystemMessage(gameId, `${username} reconnected`);
          console.log(`🔄 Player ${username} reconnected to active game ${gameId} as player ${existingPlayerIndex}`);
          
          // Send current game state to reconnected player
          const mapData = game.getMapData();
          socket.emit('game_start', {
            playerIndex: existingPlayerIndex,
            replay_id: gameId,
            ...mapData
          });
          
          // Send confirmation and continue with normal flow
          socket.emit('joined_as_player', { playerIndex: existingPlayerIndex });
          
          // Notify all players
          io.to(gameId).emit('player_joined', {
            players: gameState.players,
            newPlayerIndex: existingPlayerIndex
          });
          
          return;
        }
        
        console.log(`❌ Cannot join game ${gameId} - game already started`);
        socket.emit('game_already_started');
        return;
      }
      
      // Check for duplicate username (but allow same user to rejoin)
      const currentGameState = game.getState();
      const existingPlayer = currentGameState.players.find(p => p.username === username);
      
      if (existingPlayer && socket.data.userId !== existingPlayer.id) {
        console.log(`❌ Username "${username}" already taken in game ${gameId}`);
        socket.emit('username_taken', { username });
        return;
      }
      
      // This is a new player - try to join the game
      const playerIndex = game.addPlayer(userId, username, botDetected);
      if (playerIndex >= 0) {
        socket.data.playerIndex = playerIndex;
        socket.data.userId = userId;
        socket.data.isViewer = false;
        
        // Assign host if no host exists and this is a real player (not bot)
        if (!gameHosts.has(gameId) && !botDetected) {
          gameHosts.set(gameId, socket.id);
          socket.data.isHost = true;
          console.log(`👑 ${username} assigned as host for game ${gameId}`);
        } else {
          // Check if this socket is already the host
          socket.data.isHost = (gameHosts.get(gameId) === socket.id);
        }
      } else {
        console.log(`❌ Cannot join game ${gameId} - failed to add player`);
        socket.emit('game_already_started');
        return;
      }

      console.log(`✅ Player ${userId} (${username}) ${botDetected ? 'Bot' : 'Human'} joined game ${gameId} as player ${playerIndex} [Game State: Started=${game.isStarted()}, Ended=${game.isEnded()}]`);
      
      // Send system message for new player join
      sendSystemMessage(gameId, `${username} joined the game`);
      
      // Send confirmation to the joining player
      socket.emit('joined_as_player', { playerIndex });
      
      // Notify all players in room about updated player list
      const gameState = game.getState();
      console.log(`   Broadcasting player_joined to room ${gameId}`);
      console.log(`   Players data:`, gameState.players.map(p => ({ username: p.username, isBot: p.isBot })));
      io.to(gameId).emit('player_joined', {
        players: gameState.players,
        newPlayerIndex: playerIndex
      });
      
      // Send updated game info to ensure host status is correct
      await sendGameInfo(gameId);
    }
    
    // Check and assign host using priority system
    console.log(`🔍 Host check: gameId=${gameId}, hasHost=${gameHosts.has(gameId)}, isBot=${botDetected}, username=${username}, isViewer=${isViewer}`);
    
    if (!botDetected) {
      if (!gameHosts.has(gameId)) {
        // No host exists - assign this client as host
        gameHosts.set(gameId, socket.id);
        socket.data.isHost = true;
        console.log(`👑 ${username} assigned as host for game ${gameId} (${isViewer ? 'viewer' : 'player'} host)`);
        await sendGameInfo(gameId);
      } else if (!isViewer) {
        // Player joining when viewer is host - auto-transfer
        const currentHostId = gameHosts.get(gameId);
        const currentHostSocket = currentHostId ? (await io.in(gameId).fetchSockets()).find(s => s.id === currentHostId) : null;
        
        if (currentHostSocket?.data.isViewer) {
          gameHosts.set(gameId, socket.id);
          currentHostSocket.data.isHost = false;
          socket.data.isHost = true;
          console.log(`👑 Host auto-transferred from viewer ${currentHostSocket.data.username} to player ${username}`);
          await sendGameInfo(gameId);
        }
      }
    } else {
      socket.data.isHost = (gameHosts.get(gameId) === socket.id);
      console.log(`🔍 Host not assigned: hasHost=${gameHosts.has(gameId)}, currentHost=${gameHosts.get(gameId)}, socketId=${socket.id}`);
    }
  });

  // Handle host transfer
  socket.on('transfer_host', async (gameId: string, targetSocketId: string) => {
    if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
      const targetSocket = (await io.in(gameId).fetchSockets()).find(s => s.id === targetSocketId);
      // Allow transfer to players only (not viewers), but from any host type
      if (targetSocket && !isBot(targetSocket, targetSocket.data.userId || '', targetSocket.data.username || '') && !targetSocket.data.isViewer) {
        gameHosts.set(gameId, targetSocketId);
        socket.data.isHost = false;
        targetSocket.data.isHost = true;
        
        console.log(`👑 Host transferred from ${socket.data.username} to ${targetSocket.data.username}`);
        await sendGameInfo(gameId);
      } else {
        console.log(`❌ Invalid host transfer target: ${targetSocket?.data.username || 'unknown'} (must be a player)`);
      }
    }
  });

  // Handle bot kick
  socket.on('kick_bot', async (gameId: string, botUserId: string) => {
    console.log(`🎯 KICK_BOT START: gameId=${gameId}, botUserId=${botUserId}, host=${socket.data.username}`);
    
    if (!socket.data.isHost || gameHosts.get(gameId) !== socket.id) {
      console.log(`❌ Non-host ${socket.data.username} tried to kick bot from game ${gameId}`);
      return;
    }

    const game = games.get(gameId);
    if (!game || game.isStarted()) {
      console.log(`❌ Cannot kick bot - game not found or already started`);
      return;
    }

    const gameState = game.getState();
    const botPlayer = gameState.players.find(p => p.id === botUserId && p.isBot);
    
    console.log({ players: gameState.players, botUserId })
    if (!botPlayer || typeof botUserId !== 'string' || !botUserId) {
      console.log(`❌ Bot ${botUserId} not found in game ${gameId} or invalid botUserId`);
      return;
    }

    console.log(`🤖 Host ${socket.data.username} kicking bot ${botPlayer.username} from game ${gameId}`);
    
    // Remove bot from game
    const removed = game.removePlayer(botUserId);
    console.log(`🎯 GAME.removePlayer result: ${removed}`);
    
    if (removed) {
      // Remove bot from bot manager
      let botType: 'blob' | 'arrow' | null = null;
      if (typeof botUserId === 'string') {
        if (botUserId.toLowerCase().includes('blob')) botType = 'blob';
        else if (botUserId.toLowerCase().includes('arrow')) botType = 'arrow';
      }
      console.log(`🎯 KICK_BOT determined botType: ${botType} from botUserId: ${botUserId}`);
      
      if (!botType) {
        console.log(`❌ Could not determine botType for botUserId: ${botUserId}. Skipping botManager.removeBot.`);
      } else {
        console.log(`🎯 KICK_BOT calling botManager.removeBot(${botType}, ${gameId})`);
        botManager.removeBot(botType as 'blob' | 'arrow', gameId);
        console.log(`🎯 KICK_BOT botManager.removeBot completed`);
      }
      
      // Send system message
      sendSystemMessage(gameId, `${botPlayer.username} was removed from the game`);
      
      // Broadcast updated player list
      console.log(`   Broadcasting player_joined to room ${gameId}`, { players: game.getState().players });
      io.to(gameId).emit('player_joined', {
        players: game.getState().players
      });
      
      await sendGameInfo(gameId);
    }
    console.log(`🎯 KICK_BOT END`);
  });

  // Helper function to send game info
  async function sendGameInfo(gameId: string) {
    const sockets = await io.in(gameId).fetchSockets();
    const spectatorCount = sockets.filter(s => s.data.isViewer).length;
    const hostSocketId = gameHosts.get(gameId);
    const hostSocket = sockets.find(s => s.id === hostSocketId);
    
    // Build player index to socket ID mapping
    const playerSocketMap: { [key: string]: string } = {};
    sockets.forEach(s => {
      if (s.data.playerIndex !== undefined && !s.data.isViewer) {
        playerSocketMap[s.data.playerIndex.toString()] = s.id;
      }
    });
    
    io.to(gameId).emit('game_info', {
      spectatorCount,
      hostName: hostSocket?.data.username || null,
      hostSocketId,
      playerSocketMap
    });
  }

  socket.on('set_force_start', async (gameId: string, force: boolean) => {
    // Only allow host to start game
    const currentHost = gameHosts.get(gameId);
    console.log(`🚀 Start game attempt by ${socket.data.username} (${socket.id}). Current host: ${currentHost}, Is host: ${socket.data.isHost}`);
    
    if (!socket.data.isHost || currentHost !== socket.id) {
      console.log(`❌ Non-host ${socket.data.username} tried to start game ${gameId}`);
      return;
    }
    console.log(`🚀 Force start request: gameId=${gameId}, force=${force}`);
    const game = games.get(gameId);
    if (game && force) {
      const playerCount = game.getState().players.length;
      
      // Require at least 2 players
      if (playerCount < 2) {
        console.log(`   ❌ Cannot start game with only ${playerCount} player(s). Need at least 2 players.`);
        socket.emit('game_start_error', 'Need at least 2 players to start the game');
        return;
      }
      
      console.log(`   Starting game: ${gameId}`);
      game.startGame();
      
      // Send system message for game start
      sendSystemMessage(gameId, `🎮 Game has started! Good luck to all players!`);
      
      // Initialize game tracking
      gameFirstBlood.set(gameId, false);
      playerTerritoryHistory.set(gameId, new Map());
      
      // Send initial game state immediately
      const gameState = game.getState();
      
      // Notify each player individually with their own player index
      console.log(`   Broadcasting game_start to room ${gameId}`);
      const sockets = await io.in(gameId).fetchSockets();
      const mapData = game.getMapData();
      
      for (const playerSocket of sockets) {
        playerSocket.emit('game_start', {
          playerIndex: playerSocket.data.playerIndex ?? -1, // -1 for viewers
          replay_id: gameId,
          mapData: mapData
        });
      }

      // Send initial map state to each player individually with proper fog of war
      console.log(`   Broadcasting initial game_update to room ${gameId}`);
      
      // Send personalized updates to each player
      gameState.players.forEach((player, playerIndex) => {
        const playerSocket = [...io.sockets.sockets.values()].find(s => s.data.userId === player.id);
        if (playerSocket) {
          const personalizedGenerals = getPersonalizedGenerals(gameState.generals, playerIndex, gameState);
          playerSocket.emit('game_update', {
            cities_diff: [0, gameState.cities.length, ...gameState.cities],
            map_diff: [0, mapData.length, ...mapData],
            generals: personalizedGenerals,
            players: gameState.players,
            turn: gameState.turn
          });
        }
      });
      
      // Send to viewers (they can see everything)
      const viewerSockets = [...io.sockets.sockets.values()].filter(s => 
        s.rooms.has(gameId) && !gameState.players.some(p => p.id === s.data.userId)
      );
      viewerSockets.forEach(socket => {
        socket.emit('game_update', {
          cities_diff: [0, gameState.cities.length, ...gameState.cities],
          map_diff: [0, mapData.length, ...mapData],
          generals: gameState.generals, // Viewers see all generals
          players: gameState.players,
          turn: gameState.turn
        });
      });

      // Start sending updates
      const updateInterval = setInterval(async () => {
        const gameState = game.getState();
        
        // Log map state every 25 ticks
        if (gameState.turn % 25 === 0) {
          console.log(`\n📊 MAP STATE - Turn ${gameState.turn}:`);
          const playerStats = gameState.players.map(p => {
            const territories = gameState.terrain.filter(t => t === p.index).length;
            const totalArmies = gameState.armies.reduce((sum, armies, i) => 
              gameState.terrain[i] === p.index ? sum + armies : sum, 0);
            return `${p.username}(P${p.index}): ${territories} territories, ${totalArmies} armies`;
          });
          console.log(`   ${playerStats.join(' | ')}`);
        }
        
        if (gameState.gameEnded) {
          // Notify players of game end
          console.log(`   Game ${gameId} ended, winner: ${gameState.winner}`);
          io.to(gameId).emit('game_won', { winner: gameState.winner });
          
          // Store game data for replay/analysis before resetting
          const completedGame = {
            gameId,
            endTime: new Date().toISOString(),
            winner: gameState.winner,
            finalState: JSON.parse(JSON.stringify(gameState)), // Deep copy
            players: gameState.players.map(p => ({
              id: p.id,
              username: p.username,
              index: p.index,
              isBot: p.isBot,
              eliminated: p.eliminated
            })),
            duration: Date.now() - (game as any).startTime || 0 // Assuming we track start time
          };
          
          // Store in history
          if (!gameHistory.has(gameId)) {
            gameHistory.set(gameId, []);
          }
          gameHistory.get(gameId)!.push(completedGame);
          console.log(`   📊 Game data stored for replay/analysis`);
          
          // Clear ALL players' socket data so they need to rejoin (including bots)
          const sockets = await io.in(gameId).fetchSockets();
          for (const playerSocket of sockets) {
            if (playerSocket.data.playerIndex !== undefined && !playerSocket.data.isViewer) {
              console.log(`   🧹 Clearing player data for ${playerSocket.data.username}`);
              delete playerSocket.data.playerIndex;
              playerSocket.data.isViewer = true;
            }
          }
          
          // Reset the game state to clear player list
          game.reset();
          console.log(`   🔄 Game state reset - players list cleared`);
          
          // Remove all bots from this room
          botManager.removeAllBotsFromRoom(gameId);
          console.log(`   🤖 All bots removed from room ${gameId}`);
          
          // Clear host when game resets
          gameHosts.delete(gameId);
          console.log(`   👑 Host cleared for game ${gameId}`);
          
          // Send updated player list (should be empty now)
          io.to(gameId).emit('player_joined', { players: [] });
          await sendGameInfo(gameId);
          
          // Assign new host after game cleanup
          await assignHostAfterGameEnd(gameId);
          
          clearInterval(updateInterval);
          return;
        }

        const mapData = game.getMapData();
        
        // Send personalized updates to each player with fog of war
        gameState.players.forEach((player, playerIndex) => {
          const playerSocket = [...io.sockets.sockets.values()].find(s => s.data.userId === player.id);
          if (playerSocket) {
            const personalizedGenerals = getPersonalizedGenerals(gameState.generals, playerIndex, gameState);
            
            // Debug logging for general data integrity - Spiral only
            if (gameState.turn % 50 === 0 && player.username === 'Spiral') {
              console.log(`🔍 General data for ${player.username}:`, {
                allGenerals: gameState.generals,
                personalizedGenerals,
                visibleCount: personalizedGenerals.filter(g => g >= 0).length
              });
            }
            
            playerSocket.emit('game_update', {
              cities_diff: [0, gameState.cities.length, ...gameState.cities],
              lookoutTowers_diff: [0, gameState.lookoutTowers.length, ...gameState.lookoutTowers],
              map_diff: [0, mapData.length, ...mapData],
              generals: personalizedGenerals,
              players: gameState.players,
              turn: gameState.turn
            });
          }
        });
        
        // Send full data to viewers
        const viewerSockets = [...io.sockets.sockets.values()].filter(s => 
          s.rooms.has(gameId) && !gameState.players.some(p => p.id === s.data.userId)
        );
        viewerSockets.forEach(socket => {
          socket.emit('game_update', {
            cities_diff: [0, gameState.cities.length, ...gameState.cities],
            lookoutTowers_diff: [0, gameState.lookoutTowers.length, ...gameState.lookoutTowers],
            map_diff: [0, mapData.length, ...mapData],
            generals: gameState.generals, // Viewers see all generals
            players: gameState.players,
            turn: gameState.turn
          });
        });
      }, 100);
    } else {
      console.log(`   Game not found or force=false: gameId=${gameId}, game exists=${!!game}, force=${force}`);
    }
  });

socket.on('chat_message', (data: { gameId: string, message: string, username: string }) => {
  // Validate and sanitize input
  const sanitizedMessage = data.message
    .trim()
    .slice(0, 500) // Limit message length
    .replace(/[<>]/g, ''); // Basic XSS prevention

  if (!sanitizedMessage) return;
  
  const game = games.get(data.gameId);
  if (!game) return;
  
  // Find player index for color coding
  let playerIndex = -1;
  if (socket.data.playerIndex !== undefined) {
    playerIndex = socket.data.playerIndex;
  }
  
  // Broadcast message to all players in the game
  io.to(data.gameId).emit('chat_message', {
    username: data.username,
    message: data.message,
    playerIndex: playerIndex,
    timestamp: new Date().toISOString()
  });
});

  socket.on('attack', async (from: number, to: number) => {
    const roomId = playerRooms.get(socket.id);
    const game = games.get(roomId || '');
    const playerIndex = socket.data.playerIndex;
    const playerName = socket.data.username || 'Unknown';
    
    // Enhanced logging with strategic context
    if (game) {
      const gameMap = game.getMapData();
      const fromArmies = gameMap[from + 2]; // armies start at index 2
      const toArmies = gameMap[to + 2];
      const size = gameMap[0] * gameMap[1];
      const fromTerrain = gameMap[from + size + 2]; // terrain starts after armies
      const toTerrain = gameMap[to + size + 2];
      
      let moveType = 'EXPAND';
      if (toTerrain >= 0 && toTerrain !== playerIndex) {
        moveType = 'ATTACK';
      }
      
      // Only log Spiral moves
      if (playerName === 'Spiral') {
        console.log(`⚔️ ${moveType}: ${playerName}(P${playerIndex}) ${from}(${fromArmies}) -> ${to}(${toArmies})`);
      }
    } else {
      // Remove this log
    }
    
    // Prevent viewers from attacking
    if (socket.data.isViewer) {
      console.log(`   Attack blocked: viewer cannot attack`);
      return;
    }
    
    if (game && socket.data.playerIndex !== undefined) {
      const result = game.attack(socket.data.playerIndex, from, to);
      console.log(`   Attack result: ${result.success}, events: ${result.events.length}`);
      
      // Send system messages for events
      result.events.forEach(event => {
        sendSystemMessage(roomId || '', event);
      });
      
      // Check for first blood (only on player vs player attacks)
      if (result.success && !gameFirstBlood.get(roomId || '')) {
        const gameState = game.getState();
        const defenderOwner = gameState.terrain[to];
        
        // Only trigger first blood on attacks against other players
        if (defenderOwner >= 0 && defenderOwner !== socket.data.playerIndex) {
          gameFirstBlood.set(roomId || '', true);
          sendSystemMessage(roomId || '', '⚔️ First blood! The battle has begun!');
        }
      }
      
      // Check territory milestones and comebacks
      if (result.success) {
        checkTerritoryMilestones(roomId || '', game);
      }
      
      // Send attack result back to client
      socket.emit('attack_result', { from, to, success: result.success, attackInfo: result.attackInfo });
      
      // Handle general capture notification
      if (result.attackInfo?.generalCaptured !== undefined) {
        const capturedPlayerIndex = result.attackInfo.generalCaptured;
        const gameState = game.getState();
        const capturedPlayer = gameState.players[capturedPlayerIndex];
        
        // Find the socket for the captured player and notify them
        const sockets = await io.in(roomId || '').fetchSockets();
        const capturedSocket = sockets.find(s => s.data.playerIndex === capturedPlayerIndex);
        if (capturedSocket) {
          capturedSocket.emit('generalCaptured');
        }
      }
      
      // Handle territory capture notification
      if (result.attackInfo?.territoryCaptured !== undefined) {
        const capturedPlayerIndex = result.attackInfo.territoryCaptured;
        const gameState = game.getState();
        const capturedPlayer = gameState.players[capturedPlayerIndex];
        
        // Find the socket for the player who lost territory and notify them
        const sockets = await io.in(roomId || '').fetchSockets();
        const capturedSocket = sockets.find(s => s.data.playerIndex === capturedPlayerIndex);
        if (capturedSocket) {
          capturedSocket.emit('territoryCaptured');
        }
      }
    } else {
      console.log(`   Attack failed: game=${!!game}, playerIndex=${socket.data.playerIndex}, roomId=${roomId}`);
    }
  });

  socket.on('invite_bot', (gameId: string, botType: 'blob' | 'arrow' | 'spiral') => {
    console.log(`🤖 Bot invite request: gameId=${gameId}, botType=${botType}`);
    
    if (!games.has(gameId)) {
      socket.emit('bot_invite_error', 'Game not found');
      return;
    }

    const result = botManager.inviteBot(botType, gameId);
    socket.emit('bot_invite_result', result);
    
    // Notify all players in the room
    io.to(gameId).emit('chat_message', {
      username: 'System',
      message: `${botType.charAt(0).toUpperCase() + botType.slice(1)} bot has been invited to the game`,
      playerIndex: -1,
      timestamp: Date.now(),
      isSystem: true
    });
  });

  socket.on('end_bot_game', (gameId: string) => {
    console.log(`🤖 Viewer requesting to end bot-only game ${gameId}`);
    
    const game = games.get(gameId);
    if (!game || !game.isStarted() || game.isEnded()) {
      console.log(`❌ Cannot end game - invalid state`);
      return;
    }
    
    const gameState = game.getState();
    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const humanPlayers = activePlayers.filter(p => !p.isBot);
    
    if (humanPlayers.length > 0) {
      console.log(`❌ Cannot end game - ${humanPlayers.length} human players still active`);
      socket.emit('end_game_error', 'Cannot end game while human players are active');
      return;
    }
    
    console.log(`✅ Ending bot-only game with ${activePlayers.length} bots remaining`);
    sendSystemMessage(gameId, `Game ended by viewer - only bots remaining`);
    
    setTimeout(() => {
      game.endGame(-1); // No winner
    }, 1000);
  });

  socket.on('abandon_game', (gameId: string, userId: string) => {
    console.log(`🏃 Player ${userId} abandoning game ${gameId}`);
    
    if (!games.has(gameId)) {
      console.log(`❌ Game ${gameId} not found`);
      return;
    }
    
    const game = games.get(gameId)!;
    const gameState = game.getState();
    const player = gameState.players.find(p => p.id === userId);
    
    if (!player || player.eliminated) {
      console.log(`❌ Player ${userId} not found or already eliminated`);
      return;
    }
    
    // Mark player as eliminated
    player.eliminated = true;
    console.log(`✅ Player ${userId} (${player.username}) marked as eliminated`);
    
    // Send system message
    sendSystemMessage(gameId, `${player.username} abandoned the game`);
    
    // Convert player to viewer
    socket.data.playerIndex = -1;
    socket.data.isViewer = true;
    
    // Check for victory condition
    const remainingPlayers = gameState.players.filter(p => !p.eliminated);
    console.log(`   Remaining players after abandonment: ${remainingPlayers.length}`);
    
    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      sendSystemMessage(gameId, `🎉 ${winner.username} wins the game!`);
      
      // End the game after a short delay
      setTimeout(() => {
        console.log(`   Ending game ${gameId} - winner: ${winner.username}`);
        game.endGame(winner.index || 0);
      }, 2000);
    } else if (remainingPlayers.length === 0) {
      // No players left - end game with no winner
      sendSystemMessage(gameId, `Game ended - no players remaining`);
      setTimeout(() => {
        console.log(`   Ending game ${gameId} - no players remaining`);
        game.endGame(-1);
      }, 2000);
    }
    
    // Broadcast updated player list
    io.to(gameId).emit('player_joined', {
      players: gameState.players
    });
    
    // Send game info update
    sendGameInfo(gameId);
  });

  socket.on('leave_game', (gameId: string, userId: string) => {
    console.log(`🚪 Player ${userId} leaving game ${gameId}`);
    
    if (!games.has(gameId)) {
      console.log(`❌ Game ${gameId} not found`);
      return;
    }
    
    const game = games.get(gameId)!;
    const player = game.getPlayers().find(p => p.id === userId);
    const removed = game.removePlayer(userId);
    
    if (removed && player) {
      console.log(`✅ Player ${userId} removed from game ${gameId}`);

      // Send system message for player leave
      sendSystemMessage(gameId, `${player.username} left the game`);

      // Reset player data
      socket.data.playerIndex = -1;
      socket.data.isViewer = true;

      // Transfer host if leaving player was host
      if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
        transferHostToNextPlayer(gameId);
      }

      // Broadcast updated player list
      io.to(gameId).emit('player_joined', {
        players: game.getPlayers()
      });

      sendGameInfo(gameId);
    }
  });

  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    console.log(`🎯 DISCONNECT START: socketId=${socket.id}, roomId=${roomId}, userId=${socket.data.userId}, username=${socket.data.username}`);
    
    if (roomId) {
      console.log(`🚪 Player ${socket.id} disconnected from room ${roomId}`);
      
      const game = games.get(roomId);
      if (game && socket.data.playerIndex >= 0) {
        if (!game.isStarted()) {
          // Game hasn't started - remove player immediately
          const userId = socket.data.userId;
          const username = socket.data.username;
          console.log(`🚪 Removing disconnected player ${userId} from game ${roomId}`);
          
          // Check if this is a bot and remove from bot manager (only if not already removed)
          if (userId && userId.startsWith('bot_')) {
            console.log(`🎯 DISCONNECT detected bot: ${userId}`);
            const botType = userId.toLowerCase().includes('blob') ? 'blob' : 
                           userId.toLowerCase().includes('arrow') ? 'arrow' : null;
            console.log(`🎯 DISCONNECT determined botType: ${botType}`);
            
            if (botType) {
              // Check if bot still exists in bot manager before trying to remove
              const hasBot = botManager.hasBot(botType, roomId);
              console.log(`🎯 DISCONNECT botManager.hasBot(${botType}, ${roomId}): ${hasBot}`);
              
              if (hasBot) {
                console.log(`🤖 Removing bot ${botType} from bot manager for room ${roomId}`);
                botManager.removeBot(botType, roomId);
                console.log(`🎯 DISCONNECT botManager.removeBot completed`);
              } else {
                console.log(`🤖 Bot ${botType} already removed from bot manager for room ${roomId}`);
              }
            }
          }
          
          // Send system message for disconnect
          if (username) {
            sendSystemMessage(roomId, `${username} disconnected`);
          }
          
          game.removePlayer(userId);
          
          // Broadcast updated player list
          io.to(roomId).emit('player_joined', {
            players: game.getPlayers().map(p => ({
              username: p.username,
              index: p.index,
              isBot: p.isBot,
              eliminated: p.eliminated
            }))
          });
        } else {
          // Game is started - immediately abandon the game
          console.log(`🏃 Auto-abandoning game for disconnected player ${socket.data.playerIndex}`);
          
          const gameState = game.getState();
          const player = gameState.players.find(p => p.index === socket.data.playerIndex);
          
          if (player && !player.eliminated) {
            // Mark player as eliminated
            player.eliminated = true;
            console.log(`✅ Player ${player.id} (${player.username}) marked as eliminated due to disconnect`);
            
            // Send system message
            sendSystemMessage(roomId, `${player.username} abandoned the game`);
            
            // Check for victory condition
            const remainingPlayers = gameState.players.filter(p => !p.eliminated);
            console.log(`   Remaining players after disconnect: ${remainingPlayers.length}`);
            
            if (remainingPlayers.length === 1) {
              const winner = remainingPlayers[0];
              sendSystemMessage(roomId, `🎉 ${winner.username} wins the game!`);
              
              // End the game after a short delay
              setTimeout(() => {
                console.log(`   Ending game ${roomId} - winner: ${winner.username}`);
                game.endGame(winner.index || 0);
              }, 2000);
            }
          }
          
          // Convert socket to viewer
          socket.data.playerIndex = -1;
          socket.data.isViewer = true;
          
          // Don't remove from game immediately - let cleanup timer handle it
          playerRooms.delete(socket.id);
          socket.leave(roomId);
          sendGameInfo(roomId);
          console.log(`🎯 DISCONNECT END (game started, tracked for cleanup)`);
          return;
        }
      }
      
      // Transfer host if disconnecting player was host
      if (socket.data.isHost && gameHosts.get(roomId) === socket.id) {
        transferHostToNextPlayer(roomId);
      }
      
      playerRooms.delete(socket.id);
      socket.leave(roomId);
      
      // Update game info for remaining players
      sendGameInfo(roomId);
    } else {
      console.log(`🚪 Player ${socket.id} disconnected (no room)`);
    }
    console.log(`🎯 DISCONNECT END`);
  });

  // Helper to transfer host when current host disconnects
  async function transferHostToNextPlayer(gameId: string) {
    const nextHost = await findBestHost(gameId, socket.id);
    
    if (nextHost) {
      gameHosts.set(gameId, nextHost.id);
      nextHost.data.isHost = true;
      console.log(`👑 Host auto-transferred to ${nextHost.data.username} (${nextHost.data.isViewer ? 'viewer' : 'player'})`);
      
      // Send system message for host transfer
      sendSystemMessage(gameId, `👑 ${nextHost.data.username} is now the host`);
      await sendGameInfo(gameId);
    } else {
      gameHosts.delete(gameId);
      console.log(`👑 No eligible host found for game ${gameId} - game may be abandoned`);
      
      // Check if game should be cleaned up (no connected human players)
      const sockets = await io.in(gameId).fetchSockets();
      const connectedHumans = sockets.filter(s => 
        s.data.playerIndex !== undefined && 
        s.data.playerIndex >= 0 &&
        !isBot(s, s.data.userId || '', s.data.username || '')
      );
      
      if (connectedHumans.length === 0) {
        console.log(`🧹 Game ${gameId} has no connected human players - cleaning up`);
        const game = games.get(gameId);
        if (game && game.isStarted()) {
          sendSystemMessage(gameId, 'Game abandoned - no human players remaining');
          setTimeout(() => {
            game.endGame(-1);
          }, 1000);
        }
      }
    }
  }

  // Helper to assign host after game ends and bots are cleared
  async function assignHostAfterGameEnd(gameId: string) {
    const nextHost = await findBestHost(gameId);
    
    if (nextHost) {
      gameHosts.set(gameId, nextHost.id);
      nextHost.data.isHost = true;
      console.log(`👑 Host assigned to ${nextHost.data.username} after game end`);
      await sendGameInfo(gameId);
    }
  }
});

const PORT = process.env.PORT || 3001;

// Initialize bot manager with dynamic URL
const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const botManager = new BotManager(serverUrl);

server.listen(PORT, () => {
  console.log(`Generals game server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});
