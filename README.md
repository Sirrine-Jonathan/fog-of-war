# Generals Game Server

A Socket.IO-based game server compatible with generals.io bots, featuring both bot and human player support.

## Features

- **Bot Compatible**: Works with existing generals.io bot implementations
- **Human Players**: Interactive web interface for human players
- **Real-time Viewer**: Watch games in progress
- **Room-based**: Multiple games can run simultaneously

## Setup

```bash
npm install
npm run dev
```

Server runs on http://localhost:3001

## Usage

### For Bots
Update your bot to connect to `http://localhost:3001` instead of the official server.

### For Human Players
1. Visit `http://localhost:3001/game/your-room-name`
2. Press 'j' to join as a human player
3. Click tiles to select and move armies

### Game Controls
- Click owned tile with >1 army to select
- Click adjacent tile to attack/move
- Press 'j' to join game as human player

## API Compatibility

Implements the same Socket.IO events as generals.io:
- `set_username`
- `join_private` 
- `set_force_start`
- `attack`
- `game_start`
- `game_update`

## Architecture

- **Express**: Web server for static files
- **Socket.IO**: Real-time communication
- **Game Engine**: Core game mechanics and state management
- **Canvas Renderer**: Visual game display
