# Fog of War

A Socket.IO-based game server, featuring both bot and human player support.

## Features

implementations

- **Human Players**: Interactive web interface for human players
- **Real-time Viewer**: Watch games in progress
- **Room-based**: Multiple games can run simultaneously

## Setup

```bash
npm install
npm run dev
```

Server runs on http://localhost:5173

## Usage

### For Bots

Update your bot to connect to `http://localhost:5173`.

### For Human Players

1. Visit `http://localhost:5173/game/your-room-name`

### Game Controls

#### Basic Controls

- Click owned tile with >1 army to select
- Click adjacent tile to attack/move
- Press 'j' to join game as human player

#### Camera Controls

- **Pan**: Right-click and drag, or Shift+left-click and drag
- **Zoom**: Mouse wheel to zoom in/out
- **Auto-center**: Game centers automatically on wide screens
- **Fit to screen**: Zoom out enough to see entire map without panning

#### Advanced Controls

- Alt+click or Shift+click: Select tile without launching intent
- Long press (mobile): Select tile for movement

## API Compatibility

Socket.IO events:

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
