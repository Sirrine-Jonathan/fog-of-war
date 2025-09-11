const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const socket = io();

// Animation variables
let animationId = null;
let animationTime = 0;
let ripples = []; // Array to store active ripples

// App colors
const appColors = {
    gold: '#ffd700',
    slate: '#0f1419',
    darkSlate: '#34495e'
};

// Colors for players (supports up to 10 players)
const playerColors = [
    '#ff6b6b', // Red
    '#4ecdc4', // Teal
    '#45b7d1', // Blue
    '#96ceb4', // Green
    '#feca57', // Yellow
    '#ff9ff3', // Pink
    '#54a0ff', // Light Blue
    '#5f27cd', // Purple
    '#00d2d3', // Cyan
    '#ff6348'  // Orange
];

// Simplified tiling animation using existing canvas
function drawTilingAnimation() {
    const time = animationTime * 0.0003; // Much slower animation
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save context and apply rotation/scale transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(0.15 + time * 0.07); // Static rotation + slow spin (1 revolution per 90 seconds)
    ctx.scale(1.6, 1.6); // Larger scale for more overflow
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    const tileSize = 40;
    const cols = Math.ceil(canvas.width / tileSize) + 4; // More extra tiles
    const rows = Math.ceil(canvas.height / tileSize) + 4;
    
    for (let x = -2; x < cols; x++) { // Start further back for overflow
        for (let y = -2; y < rows; y++) {
            const xPos = x * tileSize;
            const yPos = y * tileSize;
            
            // Wave effect - horizontal wave with uneven timing and row variation
            const rowSpeed = 1 + (y % 5) * 0.3; // Different speeds per row
            const rowOffset = y * 0.7; // Different start positions per row
            let waveOffset = Math.sin(time * 2 * rowSpeed + x * 0.3 + y * 0.1 + rowOffset) * 0.5 + 0.5;
            
            const centerX = xPos + tileSize / 2;
            const centerY = yPos + tileSize / 2;
            
            // Apply ripple effects to wave
            ripples.forEach(ripple => {
                // Transform ripple position to match tile coordinate system
                // Inverse of the canvas transform: translate, rotate, scale
                const canvasCenterX = canvas.width / 2;
                const canvasCenterY = canvas.height / 2;
                
                // Translate to origin
                let rippleX = ripple.x - canvasCenterX;
                let rippleY = ripple.y - canvasCenterY;
                
                // Inverse scale (divide by 1.6)
                rippleX /= 1.6;
                rippleY /= 1.6;
                
                // Inverse rotation
                const rotation = -(0.15 + time * 0.07);
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const transformedX = rippleX * cos - rippleY * sin;
                const transformedY = rippleX * sin + rippleY * cos;
                
                // Translate back
                const finalRippleX = transformedX + canvasCenterX;
                const finalRippleY = transformedY + canvasCenterY;
                
                const distance = Math.sqrt((centerX - finalRippleX) ** 2 + (centerY - finalRippleY) ** 2);
                if (distance < ripple.radius + 30) {
                    const influence = Math.max(0, 1 - distance / (ripple.radius + 30));
                    const rippleEffect = influence * ripple.opacity * 2.0;
                    waveOffset = Math.min(1, waveOffset + rippleEffect);
                }
            });
            
            const scale = 0.4 + waveOffset * 0.6; // Larger min (0.4), max (1.0)
            const scaledSize = tileSize * scale;
            
            // Color fading effect for some tiles
            const colorPhase = Math.sin(time * 0.8 + x * 0.2 + y * 0.15) * 0.5 + 0.5;
            const shouldFade = (x + y * 3) % 5 === 0; // More tiles fade (was % 7)
            const shouldBePlayerColor = (x * 2 + y) % 6 === 0; // More player color tiles (every 6th)
            
            let tileColor = appColors.slate; // Default dark slate
            let hasRippleShimmer = false;
            let shimmerIntensity = 0;
            
            // Check for ripple shimmer effect
            ripples.forEach(ripple => {
                // Transform ripple position to match tile coordinate system
                const canvasCenterX = canvas.width / 2;
                const canvasCenterY = canvas.height / 2;
                
                let rippleX = ripple.x - canvasCenterX;
                let rippleY = ripple.y - canvasCenterY;
                
                rippleX /= 1.6;
                rippleY /= 1.6;
                
                const rotation = -(0.15 + time * 0.07);
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const transformedX = rippleX * cos - rippleY * sin;
                const transformedY = rippleX * sin + rippleY * cos;
                
                const finalRippleX = transformedX + canvasCenterX;
                const finalRippleY = transformedY + canvasCenterY;
                
                const distance = Math.sqrt((centerX - finalRippleX) ** 2 + (centerY - finalRippleY) ** 2);
                if (distance < ripple.radius + 20) { // Tighter area for shimmer
                    const influence = Math.max(0, 1 - distance / (ripple.radius + 20));
                    const currentShimmer = influence * ripple.opacity;
                    if (currentShimmer > shimmerIntensity) {
                        shimmerIntensity = currentShimmer;
                        hasRippleShimmer = true;
                    }
                }
            });
            
            if (hasRippleShimmer && shimmerIntensity > 0.1) {
                // Apply shimmer effect - blend with white
                const whiteRGB = [255, 255, 255]; // White
                const slateRGB = [15, 20, 25]; // #0f1419
                
                const r = Math.round(slateRGB[0] + (whiteRGB[0] - slateRGB[0]) * shimmerIntensity * 0.8);
                const g = Math.round(slateRGB[1] + (whiteRGB[1] - slateRGB[1]) * shimmerIntensity * 0.8);
                const b = Math.round(slateRGB[2] + (whiteRGB[2] - slateRGB[2]) * shimmerIntensity * 0.8);
                
                tileColor = `rgb(${r}, ${g}, ${b})`;
            } else if (shouldBePlayerColor && waveOffset > 0.6) {
                // Random player color tiles when wave is high
                const colorIndex = (x + y * 2) % playerColors.length;
                const playerColor = playerColors[colorIndex];
                if (playerColor) {
                    tileColor = playerColor;
                }
            } else if (shouldFade && colorPhase > 0.7) {
                // Fading to player color
                const colorIndex = (x + y) % playerColors.length;
                const fadeAmount = (colorPhase - 0.7) / 0.3; // 0 to 1
                const playerColor = playerColors[colorIndex];
                
                // Safety check for valid player color
                if (playerColor && playerColor.startsWith('#')) {
                    // Interpolate between slate and player color
                    const slateRGB = [15, 20, 25]; // #0f1419
                    const playerRGB = [
                        parseInt(playerColor.slice(1, 3), 16),
                        parseInt(playerColor.slice(3, 5), 16),
                        parseInt(playerColor.slice(5, 7), 16)
                    ];
                    
                    const r = Math.round(slateRGB[0] + (playerRGB[0] - slateRGB[0]) * fadeAmount);
                    const g = Math.round(slateRGB[1] + (playerRGB[1] - slateRGB[1]) * fadeAmount);
                    const b = Math.round(slateRGB[2] + (playerRGB[2] - slateRGB[2]) * fadeAmount);
                    
                    tileColor = `rgb(${r}, ${g}, ${b})`;
                }
            }
            
            // Subtle lighter slate gradient for high wave peaks
            if (waveOffset > 0.75) {
                const lightness = (waveOffset - 0.75) / 0.25; // 0 to 1
                const centerLightness = Math.max(0, 1 - Math.abs(waveOffset - 0.875) / 0.125); // Peak at 0.875
                const finalLightness = lightness * 0.4 + centerLightness * 0.3; // Subtle effect
                
                const baseRGB = [15, 20, 25]; // #0f1419
                const r = Math.round(baseRGB[0] + (120 - baseRGB[0]) * finalLightness);
                const g = Math.round(baseRGB[1] + (140 - baseRGB[1]) * finalLightness);
                const b = Math.round(baseRGB[2] + (160 - baseRGB[2]) * finalLightness);
                
                tileColor = `rgb(${r}, ${g}, ${b})`;
            }
            
            ctx.fillStyle = tileColor;
            ctx.fillRect(
                centerX - scaledSize / 2,
                centerY - scaledSize / 2,
                scaledSize,
                scaledSize
            );
        }
    }
    
    // Restore context
    ctx.restore();
}

function startAnimation() {
    if (animationId) return;
    
    function animate() {
        animationTime += 16;
        updateRipples(); // Update ripple data
        drawTilingAnimation(); // Tiles now react to ripples
        animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
    addRippleListeners(); // Add interactive listeners
}

function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

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

// Special tile defense display tracking
const specialTileDefenseDisplay = new Map(); // tileIndex -> { showUntil: timestamp, lastAttack: timestamp }

function drawCrownIcon(ctx, x, y, size, color = '#FFD700') {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const crownHeight = size * 0.6;
    const crownWidth = size * 0.8;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color === '#FFFFFF' ? '#CCCCCC' : '#B8860B';
    ctx.lineWidth = 1;
    
    // Crown base
    ctx.fillRect(centerX - crownWidth/2, centerY + crownHeight/4, crownWidth, crownHeight/4);
    
    // Crown points
    ctx.beginPath();
    ctx.moveTo(centerX - crownWidth/2, centerY + crownHeight/4);
    ctx.lineTo(centerX - crownWidth/4, centerY - crownHeight/4);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX + crownWidth/4, centerY - crownHeight/4);
    ctx.lineTo(centerX + crownWidth/2, centerY + crownHeight/4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawTowerIcon(ctx, x, y, size, color = '#4169E1') {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const towerWidth = size * 0.4;
    const towerHeight = size * 0.7;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color === '#FFFFFF' ? '#CCCCCC' : '#2F4F4F';
    ctx.lineWidth = 1;
    
    // Tower body
    ctx.fillRect(centerX - towerWidth/2, centerY - towerHeight/2, towerWidth, towerHeight);
    ctx.strokeRect(centerX - towerWidth/2, centerY - towerHeight/2, towerWidth, towerHeight);
    
    // Tower top
    const topWidth = towerWidth * 1.2;
    ctx.fillRect(centerX - topWidth/2, centerY - towerHeight/2, topWidth, towerHeight/4);
    ctx.strokeRect(centerX - topWidth/2, centerY - towerHeight/2, topWidth, towerHeight/4);
}

function drawCityIcon(ctx, x, y, size, color = '#FF6347') {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const buildingWidth = size * 0.2;
    const buildingHeight = size * 0.6;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color === '#FFFFFF' ? '#CCCCCC' : '#A0522D';
    ctx.lineWidth = 1;
    
    // Three buildings
    for (let i = 0; i < 3; i++) {
        const offsetX = (i - 1) * buildingWidth * 0.8;
        const height = buildingHeight * (0.7 + i * 0.15);
        ctx.fillRect(centerX + offsetX - buildingWidth/2, centerY + buildingHeight/2 - height, buildingWidth, height);
        ctx.strokeRect(centerX + offsetX - buildingWidth/2, centerY + buildingHeight/2 - height, buildingWidth, height);
    }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Calculate luminance to determine if color is light or dark
function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Get contrasting color (black or white) for given RGB
function getContrastColor(r, g, b) {
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

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
const DISCOVERED_KEY = `discovered_tiles_${roomId}`;

// Discovered tiles that remain visible permanently
let discoveredTiles = new Set();

// Load persisted state
function loadPersistedState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            lastUsername = state.username || '';
            document.getElementById('usernameInput').value = lastUsername;
            
            // Load discovered tiles
            const savedDiscovered = localStorage.getItem(DISCOVERED_KEY);
            if (savedDiscovered) {
                try {
                    const data = JSON.parse(savedDiscovered);
                    if (data.roomId === roomId) {
                        discoveredTiles = new Set(data.tiles);
                    }
                } catch (e) {
                    console.warn('Failed to parse discovered tiles:', e);
                }
            }
            
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

// Save discovered tiles to localStorage
function saveDiscoveredTiles() {
    if (playerIndex >= 0) {
        const data = {
            roomId: roomId,
            tiles: Array.from(discoveredTiles),
            timestamp: Date.now()
        };
        localStorage.setItem(DISCOVERED_KEY, JSON.stringify(data));
    }
}

// Clear saved state
function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISCOVERED_KEY);
    discoveredTiles.clear();
}

// Auto-rejoin if we were previously in this game (only if we were a player in an active game)
function attemptAutoRejoin() {
    const saved = loadPersistedState();
    // Only auto-rejoin if we were in a started game
    if (saved && saved.username && saved.playerIndex >= 0 && saved.gameStarted && (Date.now() - saved.timestamp < 30 * 60 * 1000)) { // 30 min timeout
        const userId = 'human_' + Date.now();
        socket.emit('set_username', userId, saved.username);
        socket.emit('join_private', roomId, userId);
    }
}

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

    windowWidth: window.innerWidth,
    isMobile: isMobile,
    hasTouch: 'ontouchstart' in window,
    userAgent: navigator.userAgent
});

function initMobileTabs() {
    
    if (!isMobile) {
        return;
    }
    
    
    const tabBar = document.getElementById('mobileTabBar');
    const gameTab = document.getElementById('gameTab');
    const controlsTab = document.getElementById('controlsTab');
    const chatTab = document.getElementById('chatTab');
    
        tabBar: !!tabBar,
        gameTab: !!gameTab,
        controlsTab: !!controlsTab,
        chatTab: !!chatTab
    });
    
    document.body.classList.add('mobile-game-active');
    
    if (gameTab) gameTab.addEventListener('click', () => switchMobileTab('game'));
    if (controlsTab) controlsTab.addEventListener('click', () => switchMobileTab('controls'));
    if (chatTab) chatTab.addEventListener('click', () => switchMobileTab('chat'));
    
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

// Initialize accordion and mobile/desktop controls
initAccordion();

// Initialize players list state (hide when empty)
updatePlayersList();

function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.accordion-arrow');
    
    header.classList.toggle('active');
    content.classList.toggle('active');
    
    if (content.classList.contains('active')) {
        arrow.textContent = '▼';
    } else {
        arrow.textContent = '▶';
    }
}

function initAccordion() {
    // Show appropriate controls based on device type
    const desktopControls = document.getElementById('desktopControls');
    const mobileControls = document.getElementById('mobileControls');
    
    if (isMobile) {
        desktopControls.style.display = 'none';
        mobileControls.style.display = 'block';
    } else {
        desktopControls.style.display = 'block';
        mobileControls.style.display = 'none';
    }
}

// Initialize accordion and mobile/desktop controls
initAccordion();


function initAccordion() {
    // Show appropriate controls based on device type
    const desktopControls = document.getElementById('desktopControls');
    const mobileControls = document.getElementById('mobileControls');
    
    if (isMobile) {
        desktopControls.style.display = 'none';
        mobileControls.style.display = 'block';
    } else {
        desktopControls.style.display = 'block';
        mobileControls.style.display = 'none';
    }
}

socket.on('game_start', (data) => {
    console.log('🎮 Game started!', data);
    
    if (data.mapData) {
        gameState = parseMapData(data.mapData);
            width: gameState.width,
            height: gameState.height,
            armiesLength: gameState.armies?.length,
            terrainLength: gameState.terrain?.length,
            towerDefenseLength: gameState.towerDefense?.length
        });
        
        // Log all player positions
        gameState.terrain.forEach((terrain, index) => {
            if (terrain >= 0) {
            }
        });
    }
    
    document.getElementById('gameStarted').textContent = gameStarted ? 'Playing' : 'Started';
    document.getElementById('gameEndNotification').style.display = 'none'; // Hide notification
    document.getElementById('gameBoard').style.display = 'block'; // Show canvas
    playerIndex = data.playerIndex !== undefined ? data.playerIndex : -1;
    gameStarted = true;
    
    // Stop animation when game starts
    stopAnimation();
    
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
    
    // Show/hide host indicator
    const hostIndicator = document.getElementById('hostIndicator');
    if (hostIndicator) {
        hostIndicator.style.display = isHost ? 'block' : 'none';
    }
    
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
    const gameOverlay = document.getElementById('gameOverlay');
    const overlayStartBtn = document.getElementById('overlayStartBtn');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    
    if (gameStarted) {
        // Game is active - hide all join/leave controls and overlay
        joinControls.style.display = 'none';
        if (gameOverlay) gameOverlay.style.display = 'none';
    } else if (playerIndex >= 0) {
        // Joined but game not started - show leave button, hide join controls, show overlay
        joinBtn.style.display = 'none';
        leaveBtn.style.display = 'inline-block';
        document.getElementById('usernameInput').style.display = 'none';
        if (gameOverlay) gameOverlay.style.display = 'flex';
    } else {
        // Not joined and game not started - show join controls, hide leave button, show overlay
        joinControls.style.display = 'flex';
        joinBtn.style.display = 'inline-block';
        leaveBtn.style.display = 'none';
        document.getElementById('usernameInput').style.display = 'block';
        if (gameOverlay) gameOverlay.style.display = 'flex';
    }
    
    // Show start button only when there are 2+ players and user is host
    const playerCount = players ? players.length : 0;
    const canStart = isHost && !gameStarted && playerCount >= 2;
    if (overlayStartBtn) {
        overlayStartBtn.style.display = canStart ? 'block' : 'none';
    }
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
    
    // Start animation when game ends
    startAnimation();
    
    // Show game over overlay
    showGameOverOverlay(winnerName);
    
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
    
    // Track attacks on special tiles for defense display
    if (gameState && (gameState.lookoutTowers?.includes(data.to) || gameState.cities?.includes(data.to))) {
        const now = Date.now();
        const existing = specialTileDefenseDisplay.get(data.to);
        
        console.log('Special tile attacked:', data.to);
        
        // Throttle: only update if it's been at least 500ms since last attack
        if (!existing || now - existing.lastAttack > 500) {
            specialTileDefenseDisplay.set(data.to, {
                showUntil: now + 1000, // Show for 1 second
                lastAttack: now
            });
        }
    }
});

socket.on('game_update', (data) => {
    // Stop animation when game state is received
    stopAnimation();
    
    if (data.map_diff && data.map_diff.length > 0) {
        const patchedMap = patch([], data.map_diff);
        
        gameState = parseMapData(patchedMap);
            width: gameState.width,
            height: gameState.height,
            armiesLength: gameState.armies?.length,
            terrainLength: gameState.terrain?.length,
            towerDefenseLength: gameState.towerDefense?.length
        });
        
        // Log all player positions
        gameState.terrain.forEach((terrain, index) => {
            if (terrain >= 0) {
            }
        });
        
        // Update players data if provided
        if (data.players) {
            gameState.players = data.players;
        }
        
        // Update cities and lookout towers if provided
        if (data.cities_diff) {
            gameState.cities = patch(gameState.cities || [], data.cities_diff);
        }
        if (data.lookoutTowers_diff) {
            gameState.lookoutTowers = patch(gameState.lookoutTowers || [], data.lookoutTowers_diff);
        }
        
        // Update generals if provided
        if (data.generals) {
            gameState.generals = data.generals;
        }
        
        // Auto-select player's general on first update if no tile selected
        if (selectedTile === null && playerIndex >= 0 && data.generals) {
            const generalPos = data.generals[playerIndex];
            if (generalPos !== undefined) {
                setSelectedTile(generalPos);
                
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
    
    // Start animation when game ends
    startAnimation();
    
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
    
    // Add discovered tiles (permanently visible)
    discoveredTiles.forEach(tile => visibleTiles.add(tile));
    
    // Active players see fog of war
    for (let i = 0; i < gameState.terrain.length; i++) {
        if (gameState.terrain[i] === playerIndex) {
            visibleTiles.add(i);
            
            // Check if this is a lookout tower for extended vision
            if (gameState.lookoutTowers && gameState.lookoutTowers.includes(i)) {
                // Lookout towers provide 5-tile radius vision
                const towerVision = getTilesInRadius(i, 5);
                towerVision.forEach(tile => {
                    visibleTiles.add(tile);
                    discoveredTiles.add(tile); // Permanently discover these tiles
                });
                saveDiscoveredTiles(); // Save to localStorage
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
            const isCity = gameState.cities && gameState.cities.includes(i);
            const isTower = gameState.lookoutTowers && gameState.lookoutTowers.includes(i);
            
            if (terrain === -2) { // Mountain
                ctx.fillStyle = mountainColor;
            } else if (isCity) { // City (captured or neutral)
                if (terrain >= 0) {
                    // Captured city - use player color with shiny effect
                    const playerColor = playerColors[terrain] || emptyColor;
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    // Create shiny version of player color
                    const rgb = hexToRgb(playerColor);
                    if (rgb) {
                        gradient.addColorStop(0, `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`);
                        gradient.addColorStop(0.3, `rgb(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)})`);
                        gradient.addColorStop(0.7, playerColor);
                        gradient.addColorStop(1, `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`);
                    } else {
                        gradient.addColorStop(0, playerColor);
                        gradient.addColorStop(1, playerColor);
                    }
                    ctx.fillStyle = gradient;
                } else {
                    // Neutral city - red gradient
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    gradient.addColorStop(0, '#FF6347'); // Tomato
                    gradient.addColorStop(0.3, '#FFB6C1'); // Light pink
                    gradient.addColorStop(0.7, '#CD5C5C'); // Indian red
                    gradient.addColorStop(1, '#A0522D'); // Sienna
                    ctx.fillStyle = gradient;
                }
            } else if (isTower) { // Lookout Tower (captured or neutral)
                if (terrain >= 0) {
                    // Captured tower - use player color with shiny effect
                    const playerColor = playerColors[terrain] || emptyColor;
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    // Create shiny version of player color
                    const rgb = hexToRgb(playerColor);
                    if (rgb) {
                        gradient.addColorStop(0, `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`);
                        gradient.addColorStop(0.3, `rgb(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)})`);
                        gradient.addColorStop(0.7, playerColor);
                        gradient.addColorStop(1, `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`);
                    } else {
                        gradient.addColorStop(0, playerColor);
                        gradient.addColorStop(1, playerColor);
                    }
                    ctx.fillStyle = gradient;
                } else {
                    // Neutral tower - blue gradient
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    gradient.addColorStop(0, '#4169E1'); // Royal blue
                    gradient.addColorStop(0.3, '#87CEEB'); // Sky blue
                    gradient.addColorStop(0.7, '#4682B4'); // Steel blue
                    gradient.addColorStop(1, '#2F4F4F'); // Dark slate gray
                    ctx.fillStyle = gradient;
                }
            } else if (terrain >= 0) { // Player owned
                // Check if this is a general tile
                const isGeneral = gameState.generals && gameState.generals.includes(i);
                if (isGeneral) {
                    // Create gold gradient for general tiles
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    gradient.addColorStop(0, '#FFD700'); // Gold
                    gradient.addColorStop(0.3, '#FFF8DC'); // Cornsilk (lighter)
                    gradient.addColorStop(0.7, '#DAA520'); // Goldenrod
                    gradient.addColorStop(1, '#B8860B'); // Dark goldenrod
                    ctx.fillStyle = gradient;
                } else {
                    ctx.fillStyle = playerColors[terrain] || emptyColor;
                }
            } else { // Empty
                ctx.fillStyle = emptyColor;
            }
            
            ctx.fillRect(x, y, tileSize, tileSize);
            
            // Add shine effect for special tiles
            if (terrain >= 0 && gameState.generals && gameState.generals.includes(i)) {
                // General tiles shine
                const shineGradient = ctx.createLinearGradient(x, y, x + tileSize * 0.6, y + tileSize * 0.6);
                shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = shineGradient;
                ctx.fillRect(x, y, tileSize, tileSize);
            } else if (isCity || isTower) {
                // City and tower tiles shine
                const shineGradient = ctx.createLinearGradient(x, y, x + tileSize * 0.6, y + tileSize * 0.6);
                shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = shineGradient;
                ctx.fillRect(x, y, tileSize, tileSize);
            }
            
            // Draw icons for special tiles (only for neutral tiles)
            const iconSize = tileSize * 0.6;
            const iconX = x + (tileSize - iconSize) / 2;
            const iconY = y + (tileSize - iconSize) / 2;
            
            if (terrain >= 0 && gameState.generals && gameState.generals.includes(i)) {
                // Draw crown icon on general tiles - use contrasting color against gold background
                const crownColor = getContrastColor(255, 215, 0); // Gold background
                drawCrownIcon(ctx, iconX, iconY, iconSize, crownColor);
            } else if (isTower && terrain < 0) {
                // Draw tower icon only on neutral towers
                const towerColor = getContrastColor(65, 105, 225); // Royal blue background
                drawTowerIcon(ctx, iconX, iconY, iconSize, towerColor);
            } else if (isCity && terrain < 0) {
                // Draw city icon only on neutral cities  
                const cityColor = getContrastColor(255, 99, 71); // Tomato background
                drawCityIcon(ctx, iconX, iconY, iconSize, cityColor);
            }
            
            // Draw army count or special tile defense
            if (gameState.armies[i] > 0) {
                ctx.fillStyle = terrain === -2 ? 'white' : 'black';
                ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px 'Courier New', monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(gameState.armies[i].toString(), x + tileSize/2, y + tileSize/2 + 3*camera.zoom);
            } else if ((isTower || isCity) && terrain < 0) {
                // Handle special tile defense display
                const now = Date.now();
                const defenseDisplay = specialTileDefenseDisplay.get(i);
                const shouldShowDefense = defenseDisplay && now < defenseDisplay.showUntil;
                
                if (shouldShowDefense) {
                    const defense = gameState.towerDefense?.[i]; // Both towers and cities use towerDefense array
                    if (defense > 0) {
                        // Calculate fade opacity
                        const timeLeft = defenseDisplay.showUntil - now;
                        const opacity = Math.min(1, timeLeft / 300); // Fade in last 300ms
                        
                        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                        ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px 'Courier New', monospace`;
                        ctx.textAlign = 'center';
                        ctx.fillText(defense.toString(), x + tileSize/2, y + tileSize/2 + 3*camera.zoom);
                    }
                }
                
                // Clean up expired entries
                if (defenseDisplay && now >= defenseDisplay.showUntil) {
                    specialTileDefenseDisplay.delete(i);
                }
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
        
        // Draw border - only current player's general gets persistent border
        const tileTerrain = gameState.terrain[i];
        const isPlayerGeneral = playerGenerals.has(playerIndex) && playerGenerals.get(playerIndex) === i;
        const isSelected = selectedTile === i;
        
        if (isPlayerGeneral) {
            // Only current player's general gets special border
            ctx.strokeStyle = isSelected ? '#ffd700' : '#9e8600ff';
            ctx.lineWidth = isSelected ? 3 * camera.zoom : 2 * camera.zoom;
        } else {
            // Regular tiles (including enemy generals) only get border when selected
            ctx.strokeStyle = isSelected ? '#ffd700' : '#ccc';
            ctx.lineWidth = isSelected ? 3 * camera.zoom : 1 * camera.zoom;
        }
        ctx.strokeRect(x, y, tileSize, tileSize);
        
        // Add glow effect for selected tile
        if (selectedTile === i) {
            const armyCount = gameState.armies[i];
            const canMoveArmies = armyCount > 1;
            if (canMoveArmies) {
                // Bright gold for tiles that can move armies
                ctx.shadowColor = '#ffed4e'; // Brighter gold
            } else {
                // Gray for tiles that cannot move armies
                ctx.shadowColor = '#888888'; // Clear gray
            }
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

function showGameOverOverlay(winnerName) {
    const overlay = document.getElementById('gameOverOverlay');
    const winnerText = document.getElementById('overlayWinnerText');
    
    winnerText.textContent = `The winner is ${winnerName}`;
    overlay.style.display = 'flex';
    
    // Hide after 5 seconds
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 5000);
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
    
    // Only allow interaction with visible tiles (except mobile users can click through fog)
    if (!visibleTiles.has(tileIndex) && !isMobile) return;
    
    if (selectedTile === null) {
        // No active tile: clicking owned tile makes it active, otherwise no action
        if (gameState.terrain[tileIndex] === playerIndex) {
            setSelectedTile(tileIndex);
        }
    } else {
        // There is an active tile
        if (e.altKey || e.shiftKey) {
            // Alt+click OR Shift+click: only activate clicked tile (no launched intent)
            if (gameState.terrain[tileIndex] === playerIndex) {
                setSelectedTile(tileIndex);
            } else {
                setSelectedTile(null);
            }
        } else if (isAdjacent(selectedTile, tileIndex)) {
            // Adjacent click: launch intent (move/attack)
            activeIntent = null; // Clear any existing intent
            attemptMove(selectedTile, tileIndex);
        } else {
            // Non-adjacent click: launch intent if visible, otherwise no action
            if (gameState.armies[selectedTile] > 1) {
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
                }
            }
        }
    }
});

// Camera controls
canvas.addEventListener('mousedown', (e) => {
    // Only allow panning when Shift is pressed
    if (e.shiftKey) {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault(); // Prevent any default behavior
    }
});

canvas.addEventListener('mousemove', (e) => {
    // Update cursor based on shift key state
    if (e.shiftKey && !isDragging) {
        canvas.style.cursor = 'grab';
    } else if (!e.shiftKey && !isDragging) {
        canvas.style.cursor = 'default';
    }
    
    // Only pan if we're dragging AND shift is still held
    if (isDragging && e.shiftKey) {
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
    } else if (isDragging && !e.shiftKey) {
        // Stop dragging if shift is released
        isDragging = false;
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    // Reset cursor based on current shift state
    canvas.style.cursor = 'default';
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && !isDragging) {
        canvas.style.cursor = 'default';
    }
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

// Enhanced mobile touch handling
let touches = [];
let lastPanX = 0;
let lastPanY = 0;
let touchStartTime = 0;
let touchStartPos = null;
let longPressTimer = null;
let isLongPress = false;
let isPanning = false;
let isZooming = false;

const LONG_PRESS_DURATION = 500; // ms
const TOUCH_MOVE_THRESHOLD = 10; // pixels

canvas.addEventListener('touchstart', (e) => {
    touches = Array.from(e.touches);
    touchStartTime = Date.now();
    isLongPress = false;
    isPanning = false;
    isZooming = false;
    
    if (touches.length === 1) {
        // Single touch - prepare for potential tap, long press, or pan
        const rect = canvas.getBoundingClientRect();
        const touch = touches[0];
        touchStartPos = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
        lastPanX = touchStartPos.x;
        lastPanY = touchStartPos.y;
        
        // Start long press timer
        longPressTimer = setTimeout(() => {
            if (!isPanning && !isZooming && touches.length === 1) {
                isLongPress = true;
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }, LONG_PRESS_DURATION);
        
    } else if (touches.length === 2) {
        // Two touches - prepare for pinch zoom
        clearTimeout(longPressTimer);
        isZooming = true;
    }
    
    // Don't preventDefault to allow click events for short taps
});

canvas.addEventListener('touchmove', (e) => {
    if (!gameState) return;
    
    const newTouches = Array.from(e.touches);
    
    if (touches.length === 1 && newTouches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const currentX = newTouches[0].clientX - rect.left;
        const currentY = newTouches[0].clientY - rect.top;
        
        // Check if we've moved enough to start panning
        const moveDistance = Math.hypot(
            currentX - touchStartPos.x,
            currentY - touchStartPos.y
        );
        
        if (moveDistance > TOUCH_MOVE_THRESHOLD) {
            isPanning = true;
            clearTimeout(longPressTimer);
            e.preventDefault(); // Prevent scrolling and other default behaviors
            
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
        }
        
    } else if (touches.length === 2 && newTouches.length === 2) {
        // Pinch zoom
        e.preventDefault();
        isZooming = true;
        clearTimeout(longPressTimer);
        
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
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    clearTimeout(longPressTimer);
    
    // If it was a short tap (not panning, not zooming, not long press)
    if (!isPanning && !isZooming && touchDuration < LONG_PRESS_DURATION && touchStartPos) {
        // Simulate a click event with better touch handling
        handleTouchTap(touchStartPos.x, touchStartPos.y, false);
    } else if (isLongPress && touchStartPos) {
        // Handle long press as activation-only (like Alt/Shift+click)
        handleTouchTap(touchStartPos.x, touchStartPos.y, true);
    }
    
    touches = Array.from(e.touches);
    
    // Reset state
    if (touches.length === 0) {
        isPanning = false;
        isZooming = false;
        isLongPress = false;
        touchStartPos = null;
    }
});

function handleTouchTap(x, y, isActivationOnly) {
    if (!gameState || playerIndex < 0) return;
    
    // Convert touch coordinates to game coordinates
    const gameX = x + camera.x;
    const gameY = y + camera.y;
    const tileSize = 35 * camera.zoom;
    
    const col = Math.floor(gameX / tileSize);
    const row = Math.floor(gameY / tileSize);
    const tileIndex = row * gameState.width + col;
    
    // Only allow interaction with visible tiles (except mobile users can click through fog)
    if (!visibleTiles.has(tileIndex) && !isMobile) return;
    
    
    if (selectedTile === null) {
        // No active tile: clicking owned tile makes it active, otherwise no action
        if (gameState.terrain[tileIndex] === playerIndex) {
            setSelectedTile(tileIndex);
        }
    } else {
        // There is an active tile
        if (isActivationOnly) {
            // Long press: only activate clicked tile (no launched intent)
            if (gameState.terrain[tileIndex] === playerIndex) {
                setSelectedTile(tileIndex);
            } else {
                setSelectedTile(null);
            }
        } else if (isAdjacent(selectedTile, tileIndex)) {
            // Adjacent tap: launch intent (move/attack)
            activeIntent = null; // Clear any existing intent
            attemptMove(selectedTile, tileIndex);
        } else {
            // Non-adjacent tap: launch intent if visible, otherwise no action
            if (gameState.armies[selectedTile] > 1) {
                // Regular tap: Start intent-based movement
                activeIntent = null; // Clear any existing intent first
                
                const path = findPath(selectedTile, tileIndex);
                if (path && path.length > 0) {
                    activeIntent = {
                        fromTile: selectedTile,
                        targetTile: tileIndex,
                        path: path,
                        currentStep: 0
                    };
                }
            }
        }
    }
}

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
    const playersList = document.querySelector('.players-list');
    const mobileGameStats = document.getElementById('mobileGameStats');
    playersDiv.innerHTML = '';
    const stats = calculatePlayerStats();
    
    
    // Show/hide players list and mobile game stats based on whether there are players
    // Check players array directly since stats might be empty before game starts
    if (!players || players.length === 0) {
        playersList.classList.add('empty');
        mobileGameStats.classList.add('empty');
        hideMobilePlayersAccordion();
        return;
    } else {
        playersList.classList.remove('empty');
        mobileGameStats.classList.remove('empty');
        updateMobilePlayersAccordion();
    }
    
    // Create table
    const table = document.createElement('table');
    table.className = 'players-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Player', 'Tiles', 'Armies', 'Density', 'Total'];
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
        const playerSocketId = playerSocketMap.get(player.index);
        const isHostPlayer = playerSocketId === hostSocketId;
        nameCell.textContent = (isHostPlayer ? '👑 ' : '') + player.username;
        
        if (player.isBot) {
            const botTag = document.createElement('span');
            botTag.textContent = ' [BOT]';
            botTag.className = 'bot-tag';
            nameCell.appendChild(botTag);
        }
        
        if (player.eliminated) {
            nameCell.textContent += ' (eliminated)';
        } else if (player.disconnected) {
            nameCell.textContent += ' (disconnected)';
        }
        
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
        
        // Density cell
        const densityCell = document.createElement('td');
        const density = player.stats.tiles > 0 ? 
            (player.stats.armies / player.stats.tiles).toFixed(1) : '0.0';
        densityCell.textContent = gameStarted ? density : '-';
        densityCell.style.textAlign = 'center';
        densityCell.style.fontWeight = 'bold';
        row.appendChild(densityCell);
        
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
    
    // Update mobile game stats table
    updateMobileGameStats(sortedPlayers);
    
    // Create mobile list
    const mobileList = document.getElementById('playersMobile');
    
    if (!mobileList) {
        console.error('Mobile list element not found!');
        return;
    }
    
    mobileList.innerHTML = '';
    
    if (sortedPlayers.length > 0) {
        
        const statTypes = [
            { key: 'tiles', label: 'Tiles' },
            { key: 'armies', label: 'Armies' },
            { key: 'density', label: 'Density' },
            { key: 'total', label: 'Total' }
        ];
        
        statTypes.forEach(statType => {
            const statGroup = document.createElement('li');
            statGroup.className = 'stat-group';
            
            const title = document.createElement('div');
            title.className = 'stat-title';
            title.textContent = statType.label;
            statGroup.appendChild(title);
            
            sortedPlayers.forEach(player => {
                const playerStat = document.createElement('div');
                playerStat.className = 'player-stat';
                
                if (player.index === playerIndex) {
                    playerStat.classList.add('current-player');
                }
                
                const playerName = document.createElement('span');
                playerName.textContent = player.username + (player.isBot ? ' [BOT]' : '');
                playerName.style.color = playerColors[player.index] || 'black';
                
                const statValue = document.createElement('span');
                if (!gameStarted) {
                    statValue.textContent = '-';
                } else {
                    if (statType.key === 'density') {
                        const density = player.stats.tiles > 0 ? 
                            (player.stats.armies / player.stats.tiles).toFixed(1) : '0.0';
                        statValue.textContent = density;
                    } else if (statType.key === 'total') {
                        statValue.textContent = player.score;
                    } else {
                        statValue.textContent = player.stats[statType.key];
                    }
                }
                
                playerStat.appendChild(playerName);
                playerStat.appendChild(statValue);
                statGroup.appendChild(playerStat);
            });
            
            mobileList.appendChild(statGroup);
        });
    }
    
    // Update button visibility after updating players list
    updateButtonVisibility();
}

function updateMobileGameStats(sortedPlayers) {
    const tbody = document.querySelector('#mobileStatsTable tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    sortedPlayers.forEach(player => {
        const row = document.createElement('tr');
        
        if (player.index === playerIndex) {
            row.classList.add('current-player');
        }
        
        const nameCell = document.createElement('td');
        nameCell.textContent = player.username + (player.isBot ? ' [BOT]' : '');
        nameCell.style.color = playerColors[player.index] || 'white';
        
        const armiesCell = document.createElement('td');
        armiesCell.textContent = gameStarted ? player.stats.armies : '-';
        
        const tilesCell = document.createElement('td');
        tilesCell.textContent = gameStarted ? player.stats.tiles : '-';
        
        row.appendChild(nameCell);
        row.appendChild(armiesCell);
        row.appendChild(tilesCell);
        tbody.appendChild(row);
    });
}

// Toggle mobile stats visibility
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('mobileStatsToggle');
    const table = document.getElementById('mobileStatsTable');
    const label = document.getElementById('mobileStatsLabel');
    const wrapper = document.querySelector('#mobileGameStats .stats-wrapper');
    let isVisible = true;
    
    toggle.addEventListener('click', () => {
        isVisible = !isVisible;
        table.style.display = isVisible ? 'table' : 'none';
        label.style.display = isVisible ? 'none' : 'inline';
        wrapper.classList.toggle('collapsed', !isVisible);
        toggle.textContent = isVisible ? '▲' : '▼';
    });
});

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
document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('joinBtn').addEventListener('click', joinAsPlayer);
    document.getElementById('leaveBtn').addEventListener('click', leaveGame);
    document.getElementById('overlayStartBtn').addEventListener('click', startGame);
    document.getElementById('copyUrlBtn').addEventListener('click', copyGameUrl);
    
    // Bot invite buttons
    const blobBtn = document.getElementById('inviteBlobBtn');
    const arrowBtn = document.getElementById('inviteArrowBtn');
    
    
    if (blobBtn) {
        blobBtn.addEventListener('click', () => inviteBot('blob'));
    } else {
        console.error('Blob button not found');
    }
    
    if (arrowBtn) {
        arrowBtn.addEventListener('click', () => inviteBot('arrow'));
    } else {
        console.error('Arrow button not found');
    }
});

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

function inviteBot(botType) {
    console.log('Inviting bot:', botType, 'to room:', roomId);
    socket.emit('invite_bot', roomId, botType);
}

// Bot invite result handlers
socket.on('bot_invite_result', (message) => {
    console.log('Bot invite result:', message);
});

socket.on('bot_invite_error', (error) => {
    console.error('Bot invite error:', error);
    alert(`Failed to invite bot: ${error}`);
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Shift key cursor feedback
    if (e.key === 'Shift' && !isDragging) {
        canvas.style.cursor = 'grab';
    }
    
    // Spacebar: Make general the active tile (but only if not typing in input fields)
    if (e.key === ' ' || e.key === 'Spacebar') {
        // Check if user is typing in an input field
        const activeElement = document.activeElement;
        const isTypingInInput = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
        
        // Only handle spacebar for game controls if not typing in an input
        if (!isTypingInInput && gameState && playerIndex >= 0) {
            const generalPos = gameState.generals[playerIndex];
            if (generalPos >= 0) {
                setSelectedTile(generalPos);
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }
    
    // Game controls (only if game is active)
    if (!gameState || playerIndex < 0) return;
    
    // Arrow keys: require active tile
    if (selectedTile === null) return;
    
    let targetTile = null;
    const row = Math.floor(selectedTile / gameState.width);
    const col = selectedTile % gameState.width;
    
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (row > 0) targetTile = selectedTile - gameState.width;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (row < gameState.height - 1) targetTile = selectedTile + gameState.width;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (col > 0) targetTile = selectedTile - 1;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (col < gameState.width - 1) targetTile = selectedTile + 1;
            break;
    }
    
    if (targetTile !== null && visibleTiles.has(targetTile)) {
        const moveSuccessful = attemptMove(selectedTile, targetTile);
        // Keep active tile on failed attacks (don't change selectedTile)
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

// Initialize animation on page load if no game is active
document.addEventListener('DOMContentLoaded', () => {
    // Start animation if no game is running
    if (!gameStarted && !gameState) {
        startAnimation();
    }
});

// Also start animation when canvas is resized and no game is active
window.addEventListener('resize', () => {
    if (!gameStarted && !gameState) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 120;
        // Animation will continue running and adapt to new size
    }
});
function updateMobilePlayersAccordion() {
    if (!isMobile) return;
    
    const mobileAccordion = document.querySelector('.mobile-only');
    const mobilePlayersDiv = document.getElementById('mobilePlayersAccordion');
    
    if (!players || players.length === 0) {
        mobileAccordion.style.display = 'none';
        return;
    }
    
    mobileAccordion.style.display = 'block';
    mobilePlayersDiv.innerHTML = '';
    
    // Create simplified mobile player list
    const playersList = document.createElement('div');
    playersList.className = 'mobile-players-simple';
    
    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'mobile-player-item';
        
        const stats = calculatePlayerStats();
        const playerStats = stats[player.index] || { tiles: 0, armies: 0 };

        const playerIsClient = player.index === playerIndex;
        const playerSocketId = playerSocketMap.get(player.index);
        const isHostPlayer = playerSocketId === hostSocketId;

        const playerColor = playerIsClient ? playerColors[player.index] : '#000';
        
        playerDiv.innerHTML = `
            <span style="color: ${playerColor}; font-weight: 600;">${isHostPlayer ? '👑 ' : ''}${player.username}${player.isBot ? ' (Bot)' : ''}</span>
            <span style="color: #666; font-size: 12px;">
                ${playerStats.tiles} tiles, ${playerStats.armies} armies
            </span>
        `;
        
        playersList.appendChild(playerDiv);
    });
    
    mobilePlayersDiv.appendChild(playersList);
}

function hideMobilePlayersAccordion() {
    if (!isMobile) return;
    
    const mobileAccordion = document.querySelector('.mobile-only');
    if (mobileAccordion) {
        mobileAccordion.style.display = 'none';
    }
}
// Ripple effect functions
function createRipple(x, y, size = 'normal') {
    const randomColor = playerColors[Math.floor(Math.random() * playerColors.length)];
    const maxRadius = size === 'big' ? 400 : 200;
    const lineWidth = size === 'big' ? 16 : 4;
    ripples.push({
        x: x,
        y: y,
        radius: 0,
        maxRadius: maxRadius,
        lineWidth: lineWidth,
        opacity: 1,
        startTime: animationTime,
        color: randomColor
    });
}

function updateRipples() {
    ripples = ripples.filter(ripple => {
        const age = animationTime - ripple.startTime;
        const progress = age / 1000; // 1 second duration
        
        if (progress >= 1) return false; // Remove old ripples
        
        ripple.radius = progress * ripple.maxRadius;
        ripple.opacity = 1 - progress;
        
        return true;
    });
}

// Add mouse and touch event listeners for ripples
function addRippleListeners() {
    // Only add listeners when animation is active (no game running)
    if (gameStarted || gameState) return;
    
    // Mouse events (throttled)
    canvas.addEventListener('mousemove', (e) => {
        if (!animationId) return; // Only when animation is running
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Throttle ripples - only create one every 200ms
        const now = Date.now();
        if (!canvas.lastMouseRipple || now - canvas.lastMouseRipple > 200) {
            createRipple(x, y);
            canvas.lastMouseRipple = now;
        }
    });
    
    // Touch events (throttled)
    canvas.addEventListener('touchmove', (e) => {
        if (!animationId) return;
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const now = Date.now();
        if (!canvas.lastTouchRipple || now - canvas.lastTouchRipple > 200) {
            createRipple(x, y);
            canvas.lastTouchRipple = now;
        }
    });
    
    // Click/tap for big ripples (no throttling)
    canvas.addEventListener('click', (e) => {
        if (!animationId) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        createRipple(x, y, 'big');
    });
    
    // Touchstart for big ripples (no throttling)
    canvas.addEventListener('touchstart', (e) => {
        if (!animationId) return;
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        createRipple(x, y, 'big');
    });
}
