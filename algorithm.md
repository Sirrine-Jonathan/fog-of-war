# Perfect Bot Algorithm for Fog of War

## Executive Summary

This document outlines an optimal bot strategy for Fog of War that balances economic expansion, defensive positioning, army concentration, and aggressive capital targeting. The algorithm uses a phase-based approach with dynamic priority weighting based on game state.

---

## Core Principles

### 1. Economy Wins Games

- Cities generate 1 army per turn (40% of total generation potential)
- More production = exponential army advantage over time
- **Priority**: Capture neutral cities before engaging enemies

### 2. Information is Power

- Can only attack capitals you can see
- Lookout towers provide 5-tile vision radius
- **Priority**: Capture towers to discover enemy positions

### 3. Concentrated Force Beats Distributed Force

- 50 armies on one tile beats 10 armies on 5 tiles
- Must consolidate before major attacks
- **Priority**: Pull armies toward front lines

### 4. Capital Defense is Non-Negotiable

- Losing capital = instant elimination
- Must maintain defensive buffer
- **Priority**: Keep 20+ armies near capital at all times

---

## Algorithm Phases

The bot dynamically selects priorities based on game state analysis.

### Phase 1: Early Expansion (Turns 1-50)

**Goal**: Build economic foundation

**Priorities** (in order):

1. **Capture Neutral Cities** (Weight: 100)

   - Cities are the #1 economic target
   - Each city doubles your late-game potential
   - Path toward nearest uncaptured city

2. **Capture Lookout Towers** (Weight: 80)

   - Essential for finding enemy capitals
   - 5-tile radius reveals large map areas
   - Target towers that maximize unexplored territory

3. **Expand Territory** (Weight: 50)

   - Grow toward center of map
   - Avoid edges (dead ends)
   - Favor paths toward likely enemy capital locations

4. **Defensive Buffer** (Weight: 70)
   - Keep 3+ tiles between capital and any enemy
   - If enemy within 5 tiles of capital, STOP expanding and defend

### Phase 2: Mid Game (Turns 50-150)

**Goal**: Consolidate power and locate targets

**Priorities**:

1. **Army Consolidation** (Weight: 90)

   - Pull armies from rear territories toward borders
   - Create "strike forces" of 30+ armies
   - Leave minimum 2 armies per tile

2. **Vision Coverage** (Weight: 85)

   - Continue capturing towers
   - Probe fog of war boundaries
   - Search for enemy capitals systematically

3. **Opportunistic Captures** (Weight: 75)

   - Attack weak enemy territories (< 5 armies)
   - Capture remaining cities
   - Expand vision network

4. **Capital Defense** (Weight: 95)
   - Minimum 25 armies within 3 tiles of capital
   - If enemy armies > 40 within 8 tiles: emergency consolidation

### Phase 3: End Game (Turn 150+ or Enemy Capital Discovered)

**Goal**: Eliminate opponents

**Priorities**:

1. **Capital Assault** (Weight: 100)

   - Path armies toward enemy capital
   - Wait until 50+ armies before final attack
   - Coordinate multiple attack vectors if possible

2. **Capital Defense** (Weight: 100)

   - Match priority with offense
   - Keep defensive reserves mobile
   - Don't commit all armies to attack

3. **Economic Denial** (Weight: 60)
   - Capture or block enemy cities
   - Cut off enemy production

---

## Decision-Making Algorithm

### Move Selection Process

Each turn, the bot evaluates all possible moves using this scoring system:

```
For each owned tile with 2+ armies:
  For each adjacent tile:
    Calculate move_score based on multiple factors
  Select highest scoring move
Execute best move if score > threshold
```

### Move Scoring Formula

```
move_score =
  tile_type_value * 1.0 +
  strategic_position_value * 0.8 +
  army_efficiency * 0.6 +
  threat_response * 1.2 +
  phase_priority_bonus
```

#### Tile Type Values

| Tile Type                  | Value             | Reasoning                 |
| -------------------------- | ----------------- | ------------------------- |
| Neutral City               | 100               | Production multiplier     |
| Neutral Lookout Tower      | 80                | Vision = finding capitals |
| Enemy Capital (discovered) | 200               | Winning move              |
| Enemy City                 | 90                | Deny opponent economy     |
| Enemy Territory            | 50 + (armies / 2) | Weaken opponent           |
| Neutral Territory          | 30                | Expand vision/control     |
| Own Territory              | 10                | Army consolidation only   |

#### Strategic Position Values

**Distance from Capital** (defensive scoring):

- Within 3 tiles of capital: +40 (maintain buffer)
- 4-8 tiles from capital: +20 (defensive depth)
- 9+ tiles from capital: +0 (forward positions)

**Distance to Enemy Capital** (offensive scoring):

- If enemy capital known:
  - Moving closer: +(50 / distance)
  - Path toward capital: +30
  - Adjacent to capital: +100

**Map Position**:

- Center tiles: +15 (strategic control)
- Edge tiles: -10 (dead ends)
- Unexplored adjacent tiles: +10 per unexplored (vision gain)

#### Army Efficiency

```
attacker_armies = current_tile_armies - 1
defender_armies = target_tile_armies

if attacker_armies > defender_armies:
  efficiency = (attacker_armies - defender_armies) / attacker_armies
  army_efficiency = 50 * efficiency
else:
  army_efficiency = -100  # Don't attack if can't win
```

#### Threat Response

**Under Attack Detection**:

- Enemy within 5 tiles of capital: +80 (pull back to defend)
- Enemy within 3 tiles of capital: +150 (emergency defense)
- Own territory under attack: +60 (reinforce)

**Vulnerable Target**:

- Enemy tile with < 5 armies adjacent: +40 (easy capture)
- Enemy with armies > 50 adjacent: -50 (avoid strong enemy)

#### Phase Priority Bonus

Apply additional weights based on current phase:

- Early: +30 for cities, +20 for towers, +10 for expansion
- Mid: +40 for consolidation moves, +30 for vision
- Late: +50 for moves toward enemy capital

---

## Advanced Tactical Modules

### 1. Pathfinding to Capital

Once enemy capital is discovered, use A\* pathfinding:

```
function findPathToCapital(gameState, myIndex, enemyCapitalTile):
  start = tiles I own adjacent to unexplored/enemy territory
  goal = enemyCapitalTile

  heuristic = manhattan_distance(tile, goal)

  cost_function(tile):
    if tile is mountain: return INFINITY
    if tile is mine: return 0.5 (prefer own territory)
    if tile is neutral: return 1.0
    if tile is enemy: return 1.0 + (armies[tile] / 10)
    if tile is fog: return 1.5 (unknown risk)

  return A_star(start, goal, cost_function, heuristic)
```

### 2. Army Consolidation System

Pull armies from rear toward front lines:

```
function consolidateArmies(gameState, myIndex):
  // Identify front line (tiles adjacent to enemy/neutral)
  frontLine = myTiles where any adjacent is not mine

  // Identify rear tiles (far from front, > 3 armies)
  rearTiles = myTiles where distance_to_frontLine > 5 AND armies > 3

  // Move rear armies toward front
  for each rearTile:
    next_step = step_toward_nearest_frontLine_tile(rearTile)
    if armies[rearTile] > 2:
      queue_move(rearTile, next_step)
```

### 3. Capital Defense System

Maintain defensive perimeter:

```
function defendCapital(gameState, myIndex):
  myCapital = capitals[myIndex]

  // Count defensive armies
  defenseRadius = 3
  defensiveArmies = sum of armies within defenseRadius of capital

  // Calculate threat
  enemyWithin8Tiles = enemy armies within 8 tiles
  threatLevel = sum(enemyWithin8Tiles)

  // Required defense based on threat
  requiredDefense = max(20, threatLevel * 1.5)

  if defensiveArmies < requiredDefense:
    // EMERGENCY: Pull armies back
    for each myTile with armies > 5:
      if distance(tile, capital) > 5:
        move_toward_capital(tile)
```

### 4. Vision Maximization

Systematically explore fog of war:

```
function exploreUnknown(gameState, myIndex):
  // Find tiles at edge of vision
  visionEdge = myTiles with adjacent fog tiles

  // Prioritize moves that reveal most new tiles
  for each edgeTile:
    adjacentFog = count adjacent fog tiles
    score = adjacentFog * 20

    // Bonus for moving toward map center
    if moving toward center:
      score += 15
```

### 5. Turn 25 Optimization

Every 25 turns, all tiles get +1 army. Plan ahead:

```
function turn25Strategy(gameState, turn):
  if turn % 25 == 24:  // Turn before bonus
    // Don't make aggressive moves
    // Let armies accumulate on all tiles
    // Consolidate defensive positions
    prioritize_defense = true

  if turn % 25 == 0:  // Turn after bonus
    // This is the time to strike
    // All armies are at peak
    // Make coordinated attack if capital known
    prioritize_offense = true
```

---

## Implementation Pseudocode

```python
class PerfectBot:
  def __init__(self):
    self.phase = "early"
    self.enemyCapitals = {}
    self.myCapital = None
    self.defensiveState = "normal"

  def onGameState(self, gameState, myIndex):
    # Update internal state
    self.updatePhase(gameState)
    self.updateThreats(gameState, myIndex)
    self.scanForCapitals(gameState, myIndex)

    # Generate and score all possible moves
    moves = self.generateMoves(gameState, myIndex)
    scoredMoves = [
      (move, self.scoreMove(move, gameState, myIndex))
      for move in moves
    ]

    # Select best move
    bestMove = max(scoredMoves, key=lambda x: x[1])

    # Execute if score is positive
    if bestMove[1] > 0:
      self.sendMove(bestMove[0])

  def updatePhase(self, gameState):
    turn = gameState.turn
    capitalDiscovered = len(self.enemyCapitals) > 0

    if capitalDiscovered or turn > 150:
      self.phase = "endgame"
    elif turn > 50:
      self.phase = "midgame"
    else:
      self.phase = "early"

  def scoreMove(self, move, gameState, myIndex):
    score = 0

    # Tile type value
    score += self.getTileTypeValue(move.target, gameState)

    # Strategic position
    score += self.getStrategicValue(move, gameState, myIndex)

    # Army efficiency
    score += self.getArmyEfficiency(move, gameState)

    # Threat response
    score += self.getThreatResponse(move, gameState, myIndex)

    # Phase bonus
    score += self.getPhasePriorityBonus(move, gameState)

    return score
```

---

## Key Success Factors

### 1. Economic Dominance

- Capture 60%+ of cities within first 100 turns
- Maintain 2:1 city advantage over nearest opponent
- Never sacrifice cities for territory

### 2. Information Advantage

- Control 50%+ of lookout towers by turn 75
- Discover all enemy capitals by turn 100
- Continuously probe fog boundaries

### 3. Army Concentration

- Maintain strike forces of 40+ armies
- Never spread armies evenly across all tiles
- Consolidate before major pushes

### 4. Defensive Discipline

- Never let capital defense drop below 20 armies
- Respond to threats immediately
- Don't overextend into enemy territory without backup

### 5. Timing

- Attack enemy capitals only with 50+ army advantage
- Coordinate with turn 25 army bonuses
- Don't rush - setup wins games

---

## Countering Common Strategies

### Against Aggressive Bots

- Turtle and defend early
- Let them overextend
- Counter-attack weak positions
- Focus on economy while they waste armies

### Against Economic Bots

- Apply early pressure
- Deny city captures
- Force defensive posture
- Strike before their economy scales

### Against Defensive Bots

- Capture all cities first
- Build overwhelming force
- Probe defenses for weaknesses
- Use turn 25 bonuses for coordinated assault

---

## Win Conditions Priority

1. **Eliminate all opponents** by capturing their capitals (primary goal)
2. **Economic superiority** - Control enough cities to generate unstoppable army advantage
3. **Territory control** - Own 60%+ of map (automatic win condition in practice)

---

## Conclusion

A perfect bot must balance:

- **Economic expansion** (cities/production)
- **Information gathering** (vision/scouting)
- **Army management** (concentration/positioning)
- **Defensive positioning** (capital protection)
- **Aggressive timing** (coordinated assaults)

The algorithm presented here prioritizes economic dominance early, information gathering mid-game, and coordinated capital assaults late-game, while maintaining constant defensive awareness. Success requires dynamic adaptation to opponent strategies and disciplined execution of core principles.

**Key Insight**: The bot that captures the most cities in the first 100 turns will have an overwhelming army advantage by turn 150, making late-game capital assaults nearly unstoppable.
