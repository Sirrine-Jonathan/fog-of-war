#!/usr/bin/env node

/**
 * Automated Bot Battle Test Script
 *
 * This script:
 * 1. Starts the development server
 * 2. Pipes server output to botarena.txt
 * 3. Opens browser and navigates to the game
 * 4. Invites all 4 bots
 * 5. Starts the game
 * 6. Waits for game end or 10-minute timeout
 * 7. Cleans up and exits
 */

const { spawn } = require("child_process");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const SERVER_PORT = 5173;
const GAME_URL = `http://localhost:${SERVER_PORT}/game/botarena`;
const LOG_FILE = path.join(__dirname, "botarena.txt");
const TIMEOUT_MS = 30 * 1000; // 30 seconds

let serverProcess = null;
let browser = null;
let logStream = null;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function startServer() {
  log("Starting development server...");

  // Clear or truncate existing log file
  truncateLogFile();

  // Create log stream (append mode)
  logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  logStream.write(`\n=== Bot Arena Test Log ===\n`);
  logStream.write(`Started: ${new Date().toISOString()}\n\n`);

  // Start server
  serverProcess = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  // Pipe stdout and stderr to log file
  serverProcess.stdout.on("data", (data) => {
    logStream.write(data);
  });

  serverProcess.stderr.on("data", (data) => {
    logStream.write(data);
  });

  serverProcess.on("error", (error) => {
    log(`Server process error: ${error.message}`);
  });

  // Wait for server to be ready
  log("Waiting for server to be ready...");
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`http://localhost:${SERVER_PORT}`);
      if (response.ok) {
        log("Server is ready!");
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await sleep(1000);
    retries--;
  }

  throw new Error("Server failed to start within 30 seconds");
}

async function runBotBattle() {
  log("Launching browser...");
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set up console logging
  page.on("console", (msg) => {
    const text = msg.text();
    logStream.write(`[BROWSER] ${text}\n`);
  });

  log(`Navigating to ${GAME_URL}...`);
  await page.goto(GAME_URL, { waitUntil: "networkidle2" });

  // Wait for page to load
  await sleep(2000);

  log("Inviting bots...");

  // Click "Invite Bots" to expand the section
  try {
    await page.click('button:has-text("Invite Bots")');
    await sleep(500);
  } catch (e) {
    // Section might already be expanded
  }

  // Invite only Blob and Titan for focused testing
  const bots = ["Blob", "Titan"];
  for (const bot of bots) {
    log(`Inviting ${bot}...`);
    try {
      await page.evaluate((botName) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const button = buttons.find((b) => b.textContent.includes(botName));
        if (button && !button.disabled) {
          button.click();
        }
      }, bot);
      await sleep(1000);
    } catch (e) {
      log(`Failed to invite ${bot}: ${e.message}`);
    }
  }

  log("Waiting for bots to join...");
  await sleep(3000);

  log("Starting game...");
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const startButton = buttons.find(
        (b) => b.textContent && b.textContent.includes("Start Game")
      );
      if (startButton) {
        console.log("Clicking ", startButton.textContent);
        startButton.click();
      } else {
        throw new Error("Couldn't find start button");
      }
    });
  } catch (e) {
    log(`Failed to start game: ${e.message}`);
    throw e;
  }

  log("Game started! Monitoring for completion...");

  // Wait for game end or timeout
  const startTime = Date.now();
  let gameEnded = false;

  while (!gameEnded && Date.now() - startTime < TIMEOUT_MS) {
    try {
      // Check if game has ended by looking for winner message
      const gameEndMessage = await page.evaluate(() => {
        const messages = Array.from(document.querySelectorAll(".chat-message"));
        return messages.some((m) => m.textContent.includes("wins the game"));
      });

      if (gameEndMessage) {
        log("Game ended - winner detected!");
        gameEnded = true;
        break;
      }

      // Log progress every 5 seconds
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 5 === 0 && elapsed > 0) {
        log(`Game still running... ${elapsed}s elapsed`);

        // Try to get current stats
        try {
          const stats = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("table tr"));
            return rows
              .map((row) => {
                const cells = Array.from(row.querySelectorAll("td, th"));
                return cells.map((c) => c.textContent.trim()).join(" | ");
              })
              .join("\n");
          });
          if (stats) {
            logStream.write(`\n=== Stats at ${elapsed}s ===\n${stats}\n\n`);
          }
        } catch (e) {
          // Stats not available
        }
      }

      await sleep(1000);
    } catch (e) {
      log(`Error checking game state: ${e.message}`);
      await sleep(1000);
    }
  }

  if (!gameEnded) {
    log("Timeout reached (10 minutes)");
  }

  // Get final stats
  log("Getting final stats...");
  try {
    const finalStats = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      return rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll("td, th"));
          return cells.map((c) => c.textContent.trim()).join(" | ");
        })
        .join("\n");
    });

    logStream.write(`\n=== Final Stats ===\n${finalStats}\n\n`);
    log("Final stats captured");
  } catch (e) {
    log(`Failed to get final stats: ${e.message}`);
  }
}

function truncateLogFile() {
  // Temporarily disabled truncation for debugging
  return;

  try {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content.split("\n");

    if (lines.length <= 150) {
      return; // File is small enough, no truncation needed
    }

    // Keep first 100 lines and last 50 lines
    const firstLines = lines.slice(0, 100);
    const lastLines = lines.slice(-50);

    const truncatedContent = [
      ...firstLines,
      "",
      "... [Middle section truncated for brevity] ...",
      "",
      ...lastLines,
    ].join("\n");

    fs.writeFileSync(LOG_FILE, truncatedContent, "utf8");
    log(`Log file truncated to ~150 lines`);
  } catch (error) {
    log(`Failed to truncate log file: ${error.message}`);
  }
}

async function cleanup() {
  log("Cleaning up...");

  if (browser) {
    await browser.close();
    log("Browser closed");
  }

  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    log("Server process terminated");
  }

  if (logStream) {
    logStream.write(`\nEnded: ${new Date().toISOString()}\n`);
    logStream.end();
    log(`Log saved to ${LOG_FILE}`);
  }

  // Truncate log file after writing
  truncateLogFile();
}

async function main() {
  try {
    log("=== Starting Bot Arena Test ===");

    await startServer();
    await runBotBattle();

    log("=== Test Complete ===");
    log(`Full logs available in: ${LOG_FILE}`);
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

// Handle interrupts
process.on("SIGINT", async () => {
  log("Received SIGINT, cleaning up...");
  await cleanup();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  log("Received SIGTERM, cleaning up...");
  await cleanup();
  process.exit(1);
});

// Run the test
main();
