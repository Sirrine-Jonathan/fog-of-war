import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { Game } from "./game";
import { BotManager } from "./botManager";
import { MOVES_PER_TURN } from "./types";

const app = express();
const server = createServer(app);
const io = new Server(server);

function getPersonalizedGenerals(
  allGenerals: number[],
  playerIndex: number,
  gameState: any
): number[] {
  const personalizedGenerals = new Array(allGenerals.length).fill(-1);

  // Player always knows their own general position
  personalizedGenerals[playerIndex] = allGenerals[playerIndex];

  // Check if player can see enemy generals through vision or discovery
  for (let i = 0; i < allGenerals.length; i++) {
    if (i === playerIndex) continue; // Skip own general

    const enemyGeneralPos = allGenerals[i];
    if (enemyGeneralPos === -1) continue; // General doesn't exist or is eliminated

    // Validate general position is not a mountain and is within bounds
    if (enemyGeneralPos < 0 || enemyGeneralPos >= gameState.terrain.length)
      continue;
    if (gameState.terrain[enemyGeneralPos] === -2) continue; // Skip mountains

    // Check if enemy general is visible (on player's territory or adjacent to it)
    if (isPositionVisibleToPlayer(enemyGeneralPos, playerIndex, gameState)) {
      personalizedGenerals[i] = enemyGeneralPos;
    }
  }

  return personalizedGenerals;
}

function isPositionVisibleToPlayer(
  position: number,
  playerIndex: number,
  gameState: any
): boolean {
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
  io.to(gameId).emit("chat_message", {
    username: "System",
    message: message,
    playerIndex: -1,
    timestamp: new Date().toISOString(),
    isSystem: true,
  });
}

// Enhanced bot detection function
function isBot(socket: any, userId: string, username: string): boolean {
  const userAgent = socket.handshake.headers["user-agent"] || "";
  const referer = socket.handshake.headers["referer"] || "";

  // Strong bot indicators (high confidence)
  const hasNodeUserAgent =
    userAgent.includes("node") || userAgent.includes("Node");
  const hasSocketIOClient = userAgent.includes("socket.io-client");
  const explicitBotName =
    username.toLowerCase().includes("bot") &&
    (userId.toLowerCase().includes("bot") || userAgent.includes("node"));

  // Only flag as bot if we have strong evidence
  const result = hasNodeUserAgent || hasSocketIOClient || explicitBotName;

  console.log(`🤖 Bot detection for ${username}:`, {
    userAgent:
      userAgent.substring(0, 50) + (userAgent.length > 50 ? "..." : ""),
    referer: referer.substring(0, 30) + (referer.length > 30 ? "..." : ""),
    hasNodeUserAgent,
    hasSocketIOClient,
    explicitBotName,
    isBot: result,
  });

  return result;
}

// Helper function to find best available host using priority system
async function findBestHost(
  gameId: string,
  excludeSocketId?: string
): Promise<any> {
  const sockets = await io.in(gameId).fetchSockets();

  // Priority 1: Non-bot players (existing behavior)
  const playerHost = sockets.find(
    (s) =>
      s.id !== excludeSocketId &&
      !s.data.isViewer &&
      s.data.playerIndex !== undefined &&
      s.data.playerIndex >= 0 &&
      !isBot(s, s.data.userId || "", s.data.username || "") &&
      !s.data.username?.includes("Viewer")
  );

  if (playerHost) {
    return playerHost;
  }

  // Priority 2: Non-bot viewers/spectators (new behavior for bot-only games)
  const viewerHost = sockets.find(
    (s) =>
      s.id !== excludeSocketId &&
      !isBot(s, s.data.userId || "", s.data.username || "") &&
      !s.data.username?.includes("Viewer")
  );

  return viewerHost;
}

// Helper function to calculate territory and check for milestones
function checkTerritoryMilestones(gameId: string, game: Game) {
  const gameState = game.getState();
  const totalTiles = gameState.terrain.length;
  const playerCounts = new Map<number, number>();

  // Count territory for each player
  gameState.terrain.forEach((owner) => {
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
    milestones.forEach((milestone) => {
      if (percentage >= milestone) {
        const prevCount =
          playerHistory.length > 1
            ? playerHistory[playerHistory.length - 2]
            : 0;
        const prevPercentage = Math.floor((prevCount / totalTiles) * 100);

        if (prevPercentage < milestone) {
          sendSystemMessage(
            gameId,
            `🏆 ${player.username} controls ${milestone}% of the map!`
          );
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
      if (
        minRecent > 0 &&
        current >= minRecent * 3 &&
        minRecent < totalTiles * 0.1 &&
        now - lastComeback > 60000
      ) {
        sendSystemMessage(
          gameId,
          `🔥 ${player.username} is making a comeback!`
        );
        comebackMap.set(playerIndex, now);
      }
    }
  });
}

// Clean up disconnected players every 5 seconds
// Serve static files with no-cache headers for development
app.use(
  express.static(path.join(__dirname, "../public"), {
    setHeaders: (res, path) => {
      // Disable caching for all static files in development
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  })
);

// Root route - serve welcome page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Bot documentation route
app.get("/docs/bot", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/bot-docs.html"));
});

// Game history API
app.get("/api/history/:gameId", (req, res) => {
  const gameId = req.params.gameId;
  const history = gameHistory.get(gameId) || [];
  res.json({
    gameId,
    totalGames: history.length,
    games: history,
  });
});

// Game viewer route
app.get("/game/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/game.html"));
});

io.on("connection", (socket) => {
  // System message for client connection (will be sent when they join a game)

  socket.on("set_username", (userId: string, username: string) => {
    socket.data.userId = userId;
    socket.data.username = username;
  });

  socket.on("get_current_room", () => {
    const currentRoom = playerRooms.get(socket.id);
    socket.emit("current_room", { room: currentRoom || null });
  });

  socket.on("join_private", async (gameId: string, userId: string) => {
    // Leave previous room if any
    const previousRoom = playerRooms.get(socket.id);
    if (previousRoom) {
      // Remove player from previous game
      const previousGame = games.get(previousRoom);
      if (previousGame && socket.data.userId) {
        const removed = previousGame.removePlayer(socket.data.userId);
        if (removed) {
          // Clear socket player data
          delete socket.data.playerIndex;
          socket.data.isViewer = true;
          // Notify remaining players in previous room
          io.to(previousRoom).emit("player_left", {
            players: previousGame.getState().players,
          });
        }
      }

      socket.leave(previousRoom);
    }

    // Join new room
    socket.join(gameId);
    playerRooms.set(socket.id, gameId);

    // Create game if it doesn't exist
    if (!games.has(gameId)) {
      games.set(gameId, new Game(gameId));
    }

    const game = games.get(gameId)!;
    const username = socket.data.username || "Player";
    const botDetected = isBot(socket, userId, username);

    // Check if this is a viewer (username contains "Viewer" or game is actively running)
    const isViewer =
      username.includes("Viewer") || (game.isStarted() && !game.isEnded());

    if (isViewer) {
      socket.data.isViewer = true;

      // Viewers cannot be hosts - check if this socket was previously a host
      socket.data.isHost = gameHosts.get(gameId) === socket.id;

      // Send current players list to viewer
      const gameState = game.getState();
      socket.emit("player_joined", {
        players: gameState.players,
      });

      // Send host and spectator info
      await sendGameInfo(gameId);

      // Send current game state to viewer if game is running
      if (game.isStarted()) {
        const mapData = game.getMapData();
        socket.emit("game_start", {
          playerIndex: -1, // Viewer has no player index
          replay_id: gameId,
          usernames: gameState.players.map((p) => p.username),
          movesPerTurn: MOVES_PER_TURN,
        });
        socket.emit("game_update", mapData);
      }
    } else {
      // Check if this socket is already a player in this game
      if (socket.data.playerIndex !== undefined && !socket.data.isViewer) {
        return;
      }

      // Check for reconnection FIRST, before adding as new player
      if (game.isStarted()) {
        const gameState = game.getState();
        const existingPlayerIndex = gameState.players.findIndex(
          (p) => p.id === userId
        );

        if (existingPlayerIndex >= 0) {
          // Player already exists in active game - check if eliminated
          const existingPlayer = gameState.players[existingPlayerIndex];
          if (existingPlayer.eliminated) {
            // Eliminated players can only rejoin as viewers during the same game
            console.log(`👁️ Eliminated player ${username} rejoining as viewer`);
            socket.data.isViewer = true;
            socket.data.playerIndex = -1; // No active player index
            
            // Send current game state to viewer
            const mapData = game.getMapData();
            socket.emit('game_start', {
              playerIndex: -1, // Viewer has no player index
              replay_id: gameId,
              usernames: gameState.players.map(p => p.username),
              mapData: mapData,
              movesPerTurn: MOVES_PER_TURN
            });
            
            await sendGameInfo(gameId);
            return;
          }

          // Allow reconnection by setting up socket data
          socket.data.playerIndex = existingPlayerIndex;
          socket.data.userId = userId;
          socket.data.isViewer = false;

          sendSystemMessage(gameId, `${username} reconnected`);

          // Send current game state to reconnected player
          const mapData = game.getMapData();
          socket.emit("game_start", {
            playerIndex: existingPlayerIndex,
            replay_id: gameId,
            movesPerTurn: MOVES_PER_TURN,
            ...mapData,
          });

          // Send confirmation and continue with normal flow
          socket.emit("joined_as_player", { playerIndex: existingPlayerIndex });

          // Notify all players
          io.to(gameId).emit("player_joined", {
            players: gameState.players,
            newPlayerIndex: existingPlayerIndex,
          });

          return;
        }

        socket.emit("game_already_started");
        return;
      }

      // Check for duplicate username (but allow same user to rejoin)
      const currentGameState = game.getState();
      const existingPlayer = currentGameState.players.find(
        (p) => p.username === username
      );

      if (existingPlayer && socket.data.userId !== existingPlayer.id) {
        socket.emit("username_taken", { username });
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
        } else {
          // Check if this socket is already the host
          socket.data.isHost = gameHosts.get(gameId) === socket.id;
        }
      } else {
        socket.emit("game_already_started");
        return;
      }

      // Send system message for new player join
      sendSystemMessage(gameId, `${username} joined the game`);

      // Send confirmation to the joining player
      socket.emit("joined_as_player", { playerIndex });

      // Notify all players in room about updated player list
      const gameState = game.getState();

      io.to(gameId).emit("player_joined", {
        players: gameState.players,
        newPlayerIndex: playerIndex,
      });

      // Send updated game info to ensure host status is correct
      await sendGameInfo(gameId);
    }

    // Check and assign host using priority system

    if (!botDetected) {
      if (!gameHosts.has(gameId)) {
        // No host exists - assign this client as host
        gameHosts.set(gameId, socket.id);
        socket.data.isHost = true;

        await sendGameInfo(gameId);
      } else if (!isViewer) {
        // Player joining when viewer is host - auto-transfer
        const currentHostId = gameHosts.get(gameId);
        const currentHostSocket = currentHostId
          ? (await io.in(gameId).fetchSockets()).find(
              (s) => s.id === currentHostId
            )
          : null;

        if (currentHostSocket?.data.isViewer) {
          gameHosts.set(gameId, socket.id);
          currentHostSocket.data.isHost = false;
          socket.data.isHost = true;

          await sendGameInfo(gameId);
        }
      }
    } else {
      socket.data.isHost = gameHosts.get(gameId) === socket.id;
    }
  });

  // Handle host transfer
  socket.on("transfer_host", async (gameId: string, targetSocketId: string) => {
    if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
      const targetSocket = (await io.in(gameId).fetchSockets()).find(
        (s) => s.id === targetSocketId
      );
      // Allow transfer to players only (not viewers), but from any host type
      if (
        targetSocket &&
        !isBot(
          targetSocket,
          targetSocket.data.userId || "",
          targetSocket.data.username || ""
        ) &&
        !targetSocket.data.isViewer
      ) {
        gameHosts.set(gameId, targetSocketId);
        socket.data.isHost = false;
        targetSocket.data.isHost = true;

        await sendGameInfo(gameId);
      } else {
      }
    }
  });

  // Handle bot kick
  socket.on("kick_bot", async (gameId: string, botUserId: string) => {
    if (!socket.data.isHost || gameHosts.get(gameId) !== socket.id) {
      return;
    }

    const game = games.get(gameId);
    if (!game || game.isStarted()) {
      return;
    }

    const gameState = game.getState();
    const botPlayer = gameState.players.find(
      (p) => p.id === botUserId && p.isBot
    );

    console.log({ players: gameState.players, botUserId });
    if (!botPlayer || typeof botUserId !== "string" || !botUserId) {
      return;
    }

    // Remove bot from game
    const removed = game.removePlayer(botUserId);

    if (removed) {
      // Remove bot from bot manager
      let botType: "blob" | "arrow" | null = null;
      if (typeof botUserId === "string") {
        if (botUserId.toLowerCase().includes("blob")) botType = "blob";
        else if (botUserId.toLowerCase().includes("arrow")) botType = "arrow";
      }

      if (!botType) {
      } else {
        botManager.removeBot(botType as "blob" | "arrow", gameId);
      }

      // Send system message
      sendSystemMessage(
        gameId,
        `${botPlayer.username} was removed from the game`
      );

      // Broadcast updated player list

      io.to(gameId).emit("player_joined", {
        players: game.getState().players,
      });

      await sendGameInfo(gameId);
    }
  });

  // Helper function to send game info
  async function sendGameInfo(gameId: string) {
    const sockets = await io.in(gameId).fetchSockets();
    const spectatorCount = sockets.filter((s) => s.data.isViewer).length;
    const hostSocketId = gameHosts.get(gameId);
    const hostSocket = sockets.find((s) => s.id === hostSocketId);

    // Build player index to socket ID mapping
    const playerSocketMap: { [key: string]: string } = {};
    sockets.forEach((s) => {
      if (s.data.playerIndex !== undefined && !s.data.isViewer) {
        playerSocketMap[s.data.playerIndex.toString()] = s.id;
      }
    });

    // Get current game settings
    const game = games.get(gameId);
    const gameSettings = game
      ? game.getGameSettings()
      : { turnIntervalMs: 1000, movesPerTurn: 1 };

    io.to(gameId).emit("game_info", {
      spectatorCount,
      hostName: hostSocket?.data.username || null,
      hostSocketId,
      playerSocketMap,
      gameSettings,
    });
  }

  socket.on("set_force_start", async (gameId: string, force: boolean) => {
    // Only allow host to start game
    const currentHost = gameHosts.get(gameId);

    if (!socket.data.isHost || currentHost !== socket.id) {
      return;
    }

    const game = games.get(gameId);
    if (game && force) {
      const playerCount = game.getState().players.length;

      // Require at least 2 players
      if (playerCount < 2) {
        socket.emit(
          "game_start_error",
          "Need at least 2 players to start the game"
        );
        return;
      }

      game.startGame();

      // Send system message for game start
      sendSystemMessage(
        gameId,
        `🎮 Game has started! Good luck to all players!`
      );

      // Initialize game tracking
      gameFirstBlood.set(gameId, false);
      playerTerritoryHistory.set(gameId, new Map());

      // Send initial game state immediately
      const gameState = game.getState();

      // Notify each player individually with their own player index

      const sockets = await io.in(gameId).fetchSockets();

      const mapData = game.getMapData();

      for (const playerSocket of sockets) {
        playerSocket.emit("game_start", {
          playerIndex: playerSocket.data.playerIndex ?? -1, // -1 for viewers
          replay_id: gameId,
          mapData: mapData,
          movesPerTurn: MOVES_PER_TURN,
        });
      }

      // Send initial map state to each player individually with proper fog of war

      // Send personalized updates to each player
      gameState.players.forEach((player, playerIndex) => {
        const playerSocket = [...io.sockets.sockets.values()].find(
          (s) => s.data.userId === player.id
        );
        if (playerSocket) {
          console.log(`🔍 Sending personalized update to player ${player.username} (isViewer: ${playerSocket.data.isViewer}, playerIndex: ${playerSocket.data.playerIndex})`);
          const personalizedGenerals = getPersonalizedGenerals(
            gameState.generals,
            playerIndex,
            gameState
          );
          playerSocket.emit("game_update", {
            cities_diff: [0, gameState.cities.length, ...gameState.cities],
            map_diff: [0, mapData.length, ...mapData],
            generals: personalizedGenerals,
            players: gameState.players,
            turn: gameState.turn,
            remainingMoves: game.getRemainingMoves(playerIndex),
          });
        }
      });

      // Send full map data to player viewers (eliminated/abandoned players)
      const playerViewerSockets = [...io.sockets.sockets.values()].filter(
        (s) =>
          s.rooms.has(gameId) &&
          s.data.isViewer &&
          gameState.players.some((p) => p.id === s.data.userId)
      );
      console.log(`👁️ Found ${playerViewerSockets.length} player viewers for full map data`);
      playerViewerSockets.forEach((socket) => {
        console.log(`👁️ Sending full map to player viewer ${socket.data.username} (eliminated/abandoned)`);
        socket.emit("game_update", {
          cities_diff: [0, gameState.cities.length, ...gameState.cities],
          map_diff: [0, mapData.length, ...mapData],
          generals: gameState.generals, // Player viewers see all generals
          players: gameState.players,
          turn: gameState.turn,
        });
      });

      // Send to viewers (they can see everything)
      const viewerSockets = [...io.sockets.sockets.values()].filter(
        (s) =>
          s.rooms.has(gameId) &&
          !gameState.players.some((p) => p.id === s.data.userId)
      );
      console.log(`👁️ Found ${viewerSockets.length} viewer sockets for full map data`);
      viewerSockets.forEach((socket) => {
        console.log(`👁️ Sending full map to viewer ${socket.data.username} (isViewer: ${socket.data.isViewer}, playerIndex: ${socket.data.playerIndex})`);
        socket.emit("game_update", {
          cities_diff: [0, gameState.cities.length, ...gameState.cities],
          map_diff: [0, mapData.length, ...mapData],
          generals: gameState.generals, // Viewers see all generals
          players: gameState.players,
          turn: gameState.turn,
        });
      });

      // Start sending updates
      const updateInterval = setInterval(async () => {
        const gameState = game.getState();

        // Log map state every 25 ticks
        if (gameState.turn % 25 === 0) {
          const playerStats = gameState.players.map((p) => {
            const territories = gameState.terrain.filter(
              (t) => t === p.index
            ).length;
            const totalArmies = gameState.armies.reduce(
              (sum, armies, i) =>
                gameState.terrain[i] === p.index ? sum + armies : sum,
              0
            );
            return `${p.username}(P${p.index}): ${territories} territories, ${totalArmies} armies`;
          });
        }

        if (gameState.gameEnded) {
          // Notify players of game end
          console.log(`🏁 Game ${gameId} ended, winner: ${gameState.winner}`);

          io.to(gameId).emit("game_won", { winner: gameState.winner });

          // Reset all players to non-viewer status for next game
          console.log(`🔄 Starting viewer status reset for game ${gameId}`);
          const gameEndSockets = await io.in(gameId).fetchSockets();
          gameEndSockets.forEach(socket => {
            if (gameState.players.some(p => p.id === socket.data.userId)) {
              console.log(`🔄 Resetting viewer status for player ${socket.data.username} (was viewer: ${socket.data.isViewer})`);
              socket.data.isViewer = false;
            }
          });
          console.log(`🔄 Completed viewer status reset for game ${gameId}`);

          // Store game data for replay/analysis before resetting
          const completedGame = {
            gameId,
            endTime: new Date().toISOString(),
            winner: gameState.winner,
            finalState: JSON.parse(JSON.stringify(gameState)), // Deep copy
            players: gameState.players.map((p) => ({
              id: p.id,
              username: p.username,
              index: p.index,
              isBot: p.isBot,
              eliminated: p.eliminated,
            })),
            duration: Date.now() - (game as any).startTime || 0, // Assuming we track start time
          };

          // Store in history
          if (!gameHistory.has(gameId)) {
            gameHistory.set(gameId, []);
          }
          gameHistory.get(gameId)!.push(completedGame);

          // Clear bot players' socket data and remove them from game
          const botCleanupSockets = await io.in(gameId).fetchSockets();
          for (const playerSocket of botCleanupSockets) {
            if (
              playerSocket.data.playerIndex !== undefined &&
              !playerSocket.data.isViewer
            ) {
              const player = gameState.players[playerSocket.data.playerIndex];
              if (player?.isBot) {
                delete playerSocket.data.playerIndex;
                playerSocket.data.isViewer = true;
              }
            }
          }

          // Remove bots from game but keep human players
          const humanPlayers = gameState.players.filter((p) => !p.isBot);

          // Reset game state but preserve human players
          game.reset();

          // Re-add human players to the reset game
          console.log(`🔄 Re-adding ${humanPlayers.length} human players to reset game`);
          humanPlayers.forEach((player, index) => {
            const newIndex = game.addPlayer(player.id, player.username, false);
            // Update socket data for human players
            const playerSocket = botCleanupSockets.find(
              (s) => s.data.userId === player.id
            );
            if (playerSocket) {
              console.log(`🔄 Re-adding player ${player.username} with isViewer: ${playerSocket.data.isViewer} -> false`);
              playerSocket.data.playerIndex = newIndex;
              playerSocket.data.isViewer = false;

              // Reset client-side vision for players who were viewers
              playerSocket.emit("reset_vision");
            }
          });

          // Remove all bots from this room
          botManager.removeAllBotsFromRoom(gameId);

          // Clear host when game resets
          gameHosts.delete(gameId);

          // Send updated player list (human players remain joined)
          io.to(gameId).emit("player_joined", {
            players: game.getState().players,
          });
          await sendGameInfo(gameId);

          // Assign new host after game cleanup
          await assignHostAfterGameEnd(gameId);

          clearInterval(updateInterval);
          return;
        }

        const mapData = game.getMapData();

        // Send personalized updates to each player with fog of war
        gameState.players.forEach((player, playerIndex) => {
          const playerSocket = [...io.sockets.sockets.values()].find(
            (s) => s.data.userId === player.id
          );
          if (playerSocket) {
            // Log viewer status every 10 turns for debugging
            if (gameState.turn % 10 === 0) {
              console.log(`🔍 Turn ${gameState.turn}: Player ${player.username} (isViewer: ${playerSocket.data.isViewer}, playerIndex: ${playerSocket.data.playerIndex})`);
            }
            
            const personalizedGenerals = getPersonalizedGenerals(
              gameState.generals,
              playerIndex,
              gameState
            );

            // Debug logging for general data integrity - Spiral only
            if (gameState.turn % 50 === 0 && player.username === "Spiral") {
              console.log(`🔍 General data for ${player.username}:`, {
                allGenerals: gameState.generals,
                personalizedGenerals,
                visibleCount: personalizedGenerals.filter((g) => g >= 0).length,
              });
            }

            playerSocket.emit("game_update", {
              cities_diff: [0, gameState.cities.length, ...gameState.cities],
              lookoutTowers_diff: [
                0,
                gameState.lookoutTowers.length,
                ...gameState.lookoutTowers,
              ],
              map_diff: [0, mapData.length, ...mapData],
              generals: personalizedGenerals,
              players: gameState.players,
              turn: gameState.turn,
              remainingMoves: game.getRemainingMoves(playerIndex),
            });
          }
        });

        // Send full map data to player viewers (eliminated/abandoned players)
        const playerViewerSockets = [...io.sockets.sockets.values()].filter(
          (s) =>
            s.rooms.has(gameId) &&
            s.data.isViewer &&
            gameState.players.some((p) => p.id === s.data.userId)
        );
        
        if (gameState.turn % 10 === 0 && playerViewerSockets.length > 0) {
          console.log(`👁️ Turn ${gameState.turn}: Found ${playerViewerSockets.length} player viewers receiving full map data`);
          playerViewerSockets.forEach(socket => {
            console.log(`👁️ Player viewer: ${socket.data.username} (eliminated/abandoned)`);
          });
        }
        
        playerViewerSockets.forEach((socket) => {
          socket.emit("game_update", {
            cities_diff: [0, gameState.cities.length, ...gameState.cities],
            lookoutTowers_diff: [
              0,
              gameState.lookoutTowers.length,
              ...gameState.lookoutTowers,
            ],
            map_diff: [0, mapData.length, ...mapData],
            generals: gameState.generals, // Player viewers see all generals
            players: gameState.players,
            turn: gameState.turn,
          });
        });

        // Send full data to viewers
        const viewerSockets = [...io.sockets.sockets.values()].filter(
          (s) =>
            s.rooms.has(gameId) &&
            !gameState.players.some((p) => p.id === s.data.userId)
        );
        
        // Log viewer status every 10 turns
        if (gameState.turn % 10 === 0 && viewerSockets.length > 0) {
          console.log(`👁️ Turn ${gameState.turn}: Found ${viewerSockets.length} viewers receiving full map data`);
          viewerSockets.forEach(socket => {
            console.log(`👁️ Viewer: ${socket.data.username} (isViewer: ${socket.data.isViewer}, playerIndex: ${socket.data.playerIndex})`);
          });
        }
        
        viewerSockets.forEach((socket) => {
          socket.emit("game_update", {
            cities_diff: [0, gameState.cities.length, ...gameState.cities],
            lookoutTowers_diff: [
              0,
              gameState.lookoutTowers.length,
              ...gameState.lookoutTowers,
            ],
            map_diff: [0, mapData.length, ...mapData],
            generals: gameState.generals, // Viewers see all generals
            players: gameState.players,
            turn: gameState.turn,
          });
        });
      }, 100);
    } else {
    }
  });

  socket.on(
    "chat_message",
    (data: { gameId: string; message: string; username: string }) => {
      // Validate and sanitize input
      const sanitizedMessage = data.message
        .trim()
        .slice(0, 500) // Limit message length
        .replace(/[<>]/g, ""); // Basic XSS prevention

      if (!sanitizedMessage) return;

      const game = games.get(data.gameId);
      if (!game) return;

      // Find player index for color coding
      let playerIndex = -1;
      if (socket.data.playerIndex !== undefined) {
        playerIndex = socket.data.playerIndex;
      }

      // Broadcast message to all players in the game
      io.to(data.gameId).emit("chat_message", {
        username: data.username,
        message: data.message,
        playerIndex: playerIndex,
        timestamp: new Date().toISOString(),
      });
    }
  );

  socket.on("attack", async (from: number, to: number) => {
    const roomId = playerRooms.get(socket.id);
    const game = games.get(roomId || "");
    const playerIndex = socket.data.playerIndex;
    const playerName = socket.data.username || "Unknown";

    // Enhanced logging with strategic context
    if (game) {
      const gameMap = game.getMapData();
      const fromArmies = gameMap[from + 2]; // armies start at index 2
      const toArmies = gameMap[to + 2];
      const size = gameMap[0] * gameMap[1];
      const fromTerrain = gameMap[from + size + 2]; // terrain starts after armies
      const toTerrain = gameMap[to + size + 2];

      let moveType = "EXPAND";
      if (toTerrain >= 0 && toTerrain !== playerIndex) {
        moveType = "ATTACK";
      }

      // Only log Spiral moves
      if (playerName === "Spiral") {
      }
    } else {
      // Remove this log
    }

    // Prevent viewers from attacking
    if (socket.data.isViewer) {
      return;
    }

    if (game && socket.data.playerIndex !== undefined) {
      const result = game.attack(socket.data.playerIndex, from, to);

      // Send system messages for events
      result.events.forEach((event) => {
        sendSystemMessage(roomId || "", event);
      });

      // Check for first blood (only on player vs player attacks)
      if (result.success && !gameFirstBlood.get(roomId || "")) {
        const gameState = game.getState();
        const defenderOwner = gameState.terrain[to];

        // Only trigger first blood on attacks against other players
        if (defenderOwner >= 0 && defenderOwner !== socket.data.playerIndex) {
          gameFirstBlood.set(roomId || "", true);
          sendSystemMessage(
            roomId || "",
            "⚔️ First blood! The battle has begun!"
          );
        }
      }

      // Check territory milestones and comebacks
      if (result.success) {
        checkTerritoryMilestones(roomId || "", game);
      }

      // Send attack result back to client
      socket.emit("attack_result", {
        from,
        to,
        success: result.success,
        attackInfo: result.attackInfo,
      });

      // Handle general capture notification
      if (result.attackInfo?.generalCaptured !== undefined) {
        const capturedPlayerIndex = result.attackInfo.generalCaptured;
        const gameState = game.getState();
        const capturedPlayer = gameState.players[capturedPlayerIndex];

        // Find the socket for the captured player and notify them
        const sockets = await io.in(roomId || "").fetchSockets();
        const capturedSocket = sockets.find(
          (s) => s.data.playerIndex === capturedPlayerIndex
        );
        if (capturedSocket) {
          capturedSocket.emit("generalCaptured");
        }

        // Broadcast updated player list immediately when someone is eliminated
        io.to(roomId || "").emit("player_joined", {
          players: gameState.players,
        });
      }

      // Handle territory capture notification
      if (result.attackInfo?.territoryCaptured !== undefined) {
        const capturedPlayerIndex = result.attackInfo.territoryCaptured;
        const gameState = game.getState();
        const capturedPlayer = gameState.players[capturedPlayerIndex];

        // Find the socket for the player who lost territory and notify them
        const sockets = await io.in(roomId || "").fetchSockets();
        const capturedSocket = sockets.find(
          (s) => s.data.playerIndex === capturedPlayerIndex
        );
        if (capturedSocket) {
          capturedSocket.emit("territoryCaptured");
        }
      }
    } else {
    }
  });

  socket.on(
    "invite_bot",
    (gameId: string, botType: "blob" | "arrow" | "spiral") => {
      if (!games.has(gameId)) {
        socket.emit("bot_invite_error", "Game not found");
        return;
      }

      const result = botManager.inviteBot(botType, gameId);
      socket.emit("bot_invite_result", result);

      // Notify all players in the room
      io.to(gameId).emit("chat_message", {
        username: "System",
        message: `${
          botType.charAt(0).toUpperCase() + botType.slice(1)
        } bot has been invited to the game`,
        playerIndex: -1,
        timestamp: Date.now(),
        isSystem: true,
      });
    }
  );

  socket.on("end_bot_game", (gameId: string) => {
    const game = games.get(gameId);
    if (!game || !game.isStarted() || game.isEnded()) {
      return;
    }

    const gameState = game.getState();
    const activePlayers = gameState.players.filter((p) => !p.eliminated);
    const humanPlayers = activePlayers.filter((p) => !p.isBot);

    if (humanPlayers.length > 0) {
      socket.emit(
        "end_game_error",
        "Cannot end game while human players are active"
      );
      return;
    }

    sendSystemMessage(gameId, `Game ended by viewer - only bots remaining`);

    setTimeout(() => {
      game.endGame(-1); // No winner
    }, 1000);
  });

  socket.on("abandon_game", (gameId: string, userId: string) => {
    if (!games.has(gameId)) {
      return;
    }

    const game = games.get(gameId)!;
    const gameState = game.getState();
    const player = gameState.players.find((p) => p.id === userId);

    if (!player || player.eliminated) {
      return;
    }

    // Mark player as eliminated
    player.eliminated = true;

    // Send system message
    sendSystemMessage(gameId, `${player.username} abandoned the game`);

    // Convert player to viewer
    console.log(`🚪 Player ${player.username} abandoned game - converting to viewer (was playerIndex: ${socket.data.playerIndex})`);
    socket.data.playerIndex = -1;
    socket.data.isViewer = true;

    // Check for victory condition
    const remainingPlayers = gameState.players.filter((p) => !p.eliminated);

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      sendSystemMessage(gameId, `🎉 ${winner.username} wins the game!`);

      // End the game after a short delay
      setTimeout(() => {
        game.endGame(winner.index || 0);
      }, 2000);
    } else if (remainingPlayers.length === 0) {
      // No players left - end game with no winner
      sendSystemMessage(gameId, `Game ended - no players remaining`);
      setTimeout(() => {
        game.endGame(-1);
      }, 2000);
    }

    // Broadcast updated player list
    io.to(gameId).emit("player_joined", {
      players: gameState.players,
    });

    // Send game info update
    sendGameInfo(gameId);
  });

  socket.on("leave_game", (gameId: string, userId: string) => {
    if (!games.has(gameId)) {
      return;
    }

    const game = games.get(gameId)!;
    const player = game.getPlayers().find((p) => p.id === userId);
    const removed = game.removePlayer(userId);

    if (removed && player) {
      // Send system message for player leave
      sendSystemMessage(gameId, `${player.username} left the game`);

      // Reset player data
      console.log(`🔌 Player ${socket.data.username} disconnected - converting to viewer (was playerIndex: ${socket.data.playerIndex})`);
      socket.data.playerIndex = -1;
      socket.data.isViewer = true;

      // Transfer host if leaving player was host
      if (socket.data.isHost && gameHosts.get(gameId) === socket.id) {
        transferHostToNextPlayer(gameId);
      }

      // Broadcast updated player list
      io.to(gameId).emit("player_joined", {
        players: game.getPlayers(),
      });

      sendGameInfo(gameId);
    }
  });

  socket.on(
    "update_game_settings",
    (
      gameId: string,
      settings: { turnIntervalMs?: number; movesPerTurn?: number }
    ) => {
      // Only allow host to update settings
      if (!socket.data.isHost || gameHosts.get(gameId) !== socket.id) {
        return;
      }

      const game = games.get(gameId);
      if (!game) {
        return;
      }

      // Don't allow settings changes during active games
      if (game.isStarted() && !game.isEnded()) {
        return;
      }

      // Update game settings
      if (
        settings.turnIntervalMs !== undefined ||
        settings.movesPerTurn !== undefined
      ) {
        game.setGameSettings(
          settings.turnIntervalMs || 1000,
          settings.movesPerTurn || 1
        );

        // Broadcast settings update to all players in the room
        io.to(gameId).emit("game_settings_updated", settings);
      }
    }
  );

  socket.on("disconnect", () => {
    const roomId = playerRooms.get(socket.id);

    if (roomId) {
      const game = games.get(roomId);
      if (game && socket.data.playerIndex >= 0) {
        if (!game.isStarted()) {
          // Game hasn't started - remove player immediately
          const userId = socket.data.userId;
          const username = socket.data.username;

          // Check if this is a bot and remove from bot manager (only if not already removed)
          if (userId && userId.startsWith("bot_")) {
            const botType = userId.toLowerCase().includes("blob")
              ? "blob"
              : userId.toLowerCase().includes("arrow")
              ? "arrow"
              : null;

            if (botType) {
              // Check if bot still exists in bot manager before trying to remove
              const hasBot = botManager.hasBot(botType, roomId);

              if (hasBot) {
                botManager.removeBot(botType, roomId);
              } else {
              }
            }
          }

          // Send system message for disconnect
          if (username) {
            sendSystemMessage(roomId, `${username} disconnected`);
          }

          game.removePlayer(userId);

          // Broadcast updated player list
          io.to(roomId).emit("player_joined", {
            players: game.getPlayers().map((p) => ({
              username: p.username,
              index: p.index,
              isBot: p.isBot,
              eliminated: p.eliminated,
            })),
          });
        } else {
          // Game is started - immediately abandon the game

          const gameState = game.getState();
          const player = gameState.players.find(
            (p) => p.index === socket.data.playerIndex
          );

          if (player && !player.eliminated) {
            // Mark player as eliminated
            player.eliminated = true;

            // Send system message
            sendSystemMessage(roomId, `${player.username} abandoned the game`);

            // Check for victory condition
            const remainingPlayers = gameState.players.filter(
              (p) => !p.eliminated
            );

            if (remainingPlayers.length === 1) {
              const winner = remainingPlayers[0];
              sendSystemMessage(roomId, `🎉 ${winner.username} wins the game!`);

              // End the game after a short delay
              setTimeout(() => {
                game.endGame(winner.index || 0);
              }, 2000);
            }
          }

          // Convert socket to viewer
          console.log(`💀 Player ${socket.data.username} eliminated - converting to viewer (was playerIndex: ${socket.data.playerIndex})`);
          socket.data.playerIndex = -1;
          socket.data.isViewer = true;

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
    } else {
    }
  });

  // Helper to transfer host when current host disconnects
  async function transferHostToNextPlayer(gameId: string) {
    const nextHost = await findBestHost(gameId, socket.id);

    if (nextHost) {
      gameHosts.set(gameId, nextHost.id);
      nextHost.data.isHost = true;

      // Send system message for host transfer
      sendSystemMessage(gameId, `👑 ${nextHost.data.username} is now the host`);
      await sendGameInfo(gameId);
    } else {
      gameHosts.delete(gameId);

      // Check if game should be cleaned up (no connected human players)
      const sockets = await io.in(gameId).fetchSockets();
      const connectedHumans = sockets.filter(
        (s) =>
          s.data.playerIndex !== undefined &&
          s.data.playerIndex >= 0 &&
          !isBot(s, s.data.userId || "", s.data.username || "")
      );

      if (connectedHumans.length === 0) {
        const game = games.get(gameId);
        if (game && game.isStarted()) {
          sendSystemMessage(
            gameId,
            "Game abandoned - no human players remaining"
          );
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

      await sendGameInfo(gameId);
    }
  }
});

const PORT = process.env.PORT || 5173;

// Initialize bot manager with dynamic URL
const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const botManager = new BotManager(serverUrl);

server.listen(PORT, () => {});
