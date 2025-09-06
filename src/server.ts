import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { Game } from './game';

const app = express();
const server = createServer(app);
const io = new Server(server);

function parseMapData(mapData: number[]): any {
  const width = 20; // Default width, should match game initialization
  const height = 15; // Default height, should match game initialization
  
  const terrain: number[] = [];
  const armies: number[] = [];
  
  for (let i = 0; i < mapData.length; i += 2) {
    terrain.push(mapData[i]);
    armies.push(mapData[i + 1] || 0);
  }
  
  return {
    width,
    height,
    terrain,
    armies
  };
}

const games = new Map<string, Game>();
const playerRooms = new Map<string, string>();
const gameHosts = new Map<string, string>(); // gameId -> socketId of host
const gameHistory = new Map<string, any[]>(); // gameId -> array of completed games

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

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

  socket.on('set_username', (userId: string, username: string) => {
    socket.data.userId = userId;
    socket.data.username = username;
    console.log(`👤 User ${userId} set username: ${username}`);
  });

  socket.on('join_private', async (gameId: string, userId: string) => {
    console.log(`🎮 Join private game request: gameId=${gameId}, userId=${userId}`);
    
    // Leave previous room if any
    const previousRoom = playerRooms.get(socket.id);
    if (previousRoom) {
      console.log(`   Leaving previous room: ${previousRoom}`);
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
    const isBot = username.includes('Bot') || userId.includes('bot') || socket.handshake.headers['user-agent']?.includes('node');
    
    // Check if this is a viewer (username contains "Viewer" or game is actively running)
    const isViewer = username.includes('Viewer') || (game.isStarted() && !game.isEnded());
    
    // Assign host if this is the first non-bot client
    if (!gameHosts.has(gameId) && !isBot) {
      gameHosts.set(gameId, socket.id);
      socket.data.isHost = true;
      console.log(`👑 ${username} assigned as host for game ${gameId}`);
    } else {
      // Check if this socket is already the host (preserve host status when joining as player)
      socket.data.isHost = (gameHosts.get(gameId) === socket.id);
    }
    
    if (isViewer) {
      console.log(`👁️ Viewer ${userId} (${username}) joined game ${gameId} [Game State: Started=${game.isStarted()}, Ended=${game.isEnded()}]`);
      socket.data.isViewer = true;
      
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
      
      // Check for duplicate username (but allow same user to rejoin)
      const currentGameState = game.getState();
      const existingPlayer = currentGameState.players.find(p => p.username === username);
      
      if (existingPlayer && socket.data.userId !== existingPlayer.id) {
        console.log(`❌ Username "${username}" already taken in game ${gameId}`);
        socket.emit('username_taken', { username });
        return;
      }
      
      const playerIndex = game.addPlayer(userId, username, isBot);
      socket.data.playerIndex = playerIndex;
      socket.data.userId = userId;
      socket.data.isViewer = false;

      console.log(`✅ Player ${userId} (${username}) ${isBot ? 'Bot' : 'Human'} joined game ${gameId} as player ${playerIndex} [Game State: Started=${game.isStarted()}, Ended=${game.isEnded()}]`);
      
      // Send confirmation to the joining player
      socket.emit('joined_as_player', { playerIndex });
      
      // Notify all players in room about updated player list
      const gameState = game.getState();
      console.log(`   Broadcasting player_joined to room ${gameId}`);
      io.to(gameId).emit('player_joined', {
        players: gameState.players,
        newPlayerIndex: playerIndex
      });
      
      // Send updated game info to ensure host status is correct
      await sendGameInfo(gameId);
    }
  });

  // Handle host transfer
  socket.on('transfer_host', async (gameId: string, targetSocketId: string) => {
    if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
      const targetSocket = (await io.in(gameId).fetchSockets()).find(s => s.id === targetSocketId);
      if (targetSocket && !targetSocket.data.username?.includes('Bot') && !targetSocket.data.userId?.includes('bot')) {
        gameHosts.set(gameId, targetSocketId);
        socket.data.isHost = false;
        targetSocket.data.isHost = true;
        
        console.log(`👑 Host transferred from ${socket.data.username} to ${targetSocket.data.username}`);
        await sendGameInfo(gameId);
      } else {
        console.log(`❌ Invalid host transfer target: ${targetSocket?.data.username || 'unknown'}`);
      }
    }
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
      console.log(`   Starting game: ${gameId}`);
      game.startGame();
      
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
          gameState: parseMapData(mapData)
        });
      }

      // Send initial map state
      console.log(`   Broadcasting initial game_update to room ${gameId}`);
      io.to(gameId).emit('game_update', {
        cities_diff: [0, gameState.cities.length, ...gameState.cities],
        map_diff: [0, mapData.length, ...mapData],
        generals: gameState.generals,
        players: gameState.players
      });

      // Start sending updates
      const updateInterval = setInterval(async () => {
        const gameState = game.getState();
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
          
          // Send updated player list (should be empty now)
          io.to(gameId).emit('player_joined', { players: [] });
          await sendGameInfo(gameId);
          
          clearInterval(updateInterval);
          return;
        }

        const mapData = game.getMapData();
        io.to(gameId).emit('game_update', {
          cities_diff: [0, gameState.cities.length, ...gameState.cities],
          map_diff: [0, mapData.length, ...mapData],
          generals: gameState.generals,
          players: gameState.players
        });
      }, 100);
    } else {
      console.log(`   Game not found or force=false: gameId=${gameId}, game exists=${!!game}, force=${force}`);
    }
  });

  socket.on('attack', (from: number, to: number) => {
    console.log(`⚔️ Attack request: from=${from}, to=${to}, player=${socket.data.playerIndex}`);
    const roomId = playerRooms.get(socket.id);
    const game = games.get(roomId || '');
    
    // Prevent viewers from attacking
    if (socket.data.isViewer) {
      console.log(`   Attack blocked: viewer cannot attack`);
      return;
    }
    
    if (game && socket.data.playerIndex !== undefined) {
      const success = game.attack(socket.data.playerIndex, from, to);
      console.log(`   Attack result: ${success}`);
      
      // Send attack result back to client
      socket.emit('attack_result', { from, to, success });
    } else {
      console.log(`   Attack failed: game=${!!game}, playerIndex=${socket.data.playerIndex}, roomId=${roomId}`);
    }
  });

  socket.on('leave_game', (gameId: string, userId: string) => {
    console.log(`🚪 Player ${userId} leaving game ${gameId}`);
    
    if (!games.has(gameId)) {
      console.log(`❌ Game ${gameId} not found`);
      return;
    }
    
    const game = games.get(gameId)!;
    const removed = game.removePlayer(userId);
    
    if (removed) {
      console.log(`✅ Player ${userId} removed from game ${gameId}`);
      
      // Reset player data
      socket.data.playerIndex = -1;
      socket.data.isViewer = true;
      
      // Transfer host if leaving player was host
      if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
        transferHostToNextPlayer(gameId);
      }
      
      // Broadcast updated player list
      io.to(gameId).emit('player_joined', {
        players: game.getPlayers().map(p => ({
          username: p.username,
          index: p.index,
          isBot: p.isBot,
          eliminated: p.eliminated
        }))
      });
      
      sendGameInfo(gameId);
    }
  });

  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      console.log(`🚪 Player ${socket.id} disconnected from room ${roomId}`);
      
      // If player was joined but game hasn't started, remove them from the game
      if (socket.data.playerIndex >= 0 && games.has(roomId)) {
        const game = games.get(roomId)!;
        if (!game.isStarted()) {
          const userId = socket.data.userId;
          console.log(`🚪 Removing disconnected player ${userId} from game ${roomId}`);
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
  });

  // Helper to transfer host when current host disconnects
  async function transferHostToNextPlayer(gameId: string) {
    const sockets = await io.in(gameId).fetchSockets();
    const nextHost = sockets.find(s => s.id !== socket.id && !s.data.username?.includes('Bot'));
    
    if (nextHost) {
      gameHosts.set(gameId, nextHost.id);
      nextHost.data.isHost = true;
      console.log(`👑 Host auto-transferred to ${nextHost.data.username}`);
    } else {
      gameHosts.delete(gameId);
      console.log(`👑 No eligible host found for game ${gameId}`);
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Generals game server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});
