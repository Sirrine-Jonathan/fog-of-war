# Fog of War - Complete Controls Reference

## Overview

This document provides a comprehensive analysis of all game controls for both desktop and mobile platforms. The game features an intent-based movement system, camera controls, and platform-specific input methods.

---

## Desktop Controls

### Mouse Controls

#### Basic Tile Interaction

**Left Click - Context-Dependent:**

- **When no tile is selected:**
  - Clicking owned territory → Activates that tile
  - Clicking non-owned territory → **Auto-selects best source tile and launches intent (NEW!)**
- **When a tile is selected:**
  - Clicking **same tile again** → **Deselects the tile (NEW!)**
  - Clicking **adjacent** visible tile → Launches immediate move/attack
  - Clicking **non-adjacent** visible tile → Launches pathfinding intent
  - Clicking owned territory → Changes selection to that tile
  - If insufficient armies (<2), clicking non-owned → **Auto-selects best source (NEW!)**

**Modifiers:**

- **Alt + Click** or **Shift + Click**: Activate tile WITHOUT launching intent
  - Only activates the clicked tile if owned
  - Deselects if clicking non-owned tile
  - Useful for switching between owned territories without moving armies

**Right Click:**

- Activates tile without launching intent (same as Alt/Shift + Click)
- Prevents default context menu
- Only works on visible owned tiles
- If tile not owned or invisible → Deselects current tile

#### Camera Controls

**Shift + Drag:**

- Hold Shift → Cursor changes to "grab"
- Click and drag → Pan the camera
- Release → Camera stops at current position
- Works with left mouse button while Shift is held

**Scroll Wheel:**

- Scroll up → Zoom in (max: 2x)
- Scroll down → Zoom out (min: calculated to fit entire map + 30% padding)
- Zooms toward mouse cursor position
- Smooth zoom with reduced sensitivity (5% per scroll increment)

**Middle Mouse Button + Drag:**

- Alternative panning method
- Does not require Shift key
- Same functionality as Shift + Drag

### Keyboard Controls

**Movement Keys (WASD or Arrow Keys):**

- `W` or `↑` - Move selected tile's armies UP
- `S` or `↓` - Move selected tile's armies DOWN
- `A` or `←` - Move selected tile's armies LEFT
- `D` or `→` - Move selected tile's armies RIGHT

**Requirements:**

- Canvas must be focused (click canvas first)
- Must have a selected tile
- Selected tile must have >1 army
- Target tile must be visible and adjacent

**Special Keys:**

- **Spacebar**: Cycle through owned tiles in order:
  1. Your capital
  2. Owned cities
  3. Captured enemy capitals
  - Plays sound effect when cycling
  - Wraps around to beginning after last tile
  - Works even if no tile currently selected

**Shift Key:**

- Shows "grab" cursor when held (even without clicking)
- Enables camera panning with drag
- Visual feedback for panning availability

---

## Mobile Controls

### Device Detection

The game automatically detects mobile devices using:

- Screen width ≤ 768px
- User agent string matching mobile devices
- Activates mobile-specific UI and controls

### Touch Gestures

#### Single Touch

**Short Tap (< 500ms):**

- **When no tile is selected:**
  - Tap owned territory → Activates that tile
  - Tap non-owned territory → No action
- **When a tile is selected:**
  - Tap **adjacent** visible tile → Launches immediate move/attack
  - Tap **non-adjacent** visible tile → Launches pathfinding intent
  - Tap owned territory → Changes selection to that tile

**Long Press (≥ 500ms):**

- Provides haptic feedback (if device supports)
- Functions like Alt/Shift + Click on desktop
- Activates tile WITHOUT launching intent
- Useful for switching between owned territories without moving armies
- Must not move finger during press

**Single Finger Drag:**

- Touch and hold → Start potential drag
- Move > 10px → Activates pan mode
- Continue dragging → Pan camera around map
- Release → Camera stops at current position
- **Note**: Small movements (< 10px) are ignored to allow precise tapping

#### Multi-Touch

**Two Finger Pinch Zoom:**

- Place two fingers on screen
- Pinch together → Zoom out (min: calculated to fit map)
- Spread apart → Zoom in (max: 2x)
- Smooth zoom based on distance between fingers
- Works while panning is active

### Mobile Tab System

**Three Tabs:**

1. **Game Tab** (default)
   - Main game canvas
   - Full-screen game view
   - Primary interaction area
2. **Controls Tab**
   - Player list with stats
   - Bot invite buttons
   - Game control buttons
3. **Chat Tab**
   - Chat messages
   - Chat input
   - Send button

**Switching Tabs:**

- Tap tab icons in bottom tab bar
- Active tab highlighted
- Body class changes to show/hide relevant content
- Canvas resizes when switching to Game tab

---

## Intent-Based Movement System

### What is an Intent?

An intent is an automatic pathfinding system that moves armies toward a distant target over multiple turns.

### How It Works

1. **Launch Intent**: Click/tap non-adjacent visible tile with selected armies
2. **Pathfinding**: System calculates optimal path avoiding mountains
3. **Execution**: Each turn, armies move one step along the path
4. **Completion**: Intent clears when target reached or path blocked

### Path Preferences

The pathfinding algorithm uses weighted costs:

- **Owned territory**: 0.5 cost (preferred)
- **Neutral/empty territory**: 1.0 cost (normal)
- **Unknown (fog)**: 1.2 cost (slight penalty)
- **Special tiles to avoid**: 3.0 cost (try to avoid unless target)
  - Neutral cities
  - Neutral towers
  - Enemy capitals

### Auto-Source Selection (NEW!)

When you click a target without a valid source selected (or with insufficient armies), the game automatically finds the best source tile using an intelligent scoring system:

**Scoring Formula:**

- Score = (Distance × 1.0) + (Armies × 0.5)
- Cities receive a 20% distance bonus to prefer them as sources
- Prefers farther tiles with more armies
- Falls back to capital if no other suitable sources available

**This means:**

- Click any target and let the game find the best source
- Reduces micromanagement for distant attacks
- Automatically prioritizes cities for launching attacks
- Better strategic positioning without manual selection

### Visual Feedback

- **Red dashed border**: Shows intent path
- **Updates each turn**: Path recalculates if needed
- **Cleared on completion**: Border disappears when done
- **Can be overridden**: New click/tap cancels current intent

### Canceling Intents

- Click/tap any tile → Clears current intent
- Right-click (desktop) → Cancels intent
- Long press (mobile) → Cancels intent
- New movement command → Replaces intent

---

## Camera System

### Auto-Following

**Selected Tile Tracking:**

- Camera follows selected tile when near viewport edges
- 25% margin from edge triggers camera movement
- Smooth interpolation (10% smoothing factor)
- Only moves when tile approaches edge (not always centered)

**Auto-Centering:**

- When canvas is **larger than map**: Game centers automatically
- Applies to both width and height independently
- Maintains centered position during zoom

### Manual Control

**Panning:**

- Desktop: Shift + Drag, or Middle mouse + Drag, or Right mouse + Drag
- Mobile: Single finger drag (after 10px threshold)
- Clamps to map boundaries when map is larger than viewport
- Updates target position for smooth interpolation

**Zooming:**

- Desktop: Scroll wheel zooms toward mouse cursor
- Mobile: Pinch gesture zooms toward touch midpoint
- Maintains cursor/touch position during zoom (zoom-to-point)
- Clamps to min/max zoom levels
- Recalculates bounds after zoom

### Dynamic Zoom Limits

**Minimum Zoom:**

- Calculated to fit entire map in viewport
- Allows 30% additional zoom out (0.7x multiplier)
- Recalculates on window resize

**Maximum Zoom:**

- Fixed at 2x (200%)
- Allows close inspection of tiles

**Initial Zoom (NEW!):**

- **Desktop**: Starts at minimum zoom to see full map
- **Mobile**: Starts at 1.2x for comfortable tap size
  - Larger tiles make it easier to tap accurately
  - Better for touch-based interaction

---

## Selection System

### Visual Feedback

**Overlay Colors (NEW!):**

- **Gold semi-transparent**: Tile with movable armies (>1 army) or player's capital
- **Gray semi-transparent**: Tile without movable armies (1 army only)
- Applied to selected tile to make selection more obvious

**Border Colors:**

- **Gold (#ffd700)**: Selected tile with movable armies (>1 army)
- **Gray (#888888)**: Selected tile without movable armies (1 army)
- **White (#FFF)**: Unselected tiles (normal border)

**Border Width:**

- **3px**: Selected tile
- **2px**: Current player's capital (persistent, even when not selected)
- **1px**: All other unselected tiles

**Glow Effect:**

- Selected tiles have shadow blur (10px scaled by zoom)
- Bright gold glow for movable tiles
- Gray glow for immovable tiles

### Special Tile Borders

**Player's Capital:**

- Persistent gold/white border even when not selected
- Stronger border (2px) to remain visible
- Glows gold when selected, white when not selected

**Enemy Capitals:**

- Only show border when selected
- No persistent border (unlike player's capital)
- Standard selection colors apply

---

## Tile Interaction Rules

### Selection Priority

1. **No tile selected → Click owned tile**: Activates that tile
2. **No tile selected → Click non-owned**: No action
3. **Tile selected → Alt/Shift/Right-click**: Changes selection only (no intent)
4. **Tile selected → Click adjacent**: Immediate move/attack
5. **Tile selected → Click distant**: Launch intent (if visible)

### Movement Requirements

**Minimum Armies:**

- Must have >1 army on source tile to move
- 1 army always remains on source tile
- Moving armies = Total - 1

**Visibility:**

- Can only interact with visible tiles
- Fog of war hides enemy positions
- Discovered tiles remain visible (but army counts may be outdated)

**Terrain:**

- Cannot move through mountains
- Cannot click mountains (no action)
- Cannot target mountains in intents

### Sound Feedback

**Movement Sounds:**

- **captureUnowned**: Capturing neutral/empty territory
- **moveToOwned**: Moving to owned territory
- **attackSpecial**: Attacking city/tower
- **captureSpecial**: Successfully capturing city/tower
- **attackEnemy**: Attacking enemy territory
- **attackCapital**: Attacking enemy capital
- **captureCapital**: Capturing enemy capital
- **capitalLost**: Your capital was captured
- **territoryLost**: Your territory was captured
- **mountainAdjacent**: Attempted invalid mountain move
- **insufficientArmies**: Attempted move with insufficient armies
- **cycleTiles**: Spacebar tile cycling
- **armyBonus**: Turn 25 (and multiples) army bonus
- **gameStart**: Game beginning

---

## Special Interactions

### Spacebar Cycling

**Order of Tiles:**

1. Your capital (if alive)
2. Owned cities (in order discovered)
3. Captured enemy capitals (in order captured)

**Behavior:**

- Wraps to beginning after last tile
- Plays sound on each cycle
- Works even without current selection
- Skips to next if current tile already selected
- Updates camera to follow new selection

### Failed Move Behavior

**When Attack Fails:**

- Selected tile remains selected
- No selection change
- Allows retry without reselecting
- Visual feedback shows tile still active

**When Move Blocked:**

- Mountain target → Plays error sound
- Insufficient armies → Plays error sound
- Invalid target → No action
- Selection remains on original tile

---

## UI Control Buttons

### Game Management

**Join Controls:**

- **Join Button**: Visible when not joined, game not started
- **Leave Button**: Visible when joined, game not started
- **Abandon Button**: Visible when joined as player in active game
- **End Bot Game Button**: Visible to viewers when only bots remain

**Host Controls:**

- **Start Game Button**: Visible on overlay when host, 2+ players, not started
- **Transfer Host**: Available in player list for host to transfer to other player
- **Kick Bot**: Available in player list for host to remove bots

**Bot Invites:**

- **Invite Blob Bot**: Adds BlobBot to game
- **Invite Arrow Bot**: Adds ArrowBot to game
- **Invite Spiral Bot**: Adds SpiralBot to game

### Sidebar Controls

**Tab Switching:**

- **Controls Tab**: Player list, game controls, bot invites
- **Chat Tab**: Chat messages and input
- **Options Tab**: Sound settings and preferences

**Sidebar Toggle:**

- Gear icon in header collapses/expands sidebar
- Canvas resizes automatically when sidebar toggles
- Mobile: Use tab bar instead of sidebar

---

## Mobile-Specific Features

### Touch Thresholds

- **Tap threshold**: 0px movement (instant tap)
- **Drag threshold**: 10px movement to activate panning
- **Long press duration**: 500ms hold time
- **Zoom pinch minimum**: 2 fingers required

### Performance Considerations

- Touch move throttling prevents excessive events
- Pinch zoom calculated only on finger movement
- Canvas resize debounced on tab switch
- Haptic feedback on long press (if supported)

### Mobile Tab Bar

**Always Visible:**

- Fixed to bottom of screen
- Three tabs: Game, Controls, Chat
- Active tab highlighted
- Smooth transitions between views

**Layout Adjustments:**

- Game canvas expands to available space
- Chat input optimized for mobile keyboards
- Player list condensed for small screens
- Touch targets enlarged for fingers (44px minimum)

---

## Accessibility Features

### Visual Feedback

- High contrast borders (gold, white, gray)
- Color-coded player territories
- Animated glow on selection
- Clear visual hierarchy

### Keyboard Navigation

- Tab to focus canvas
- Arrow keys for movement
- Spacebar for quick navigation
- All controls keyboard accessible

### Touch Accessibility

- Large touch targets (tiles scaled by zoom)
- Haptic feedback on long press
- Clear visual feedback on tap
- Gesture-based controls intuitive

### Screen Reader Considerations

- Semantic HTML structure
- ARIA labels on buttons
- Descriptive alt text
- Keyboard-only navigation possible

---

## Advanced Techniques

### Efficient Movement

1. **Use Spacebar**: Quickly cycle to important tiles
2. **Intent System**: Set distant targets and let pathfinding handle it
3. **Keyboard Movement**: Faster than clicking for adjacent moves
4. **Right-Click Selection**: Avoid accidental movements when switching tiles

### Camera Management

1. **Zoom Out**: See battlefield overview
2. **Zoom In**: Precise army counts and positioning
3. **Pan Ahead**: Scout fog of war boundaries
4. **Center on Action**: Use spacebar to jump to key tiles

### Mobile Optimization

1. **Long Press**: Prevents accidental movements
2. **Two-Finger Drag**: Pan while zoomed in
3. **Pinch Zoom**: Quick battlefield overview
4. **Tab Bar**: Fast context switching

---

## Troubleshooting

### Controls Not Working

**Desktop:**

- Ensure canvas is focused (click canvas)
- Check if Shift key is stuck (release and press again)
- Verify JavaScript is enabled
- Try refreshing page

**Mobile:**

- Ensure touch events are not blocked
- Check if page is responsive (resize browser)
- Verify browser supports touch events
- Try portrait/landscape orientation

### Camera Issues

- **Stuck Camera**: Click and drag to reset
- **Won't Zoom**: Check min/max zoom limits reached
- **Wrong Position**: Zoom out to see full map, then zoom in
- **Jerky Movement**: Smooth interpolation may need adjustment

### Selection Issues

- **Can't Select Tile**: Verify tile is owned and visible
- **Intent Not Launching**: Check armies >1 and target visible
- **Spacebar Not Working**: Focus canvas by clicking it
- **Wrong Tile Selected**: Use right-click or long press for precise selection

---

## Summary Table

| Action                    | Desktop               | Mobile                    |
| ------------------------- | --------------------- | ------------------------- |
| **Select Tile**           | Left Click            | Tap                       |
| **Move Adjacent**         | Click/Arrow Keys/WASD | Tap                       |
| **Launch Intent**         | Click Distant Tile    | Tap Distant Tile          |
| **Select Without Intent** | Alt/Shift + Click     | Long Press (500ms)        |
| **Cancel Selection**      | Right Click           | Long Press on Empty/Enemy |
| **Pan Camera**            | Shift + Drag          | Single Finger Drag        |
| **Zoom In/Out**           | Scroll Wheel          | Pinch Gesture             |
| **Cycle Tiles**           | Spacebar              | (Not available)           |
| **Directional Move**      | WASD/Arrow Keys       | (Not available)           |
| **Switch Views**          | (Not applicable)      | Tab Bar                   |
| **Haptic Feedback**       | (Not available)       | Long Press                |
| **Multi-Touch Zoom**      | (Not available)       | Two Finger Pinch          |

---

## Keyboard Shortcuts Reference

| Key               | Action                               |
| ----------------- | ------------------------------------ |
| **Spacebar**      | Cycle through owned tiles            |
| **W / ↑**         | Move armies up                       |
| **S / ↓**         | Move armies down                     |
| **A / ←**         | Move armies left                     |
| **D / →**         | Move armies right                    |
| **Shift (hold)**  | Enable camera pan mode (grab cursor) |
| **Shift + Drag**  | Pan camera                           |
| **Scroll Wheel**  | Zoom in/out                          |
| **Alt + Click**   | Select tile without launching intent |
| **Shift + Click** | Select tile without launching intent |
| **Right Click**   | Select tile without launching intent |
| **Middle + Drag** | Pan camera (alternative)             |

---

## Mouse Button Reference

| Button           | Action                             |
| ---------------- | ---------------------------------- |
| **Left**         | Select tile / Move armies          |
| **Right**        | Select without intent / Pan camera |
| **Middle**       | Pan camera                         |
| **Left + Shift** | Pan camera                         |
| **Scroll Wheel** | Zoom in/out                        |

---

## Implementation Details

### Canvas Coordinate System

- **Screen Coordinates**: Mouse/touch position in pixels relative to canvas
- **World Coordinates**: Position in game space accounting for camera and zoom
- **Tile Coordinates**: Grid position (row, column) on the game board
- **Device Pixel Ratio**: Handled for high-DPI displays (1:1 pixel mapping)

### Event Handling

- **Canvas Focus**: Required for keyboard events
- **Event Bubbling**: Prevented for touch events to avoid conflicts
- **Throttling**: Touch move events throttled to improve performance
- **Debouncing**: Canvas resize debounced to prevent excessive redraws

### State Management

- **Selection State**: `selectedTile` (index or null)
- **Intent State**: `activeIntent` (path object or null)
- **Camera State**: Position (x, y), zoom, targets, smoothing
- **Touch State**: Touch points, drag tracking, long press timers
- **Cycling State**: `cycleIndex` for spacebar cycling

---

## Future Enhancements

### Potential Desktop Features

- Mouse gestures for advanced commands
- Hotkeys for quick bot actions
- Customizable keybindings
- Mouse sensitivity settings

### Potential Mobile Features

- Three-finger gestures for special actions
- Swipe to cycle through tiles
- Double-tap to zoom to tile
- Shake to recenter camera

### Cross-Platform

- Unified control scheme with platform adapters
- Custom gesture recognition system
- Haptic feedback on desktop (gamepad)
- Voice commands for accessibility
