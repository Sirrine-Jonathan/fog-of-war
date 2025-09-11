// Main game module that orchestrates all components

import { AnimationSystem } from './animation.js';
import { GameState } from './game-state.js';
import { UIManager } from './ui-manager.js';
import { DOMUtils } from './dom-utils.js';
import { parseMapData, patch } from './utils.js';

class FogOfWarGame {
    constructor() {
        this.canvas = document.getElementById('gameBoard');
        this.ctx = this.canvas.getContext('2d');
        this.socket = io();
        
        // Initialize core systems
        this.gameState = new GameState();
        this.animationSystem = new AnimationSystem(this.canvas, this.ctx);
        this.uiManager = new UIManager(this.gameState);
        
        // Camera system
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Input handling
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Get room ID from URL
        this.roomId = window.location.pathname.split('/').pop();
        window.roomId = this.roomId;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupSocketEvents();
        this.setupInputHandlers();
        this.gameState.loadPersistedState();
        
        // Start animation if no game is running
        if (!this.gameState.gameStarted) {
            this.animationSystem.start();
            this.animationSystem.addRippleListeners();
        }
        
        // Attempt auto-rejoin
        if (this.gameState.attemptAutoRejoin()) {
            // Auto-join logic would go here
        }
    }

    setupCanvas() {
        // Set canvas size
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('join_room', this.roomId);
        });

        this.socket.on('game_update', (data) => {
            this.handleGameUpdate(data);
        });

        this.socket.on('game_start', () => {
            this.gameState.gameStarted = true;
            this.animationSystem.stop();
            this.uiManager.updateButtonVisibility();
        });

        this.socket.on('game_end', (data) => {
            this.gameState.gameEnded = true;
            this.gameState.gameStarted = false;
            if (data.winner) {
                this.uiManager.showGameEndModal(data.winner.name, data.winner.index);
            }
        });

        this.socket.on('players_update', (players) => {
            this.gameState.players = players;
            this.updatePlayersList();
        });
    }

    setupInputHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleGameUpdate(data) {
        if (data.map) {
            this.gameState.gameState = parseMapData(data.map);
        } else if (data.diff && this.gameState.gameState) {
            // Apply diff to existing state
            this.gameState.gameState.terrain = patch(this.gameState.gameState.terrain, data.diff.terrain);
            this.gameState.gameState.armies = patch(this.gameState.gameState.armies, data.diff.armies);
            if (data.diff.cities) {
                this.gameState.gameState.cities = patch(this.gameState.gameState.cities, data.diff.cities);
            }
            if (data.diff.towers) {
                this.gameState.gameState.towers = patch(this.gameState.gameState.towers, data.diff.towers);
            }
        }
        
        if (data.turn !== undefined) {
            this.gameState.gameState.turn = data.turn;
            this.uiManager.updateTurnDisplay();
        }
        
        this.gameState.updateVisibleTiles();
        this.drawGame();
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            
            this.camera.x -= deltaX;
            this.camera.y -= deltaY;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            this.drawGame();
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    handleClick(e) {
        if (!this.gameState.gameState || this.gameState.playerIndex < 0) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.camera.x;
        const y = e.clientY - rect.top + this.camera.y;
        
        const tileSize = 30;
        const col = Math.floor(x / tileSize);
        const row = Math.floor(y / tileSize);
        const tileIndex = row * this.gameState.gameState.width + col;
        
        if (tileIndex >= 0 && tileIndex < this.gameState.gameState.terrain.length) {
            this.handleTileClick(tileIndex, e.shiftKey);
        }
    }

    handleTileClick(tileIndex, isActivationOnly) {
        if (!this.gameState.visibleTiles.has(tileIndex)) return;
        
        if (isActivationOnly) {
            // Shift+click to activate without moving
            if (this.gameState.gameState.terrain[tileIndex] === this.gameState.playerIndex) {
                this.gameState.setSelectedTile(tileIndex);
                this.drawGame();
            }
        } else {
            // Regular click to move or activate
            if (this.gameState.selectedTile !== null) {
                this.attemptMove(this.gameState.selectedTile, tileIndex);
            } else if (this.gameState.gameState.terrain[tileIndex] === this.gameState.playerIndex) {
                this.gameState.setSelectedTile(tileIndex);
                this.drawGame();
            }
        }
    }

    attemptMove(fromTile, toTile) {
        if (!this.gameState.gameState || !this.gameState.visibleTiles.has(toTile)) return false;
        
        // Check if it's a valid move
        if (this.gameState.gameState.terrain[fromTile] === this.gameState.playerIndex && 
            this.gameState.gameState.armies[fromTile] > 1) {
            
            this.socket.emit('move', this.roomId, fromTile, toTile);
            return true;
        }
        
        return false;
    }

    handleTouchStart(e) {
        e.preventDefault();
        // Touch handling implementation
    }

    handleTouchMove(e) {
        e.preventDefault();
        // Touch handling implementation
    }

    handleTouchEnd(e) {
        e.preventDefault();
        // Touch handling implementation
    }

    handleKeyDown(e) {
        if (!this.gameState.gameState || this.gameState.selectedTile === null) return;
        
        let newTile = null;
        const row = Math.floor(this.gameState.selectedTile / this.gameState.gameState.width);
        const col = this.gameState.selectedTile % this.gameState.gameState.width;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (row > 0) newTile = (row - 1) * this.gameState.gameState.width + col;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (row < this.gameState.gameState.height - 1) newTile = (row + 1) * this.gameState.gameState.width + col;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (col > 0) newTile = row * this.gameState.gameState.width + (col - 1);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (col < this.gameState.gameState.width - 1) newTile = row * this.gameState.gameState.width + (col + 1);
                break;
        }
        
        if (newTile !== null && this.gameState.visibleTiles.has(newTile)) {
            this.attemptMove(this.gameState.selectedTile, newTile);
        }
    }

    drawGame() {
        if (!this.gameState.gameState) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        const tileSize = 30;
        
        for (let i = 0; i < this.gameState.gameState.terrain.length; i++) {
            const row = Math.floor(i / this.gameState.gameState.width);
            const col = i % this.gameState.gameState.width;
            const x = col * tileSize;
            const y = row * tileSize;
            
            if (!this.gameState.visibleTiles.has(i)) {
                // Draw fog of war
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(x, y, tileSize, tileSize);
                continue;
            }
            
            // Draw visible tile
            const owner = this.gameState.gameState.terrain[i];
            const armies = this.gameState.gameState.armies[i];
            
            // Tile background
            if (owner >= 0) {
                const playerColors = [
                    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
                    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff6348'
                ];
                this.ctx.fillStyle = playerColors[owner % playerColors.length];
            } else {
                this.ctx.fillStyle = '#ddd';
            }
            
            this.ctx.fillRect(x, y, tileSize, tileSize);
            
            // Tile border
            this.ctx.strokeStyle = '#999';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, tileSize, tileSize);
            
            // Selected tile highlight
            if (i === this.gameState.selectedTile) {
                this.ctx.strokeStyle = armies > 1 ? '#ffd700' : '#999';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, tileSize, tileSize);
            }
            
            // Army count
            if (armies > 0) {
                this.ctx.fillStyle = '#000';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(armies.toString(), x + tileSize/2, y + tileSize/2 + 4);
            }
        }
        
        this.ctx.restore();
    }

    updatePlayersList() {
        // Update players list in UI
        const stats = this.gameState.calculatePlayerStats();
        // Implementation would update the DOM with player information
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fogOfWarGame = new FogOfWarGame();
});
