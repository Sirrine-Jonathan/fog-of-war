# Fog of War

A real-time multiplayer strategy game where players compete to conquer territory, build armies, and eliminate opponents by capturing their capitals. Features an advanced intent-based pathfinding system, bot support, and mobile-optimized controls.

**🎮 Live Game:** https://fog-of-war-c771d20fa90e.herokuapp.com/

## Features

- **Multiplayer:** 2-8 players compete in real-time strategic battles
- **Smart Intent System:** Auto-pathfinding moves armies to distant targets automatically
- **Bot API:** Create custom bots using WebSocket protocol to play alongside humans
- **Fog of War:** Limited vision creates tactical depth and surprise encounters
- **Strategic Objectives:** Capture cities, control lookout towers, eliminate enemy capitals
- **Mobile Optimized:** Touch controls, gestures, and responsive design for mobile play
- **PWA Support:** Installable as an app on any device for offline-capable gaming

## Quick Start

### Play Online

Visit https://fog-of-war-c771d20fa90e.herokuapp.com/ to start playing immediately.

### Local Development

```bash
# Clone the repository
git clone https://github.com/Sirrine-Jonathan/fog-of-war.git
cd fog-of-war

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

## Documentation

- **[How to Play](https://fog-of-war-c771d20fa90e.herokuapp.com/how-to-play.html)** - Game rules, mechanics, and winning strategies
- **[Controls Guide](https://fog-of-war-c771d20fa90e.herokuapp.com/controls.html)** - Desktop and mobile controls reference
- **[Bot Specification](https://fog-of-war-c771d20fa90e.herokuapp.com/specification.html)** - WebSocket API for creating custom bots

## Game Overview

### Objective

Eliminate all opponents by capturing their capitals while defending your own.

### Key Mechanics

- **Army Generation:** Your capital and captured cities produce 1 army per turn
- **Territory Control:** Expand to neutral tiles and capture enemy territory
- **Combat:** Attack enemies with your armies; larger force wins
- **Vision:** See owned tiles and adjacent areas; use lookout towers for extended vision
- **Special Tiles:**
  - 👑 **Capitals:** Your starting position; losing it eliminates you
  - 🏛️ **Cities:** Generate 1 army per turn when captured
  - 🗼 **Lookout Towers:** Provide extended vision radius
  - ⛰️ **Mountains:** Impassable terrain for strategic defense

### Recent Updates

- **Improved Intent System** (commit 2e1b68d): Enhanced auto-pathfinding with intelligent source tile selection
- **Mobile Zoom** (commit 17540da): Better initial zoom for mobile devices

## Technology Stack

- **Backend:** Node.js, TypeScript, Express, WebSocket (ws)
- **Frontend:** Vanilla JavaScript, HTML5 Canvas
- **Deployment:** Heroku
- **PWA:** Service Workers for offline functionality

## Project Structure

```
fog-of-war/
├── src/
│   ├── server.ts          # WebSocket server & game orchestration
│   ├── game.ts            # Core game logic
│   ├── botManager.ts      # Bot management
│   ├── types.ts           # TypeScript type definitions
│   └── bots/              # Built-in bot implementations
│       ├── BaseBot.ts
│       ├── BlobBot.ts
│       ├── ArrowBot.ts
│       └── SpiralBot.ts
├── public/
│   ├── game.html          # Main game interface
│   ├── game.js            # Client-side game rendering
│   ├── index.html         # Landing page
│   ├── controls.html      # Controls guide
│   ├── how-to-play.html   # Tutorial guide
│   ├── specification.html # Bot API documentation
│   └── BOT_SPECIFICATION.md # Markdown specification
└── CONTROLS.md            # Controls reference
```

## Creating Bots

Bots connect via WebSocket and receive game state updates every turn. See the [Bot Specification](https://fog-of-war-c771d20fa90e.herokuapp.com/specification.html) for complete API documentation.

### Quick Example

```javascript
const WebSocket = require("ws");

class SimpleBot {
  constructor(name) {
    this.ws = new WebSocket("wss://fog-of-war-c771d20fa90e.herokuapp.com");
    this.ws.on("open", () => {
      this.ws.send(JSON.stringify({ type: "joinAsBot", playerName: name }));
    });
    this.ws.on("message", (data) => {
      const msg = JSON.parse(data);
      if (msg.type === "gameState") {
        this.makeMove(msg.gameState, msg.playerIndex);
      }
    });
  }

  makeMove(gameState, playerIndex) {
    // Your bot logic here
    const { terrain, armies, width, height } = gameState;
    // Find owned tiles, select moves, send commands
  }
}

new SimpleBot("MyBot");
```

## Contributing

Contributions are welcome! Feel free to:

- Report bugs or request features via [GitHub Issues](https://github.com/Sirrine-Jonathan/fog-of-war/issues)
- Submit pull requests with improvements
- Create and share custom bot implementations
- Improve documentation

## Development Commands

```bash
npm run dev       # Start development server
npm run build     # Build TypeScript
npm start         # Run production server
npm test          # Run tests
```

## License

MIT License - See [LICENSE](LICENSE) file for details

## Credits

- Sound effects from Freesound.org (see [credits](https://fog-of-war-c771d20fa90e.herokuapp.com/credits.html))
- Built with ❤️ by [Jonathan Sirrine](https://github.com/Sirrine-Jonathan)

## Support

- **GitHub:** https://github.com/Sirrine-Jonathan/fog-of-war
- **Issues:** https://github.com/Sirrine-Jonathan/fog-of-war/issues
- **Discussions:** https://github.com/Sirrine-Jonathan/fog-of-war/discussions

---

**Ready to conquer?** [Play Now →](https://fog-of-war-c771d20fa90e.herokuapp.com/)
