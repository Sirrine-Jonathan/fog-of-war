// Game state management for the Fog of War game

export class GameState {
    constructor() {
        this.gameState = null;
        this.selectedTile = null;
        this.playerIndex = -1;
        this.gameStarted = false;
        this.gameEnded = false;
        this.players = [];
        this.visibleTiles = new Set();
        this.playerGenerals = new Map();
        this.lastUsername = '';
        this.currentUserId = '';
        this.isHost = false;
        this.hostSocketId = null;
        this.isEliminated = false;
        this.playerSocketMap = new Map();
        this.activeIntent = null;
        this.discoveredTiles = new Set();
        
        this.STORAGE_KEY = 'fogOfWarGameState';
    }

    // Load persisted state
    loadPersistedState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.lastUsername = state.username || '';
                this.currentUserId = state.userId || '';
                
                // Convert discovered tiles array back to Set
                if (state.discoveredTiles) {
                    this.discoveredTiles = new Set(state.discoveredTiles);
                }
                
                return state;
            } catch (e) {
                console.warn('Failed to parse saved state:', e);
                this.clearState();
            }
        }
        return null;
    }

    // Save state to localStorage (only for actual players)
    saveState() {
        if (this.playerIndex >= 0) {
            const state = {
                username: this.lastUsername,
                userId: this.currentUserId,
                playerIndex: this.playerIndex,
                gameStarted: this.gameStarted,
                roomId: window.roomId,
                discoveredTiles: Array.from(this.discoveredTiles)
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        }
    }

    // Clear saved state
    clearState() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.discoveredTiles.clear();
        this.playerGenerals.clear();
        this.visibleTiles.clear();
    }

    // Auto-rejoin if we were previously in this game
    attemptAutoRejoin() {
        const saved = this.loadPersistedState();
        if (saved && saved.gameStarted && saved.roomId === window.roomId && saved.username) {
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                usernameInput.value = saved.username;
            }
            return true;
        }
        return false;
    }

    setSelectedTile(tileIndex) {
        this.selectedTile = tileIndex;
        if (tileIndex !== null) {
            this.saveState();
        }
    }

    updateVisibleTiles() {
        if (!this.gameState) return;
        
        this.visibleTiles.clear();
        
        // Viewers and eliminated players see everything
        if (this.playerIndex < 0 || this.isEliminated) {
            for (let i = 0; i < this.gameState.terrain.length; i++) {
                this.visibleTiles.add(i);
            }
            return;
        }
        
        // Add discovered tiles (permanent visibility)
        this.discoveredTiles.forEach(tile => this.visibleTiles.add(tile));
        
        // Active players see fog of war
        for (let i = 0; i < this.gameState.terrain.length; i++) {
            if (this.gameState.terrain[i] === this.playerIndex) {
                this.visibleTiles.add(i);
                this.discoveredTiles.add(i);
                
                // Add adjacent tiles for owned territories
                const adjacent = this.getAdjacentTiles(i);
                adjacent.forEach(adjTile => {
                    this.visibleTiles.add(adjTile);
                    this.discoveredTiles.add(adjTile);
                });
            }
        }
        
        // Add visibility around cities and towers
        for (let i = 0; i < this.gameState.terrain.length; i++) {
            if (this.gameState.terrain[i] === this.playerIndex) {
                if (this.gameState.cities[i] > 0) {
                    const tilesInRadius = this.getTilesInRadius(i, 2);
                    tilesInRadius.forEach(tile => {
                        this.visibleTiles.add(tile);
                        this.discoveredTiles.add(tile);
                    });
                }
                
                if (this.gameState.towers[i] > 0) {
                    const tilesInRadius = this.getTilesInRadius(i, 3);
                    tilesInRadius.forEach(tile => {
                        this.visibleTiles.add(tile);
                        this.discoveredTiles.add(tile);
                    });
                }
            }
        }
        
        this.saveState();
    }

    getAdjacentTiles(tileIndex) {
        const adjacent = [];
        const row = Math.floor(tileIndex / this.gameState.width);
        const col = tileIndex % this.gameState.width;
        
        // 8-directional (including diagonals)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (newRow >= 0 && newRow < this.gameState.height && 
                    newCol >= 0 && newCol < this.gameState.width) {
                    adjacent.push(newRow * this.gameState.width + newCol);
                }
            }
        }
        
        return adjacent;
    }

    getTilesInRadius(tileIndex, radius) {
        const tiles = [];
        const row = Math.floor(tileIndex / this.gameState.width);
        const col = tileIndex % this.gameState.width;
        
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const distance = Math.sqrt(dr * dr + dc * dc);
                if (distance <= radius) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    if (newRow >= 0 && newRow < this.gameState.height && 
                        newCol >= 0 && newCol < this.gameState.width) {
                        tiles.push(newRow * this.gameState.width + newCol);
                    }
                }
            }
        }
        
        return tiles;
    }

    calculatePlayerStats() {
        if (!this.gameState) return {};
        
        const stats = {};
        this.players.forEach((player, index) => {
            stats[index] = {
                name: player.name,
                tiles: 0,
                armies: 0,
                cities: 0,
                towers: 0
            };
        });
        
        for (let i = 0; i < this.gameState.terrain.length; i++) {
            const owner = this.gameState.terrain[i];
            if (owner >= 0 && stats[owner]) {
                stats[owner].tiles++;
                stats[owner].armies += this.gameState.armies[i];
                if (this.gameState.cities[i] > 0) stats[owner].cities++;
                if (this.gameState.towers[i] > 0) stats[owner].towers++;
            }
        }
        
        return stats;
    }
}
