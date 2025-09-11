// Utility functions for the Fog of War game

// Helper function to convert hex color to RGB
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Calculate luminance to determine if color is light or dark
export function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Get contrasting color (black or white) for given RGB
export function getContrastColor(r, g, b) {
    const luminance = getLuminance(r, g, b);
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Patch function for applying diffs
export function patch(old, diff) {
    const out = [];
    let i = 0;
    while (i < diff.length) {
        if (diff[i]) {
            out.push(diff[i + 1]);
            i += 2;
        } else {
            out.push(old[diff[i + 1]]);
            i += 2;
        }
    }
    return out;
}

// Parse map data from server
export function parseMapData(mapData) {
    const width = mapData[0];
    const height = mapData[1];
    const terrain = mapData.slice(2, 2 + width * height);
    const armies = mapData.slice(2 + width * height, 2 + 2 * width * height);
    const cities = mapData.slice(2 + 2 * width * height, 2 + 3 * width * height);
    const towers = mapData.slice(2 + 3 * width * height, 2 + 4 * width * height);
    const mountains = mapData.slice(2 + 4 * width * height, 2 + 5 * width * height);
    const generals = mapData.slice(2 + 5 * width * height);
    
    return { width, height, terrain, armies, cities, towers, mountains, generals };
}

// Check if device is mobile
export function checkIsMobile() {
    const width = window.innerWidth;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return width <= 768 || isMobileUA;
}

// Get adjacent tiles (8-directional)
export function getAdjacentTiles(tileIndex, gameState) {
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

// Get tiles within radius
export function getTilesInRadius(tileIndex, radius, gameState) {
    const tiles = [];
    const row = Math.floor(tileIndex / gameState.width);
    const col = tileIndex % gameState.width;
    
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            // Use circular distance instead of square
            const distance = Math.sqrt(dr * dr + dc * dc);
            if (distance <= radius) {
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (newRow >= 0 && newRow < gameState.height && 
                    newCol >= 0 && newCol < gameState.width) {
                    tiles.push(newRow * gameState.width + newCol);
                }
            }
        }
    }
    
    return tiles;
}

// Check if two tiles are adjacent
export function isAdjacent(from, to, gameState) {
    const fromRow = Math.floor(from / gameState.width);
    const fromCol = from % gameState.width;
    const toRow = Math.floor(to / gameState.width);
    const toCol = to % gameState.width;
    
    const rowDiff = Math.abs(fromRow - toRow);
    const colDiff = Math.abs(fromCol - toCol);
    
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
}
