"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const game_1 = require("./game");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server);
function parseMapData(mapData) {
    const width = 30; // Default width, should match game initialization
    const height = 30; // Default height, should match game initialization
    const terrain = [];
    const armies = [];
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
const games = new Map();
const playerRooms = new Map();
const gameHosts = new Map(); // gameId -> socketId of host
const gameHistory = new Map(); // gameId -> array of completed games
const disconnectedPlayers = new Map();
// Game event tracking
const gameFirstBlood = new Map(); // gameId -> has first blood occurred
const playerTerritoryHistory = new Map(); // gameId -> playerIndex -> territory counts over time
const playerComebackCooldown = new Map(); // gameId -> playerIndex -> last comeback timestamp
// Helper function to send system messages
function sendSystemMessage(gameId, message) {
    io.to(gameId).emit('chat_message', {
        username: 'System',
        message: message,
        playerIndex: -1,
        timestamp: new Date().toISOString(),
        isSystem: true
    });
}
// Helper function to calculate territory and check for milestones
function checkTerritoryMilestones(gameId, game) {
    const gameState = game.getState();
    const totalTiles = gameState.terrain.length;
    const playerCounts = new Map();
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
    const gameHistory = playerTerritoryHistory.get(gameId);
    // Check each player for milestones and comebacks
    playerCounts.forEach((count, playerIndex) => {
        const player = gameState.players[playerIndex];
        if (!player || player.eliminated)
            return;
        const percentage = Math.floor((count / totalTiles) * 100);
        // Initialize player history if needed
        if (!gameHistory.has(playerIndex)) {
            gameHistory.set(playerIndex, []);
        }
        const playerHistory = gameHistory.get(playerIndex);
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
            const comebackMap = playerComebackCooldown.get(gameId);
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
setInterval(() => {
    const now = Date.now();
    const toRemove = [];
    disconnectedPlayers.forEach((data, socketId) => {
        if (now - data.disconnectTime > 30000) { // 30 seconds
            const game = games.get(data.gameId);
            if (game && game.isStarted()) {
                console.log(`🧹 Removing disconnected player ${data.playerIndex} from game ${data.gameId}`);
                // Mark player as eliminated
                const player = game.getState().players[data.playerIndex];
                if (player && !player.eliminated) {
                    player.eliminated = true;
                    sendSystemMessage(data.gameId, `${player.username} was eliminated due to disconnection`);
                    // Check for victory condition
                    const remainingPlayers = game.getState().players.filter(p => !p.eliminated);
                    console.log(`   Remaining players after elimination: ${remainingPlayers.length}`);
                    if (remainingPlayers.length === 1) {
                        const winner = remainingPlayers[0];
                        sendSystemMessage(data.gameId, `🎉 ${winner.username} wins the game!`);
                        // End the game after a short delay
                        setTimeout(() => {
                            console.log(`   Ending game ${data.gameId} - winner: ${winner.username}`);
                            game.endGame(winner.index || 0);
                        }, 2000);
                    }
                    else if (remainingPlayers.length === 0) {
                        // No players left - end game with no winner
                        sendSystemMessage(data.gameId, `Game ended - no players remaining`);
                        setTimeout(() => {
                            console.log(`   Ending game ${data.gameId} - no players remaining`);
                            game.endGame(-1);
                        }, 2000);
                    }
                }
            }
            toRemove.push(socketId);
        }
    });
    toRemove.forEach(socketId => disconnectedPlayers.delete(socketId));
}, 5000);
// Serve static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Root route - serve welcome page
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Bot documentation route
app.get('/docs/bot', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/bot-docs.html'));
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
    res.sendFile(path_1.default.join(__dirname, '../public/game.html'));
});
io.on('connection', (socket) => {
    console.log('🔌 Player connected:', socket.id);
    console.log('   User-Agent:', socket.handshake.headers['user-agent']);
    console.log('   Remote Address:', socket.handshake.address);
    // System message for client connection (will be sent when they join a game)
    socket.on('set_username', (userId, username) => {
        socket.data.userId = userId;
        socket.data.username = username;
        console.log(`👤 User ${userId} set username: ${username}`);
    });
    socket.on('join_private', async (gameId, userId) => {
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
            games.set(gameId, new game_1.Game(gameId));
        }
        const game = games.get(gameId);
        const username = socket.data.username || 'Player';
        const isBot = username.includes('Bot') || userId.includes('bot') || socket.handshake.headers['user-agent']?.includes('node');
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
        }
        else {
            // Check if this socket is already a player in this game
            if (socket.data.playerIndex !== undefined && !socket.data.isViewer) {
                console.log(`❌ Socket ${socket.id} already joined as player ${socket.data.playerIndex}`);
                return;
            }
            // This is a player - try to join the game
            const playerIndex = game.addPlayer(userId, username, isBot);
            if (playerIndex >= 0) {
                socket.data.playerIndex = playerIndex;
                socket.data.isViewer = false;
                // Assign host if no host exists and this is a real player (not bot)
                if (!gameHosts.has(gameId) && !isBot) {
                    gameHosts.set(gameId, socket.id);
                    socket.data.isHost = true;
                    console.log(`👑 ${username} assigned as host for game ${gameId}`);
                }
                else {
                    // Check if this socket is already the host
                    socket.data.isHost = (gameHosts.get(gameId) === socket.id);
                }
            }
            // Check for duplicate username (but allow same user to rejoin)
            const currentGameState = game.getState();
            const existingPlayer = currentGameState.players.find(p => p.username === username);
            if (existingPlayer && socket.data.userId !== existingPlayer.id) {
                console.log(`❌ Username "${username}" already taken in game ${gameId}`);
                socket.emit('username_taken', { username });
                return;
            }
            // Check if this is a reconnection attempt to an active game
            if (playerIndex === -1 && game.isStarted()) {
                // Check if this user was previously in this game
                const gameState = game.getState();
                const existingPlayerIndex = gameState.players.findIndex(p => p.id === userId);
                if (existingPlayerIndex >= 0) {
                    // This is a reconnection to an active game
                    const wasDisconnected = Array.from(disconnectedPlayers.entries()).find(([socketId, data]) => data.gameId === gameId && data.playerIndex === existingPlayerIndex);
                    if (wasDisconnected) {
                        // Allow reconnection by setting up socket data
                        socket.data.playerIndex = existingPlayerIndex;
                        socket.data.userId = userId;
                        socket.data.isViewer = false;
                        // Remove from disconnected players
                        disconnectedPlayers.delete(wasDisconnected[0]);
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
                }
                console.log(`❌ Cannot join game ${gameId} - game already started`);
                socket.emit('game_already_started');
                return;
            }
            if (playerIndex === -1) {
                // This case is now handled above for active games
                console.log(`❌ Cannot join game ${gameId} - unknown error`);
                socket.emit('game_already_started');
                return;
            }
            socket.data.playerIndex = playerIndex;
            socket.data.userId = userId;
            socket.data.isViewer = false;
            console.log(`✅ Player ${userId} (${username}) ${isBot ? 'Bot' : 'Human'} joined game ${gameId} as player ${playerIndex} [Game State: Started=${game.isStarted()}, Ended=${game.isEnded()}]`);
            // Check if this is a reconnection
            const wasDisconnected = Array.from(disconnectedPlayers.entries()).find(([socketId, data]) => data.gameId === gameId && data.playerIndex === playerIndex);
            if (wasDisconnected) {
                // Remove from disconnected players and send reconnection message
                disconnectedPlayers.delete(wasDisconnected[0]);
                sendSystemMessage(gameId, `${username} reconnected`);
                console.log(`🔄 Player ${username} reconnected to game ${gameId}`);
            }
            else {
                // Send system message for new player join
                sendSystemMessage(gameId, `${username} joined the game`);
            }
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
        // Always check and assign host if none exists and this is a non-bot, non-viewer
        console.log(`🔍 Host check: gameId=${gameId}, hasHost=${gameHosts.has(gameId)}, isBot=${isBot}, username=${username}`);
        if (!gameHosts.has(gameId) && !isBot && !username.includes('Viewer')) {
            gameHosts.set(gameId, socket.id);
            socket.data.isHost = true;
            console.log(`👑 ${username} assigned as host for game ${gameId} (no existing host)`);
            await sendGameInfo(gameId);
        }
        else {
            socket.data.isHost = (gameHosts.get(gameId) === socket.id);
            console.log(`🔍 Host not assigned: hasHost=${gameHosts.has(gameId)}, currentHost=${gameHosts.get(gameId)}, socketId=${socket.id}`);
        }
    });
    // Handle host transfer
    socket.on('transfer_host', async (gameId, targetSocketId) => {
        if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
            const targetSocket = (await io.in(gameId).fetchSockets()).find(s => s.id === targetSocketId);
            if (targetSocket && !targetSocket.data.username?.includes('Bot') && !targetSocket.data.userId?.includes('bot')) {
                gameHosts.set(gameId, targetSocketId);
                socket.data.isHost = false;
                targetSocket.data.isHost = true;
                console.log(`👑 Host transferred from ${socket.data.username} to ${targetSocket.data.username}`);
                await sendGameInfo(gameId);
            }
            else {
                console.log(`❌ Invalid host transfer target: ${targetSocket?.data.username || 'unknown'}`);
            }
        }
    });
    // Helper function to send game info
    async function sendGameInfo(gameId) {
        const sockets = await io.in(gameId).fetchSockets();
        const spectatorCount = sockets.filter(s => s.data.isViewer).length;
        const hostSocketId = gameHosts.get(gameId);
        const hostSocket = sockets.find(s => s.id === hostSocketId);
        // Build player index to socket ID mapping
        const playerSocketMap = {};
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
    socket.on('set_force_start', async (gameId, force) => {
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
                        duration: Date.now() - game.startTime || 0 // Assuming we track start time
                    };
                    // Store in history
                    if (!gameHistory.has(gameId)) {
                        gameHistory.set(gameId, []);
                    }
                    gameHistory.get(gameId).push(completedGame);
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
                    // Clear host when game resets
                    gameHosts.delete(gameId);
                    console.log(`   👑 Host cleared for game ${gameId}`);
                    // Send updated player list (should be empty now)
                    io.to(gameId).emit('player_joined', { players: [] });
                    await sendGameInfo(gameId);
                    clearInterval(updateInterval);
                    return;
                }
                const mapData = game.getMapData();
                io.to(gameId).emit('game_update', {
                    cities_diff: [0, gameState.cities.length, ...gameState.cities],
                    lookoutTowers_diff: [0, gameState.lookoutTowers.length, ...gameState.lookoutTowers],
                    map_diff: [0, mapData.length, ...mapData],
                    generals: gameState.generals,
                    players: gameState.players
                });
            }, 100);
        }
        else {
            console.log(`   Game not found or force=false: gameId=${gameId}, game exists=${!!game}, force=${force}`);
        }
    });
    socket.on('chat_message', (data) => {
        // Validate and sanitize input
        const sanitizedMessage = data.message
            .trim()
            .slice(0, 500) // Limit message length
            .replace(/[<>]/g, ''); // Basic XSS prevention
        if (!sanitizedMessage)
            return;
        const game = games.get(data.gameId);
        if (!game)
            return;
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
    socket.on('attack', (from, to) => {
        console.log(`⚔️ Attack request: from=${from}, to=${to}, player=${socket.data.playerIndex}`);
        const roomId = playerRooms.get(socket.id);
        const game = games.get(roomId || '');
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
            socket.emit('attack_result', { from, to, success: result.success });
        }
        else {
            console.log(`   Attack failed: game=${!!game}, playerIndex=${socket.data.playerIndex}, roomId=${roomId}`);
        }
    });
    socket.on('leave_game', (gameId, userId) => {
        console.log(`🚪 Player ${userId} leaving game ${gameId}`);
        if (!games.has(gameId)) {
            console.log(`❌ Game ${gameId} not found`);
            return;
        }
        const game = games.get(gameId);
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
            const game = games.get(roomId);
            if (game && socket.data.playerIndex >= 0) {
                if (!game.isStarted()) {
                    // Game hasn't started - remove player immediately
                    const userId = socket.data.userId;
                    const username = socket.data.username;
                    console.log(`🚪 Removing disconnected player ${userId} from game ${roomId}`);
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
                }
                else {
                    // Game is started - track disconnection for cleanup
                    console.log(`⏰ Tracking disconnected player ${socket.data.playerIndex} for cleanup`);
                    disconnectedPlayers.set(socket.id, {
                        gameId: roomId,
                        playerIndex: socket.data.playerIndex,
                        disconnectTime: Date.now()
                    });
                    // Don't remove from game immediately - let cleanup timer handle it
                    playerRooms.delete(socket.id);
                    socket.leave(roomId);
                    sendGameInfo(roomId);
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
        }
        else {
            console.log(`🚪 Player ${socket.id} disconnected (no room)`);
        }
    });
    // Helper to transfer host when current host disconnects
    async function transferHostToNextPlayer(gameId) {
        const sockets = await io.in(gameId).fetchSockets();
        // Only consider connected players (not viewers, not bots) as potential hosts
        const nextHost = sockets.find(s => s.id !== socket.id &&
            !s.data.username?.includes('Bot') &&
            !s.data.username?.includes('Viewer') &&
            !s.data.isViewer &&
            s.data.playerIndex !== undefined &&
            s.data.playerIndex >= 0);
        if (nextHost) {
            gameHosts.set(gameId, nextHost.id);
            nextHost.data.isHost = true;
            console.log(`👑 Host auto-transferred to ${nextHost.data.username}`);
            // Send system message for host transfer
            sendSystemMessage(gameId, `👑 ${nextHost.data.username} is now the host`);
        }
        else {
            gameHosts.delete(gameId);
            console.log(`👑 No eligible host found for game ${gameId} - game may be abandoned`);
            // Check if game should be cleaned up (no connected players)
            const connectedPlayers = sockets.filter(s => !s.data.isViewer &&
                s.data.playerIndex !== undefined &&
                s.data.playerIndex >= 0);
            if (connectedPlayers.length === 0) {
                console.log(`🧹 Game ${gameId} has no connected players - cleaning up`);
                const game = games.get(gameId);
                if (game && game.isStarted()) {
                    sendSystemMessage(gameId, 'Game abandoned - no players remaining');
                    setTimeout(() => {
                        game.endGame(-1);
                    }, 1000);
                }
            }
        }
    }
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Generals game server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});
