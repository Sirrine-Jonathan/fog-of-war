// Animation system for the Fog of War game

export class AnimationSystem {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.animationId = null;
        this.animationTime = 0;
        this.ripples = [];
        
        // App colors
        this.appColors = {
            gold: '#ffd700',
            slate: '#0f1419',
            darkSlate: '#34495e'
        };

        // Colors for players (supports up to 10 players)
        this.playerColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff6348'
        ];
    }

    // Simplified tiling animation using existing canvas
    drawTilingAnimation() {
        const time = this.animationTime * 0.0003; // Much slower animation
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // White background
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context and apply rotation/scale transform
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(0.15 + time * 0.07); // Static rotation + slow spin
        this.ctx.scale(1.6, 1.6); // Larger scale for more overflow
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        
        const tileSize = 40;
        const cols = Math.ceil(this.canvas.width / tileSize) + 4;
        const rows = Math.ceil(this.canvas.height / tileSize) + 4;
        
        for (let x = -2; x < cols; x++) {
            for (let y = -2; y < rows; y++) {
                const xPos = x * tileSize;
                const yPos = y * tileSize;
                
                // Wave animation with different speeds per row
                const rowSpeed = 1 + (y % 5) * 0.3;
                const rowOffset = y * 0.7;
                let waveOffset = Math.sin(time * 2 * rowSpeed + x * 0.3 + y * 0.1 + rowOffset) * 0.5 + 0.5;
                
                const centerX = xPos + tileSize / 2;
                const centerY = yPos + tileSize / 2;
                
                // Check for ripple effects
                for (const ripple of this.ripples) {
                    const age = this.animationTime - ripple.startTime;
                    if (age < ripple.duration) {
                        const canvasCenterX = this.canvas.width / 2;
                        const canvasCenterY = this.canvas.height / 2;
                        
                        // Translate to origin
                        let rippleX = ripple.x - canvasCenterX;
                        let rippleY = ripple.y - canvasCenterY;
                        
                        // Inverse scale (divide by 1.6)
                        rippleX /= 1.6;
                        rippleY /= 1.6;
                        
                        // Inverse rotation
                        const angle = -(0.15 + time * 0.07);
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        const rotatedX = rippleX * cos - rippleY * sin;
                        const rotatedY = rippleX * sin + rippleY * cos;
                        
                        // Translate back
                        const transformedRippleX = rotatedX + this.canvas.width / 2;
                        const transformedRippleY = rotatedY + this.canvas.height / 2;
                        
                        const distance = Math.sqrt(
                            Math.pow(centerX - transformedRippleX, 2) + 
                            Math.pow(centerY - transformedRippleY, 2)
                        );
                        
                        const progress = age / ripple.duration;
                        const currentRadius = progress * ripple.maxRadius;
                        
                        if (Math.abs(distance - currentRadius) < 20) {
                            waveOffset = Math.min(1, waveOffset + 0.8);
                        }
                    }
                }
                
                // Determine tile color
                const shouldBePlayerColor = (x * 2 + y) % 6 === 0;
                
                let tileColor = this.appColors.slate;
                let hasRippleShimmer = false;
                let shimmerIntensity = 0;
                
                // Check for ripple shimmer effect
                for (const ripple of this.ripples) {
                    const age = this.animationTime - ripple.startTime;
                    if (age < ripple.duration) {
                        const canvasCenterX = this.canvas.width / 2;
                        const canvasCenterY = this.canvas.height / 2;
                        
                        let rippleX = ripple.x - canvasCenterX;
                        let rippleY = ripple.y - canvasCenterY;
                        
                        rippleX /= 1.6;
                        rippleY /= 1.6;
                        
                        const angle = -(0.15 + time * 0.07);
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        const rotatedX = rippleX * cos - rippleY * sin;
                        const rotatedY = rippleX * sin + rippleY * cos;
                        
                        const transformedRippleX = rotatedX + this.canvas.width / 2;
                        const transformedRippleY = rotatedY + this.canvas.height / 2;
                        
                        const distance = Math.sqrt(
                            Math.pow(centerX - transformedRippleX, 2) + 
                            Math.pow(centerY - transformedRippleY, 2)
                        );
                        
                        const progress = age / ripple.duration;
                        const currentRadius = progress * ripple.maxRadius;
                        
                        if (Math.abs(distance - currentRadius) < 30) {
                            hasRippleShimmer = true;
                            shimmerIntensity = Math.max(shimmerIntensity, 1 - progress);
                        }
                    }
                }
                
                if (shouldBePlayerColor) {
                    const colorIndex = (x + y * 3) % this.playerColors.length;
                    tileColor = this.playerColors[colorIndex];
                } else if (hasRippleShimmer) {
                    const shimmerColor = this.playerColors[Math.floor(Math.random() * this.playerColors.length)];
                    tileColor = shimmerColor;
                }
                
                // Apply wave effect to brightness
                const brightness = 0.3 + waveOffset * 0.7;
                
                // Parse and adjust color
                const rgb = this.hexToRgb(tileColor);
                if (rgb) {
                    const adjustedColor = `rgb(${Math.floor(rgb.r * brightness)}, ${Math.floor(rgb.g * brightness)}, ${Math.floor(rgb.b * brightness)})`;
                    this.ctx.fillStyle = adjustedColor;
                } else {
                    this.ctx.fillStyle = tileColor;
                }
                
                // Draw tile
                this.ctx.fillRect(xPos, yPos, tileSize - 1, tileSize - 1);
                
                // Add shimmer effect
                if (hasRippleShimmer && shimmerIntensity > 0) {
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${shimmerIntensity * 0.3})`;
                    this.ctx.fillRect(xPos, yPos, tileSize - 1, tileSize - 1);
                }
            }
        }
        
        this.ctx.restore();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    start() {
        if (this.animationId) return;
        
        const animate = () => {
            this.animationTime += 16;
            this.updateRipples();
            this.drawTilingAnimation();
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    createRipple(x, y, size = 'normal') {
        const randomColor = this.playerColors[Math.floor(Math.random() * this.playerColors.length)];
        const maxRadius = size === 'big' ? 400 : 200;
        
        this.ripples.push({
            x: x,
            y: y,
            startTime: this.animationTime,
            duration: 2000,
            maxRadius: maxRadius,
            color: randomColor
        });
    }

    updateRipples() {
        this.ripples = this.ripples.filter(ripple => {
            const age = this.animationTime - ripple.startTime;
            return age < ripple.duration;
        });
    }

    addRippleListeners() {
        // Only add listeners when animation is active (no game running)
        const handleRipple = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.createRipple(x, y);
        };

        this.canvas.addEventListener('click', handleRipple);
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.createRipple(x, y);
        });
    }
}
