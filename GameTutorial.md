# Game Tutorial - Design Document

## Overview

An interactive, guided tutorial accessible from the home page that teaches players everything about Fog of War through hands-on experience. Players can skip steps, quit anytime, and replay individual lessons.

---

## Tutorial Structure & Scope

### Key Requirements

- **Comprehensive**: Cover all game mechanics (10+ steps)
- **Skippable**: Players can skip steps or quit anytime
- **Optional**: Always available but not required
- **Replayable**: Access individual lessons from home page
- **Interactive**: Hands-on guided experience, not just text

### Success Criteria

- Complete tutorial by winning against a weak bot
- Award confetti celebration (using konami code confetti system)

---

## Terminology Updates

**Replace ALL "general" references with "capital":**

- `generals` array → `capitals` array
- Socket events: `generalCaptured` → `capitalCaptured`
- UI text: "general" → "capital"
- Comments and documentation
- Keep gold gradient visual for player's capital

---

## Tutorial Lessons

### Lesson 1: Welcome & Your Capital

**Goal**: Understand your starting position and the capital concept

**Setup**:

- Small 10x10 map
- Player capital at center
- Frozen time
- No fog of war for first lesson

**Steps**:

1. Welcome message: "Welcome to Fog of War! You command armies to conquer territory."
2. Highlight player's capital (gold tile) with pulsing border
3. Explain: "This is your CAPITAL - your home base. Protect it!"
4. Show army counter: "The number shows how many armies you have here"
5. Explain capital generates +1 army per turn
6. **Action**: "Click your capital to select it" (require action to proceed)

**Visual Guidance**:

- Pulsing gold border on capital
- Arrow pointing to capital
- Dim all other UI elements
- Show tooltip with capital info

---

### Lesson 2: Moving Armies

**Goal**: Learn basic movement mechanics

**Setup**:

- Same map, capital selected from Lesson 1
- Empty tiles adjacent to capital

**Steps**:

1. Explain: "You need >1 army to move. Your capital has armies ready!"
2. Highlight adjacent empty tiles with pulsing borders
3. Explain: "When you move, all armies except 1 will move to the new tile"
4. **Action**: "Click an adjacent tile to move armies" (require action)
5. Show animation of armies moving
6. Toast notification: "Great! You've conquered new territory"

**Visual Guidance**:

- Pulsing borders on valid move targets
- Arrow from capital to adjacent tiles
- Dim non-actionable tiles
- Show army count change during move

---

### Lesson 3: Territory Expansion

**Goal**: Learn about territory control and expansion

**Setup**:

- Player now has capital + 1 adjacent tile
- More empty tiles available

**Steps**:

1. Explain: "More territory = more power. But you need armies to hold it!"
2. Show: "Each tile you control is your territory (shown in your color)"
3. Explain turn counter: "Every turn, your capital generates +1 army"
4. Advance 3 turns (show counter incrementing)
5. Explain 25-turn bonus: "Every 25 turns, ALL your tiles get +1 army"
6. **Action**: "Expand to 3 more tiles" (require expanding to 5 total tiles)

**Visual Guidance**:

- Highlight tiles you can reach
- Show turn counter with explanation tooltip
- Progress indicator: "0/3 tiles captured"
- Celebrate each capture with sound

---

### Lesson 4: Fog of War

**Goal**: Understand vision mechanics

**Setup**:

- Enable fog of war
- Player has 5 tiles
- Mystery tiles beyond their vision

**Steps**:

1. Reveal fog: "Notice the gray shimmer? That's the FOG OF WAR"
2. Explain: "You can only see your territory + adjacent tiles"
3. Show: "Tiles you've discovered remain visible (but armies update only when in sight)"
4. Explain: "Enemy positions are hidden in the fog"
5. **Action**: "Expand further to discover new territory" (reveal 3 fog tiles)

**Visual Guidance**:

- Animated shimmer on fog tiles
- Highlight vision boundary
- Show before/after of fog revealing
- Tooltip explaining fog mechanics

---

### Lesson 5: Special Structures - Cities

**Goal**: Learn about cities and their benefits

**Setup**:

- Place 1 city (neutral, red gradient) near player
- City has 40 armies

**Steps**:

1. Highlight city with pulsing border
2. Explain: "Cities are valuable! They generate +1 army per turn when captured"
3. Show city icon and red gradient
4. Warn: "Cities have 40 armies defending them - you need >40 to capture"
5. Explain: "All your armies (except 1) attack when you move"
6. **Action**: "Build up armies and capture the city" (wait for accumulation + capture)

**Visual Guidance**:

- City icon pulses
- Show required army count vs current count
- Progress bar of army accumulation
- Celebration toast on capture

---

### Lesson 6: Special Structures - Towers

**Goal**: Learn about lookout towers and extended vision

**Setup**:

- Place 1 tower (neutral, blue gradient) near player
- Tower has 25 defense

**Steps**:

1. Highlight tower with pulsing border
2. Explain: "Lookout Towers have 25 defense AND provide vision"
3. Show: "Captured towers give you 5-tile vision radius"
4. Demonstrate vision radius visually
5. Explain: "Tower vision is permanent - discovered tiles stay visible"
6. **Action**: "Capture the tower" (require >25 armies + capture)

**Visual Guidance**:

- Tower icon pulses
- Show 5-tile radius overlay
- Animate vision expansion on capture
- Dim fog tiles that will be revealed

---

### Lesson 7: Combat Basics

**Goal**: Understand attack mechanics

**Setup**:

- Introduce weak bot opponent with small territory
- Bot has 3-4 tiles, 10 armies total

**Steps**:

1. Explain: "Enemy territory is shown in different colors"
2. Show bot's territory in different color
3. Explain combat: "Your armies fight their armies. Highest count wins!"
4. Explain: "Winner keeps (attacker - defender) armies on captured tile"
5. Show example calculation
6. **Action**: "Attack and capture 2 enemy tiles"

**Visual Guidance**:

- Highlight enemy tiles
- Show attack math in tooltip
- Animate combat results
- Display remaining armies after battle

---

### Lesson 8: Win Condition - Capturing the Capital

**Goal**: Learn the ultimate objective

**Setup**:

- Bot's capital revealed (silver gradient)
- Player has tactical advantage

**Steps**:

1. Highlight bot's capital with dramatic pulsing
2. Explain: "The CAPITAL is the key! Capture it to eliminate a player"
3. Warn: "If YOUR capital is captured, you lose!"
4. Show: "Enemy capitals are marked with silver gradient"
5. Explain: "Capitals also generate +1 army per turn"
6. **Action**: "Capture the bot's capital to win!" (require capital capture)

**Visual Guidance**:

- Bot capital has intense silver pulsing
- Arrow pointing to bot capital
- Show suggested attack path
- Victory confetti on success!

---

### Lesson 9: Advanced Movement - Intent System

**Goal**: Learn pathfinding and efficient movement

**Setup**:

- Medium 15x15 map
- Player has capital + scattered territory
- Target tile far away

**Steps**:

1. Explain: "Click distant tiles to launch an INTENT"
2. Show: "Your armies automatically pathfind to the target"
3. Demonstrate: Click distant tile → see red dashed path
4. Explain: "Intent movement happens step-by-step each turn"
5. Show Alt/Shift+click: "Hold Alt or Shift to select without moving"
6. **Action**: "Use intent to move armies across the map" (click distant tile)

**Visual Guidance**:

- Highlight distant target
- Show red dashed pathfinding line
- Animate step-by-step movement
- Show keyboard modifier tooltips

---

### Lesson 10: Keyboard & Camera Controls

**Goal**: Master efficient controls

**Setup**:

- Full-sized map
- Player territory spread out

**Steps**:

1. Explain keyboard controls: "WASD or Arrow keys to move"
2. Demonstrate spacebar: "Press Space to cycle through important tiles"
3. Show: Spacebar cycles capital → cities → captured enemy capitals
4. Explain camera: "Shift+drag to pan, scroll to zoom"
5. Explain: "Right-click selects tile without moving"
6. **Action**: "Use spacebar to cycle 3 times, then use keyboard to move"

**Visual Guidance**:

- Keyboard graphic overlay
- Show key bindings in corner
- Highlight tiles as spacebar cycles
- Camera control tutorial

---

### Lesson 11: Strategy Tips

**Goal**: Understand basic strategy concepts

**Setup**:

- Strategic scenario with choices

**Steps**:

1. Explain army density: "Tiles/Armies ratio matters"
2. Show: "Expand too fast = weak defense. Too slow = enemy grows"
3. Explain: "Cities and towers are force multipliers"
4. Show turn 25 bonus timing
5. Tip: "Stack armies on frontlines before attacking"
6. Tip: "Protect your capital at all costs"
7. **Action**: "Read tips" (no action required, auto-advance)

**Visual Guidance**:

- Split-screen showing good vs bad strategies
- Animated examples
- Stats comparison overlay

---

### Lesson 12: Final Challenge

**Goal**: Put it all together and win!

**Setup**:

- 15x15 map
- Player vs 1 weak bot (BlobBot with limited turns)
- 2 cities, 1 tower on map
- Real-time game (unfrozen)

**Steps**:

1. Explain: "This is a real match! Beat the bot to complete the tutorial"
2. Remind: "Capture cities for income, towers for vision"
3. Remind: "Capture their capital to win!"
4. Show: All UI controls available
5. Game runs normally (but bot is intentionally weak)
6. **Victory**: Confetti celebration + completion message

**Visual Guidance**:

- All visual helpers disabled (play like real game)
- Optional hint system if stuck for 60 seconds
- Show turn counter and stats
- Massive celebration on win!

---

## Technical Integration

### Routes

- `/tutorial` - Main tutorial page
- `/tutorial/:lesson` - Individual lesson replay

### Home Page Updates

**Current form improvement:**

```html
<!-- Replace existing form with better styling -->
<div class="home-actions">
  <button class="btn btn-primary btn-large" onclick="location.href='/tutorial'">
    🎓 Start Tutorial
  </button>
  <form id="lobbyForm" class="lobby-form">
    <input name="lobbyName" placeholder="Enter lobby name" />
    <button type="submit" class="btn btn-secondary">Play Now →</button>
  </form>
</div>
```

**First-time visitor prompt:**

- Check `localStorage.getItem('tutorial-prompted')`
- Show one-time toast: "New to Fog of War? Try the tutorial!"
- Set `localStorage.setItem('tutorial-prompted', 'true')`

### Progress Tracking

**localStorage keys:**

- `tutorial-completed`: boolean
- `tutorial-current-lesson`: number (1-12)
- `tutorial-lessons-completed`: array of completed lesson numbers
- `tutorial-prompted`: boolean (one-time home page prompt)

### Visual Components

**Tutorial Overlay System:**

```javascript
class TutorialOverlay {
  showMessage(text, options = {}) {
    // Display message box with text
    // Options: position, arrow, highlight, dim
  }

  highlightElement(selector, pulse = true) {
    // Add pulsing golden border
  }

  showArrow(fromX, fromY, toX, toY) {
    // Animated arrow overlay
  }

  dimBackground(exceptSelectors = []) {
    // Darken everything except specified elements
  }

  showProgressBar(current, total) {
    // Progress: Lesson X of 12
  }
}
```

**Tutorial Game State:**

```javascript
class TutorialGame {
  constructor(lessonNumber) {
    this.frozen = true; // Can pause time
    this.allowedActions = ["click"]; // Restrict what player can do
    this.lessonNumber = lessonNumber;
    this.setupLesson();
  }

  setupLesson() {
    // Configure map, bots, structures for this lesson
  }

  checkCompletion() {
    // Verify lesson objectives met
  }
}
```

### Success Celebration

**Confetti System** (reuse from konami.js):

```javascript
// On tutorial completion
confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
});
showToast("Tutorial Complete! You're ready to play!", "success", 5000);
localStorage.setItem("tutorial-completed", "true");
```

---

## User Experience Flow

### First-Time User Flow

1. Visit home page → See tutorial button + one-time toast prompt
2. Click "Start Tutorial" → Route to `/tutorial`
3. See welcome screen with lesson list
4. Click "Begin" → Start Lesson 1
5. Complete lessons sequentially (can skip/quit anytime)
6. Reach Lesson 12 → Final challenge
7. Beat bot → Confetti + completion message
8. Option: "Play Real Game" or "Replay Lessons"

### Returning User Flow

1. Visit home page → Tutorial button available (no prompt)
2. Option A: Click tutorial → See completed lessons checklist → Choose replay
3. Option B: Go straight to playing

### In-Tutorial Navigation

- **Header**: "Lesson X of 12" with progress bar
- **Buttons**: [Skip Lesson] [Quit Tutorial] [Next →]
- **Skip**: Marks lesson as skipped, advances to next
- **Quit**: Returns to home page, saves progress
- **Next**: Only enabled when lesson objectives met

---

## Sound Design

### Tutorial-Specific Sounds

- Lesson start: Gentle chime
- Objective complete: Success arpeggio (reuse existing)
- Step advance: Soft click (reuse existing)
- Tutorial complete: Triumphant fanfare + confetti
- Hint appears: Gentle notification sound

### Existing Sound Reuse

- Movement: Existing game sounds
- Combat: Existing attack/capture sounds
- UI: Existing click/error sounds

---

## Accessibility Considerations

- All text instructions also shown visually
- Tooltips for color-blind users (not just color coding)
- Keyboard navigation through tutorial steps
- Option to replay any instruction
- Skip button always available
- Clear progress indicators

---

## Development Phases

### Phase 1: Core Infrastructure

- Create `/tutorial` route and page
- Build TutorialOverlay component
- Implement lesson state management
- Add home page button and styling

### Phase 2: Basic Lessons (1-4)

- Implement Lessons 1-4 (basics)
- Test freeze/unfreeze mechanics
- Verify visual guidance works
- Test skip/quit functionality

### Phase 3: Advanced Lessons (5-8)

- Implement Lessons 5-8 (structures, combat)
- Add weak bot opponent
- Test combat scenarios
- Verify city/tower mechanics

### Phase 4: Expert Lessons (9-11)

- Implement Lessons 9-11 (advanced controls)
- Add intent pathfinding tutorial
- Keyboard control training
- Strategy tips display

### Phase 5: Final Challenge (12)

- Implement full game scenario
- Balance bot difficulty
- Add celebration sequence
- Test completion flow

### Phase 6: Polish

- Improve home page form styling
- Add localStorage persistence
- Implement first-time prompt
- Add replay functionality
- Comprehensive testing

---

## Open Questions for Implementation

1. Should we create a new tutorial-specific bot class that's intentionally weak?
2. Do we need a tutorial-specific map generator for consistent lesson layouts?
3. Should confetti use canvas overlay or DOM elements?
4. How detailed should arrow overlays be (simple SVG or animated)?
5. Should we add voice narration option for accessibility?

---

## Success Metrics

- Tutorial completion rate
- Average time to complete
- Most frequently skipped lessons (identify problem areas)
- Tutorial → active player conversion rate
- Replay frequency per lesson
