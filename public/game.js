const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const socket = io();

// Camera system
let camera = {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.5, // Will be calculated dynamically
    maxZoom: 2,
    targetX: 0,
    targetY: 0,
    smoothing: 0.1
};

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

let gameState = null;
let selectedTile = null;
let playerIndex = -1;
let gameStarted = false;
let gameEnded = false;
let players = [];
let visibleTiles = new Set();
let playerGenerals = new Map(); // Track each player's starting position
let lastUsername = ''; // Remember last used username
let currentUserId = ''; // Track current user ID
let isHost = false;
let hostSocketId = null;
let isEliminated = false;
let playerSocketMap = new Map(); // playerIndex -> socketId

// Intent-based movement system
let activeIntent = null; // { fromTile, targetTile, path, currentStep }

// Get room ID from URL
const roomId = window.location.pathname.split('/').pop();
document.getElementById('roomId').textContent = roomId;

// Persistence keys (defined after roomId)
const STORAGE_KEY = `fog_of_war_${roomId}`;

// Load persisted state
function loadPersistedState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            lastUsername = state.username || '';
            document.getElementById('usernameInput').value = lastUsername;
            return state;
        } catch (e) {
            console.warn('Failed to load persisted state:', e);
        }
    }
    return null;
}

// Save state to localStorage (only for actual players)
function saveState() {
    if (playerIndex >= 0) { // Only save if actually joined as player
        const state = {
            username: lastUsername,
            playerIndex: playerIndex,
            isHost: isHost,
            gameStarted: gameStarted,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
}

// Clear saved state
function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}

// Auto-rejoin if we were previously in this game (only if we were a player in an active game)
function attemptAutoRejoin() {
    const saved = loadPersistedState();
    // Only auto-rejoin if we were in a started game
    if (saved && saved.username && saved.playerIndex >= 0 && saved.gameStarted && (Date.now() - saved.timestamp < 30 * 60 * 1000)) { // 30 min timeout
        console.log('Attempting auto-rejoin for player:', saved.username);
        const userId = 'human_' + Date.now();
        socket.emit('set_username', userId, saved.username);
        socket.emit('join_private', roomId, userId);
    }
}

// Colors for players
const playerColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
const emptyColor = '#f0f0f0';
const mountainColor = '#333';
const fogColor = '#888';

// Mobile tab system
function checkIsMobile() {
    const width = window.innerWidth;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobileWidth = width <= 768;
    return isMobileWidth || isMobileUA;
}

const isMobile = checkIsMobile();
let currentMobileTab = 'game';

console.log('🔍 Mobile Detection:', {
    windowWidth: window.innerWidth,
    isMobile: isMobile,
    hasTouch: 'ontouchstart' in window,
    userAgent: navigator.userAgent
});

function initMobileTabs() {
    console.log('🔍 initMobileTabs called, isMobile:', isMobile);
    
    if (!isMobile) {
        console.log('🔍 Not mobile, skipping tab init');
        return;
    }
    
    console.log('🔍 Setting up mobile tabs...');
    
    const tabBar = document.getElementById('mobileTabBar');
    const gameTab = document.getElementById('gameTab');
    const controlsTab = document.getElementById('controlsTab');
    const chatTab = document.getElementById('chatTab');
    
    console.log('🔍 Tab elements:', {
        tabBar: !!tabBar,
        gameTab: !!gameTab,
        controlsTab: !!controlsTab,
        chatTab: !!chatTab
    });
    
    document.body.classList.add('mobile-game-active');
    console.log('🔍 Added mobile-game-active class');
    
    if (gameTab) gameTab.addEventListener('click', () => switchMobileTab('game'));
    if (controlsTab) controlsTab.addEventListener('click', () => switchMobileTab('controls'));
    if (chatTab) chatTab.addEventListener('click', () => switchMobileTab('chat'));
    
    console.log('🔍 Mobile tabs initialized');
}

function switchMobileTab(tab) {
    if (!isMobile) return;
    
    // Remove all active classes
    document.body.classList.remove('mobile-game-active', 'mobile-controls-active', 'mobile-chat-active');
    document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
    
    // Add new active class
    document.body.classList.add(`mobile-${tab}-active`);
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    currentMobileTab = tab;
    
    // Resize canvas if switching to game tab
    if (tab === 'game') {
        setTimeout(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 120;
            drawGame();
        }, 100);
    }
}

// Connect as viewer initially, then try auto-rejoin
socket.emit('set_username', 'viewer_' + Date.now(), 'Viewer');
socket.emit('join_private', roomId, 'viewer_' + Date.now());

// Load persisted state and attempt auto-rejoin
loadPersistedState();
setTimeout(attemptAutoRejoin, 100); // Small delay to ensure connection

// Initialize mobile tabs
initMobileTabs();

socket.on('game_start', (data) => {
    console.log('🎮 Game started!', data);
    console.log('   Player index:', data.playerIndex);
    console.log('   Map data length:', data.mapData?.length);
    
    if (data.mapData) {
        gameState = parseMapData(data.mapData);
        console.log('   Parsed initial game state:', {
            width: gameState.width,
            height: gameState.height,
            armiesLength: gameState.armies?.length,
            terrainLength: gameState.terrain?.length,
            towerDefenseLength: gameState.towerDefense?.length
        });
        
        // Log all player positions
        console.log('   Initial player positions:');
        gameState.terrain.forEach((terrain, index) => {
            if (terrain >= 0) {
                console.log(`     Position ${index}: player=${terrain}, armies=${gameState.armies[index]}`);
            }
        });
    }
    
    document.getElementById('gameStarted').textContent = gameStarted ? 'Playing' : 'Started';
    document.getElementById('gameEndNotification').style.display = 'none'; // Hide notification
    document.getElementById('gameBoard').style.display = 'block'; // Show canvas
    playerIndex = data.playerIndex !== undefined ? data.playerIndex : -1;
    gameStarted = true;
    updateButtonVisibility(); // Update button visibility
    saveState(); // Save state when game starts
    console.log('   Player index set to:', playerIndex);
});

socket.on('game_info', (data) => {
    document.getElementById('spectatorCount').textContent = data.spectatorCount;
    document.getElementById('hostName').textContent = data.hostName || '-';
    hostSocketId = data.hostSocketId;
    
    // Update host status based on server data
    isHost = (data.hostSocketId === socket.id);
    console.log('Host status update:', { mySocketId: socket.id, hostSocketId: data.hostSocketId, isHost, playerIndex });
    
    // Update player socket mapping
    if (data.playerSocketMap) {
        playerSocketMap = new Map(Object.entries(data.playerSocketMap));
    }
    
    // Show/hide buttons based on status
    updateButtonVisibility();
    
    // Update player list to show/hide "Make Host" buttons
    updatePlayersList();
});

function updateButtonVisibility() {
    const joinControls = document.getElementById('joinControls');
    const startBtn = document.getElementById('startBtn');
    const mobileStartBtn = document.getElementById('mobileStartBtn');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    
    if (gameStarted) {
        // Game is active - hide all join/leave controls
        joinControls.style.display = 'none';
    } else if (playerIndex >= 0) {
        // Joined but game not started - show leave button, hide join controls
        joinBtn.style.display = 'none';
        leaveBtn.style.display = 'inline-block';
        document.getElementById('usernameInput').style.display = 'none';
    } else {
        // Not joined and game not started - show join controls, hide leave button
        joinControls.style.display = 'block';
        joinBtn.style.display = 'inline-block';
        leaveBtn.style.display = 'none';
        document.getElementById('usernameInput').style.display = 'block';
    }
    
    // Show start button only to host when game not started
    startBtn.style.display = (isHost && !gameStarted) ? 'inline-block' : 'none';
    mobileStartBtn.style.display = (isHost && !gameStarted) ? 'inline-block' : 'none';
}

socket.on('joined_as_player', (data) => {
    console.log('Joined as player:', data);
    playerIndex = data.playerIndex;
    saveState(); // Save state only after successfully joining
    updateButtonVisibility(); // Update button visibility
});

socket.on('player_joined', (data) => {
    console.log('Player joined:', data);
    players = data.players;
    
    // Check if current player is eliminated
    if (playerIndex >= 0 && players[playerIndex]?.eliminated) {
        isEliminated = true;
        console.log('Player eliminated - switching to spectator view');
        updateVisibleTiles(); // Update visibility to show full map
        drawGame();
    }
    
    updatePlayersList();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    
    // If we were a joined player but game hasn't started, leave the game
    if (playerIndex >= 0 && !gameStarted) {
        console.log('Disconnected while joined but game not started - leaving game');
        leaveGame();
    }
    
    // Show reconnection message
    const notification = document.getElementById('gameEndNotification');
    const gameEndText = document.getElementById('gameEndText');
    gameEndText.textContent = 'Connection lost - attempting to reconnect...';
    gameEndText.style.color = '#ff9800';
    notification.style.display = 'block';
});

socket.on('connect', () => {
    console.log('Connected to server');
    // Hide reconnection message
    const notification = document.getElementById('gameEndNotification');
    if (notification.style.display === 'block') {
        notification.style.display = 'none';
    }
    
    // Attempt to rejoin only if we were previously in an active game
    if (playerIndex >= 0 && lastUsername && gameStarted) {
        console.log('Reconnecting as player:', lastUsername);
        const userId = 'human_' + Date.now();
        socket.emit('set_username', userId, lastUsername);
        socket.emit('join_private', roomId, userId);
    }
});

socket.on('username_taken', (data) => {
    alert(`Username "${data.username}" is already taken. Please choose a different username.`);
    document.getElementById('usernameInput').focus();
});

socket.on('game_already_started', () => {
    alert('Cannot join - game has already started. You can spectate instead.');
    // Switch to viewer mode
    socket.emit('join_as_viewer', { gameId: currentGameId });
});

socket.on('game_won', (data) => {
    gameStarted = false;
    const winnerName = players[data.winner]?.username || 'Unknown';
    
    // Reset player state for humans (bots will auto-rejoin)
    playerIndex = -1;
    selectedTile = null;
    document.getElementById('gameStarted').textContent = 'Game Ended';
    
    // Show in-game notification instead of modal
    const notification = document.getElementById('gameEndNotification');
    const gameEndText = document.getElementById('gameEndText');
    
    // Check if current player won by comparing usernames
    const didIWin = (winnerName === lastUsername);
    
    if (didIWin) {
        gameEndText.textContent = '🎉 Victory! You won the game! 🎉';
        gameEndText.style.color = '#4CAF50';
    } else {
        gameEndText.textContent = `💀 Game Over - ${winnerName} won! 💀`;
        gameEndText.style.color = '#f44336';
    }
    
    notification.style.display = 'block';
    
    // Pre-populate username input with last used username
    document.getElementById('usernameInput').value = lastUsername;
    
    // Clear saved state when game ends
    clearState();
});

socket.on('attack_result', (data) => {
    if (data.success) {
        setSelectedTile(data.to);
        updateVisibleTiles();
    } else {
        // Keep the original tile selected on failed moves
        // selectedTile remains unchanged
        drawGame();
    }
});

socket.on('game_update', (data) => {
    console.log('🔄 Game update received:', data);
    
    if (data.map_diff && data.map_diff.length > 0) {
        console.log('   Map diff length:', data.map_diff.length);
        const patchedMap = patch([], data.map_diff);
        console.log('   Patched map length:', patchedMap.length);
        
        gameState = parseMapData(patchedMap);
        console.log('   Parsed game state:', {
            width: gameState.width,
            height: gameState.height,
            armiesLength: gameState.armies?.length,
            terrainLength: gameState.terrain?.length,
            towerDefenseLength: gameState.towerDefense?.length
        });
        
        // Log all player positions
        console.log('   Player positions:');
        gameState.terrain.forEach((terrain, index) => {
            if (terrain >= 0) {
                console.log(`     Position ${index}: player=${terrain}, armies=${gameState.armies[index]}`);
            }
        });
        
        // Update players data if provided
        if (data.players) {
            gameState.players = data.players;
            console.log('   Players updated:', gameState.players);
        }
        
        // Update cities and lookout towers if provided
        if (data.cities_diff) {
            gameState.cities = patch(gameState.cities || [], data.cities_diff);
            console.log('   Cities updated:', gameState.cities);
        }
        if (data.lookoutTowers_diff) {
            gameState.lookoutTowers = patch(gameState.lookoutTowers || [], data.lookoutTowers_diff);
            console.log('   Lookout towers updated:', gameState.lookoutTowers);
        }
        
        // Auto-select player's general on first update if no tile selected
        if (selectedTile === null && playerIndex >= 0 && data.generals) {
            const generalPos = data.generals[playerIndex];
            if (generalPos !== undefined) {
                setSelectedTile(generalPos);
                console.log(`🎯 Auto-selected general at position ${generalPos}`);
                
                // Center camera on general immediately (override smooth following)
                const row = Math.floor(generalPos / gameState.width);
                const col = generalPos % gameState.width;
                const tileWorldX = (col * 35 + 17.5) * camera.zoom;
                const tileWorldY = (row * 35 + 17.5) * camera.zoom;
                
                camera.x = tileWorldX - canvas.width / 2;
                camera.y = tileWorldY - canvas.height / 2;
                camera.targetX = camera.x;
                camera.targetY = camera.y;
                
                // Clamp to bounds
                const mapWidth = gameState.width * 35 * camera.zoom;
                const mapHeight = gameState.height * 35 * camera.zoom;
                camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width));
                camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height));
                camera.targetX = camera.x;
                camera.targetY = camera.y;
            }
        }
        
        // Check if current player got eliminated this turn
        if (playerIndex >= 0 && gameState.players && gameState.players[playerIndex]?.eliminated && !isEliminated) {
            isEliminated = true;
            console.log('Player just got eliminated - switching to spectator view');
        }
        
        // Track generals (starting positions)
        if (gameState && gameStarted) {
            for (let i = 0; i < gameState.terrain.length; i++) {
                const terrain = gameState.terrain[i];
                if (terrain >= 0 && gameState.armies[i] > 0) {
                    // Check if this might be a starting position (any army count for generals)
                    if (!playerGenerals.has(terrain)) {
                        playerGenerals.set(terrain, i);
                        console.log(`🎯 Detected general for player ${terrain} at position ${i}`);
                    }
                }
            }
        }
        
        updateVisibleTiles();
        
        // Execute intent-based movement
        if (activeIntent && activeIntent.currentStep < activeIntent.path.length) {
            const currentTile = activeIntent.currentStep === 0 ? activeIntent.fromTile : activeIntent.path[activeIntent.currentStep - 1];
            const nextTile = activeIntent.path[activeIntent.currentStep];
            
            if (gameState.armies[currentTile] > 1 && isAdjacent(currentTile, nextTile)) {
                socket.emit('attack', currentTile, nextTile);
                activeIntent.currentStep++;
                
                // Check if we've reached the target
                if (activeIntent.currentStep >= activeIntent.path.length) {
                    activeIntent = null; // Clear completed intent
                }
            } else {
                activeIntent = null; // Clear invalid intent
            }
        }
        
        drawGame();
        updatePlayersList(); // Update stats display
        saveState(); // Save state on each game update
    }
});

socket.on('game_end', (data) => {
    console.log('Game ended:', data);
    gameEnded = true;
    
    // Show the existing end game notification
    const notification = document.getElementById('gameEndNotification');
    const gameEndText = document.getElementById('gameEndText');
    
    if (data.winner) {
        gameEndText.textContent = `🏆 ${data.winner.username} wins!`;
        gameEndText.style.color = '#4CAF50';
    } else {
        gameEndText.textContent = 'Game ended';
        gameEndText.style.color = '#666';
    }
    
    notification.style.display = 'block';
    
    updateVisibleTiles();
    drawGame();
});

function updateVisibleTiles() {
    if (!gameState) return;
    
    visibleTiles.clear();
    
    // Viewers and eliminated players see everything
    if (playerIndex < 0 || isEliminated) {
        for (let i = 0; i < gameState.terrain.length; i++) {
            visibleTiles.add(i);
        }
        return;
    }
    
    // Active players see fog of war
    for (let i = 0; i < gameState.terrain.length; i++) {
        if (gameState.terrain[i] === playerIndex) {
            visibleTiles.add(i);
            
            // Check if this is a lookout tower for extended vision
            if (gameState.lookoutTowers && gameState.lookoutTowers.includes(i)) {
                // Lookout towers provide 5-tile radius vision
                const towerVision = getTilesInRadius(i, 5);
                towerVision.forEach(tile => visibleTiles.add(tile));
            } else {
                // Regular tiles provide adjacent vision
                const adjacent = getAdjacentTiles(i);
                adjacent.forEach(adj => visibleTiles.add(adj));
            }
        }
    }
}

function getAdjacentTiles(tileIndex) {
    const adjacent = [];
    const row = Math.floor(tileIndex / gameState.width);
    const col = tileIndex % gameState.width;
    
    // 8-directional (including diagonals)
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue; // Skip the tile itself
            
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < gameState.height && 
                newCol >= 0 && newCol < gameState.width) {
                adjacent.push(newRow * gameState.width + newCol);
            }
        }
    }
    
    return adjacent;
}

function getTilesInRadius(tileIndex, radius) {
    const tiles = [];
    const row = Math.floor(tileIndex / gameState.width);
    const col = tileIndex % gameState.width;
    
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < gameState.height && 
                newCol >= 0 && newCol < gameState.width) {
                tiles.push(newRow * gameState.width + newCol);
            }
        }
    }
    
    return tiles;
}

function patch(old, diff) {
    const out = [];
    let i = 0;
    while (i < diff.length) {
        if (diff[i]) {
            out.push(...old.slice(out.length, out.length + diff[i]));
        }
        i++;
        if (i < diff.length && diff[i]) {
            out.push(...diff.slice(i + 1, i + 1 + diff[i]));
            i += diff[i];
        }
        i++;
    }
    return out;
}

function parseMapData(mapData) {
    const width = mapData[0];
    const height = mapData[1];
    const size = width * height;
    const armies = mapData.slice(2, size + 2);
    const terrain = mapData.slice(size + 2, size + 2 + size);
    const towerDefense = mapData.slice(size + 2 + size, size + 2 + size + size);
    
    return { width, height, armies, terrain, towerDefense, generals: [] };
}

function setSelectedTile(tileIndex) {
    selectedTile = tileIndex;
    if (tileIndex !== null) {
        updateCamera();
    }
    drawGame();
}

function attemptMove(fromTile, toTile) {
    if (!gameState || !visibleTiles.has(toTile)) return false;
    
    if (gameState.armies[fromTile] > 1) {
        // Have armies to move - attempt attack/move
        socket.emit('attack', fromTile, toTile);
        return true;
    } else if (gameState.terrain[toTile] === playerIndex) {
        // Can't move but target is owned - change selection
        setSelectedTile(toTile);
        return true;
    }
    return false;
}

function updateCamera() {
    if (!gameState || selectedTile === null) return;
    
    const tileSize = 35 * camera.zoom;
    const row = Math.floor(selectedTile / gameState.width);
    const col = selectedTile % gameState.width;
    
    // World position of selected tile center
    const tileWorldX = (col * 35 + 17.5) * camera.zoom;
    const tileWorldY = (row * 35 + 17.5) * camera.zoom;
    
    // Screen position of tile if camera doesn't move
    const tileScreenX = tileWorldX - camera.x;
    const tileScreenY = tileWorldY - camera.y;
    
    // Define edge margins (how close to edge before camera starts following)
    const marginX = canvas.width * 0.25; // 25% from edge
    const marginY = canvas.height * 0.25;
    
    // Calculate target camera position to center tile
    const targetCameraX = tileWorldX - canvas.width / 2;
    const targetCameraY = tileWorldY - canvas.height / 2;
    
    // Only update target if tile is near screen edges
    if (tileScreenX < marginX || tileScreenX > canvas.width - marginX) {
        camera.targetX = targetCameraX;
    }
    if (tileScreenY < marginY || tileScreenY > canvas.height - marginY) {
        camera.targetY = targetCameraY;
    }
    
    // Clamp target to map bounds
    const mapWidth = gameState.width * 35 * camera.zoom;
    const mapHeight = gameState.height * 35 * camera.zoom;
    
    camera.targetX = Math.max(0, Math.min(camera.targetX, mapWidth - canvas.width));
    camera.targetY = Math.max(0, Math.min(camera.targetY, mapHeight - canvas.height));
    
    // Smooth interpolation toward target
    const deltaX = camera.targetX - camera.x;
    const deltaY = camera.targetY - camera.y;
    
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        camera.x += deltaX * camera.smoothing;
        camera.y += deltaY * camera.smoothing;
        
        // Redraw if camera moved significantly
        drawGame();
        requestAnimationFrame(updateCamera);
    }
}

function drawGame() {
    if (!gameState) return;
    
    console.log('🎨 Drawing game - terrain length:', gameState.terrain?.length);
    
    const tileSize = 35 * camera.zoom;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context for camera transform
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    for (let i = 0; i < gameState.terrain.length; i++) {
        const row = Math.floor(i / gameState.width);
        const col = i % gameState.width;
        const x = col * tileSize;
        const y = row * tileSize;
        
        // Skip tiles outside viewport
        if (x + tileSize < camera.x || x > camera.x + canvas.width ||
            y + tileSize < camera.y || y > camera.y + canvas.height) {
            continue;
        }
        
        // Check if tile is visible to current player (or show all if game ended)
        const isVisible = playerIndex < 0 || visibleTiles.has(i) || gameEnded;
        
        if (!isVisible) {
            // Draw fog of war
            ctx.fillStyle = fogColor;
            ctx.fillRect(x, y, tileSize, tileSize);
            
            // Add fog pattern
            ctx.fillStyle = '#999';
            for (let fx = 0; fx < tileSize; fx += 4) {
                for (let fy = 0; fy < tileSize; fy += 4) {
                    if ((fx + fy) % 8 === 0) {
                        ctx.fillRect(x + fx, y + fy, 2, 2);
                    }
                }
            }
        } else {
            // Draw visible tile
            const terrain = gameState.terrain[i];
            if (terrain === -2) { // Mountain
                ctx.fillStyle = mountainColor;
            } else if (terrain === -6) { // City
                ctx.fillStyle = '#D2691E'; // Saddle brown for cities
            } else if (terrain === -5) { // Lookout Tower
                ctx.fillStyle = '#696969'; // Dim gray for towers
            } else if (terrain >= 0) { // Player owned
                ctx.fillStyle = playerColors[terrain] || emptyColor;
            } else { // Empty
                ctx.fillStyle = emptyColor;
            }
            
            ctx.fillRect(x, y, tileSize, tileSize);
            
            // Draw city buildings
            if (terrain === -6 || (terrain >= 0 && gameState.cities && gameState.cities.includes(i))) {
                ctx.fillStyle = '#8B4513'; // Brown buildings
                const scale = camera.zoom;
                ctx.fillRect(x + 4*scale, y + 12*scale, 6*scale, 12*scale);
                ctx.fillRect(x + 12*scale, y + 8*scale, 6*scale, 16*scale);
                ctx.fillRect(x + 20*scale, y + 15*scale, 4*scale, 9*scale);
            }
            
            // Draw lookout tower
            if (terrain === -5 || (terrain >= 0 && gameState.lookoutTowers && gameState.lookoutTowers.includes(i))) {
                ctx.fillStyle = '#654321'; // Dark brown tower
                const scale = camera.zoom;
                ctx.fillRect(x + 10*scale, y + 6*scale, 6*scale, 18*scale);
                ctx.fillRect(x + 8*scale, y + 4*scale, 10*scale, 4*scale);
                // Tower flag
                if (terrain >= 0) {
                    ctx.fillStyle = playerColors[terrain];
                    ctx.fillRect(x + 16*scale, y + 4*scale, 4*scale, 3*scale);
                }
            }
            
            // Draw castle for starting positions
            if (playerGenerals.has(terrain) && playerGenerals.get(terrain) === i) {
                console.log(`🏰 Drawing castle for player ${terrain} at position ${i}`);
                ctx.fillStyle = '#8B4513'; // Brown castle base
                const scale = camera.zoom;
                ctx.fillRect(x + 8*scale, y + 18*scale, 9*scale, 7*scale);
                ctx.fillRect(x + 6*scale, y + 15*scale, 4*scale, 10*scale);
                ctx.fillRect(x + 15*scale, y + 15*scale, 4*scale, 10*scale);
                ctx.fillRect(x + 10*scale, y + 12*scale, 5*scale, 13*scale);
                
                // Castle flag
                ctx.fillStyle = playerColors[terrain];
                ctx.fillRect(x + 11*scale, y + 8*scale, 3*scale, 4*scale);
            }
            
            // Draw army count or tower defense
            if (gameState.armies[i] > 0) {
                ctx.fillStyle = terrain === -2 ? 'white' : 'black';
                ctx.font = `bold ${Math.max(8, 10 * camera.zoom)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(gameState.armies[i].toString(), x + tileSize/2, y + tileSize/2 + 3*camera.zoom);
            } else if (terrain === -5 && gameState.towerDefense && gameState.towerDefense[i] > 0) {
                // Show tower defense for neutral towers
                ctx.fillStyle = 'white';
                ctx.font = `bold ${Math.max(8, 10 * camera.zoom)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(gameState.towerDefense[i].toString(), x + tileSize/2, y + tileSize/2 + 3*camera.zoom);
            }
        }
        
        // Draw intent path
        if (activeIntent && activeIntent.path.includes(i)) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3 * camera.zoom;
            ctx.setLineDash([5 * camera.zoom, 5 * camera.zoom]);
            ctx.strokeRect(x, y, tileSize, tileSize);
            ctx.setLineDash([]);
        }
        
        // Draw border
        ctx.strokeStyle = selectedTile === i ? '#ffd700' : '#ccc';
        ctx.lineWidth = selectedTile === i ? 3 * camera.zoom : 1 * camera.zoom;
        ctx.strokeRect(x, y, tileSize, tileSize);
        
        // Add glow effect for selected tile
        if (selectedTile === i) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 10 * camera.zoom;
            ctx.strokeRect(x, y, tileSize, tileSize);
            ctx.shadowBlur = 0;
        }
    }
    
    // Restore context
    ctx.restore();
}

function drawGameEndOverlay() {
    const gameEndText = document.getElementById('gameEndText');
    if (!gameEndText || !gameEndText.textContent) return;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Main message
    ctx.fillStyle = gameEndText.style.color || '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText(gameEndText.textContent, canvas.width / 2, canvas.height / 2);
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Subtitle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '24px Arial';
    ctx.fillText('Click anywhere to continue viewing', canvas.width / 2, canvas.height / 2 + 60);
}

function closeGameEndModal() {
    document.getElementById('gameEndModal').style.display = 'none';
}

function showGameEndModal(winnerName, winnerIndex) {
    const modal = document.getElementById('gameEndModal');
    const winnerText = document.getElementById('winnerText');
    const gameEndMessage = document.getElementById('gameEndMessage');
    
    console.log('Game end modal:', { winnerName, winnerIndex, myPlayerIndex: playerIndex, myUsername: lastUsername });
    
    // Check if current player won by comparing usernames instead of indices
    const didIWin = (winnerName === lastUsername);
    
    if (didIWin) {
        winnerText.textContent = '🎉 Victory! 🎉';
        winnerText.style.color = '#4CAF50';
        gameEndMessage.textContent = 'Congratulations! You have conquered the battlefield!';
    } else {
        winnerText.textContent = '💀 Defeat 💀';
        winnerText.style.color = '#f44336';
        gameEndMessage.textContent = `${winnerName} has conquered the battlefield. Better luck next time!`;
    }
    
    modal.style.display = 'flex';
}

canvas.addEventListener('click', (e) => {
    if (!gameState || playerIndex < 0 || isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + camera.x;
    const y = e.clientY - rect.top + camera.y;
    const tileSize = 35 * camera.zoom;
    
    const col = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);
    const tileIndex = row * gameState.width + col;
    
    // Only allow interaction with visible tiles
    if (!visibleTiles.has(tileIndex)) return;
    
    if (selectedTile === null) {
        // Select any tile owned by player (even with 1 army)
        if (gameState.terrain[tileIndex] === playerIndex) {
            setSelectedTile(tileIndex);
        }
    } else {
        if (isAdjacent(selectedTile, tileIndex)) {
            // Clear any existing intent when making manual moves
            activeIntent = null;
            // Try to move/attack
            attemptMove(selectedTile, tileIndex);
        } else {
            // Non-adjacent click - check for intent-based movement vs selection
            if (gameState.armies[selectedTile] > 1 && !e.shiftKey) {
                // Regular click: Start intent-based movement
                activeIntent = null; // Clear any existing intent first
                
                const path = findPath(selectedTile, tileIndex);
                if (path && path.length > 0) {
                    activeIntent = {
                        fromTile: selectedTile,
                        targetTile: tileIndex,
                        path: path,
                        currentStep: 0
                    };
                    console.log('Intent path:', path);
                }
            } else if (e.shiftKey && gameState.terrain[tileIndex] === playerIndex) {
                // Shift+click: Change selection (pan behavior)
                setSelectedTile(tileIndex);
            } else if (!e.shiftKey && gameState.terrain[tileIndex] === playerIndex) {
                // Can't move but target is owned - change selection
                setSelectedTile(tileIndex);
            } else {
                setSelectedTile(null);
            }
        }
    }
});

// Camera controls
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        camera.x -= deltaX;
        camera.y -= deltaY;
        
        // Update target to current position when manually dragging
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        // Clamp camera to map bounds
        const mapWidth = gameState ? gameState.width * 35 * camera.zoom : 1050;
        const mapHeight = gameState ? gameState.height * 35 * camera.zoom : 1050;
        
        camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height));
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        drawGame();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    if (!gameState) return;
    
    // Calculate minimum zoom to fit entire map
    const mapPixelWidth = gameState.width * 35;
    const mapPixelHeight = gameState.height * 35;
    const minZoomX = canvas.width / mapPixelWidth;
    const minZoomY = canvas.height / mapPixelHeight;
    const calculatedMinZoom = Math.max(minZoomX, minZoomY);
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // World coordinates before zoom (accounting for current camera position)
    const worldX = (mouseX + camera.x) / camera.zoom;
    const worldY = (mouseY + camera.y) / camera.zoom;
    
    // Reduced sensitivity: smaller zoom steps
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
    const newZoom = Math.max(calculatedMinZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));
    
    if (newZoom !== camera.zoom) {
        camera.zoom = newZoom;
        
        // Adjust camera to keep mouse position fixed
        camera.x = worldX * camera.zoom - mouseX;
        camera.y = worldY * camera.zoom - mouseY;
        
        // Update targets to current position
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        // Clamp camera to map bounds
        const mapWidth = gameState.width * 35 * camera.zoom;
        const mapHeight = gameState.height * 35 * camera.zoom;
        
        camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height));
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        drawGame();
    }
});

// Touch support for mobile pinch zoom and panning
let touches = [];
let lastPanX = 0;
let lastPanY = 0;

canvas.addEventListener('touchstart', (e) => {
    touches = Array.from(e.touches);
    
    if (touches.length === 1) {
        // Single touch - prepare for panning
        const rect = canvas.getBoundingClientRect();
        lastPanX = touches[0].clientX - rect.left;
        lastPanY = touches[0].clientY - rect.top;
    }
    // Don't preventDefault here to allow click events
});

canvas.addEventListener('touchmove', (e) => {
    if (!gameState) return;
    
    const newTouches = Array.from(e.touches);
    
    if (touches.length === 1 && newTouches.length === 1) {
        // Only prevent default for panning to avoid blocking clicks
        e.preventDefault();
        
        // Single touch panning
        const rect = canvas.getBoundingClientRect();
        const currentX = newTouches[0].clientX - rect.left;
        const currentY = newTouches[0].clientY - rect.top;
        
        const deltaX = currentX - lastPanX;
        const deltaY = currentY - lastPanY;
        
        camera.x -= deltaX;
        camera.y -= deltaY;
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        // Clamp to bounds
        const mapWidth = gameState.width * 35 * camera.zoom;
        const mapHeight = gameState.height * 35 * camera.zoom;
        camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height));
        camera.targetX = camera.x;
        camera.targetY = camera.y;
        
        lastPanX = currentX;
        lastPanY = currentY;
        drawGame();
        
    } else if (touches.length === 2 && newTouches.length === 2) {
        // Pinch zoom
        const oldDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        const newDistance = Math.hypot(
            newTouches[0].clientX - newTouches[1].clientX,
            newTouches[0].clientY - newTouches[1].clientY
        );
        
        const zoomFactor = newDistance / oldDistance;
        const mapPixelWidth = gameState.width * 35;
        const mapPixelHeight = gameState.height * 35;
        const minZoomX = canvas.width / mapPixelWidth;
        const minZoomY = canvas.height / mapPixelHeight;
        const calculatedMinZoom = Math.max(minZoomX, minZoomY);
        
        camera.zoom = Math.max(calculatedMinZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));
        drawGame();
    }
    
    touches = newTouches;
});

canvas.addEventListener('touchend', (e) => {
    touches = Array.from(e.touches);
    // Don't preventDefault to allow click events
});

canvas.style.cursor = 'grab';

function isAdjacent(from, to) {
    const fromRow = Math.floor(from / gameState.width);
    const fromCol = from % gameState.width;
    const toRow = Math.floor(to / gameState.width);
    const toCol = to % gameState.width;
    
    const rowDiff = Math.abs(fromRow - toRow);
    const colDiff = Math.abs(fromCol - toCol);
    
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Simple pathfinding for intent-based movement
function findPath(from, to) {
    if (!gameState) return null;
    
    const queue = [{ tile: from, path: [from] }];
    const visited = new Set([from]);
    
    while (queue.length > 0) {
        const { tile, path } = queue.shift();
        
        if (tile === to) {
            return path.slice(1); // Remove starting tile
        }
        
        // Check all adjacent tiles
        const row = Math.floor(tile / gameState.width);
        const col = tile % gameState.width;
        
        const neighbors = [
            { r: row - 1, c: col },     // up
            { r: row + 1, c: col },     // down
            { r: row, c: col - 1 },     // left
            { r: row, c: col + 1 }      // right
        ];
        
        for (const { r, c } of neighbors) {
            if (r < 0 || r >= gameState.height || c < 0 || c >= gameState.width) continue;
            
            const neighborTile = r * gameState.width + c;
            if (visited.has(neighborTile)) continue;
            
            // Skip mountains (terrain -2) - but allow pathfinding through fog and other terrain
            if (visibleTiles.has(neighborTile) && gameState.terrain[neighborTile] === -2) continue;
            
            visited.add(neighborTile);
            queue.push({ tile: neighborTile, path: [...path, neighborTile] });
        }
    }
    
    return null; // No path found
}

function calculatePlayerStats() {
    if (!gameState) return {};
    
    const stats = {};
    players.forEach((player, index) => {
        stats[index] = { tiles: 0, armies: 0 };
    });
    
    for (let i = 0; i < gameState.terrain.length; i++) {
        const owner = gameState.terrain[i];
        if (owner >= 0 && stats[owner]) {
            stats[owner].tiles++;
            stats[owner].armies += gameState.armies[i];
        }
    }
    
    return stats;
}

function updatePlayersList() {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    const stats = calculatePlayerStats();
    
    // Create table
    const table = document.createElement('table');
    table.className = 'players-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Player', 'Tiles', 'Armies', 'Total'];
    if (isHost && !gameStarted) {
        headers.push('Actions');
    }
    
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    // Create sorted player list by performance (tiles + armies)
    const sortedPlayers = players.map((player, index) => ({
        ...player,
        index,
        stats: stats[index] || { tiles: 0, armies: 0 },
        score: (stats[index]?.tiles || 0) + (stats[index]?.armies || 0)
    })).sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player) => {
        const row = document.createElement('tr');
        row.style.color = playerColors[player.index] || 'black';
        
        if (player.eliminated) {
            row.classList.add('eliminated-player');
        }
        
        if (player.index === playerIndex) {
            row.classList.add('current-player');
        }
        
        // Player name cell
        const nameCell = document.createElement('td');
        let displayName = player.username;
        if (player.eliminated) {
            displayName += ' (eliminated)';
        } else if (player.disconnected) {
            displayName += ' (disconnected)';
        }
        nameCell.textContent = displayName;
        row.appendChild(nameCell);
        
        // Tiles cell
        const tilesCell = document.createElement('td');
        tilesCell.textContent = gameStarted ? player.stats.tiles : '-';
        tilesCell.style.textAlign = 'center';
        row.appendChild(tilesCell);
        
        // Armies cell
        const armiesCell = document.createElement('td');
        armiesCell.textContent = gameStarted ? player.stats.armies : '-';
        armiesCell.style.textAlign = 'center';
        row.appendChild(armiesCell);
        
        // Total cell
        const totalCell = document.createElement('td');
        totalCell.textContent = gameStarted ? player.score : '-';
        totalCell.style.textAlign = 'center';
        totalCell.style.fontWeight = 'bold';
        row.appendChild(totalCell);
        
        // Actions cell (only for host viewing non-bot human players when game not started)
        if (isHost && !gameStarted) {
            const actionsCell = document.createElement('td');
            if (player.isBot === false && player.index !== playerIndex) {
                const transferBtn = document.createElement('button');
                transferBtn.textContent = 'Make Host';
                transferBtn.className = 'transfer-btn';
                transferBtn.title = 'Transfer host to this player';
                transferBtn.onclick = () => transferHost(player.index);
                actionsCell.appendChild(transferBtn);
            }
            row.appendChild(actionsCell);
        }
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    playersDiv.appendChild(table);
}

function transferHost(targetPlayerIndex) {
    const targetSocketId = playerSocketMap.get(targetPlayerIndex.toString());
    console.log('Transfer host attempt:', { targetPlayerIndex, targetSocketId, playerSocketMap });
    if (targetSocketId) {
        socket.emit('transfer_host', roomId, targetSocketId);
    } else {
        console.error('No socket ID found for player index:', targetPlayerIndex);
    }
}

// Button handlers
document.getElementById('joinBtn').addEventListener('click', joinAsPlayer);
document.getElementById('leaveBtn').addEventListener('click', leaveGame);
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('mobileStartBtn').addEventListener('click', startGame);
document.getElementById('copyUrlBtn').addEventListener('click', copyGameUrl);

function joinAsPlayer() {
    if (playerIndex >= 0) return;
    
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        document.getElementById('usernameInput').focus();
        return;
    }
    
    lastUsername = username; // Remember this username
    currentUserId = 'human_' + Date.now();
    socket.emit('set_username', currentUserId, username);
    socket.emit('join_private', roomId, currentUserId);
}

function leaveGame() {
    if (playerIndex < 0 || gameStarted) return;
    
    // Emit leave event to server with current user ID
    socket.emit('leave_game', roomId, currentUserId);
    
    // Reset player state
    playerIndex = -1;
    selectedTile = null;
    isHost = false;
    currentUserId = '';
    clearState(); // This clears localStorage
    
    updateButtonVisibility();
}

function startGame() {
    socket.emit('set_force_start', roomId, true);
}

function copyGameUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.getElementById('copyUrlBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const btn = document.getElementById('copyUrlBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Arrow key controls
document.addEventListener('keydown', (e) => {
    if (!gameState || playerIndex < 0 || selectedTile === null) return;
    
    let targetTile = null;
    const row = Math.floor(selectedTile / gameState.width);
    const col = selectedTile % gameState.width;
    
    switch(e.key) {
        case 'ArrowUp':
            if (row > 0) targetTile = selectedTile - gameState.width;
            break;
        case 'ArrowDown':
            if (row < gameState.height - 1) targetTile = selectedTile + gameState.width;
            break;
        case 'ArrowLeft':
            if (col > 0) targetTile = selectedTile - 1;
            break;
        case 'ArrowRight':
            if (col < gameState.width - 1) targetTile = selectedTile + 1;
            break;
    }
    
    if (targetTile !== null && visibleTiles.has(targetTile)) {
        attemptMove(selectedTile, targetTile);
        e.preventDefault();
    }
});

// Chat functionality
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && roomId) {
        socket.emit('chat_message', {
            gameId: roomId,
            message: message,
            username: lastUsername || 'Anonymous'
        });
        chatInput.value = '';
    }
}

sendChatBtn.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

socket.on('chat_message', (data) => {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '3px';
    messageDiv.style.fontSize = '13px';
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (data.isSystem) {
        // System message styling
        messageDiv.innerHTML = `
            <span style="color: #999; font-size: 11px;">[${timestamp}]</span>
            <span style="color: #ff6600; font-weight: bold; font-style: italic;">⚡ ${data.message}</span>
        `;
    } else {
        // Regular player message
        const playerColor = data.playerIndex >= 0 ? playerColors[data.playerIndex] : '#666';
        messageDiv.innerHTML = `
            <span style="color: #999; font-size: 11px;">[${timestamp}]</span>
            <span style="color: ${playerColor}; font-weight: bold;">${data.username}:</span>
            <span>${data.message}</span>
        `;
    }
    
    const wasScrolledToBottom = chatMessages.scrollTop >= chatMessages.scrollHeight - chatMessages.clientHeight - 5;
    
    chatMessages.appendChild(messageDiv);
    
    // Auto-scroll only if user was already at bottom
    if (wasScrolledToBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
