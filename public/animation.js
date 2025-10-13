// Shared tiling animation for fog-of-war-server
// Used on home page - based on working implementation from game.js

function createTilingAnimation(canvasElement) {
  const playerColors = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#feca57",
    "#ff9ff3",
    "#54a0ff",
    "#5f27cd",
  ];

  let animationTime = 0;
  let ripples = [];
  let animationId = null;

  // Create canvas element
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvasElement.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // Set canvas size to match container
  function resizeCanvas() {
    const rect = canvasElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Drawing function
  function drawTilingAnimation() {
    const time = animationTime * 0.0003;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "rgb(15, 20, 25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context and apply rotation/scale transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(0.15 + time * 0.07);
    ctx.scale(1.6, 1.6);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    const tileSize = 40;
    const cols = Math.ceil(canvas.width / tileSize) + 4;
    const rows = Math.ceil(canvas.height / tileSize) + 4;

    for (let x = -2; x < cols; x++) {
      for (let y = -2; y < rows; y++) {
        const xPos = x * tileSize;
        const yPos = y * tileSize;

        // Wave effect
        const rowSpeed = 1 + (y % 5) * 0.3;
        const rowOffset = y * 0.7;
        let waveOffset =
          Math.sin(time * 2 * rowSpeed + x * 0.3 + y * 0.1 + rowOffset) * 0.5 +
          0.5;

        const centerX = xPos + tileSize / 2;
        const centerY = yPos + tileSize / 2;

        // Apply ripple effects
        ripples.forEach((ripple) => {
          const distance = Math.sqrt(
            (centerX - ripple.x) ** 2 + (centerY - ripple.y) ** 2
          );
          if (distance < ripple.radius + 30) {
            const influence = Math.max(0, 1 - distance / (ripple.radius + 30));
            const rippleEffect = influence * ripple.opacity * 2.0;
            waveOffset = Math.min(1, waveOffset + rippleEffect);
          }
        });

        const scale = 0.4 + waveOffset * 0.6;
        const scaledSize = tileSize * scale;

        // Color fading effect
        const colorPhase =
          Math.sin(time * 0.8 + x * 0.2 + y * 0.15) * 0.5 + 0.5;
        const shouldFade = (x + y * 3) % 5 === 0;
        const shouldBePlayerColor = (x * 2 + y) % 6 === 0;

        let tileColor = "rgb(15, 20, 25)"; // Default dark slate

        if (shouldBePlayerColor && waveOffset > 0.6) {
          const colorIndex = (x + y * 2) % playerColors.length;
          tileColor = playerColors[colorIndex];
        } else if (shouldFade && colorPhase > 0.7) {
          const colorIndex = (x + y) % playerColors.length;
          const fadeAmount = (colorPhase - 0.7) / 0.3;
          const playerColor = playerColors[colorIndex];

          if (playerColor && playerColor.startsWith("#")) {
            const slateRGB = [15, 20, 25];
            const playerRGB = [
              parseInt(playerColor.slice(1, 3), 16),
              parseInt(playerColor.slice(3, 5), 16),
              parseInt(playerColor.slice(5, 7), 16),
            ];

            const r = Math.round(
              slateRGB[0] + (playerRGB[0] - slateRGB[0]) * fadeAmount
            );
            const g = Math.round(
              slateRGB[1] + (playerRGB[1] - slateRGB[1]) * fadeAmount
            );
            const b = Math.round(
              slateRGB[2] + (playerRGB[2] - slateRGB[2]) * fadeAmount
            );

            tileColor = `rgb(${r}, ${g}, ${b})`;
          }
        } else if (waveOffset > 0.75) {
          const lightness = (waveOffset - 0.75) / 0.25;
          const centerLightness = Math.max(
            0,
            1 - Math.abs(waveOffset - 0.875) / 0.125
          );
          const finalLightness = lightness * 0.4 + centerLightness * 0.3;

          const baseRGB = [15, 20, 25];
          const r = Math.round(
            baseRGB[0] + (120 - baseRGB[0]) * finalLightness
          );
          const g = Math.round(
            baseRGB[1] + (140 - baseRGB[1]) * finalLightness
          );
          const b = Math.round(
            baseRGB[2] + (160 - baseRGB[2]) * finalLightness
          );

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

    ctx.restore();

    // Draw ripples
    ripples = ripples.filter((ripple) => {
      const age = animationTime - ripple.startTime;
      const progress = age / 1000;
      if (progress >= 1) return false;

      ripple.radius = progress * ripple.maxRadius;
      ripple.opacity = 1 - progress;

      ctx.save();
      ctx.globalAlpha = ripple.opacity;
      ctx.strokeStyle = ripple.color;
      ctx.lineWidth = ripple.lineWidth * (1 - progress);
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      return true;
    });
  }

  // Animation loop
  function animate() {
    animationTime += 16;
    drawTilingAnimation();
    animationId = requestAnimationFrame(animate);
  }

  // Mouse/touch interaction
  function createRipple(x, y, size = "normal") {
    const randomColor =
      playerColors[Math.floor(Math.random() * playerColors.length)];
    const maxRadius = size === "big" ? 400 : 200;
    const lineWidth = size === "big" ? 16 : 4;
    ripples.push({
      x: x,
      y: y,
      radius: 0,
      maxRadius: maxRadius,
      lineWidth: lineWidth,
      opacity: 1,
      startTime: animationTime,
      color: randomColor,
    });
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    createRipple(x, y, "big");
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = Date.now();
    if (!canvas.lastMouseRipple || now - canvas.lastMouseRipple > 200) {
      createRipple(x, y);
      canvas.lastMouseRipple = now;
    }
  });

  // Start animation
  animate();

  // Return cleanup function
  return {
    stop: () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
  };
}

// Make function available globally
window.createTilingAnimation = createTilingAnimation;
