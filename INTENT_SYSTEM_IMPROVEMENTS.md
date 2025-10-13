# Intent System Improvements & UX Analysis

## Intent System Analysis

### Current Intent Flow (Problematic)

```
User clicks distant tile → Check if source has >1 army
  ├─ YES → Launch intent, armies move automatically
  └─ NO → Nothing happens, user must:
           1. Click to deselect current tile
           2. Find and click tile with armies
           3. Click distant target again
```

**Pain Points**:

- Requires 3 clicks when it should be 1
- Forces user to manually find a viable source
- Breaks flow when armies are exhausted
- Especially frustrating on mobile (harder tapping)

---

## Proposed Solutions

### Option A: Smart Source Auto-Selection

**Concept**: When user clicks distant target without valid source, automatically select best source tile.

**Selection Criteria** (in priority order):

1. **Player's capital** [Never automatically draw from capital (too risky). Users can override by explicitly activating the capital before launching an intent.]
2. **Nearest owned city** (if has >1 army) - Strategic strongpoints
   [Always choose nearest city unless a closer (as the crow flies) owned tile has more armies than the city.]
3. **Nearest owned tile with >1 army** - Any valid source

**Pros**:

- Reduces clicks from 3 to 1
- Smart defaults work for most cases
- Maintains single source → target model (familiar)
- Easy to understand visually

**Cons**:

- May not always pick the source user wanted
- Requires visual feedback to show auto-selected source [let's increase the visibility of selected tile, it currently has a gold border, but that could be more visible. Let's try making the active tile "Glow"].
- Need override mechanism (Alt/Shift + click to force different source) [just explicitly activate a tile to override the source tile]

**Implementation**:

```javascript
function handleDistantTileClick(targetTile) {
  // If no source or source invalid
  if (selectedTile === null || gameState.armies[selectedTile] <= 1) {
    // Auto-select best source
    const bestSource = findBestIntentSource(targetTile);
    if (bestSource !== null) {
      setSelectedTile(bestSource);
      // Visual feedback: briefly highlight auto-selected source
      showAutoSelectionFeedback(bestSource);
      // Then launch intent
      launchIntent(bestSource, targetTile);
    }
  }
}
```

**Recommendation**: ✅ **This is the best solution** - Simple, intuitive, handles 90% of cases well.

---

### Option B: Multi-Source Gathering Intent [Let's scrap Option B altogether]

**Concept**: No single source tile. Instead, intent gathers armies from ALL nearby owned tiles along the path.

**How It Works**:

1. User clicks distant target
2. System calculates path to target
3. Each turn, ALL owned tiles along path contribute armies toward target
4. Creates a "wave" of armies flowing toward target

**Pros**:

- No source selection needed at all
- More realistic military movement (reinforcements from multiple areas)
- Visually impressive (wave effect)
- Works great for large territory captures

**Cons**:

- **Complexity**: Much harder to implement and understand
- **Unpredictable**: User can't easily see which tiles will contribute
- **Strategic loss**: Can't choose to preserve specific tiles
- **Over-mobilization**: Might pull armies from tiles you wanted to keep defended

**Recommendation**: ❌ **Too complex for the benefit** - Better as an optional advanced feature, not default behavior.

---

### Option C: Hybrid Smart System

**Concept**: Combine auto-selection with optional gathering.

**Default Behavior** (Auto-Selection):

- Single source as in Option A
- Works for 90% of cases

**Advanced Option** (Gathering Mode):

- Hold modifier key (Ctrl/Cmd on desktop, two-finger tap on mobile)
- Enables gathering from multiple sources
- Shows preview of which tiles will contribute
- User confirms or cancels

**Pros**:

- Best of both worlds
- Simple for beginners (auto-selection)
- Powerful for advanced players (gathering)
- Progressive complexity

**Cons**:

- More code to maintain
- Requires UI to explain gathering mode
- Risk of confusing new players

**Recommendation**: 🔶 **Good for v2.0** - Start with Option A, add gathering mode later if users request it. [Let's scrap this idea altogether, too complex]

---

## Path Preference System

### Current Path Algorithm

```javascript
// Weighted pathfinding
- Owned territory: 0.5 cost (preferred)
- Neutral/empty: 1.0 cost (normal)
- Unknown (fog): 1.2 cost (slight penalty)
- Avoid special tiles: 3.0 cost (cities, towers, capitals)
```

### Proposed Path Modes

#### 1. Conservative (Current Default)

**Goal**: Minimize risk, stay on owned territory

```javascript
costs = {
  owned: 0.5,
  neutral: 1.0,
  fog: 1.2,
  enemy: 2.0,
  special: 3.0,
};
```

**Best For**: Defending territory, maintaining supply lines, safe expansion

---

#### 2. Aggressive

**Goal**: Shortest path to target, ignore risk

```javascript
costs = {
  owned: 1.0,
  neutral: 1.0,
  fog: 1.0,
  enemy: 1.1, // Only slight penalty
  special: 1.2, // Go through specials if shorter
};
```

**Best For**: Rushing enemy capital, surprise attacks, time-critical moves

---

#### 3. Gathering

**Goal**: Collect armies along the way

```javascript
// Path through tiles WITH armies, even if longer
costs = {
  owned_with_armies: 0.3, // Strongly prefer
  owned_empty: 1.5, // Avoid empty tiles
  neutral: 1.0,
  fog: 1.2,
  enemy: 2.0,
  special: 3.0,
};
```

**Best For**: Building up force for big attack, consolidating scattered armies

---

#### 4. Efficient

**Goal**: Balance between safe and fast

```javascript
costs = {
  owned: 0.7,
  neutral: 1.0,
  fog: 1.3,
  enemy: 1.8,
  special: 2.0,
};
```

**Best For**: General gameplay, good default for most situations

---

### UI Control Options

#### Desktop Implementation

**Option 1: Number Keys (Hotkeys)**

```
Press 1-4 while launching intent to select mode:
1 = Conservative (default)
2 = Aggressive
3 = Gathering
4 = Efficient

Hold number key + click target = Launch with that mode
```

**Pros**: Fast, doesn't require UI space, familiar to gamers
**Cons**: Not discoverable, requires tutorial

---

**Option 2: Modifier Keys**

```
Normal click = Conservative (default)
Shift + click = Aggressive
Alt + click = Gathering
Ctrl + click = Efficient
```

**Pros**: Uses existing modifier system, consistent with other modifiers
**Cons**: Conflicts with current Shift (pan) and Alt (select without intent)

---

**Option 3: Radial Menu** [Let's do this one, for mobile and desktop. There should still be a quick action (most basic click/tap) to just launch the intent with the default algorithm (setting for default algorithm in preferences) and then it would just require some extra control of some sort to open the radial menu to launch one of the 4 algorithmic intents]

```
Right-click target → Shows radial menu with 4 modes
Select mode → Intent launches with that mode
Middle click = Last used mode
```

**Pros**: Visual, discoverable, doesn't conflict with other controls
**Cons**: Extra click, slower, requires mouse precision

---

#### Mobile Implementation

**Option 1: Tap-and-Hold Menu**

```
Long press target (500ms) → Shows mode selector overlay
Tap mode icon → Intent launches with that mode
```

**Pros**: Natural mobile pattern, visual feedback
**Cons**: Slower than quick tap

---

**Option 2: Mode Toggle Button**

```
Persistent button in UI showing current mode
Tap to cycle through modes: Conservative → Aggressive → Gathering → Efficient
Intent launches with displayed mode
```

**Pros**: Always visible, clear current state, single tap to change
**Cons**: Takes up UI space, extra tap before intent

---

**Option 3: Swipe Direction**

```
Swipe up on target = Conservative
Swipe down on target = Aggressive
Swipe left on target = Gathering
Swipe right on target = Efficient
```

**Pros**: Fast, gestural, no UI space
**Cons**: Hard to discover, easy to misfire, conflicts with pan gestures

---

### Settings Persistence

#### Persistent Settings (Local Storage)

**What to Save**:
[Let's only add a setting for their default intent algorithm]

```javascript
const intentSettings = {
  defaultMode: "conservative", // User's preferred default
  mobileZoomLevel: 1.2, // Mobile starting zoom
  showIntentPreview: true, // Show path preview before launching
  autoSelectSource: true, // Enable smart source selection
  gatheringRadius: 3, // How many tiles to gather from (if gathering mode)
  soundEnabled: true, // Sound preferences
  sounds: {
    /* granular sound settings */
  },
};
```

**Storage Method**: [We already have some preference persistinance set up, make sure you view that.]

```javascript
// Save settings
localStorage.setItem("fogOfWarSettings", JSON.stringify(intentSettings));

// Load on game start
const savedSettings = JSON.parse(localStorage.getItem("fogOfWarSettings"));
```

**Settings UI Location**: Options tab in sidebar

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (Immediate) [Go ahead with phase 1]

1. ✅ **Fix mobile zoom** - Start at 1.2x instead of min zoom
2. ✅ **Smart source auto-selection** - Implement Option A for intents
3. ✅ **Visual feedback** - Show which tile was auto-selected (brief highlight)

### Phase 2: Path Modes (Next)

4. ✅ **Implement 4 path modes** - Conservative, Aggressive, Gathering, Efficient
5. ✅ **Desktop control** - Number keys (1-4) to select mode while clicking
6. ✅ **Mobile control** - Mode toggle button in UI
7. ✅ **Visual preview** - Show path preview with cost visualization

### Phase 3: Settings & Polish (Later)

8. 🔶 **Settings persistence** - Save user preferences to local storage
9. 🔶 **Advanced options** - Fine-tune gathering radius, path costs
10. 🔶 **Tutorial** - Interactive lessons for new path modes
11. 🔶 **Statistics** - Show path costs, estimated turns, etc.

### Phase 4: Advanced Features (Optional)

12. ❌ **Multi-source gathering** - Only if users request it
13. ❌ **Custom path algorithms** - Power user feature
14. ❌ **Path replay** - Show historical intent paths

---

## UX Recommendations Summary

### 1. Mobile Zoom (Do Now) ✅

```javascript
// Simple fix, huge UX improvement
if (isMobile) {
  camera.zoom = 1.2; // Comfortable tap size
}
```

### 2. Smart Source Selection (Do Now) ✅

```javascript
// When no valid source, auto-select best one
// Priority: Capital → Cities → Strong tiles → Any tile
function findBestIntentSource(targetTile) {
  // Implementation in next section
}
```

**Why This First**:

- Solves the 3-click problem immediately
- No new UI needed
- Works for 90% of use cases
- Can refine algorithm based on feedback

### 3. Path Modes (Do Next) ✅

**Desktop**: Number keys 1-4

```
1 = Conservative (safe, owned territory)
2 = Aggressive (fastest, risky)
3 = Gathering (collect armies)
4 = Efficient (balanced)
```

**Mobile**: Toggle button

```
[🛡️ Conservative] ← Tap to cycle
```

**Why Number Keys for Desktop**:

- Fast (hold key + click = instant mode switch)
- Doesn't conflict with existing controls
- Familiar pattern for gamers (weapon switching, etc.)
- Easy to show in UI ("Press 1-4 for path mode")

**Why Toggle Button for Mobile**:

- Always visible (discoverability)
- Single tap (simplicity)
- Clear current state
- Doesn't require gestures

### 4. Settings Persistence (Do Later) 🔶

Save to localStorage:

- Default path mode
- Mobile zoom preference
- Sound settings
- UI preferences

**Why Later**:

- Not critical for core gameplay
- Need to see what users actually customize
- Risk of premature optimization

---

## Implementation Priority

### Critical (Week 1)

1. Mobile zoom fix
2. Smart source auto-selection
3. Visual feedback for auto-selection

### Important (Week 2)

4. Path mode algorithms
5. Number key controls (desktop)
6. Mode toggle button (mobile)
7. Path preview visualization

### Nice to Have (Week 3+)

8. Settings persistence
9. Advanced path customization
10. Tutorial for new features
11. Statistics and analytics

---

## Code Architecture Notes

### Source Selection Algorithm

```javascript
function findBestIntentSource(targetTile) {
  const targetRow = Math.floor(targetTile / gameState.width);
  const targetCol = targetTile % gameState.width;

  // Priority 1: Player's capital (if viable)
  const capitalPos = gameState.generals[playerIndex];
  if (capitalPos >= 0 && gameState.armies[capitalPos] > 1) {
    return capitalPos;
  }

  // Priority 2: Nearest owned city with armies
  let nearestCity = null;
  let minCityDist = Infinity;
  gameState.cities?.forEach((cityPos) => {
    if (
      gameState.terrain[cityPos] === playerIndex &&
      gameState.armies[cityPos] > 1
    ) {
      const dist = manhattanDistance(cityPos, targetTile);
      if (dist < minCityDist) {
        minCityDist = dist;
        nearestCity = cityPos;
      }
    }
  });
  if (nearestCity !== null) return nearestCity;

  // Priority 3: Nearest tile with >5 armies
  // Priority 4: Nearest tile with >1 army
  // Implementation continues...
}
```

### Path Mode System

```javascript
const PathModes = {
  CONSERVATIVE: "conservative",
  AGGRESSIVE: "aggressive",
  GATHERING: "gathering",
  EFFICIENT: "efficient",
};

let currentPathMode = PathModes.CONSERVATIVE;

function getPathCosts(mode) {
  switch (mode) {
    case PathModes.CONSERVATIVE:
      return { owned: 0.5, neutral: 1.0, fog: 1.2, enemy: 2.0, special: 3.0 };
    case PathModes.AGGRESSIVE:
      return { owned: 1.0, neutral: 1.0, fog: 1.0, enemy: 1.1, special: 1.2 };
    case PathModes.GATHERING:
      return {
        owned_with_armies: 0.3,
        owned_empty: 1.5,
        neutral: 1.0,
        fog: 1.2,
        enemy: 2.0,
        special: 3.0,
      };
    case PathModes.EFFICIENT:
      return { owned: 0.7, neutral: 1.0, fog: 1.3, enemy: 1.8, special: 2.0 };
  }
}

// Desktop: Listen for number keys
document.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "4") {
    currentPathMode = Object.values(PathModes)[parseInt(e.key) - 1];
    // Show mode indicator briefly
    showModeIndicator(currentPathMode);
  }
});
```

---

## User Testing Questions

After implementing these changes, test with users:

1. **Mobile Zoom**: Do users still manually zoom after game start?
2. **Auto-Selection**: Do users notice when source is auto-selected? Does it pick the right tile?
3. **Path Modes**: Which mode do users prefer? Do they switch modes often?
4. **Discoverability**: Do users find the number keys? Do they understand path modes?
5. **Performance**: Any lag with path preview calculations?

---

## Conclusion

**Start with the simple, high-impact changes**:

1. Fix mobile zoom (10 minutes of work, huge improvement)
2. Add smart source selection (1-2 hours, eliminates major pain point)
3. Implement basic path modes (4-6 hours, adds strategic depth)

**Avoid complexity traps**:

- Don't build multi-source gathering until users ask for it
- Don't over-engineer settings until you know what needs customization
- Don't add UI until you've tested with number keys first

**Measure success**:

- Fewer clicks per intent (should drop from 3 to 1 in most cases)
- More intents launched (should increase as friction decreases)
- Positive user feedback about mobile experience
- Users experimenting with different path modes

**The best UX is invisible** - Users shouldn't think about the controls, they should just play.
