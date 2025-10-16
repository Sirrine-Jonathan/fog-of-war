import { BaseBot } from "./BaseBot";

interface ThreatAssessment {
  tile: number;
  threat: number;
  distance: number;
}

interface StrategicPosition {
  tile: number;
  value: number;
  type: "capital" | "city" | "lookout" | "frontier" | "strategic";
}

interface PerformanceProfile {
  turn: number;
  ourTiles: number;
  ourArmies: number;
  enemyContact: boolean;
  citiesDiscovered: number;
  citiesCaptured: number;
  expansionRate: number;
}

export class TitanBot extends BaseBot {
  private strategicPhase: "early" | "mid" | "late" = "early";
  private controlledCities: Set<number> = new Set();
  private threatCache: Map<number, ThreatAssessment> = new Map();
  private performanceLog: PerformanceProfile[] = [];
  private lastTileCount: number = 0;
  private citiesDiscovered: Set<number> = new Set();
  private enemyContactTurn: number = -1;
  private recentlyExpandedFrom: Map<number, number> = new Map(); // tile -> turn

  makeMove() {
    // Update game phase
    this.updateGamePhase();

    // Clear old threat cache
    if (this.currentTurn % 5 === 0) {
      this.threatCache.clear();
    }

    // EARLY GAME: Pure expansion, no distractions
    if (this.strategicPhase === "early") {
      const earlyMove = this.earlyGameStrategy();
      if (earlyMove) {
        console.log(
          `T${this.currentTurn}: Titan ${earlyMove.from}->${earlyMove.to}`
        );
        this.attack(earlyMove.from, earlyMove.to);
        return;
      } else {
        console.log(`T${this.currentTurn}: Titan NO MOVE (waiting for armies)`);
      }
    }

    // MID/LATE GAME: Add strategic considerations
    // Critical Priority: Defend capital from imminent threats
    const urgentDefense = this.defendAgainstThreats();
    if (urgentDefense) {
      this.attack(urgentDefense.from, urgentDefense.to);
      return;
    }

    // High Priority: Capture critical strategic positions
    const strategicCapture = this.captureStrategicPositions();
    if (strategicCapture) {
      this.attack(strategicCapture.from, strategicCapture.to);
      return;
    }

    // Phase-dependent strategy
    if (this.strategicPhase === "mid") {
      const midMove = this.midGameStrategy();
      if (midMove) {
        this.attack(midMove.from, midMove.to);
        return;
      }
    } else {
      const lateMove = this.lateGameStrategy();
      if (lateMove) {
        this.attack(lateMove.from, lateMove.to);
        return;
      }
    }

    // Fallback: Optimal expansion
    const expansion = this.intelligentExpansion();
    if (expansion) {
      this.attack(expansion.from, expansion.to);
    }
  }

  private updateGamePhase() {
    const { terrain, armies } = this.gameState;

    // Count our territory and total armies
    let ourTerritory = 0;
    let ourTotalArmies = 0;
    let totalVisible = 0;
    let enemyTiles = 0;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        ourTerritory++;
        ourTotalArmies += armies[i];
      }
      if (terrain[i] !== -3) totalVisible++;
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        enemyTiles++;
      }
    }

    // Track ACTUAL enemy contact (within 3 tiles of our territory)
    let hasEnemyContact = false;
    if (enemyTiles > 0) {
      // Check if any enemy is actually near us
      for (let i = 0; i < terrain.length; i++) {
        if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
          // Check if this enemy tile is within 3 tiles of any of our tiles
          for (let j = 0; j < terrain.length; j++) {
            if (terrain[j] === this.gameState.playerIndex) {
              const dist = this.getDistance(i, j);
              if (dist <= 3) {
                hasEnemyContact = true;
                break;
              }
            }
          }
          if (hasEnemyContact) break;
        }
      }
    }
    if (hasEnemyContact && this.enemyContactTurn === -1) {
      this.enemyContactTurn = this.currentTurn;
    }

    // Track discovered cities
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === -6 || this.gameState.cities.includes(i)) {
        const adjacent = this.getAdjacentTiles(i);
        const isNearUs = adjacent.some(
          (adj) => terrain[adj] === this.gameState.playerIndex
        );
        if (isNearUs) {
          this.citiesDiscovered.add(i);
        }
      }
    }

    // Profile performance every 10 turns
    if (this.currentTurn % 10 === 0) {
      const expansionRate = ourTerritory - this.lastTileCount;
      this.performanceLog.push({
        turn: this.currentTurn,
        ourTiles: ourTerritory,
        ourArmies: ourTotalArmies,
        enemyContact: hasEnemyContact,
        citiesDiscovered: this.citiesDiscovered.size,
        citiesCaptured: this.controlledCities.size,
        expansionRate: expansionRate,
      });
      this.lastTileCount = ourTerritory;

      // Log performance every 10 turns
      if (this.currentTurn % 10 === 0) {
        console.log(
          `T${this.currentTurn} Summary: ${ourTerritory} tiles, ${ourTotalArmies} armies, rate=${expansionRate}/10turns`
        );
      }
    }

    const controlPercentage = ourTerritory / totalVisible;

    // DYNAMIC PHASE TRANSITIONS (per training recommendations)
    // Switch to mid-game when ANY of these conditions met:
    // 1. 40+ tiles captured (exponential foundation built)
    // 2. City discovered nearby (strategic opportunity)
    // 3. Enemy contact made (need defensive awareness)
    // 4. Turn 50 reached (fallback threshold)

    if (this.strategicPhase === "early") {
      if (
        ourTerritory >= 40 ||
        this.citiesDiscovered.size > 0 ||
        hasEnemyContact ||
        this.currentTurn >= 50
      ) {
        this.strategicPhase = "mid";
        console.log(
          `T${this.currentTurn} -> MID GAME (tiles:${ourTerritory}, cities:${this.citiesDiscovered.size}, contact:${hasEnemyContact})`
        );
      }
    } else if (this.strategicPhase === "mid") {
      if (this.currentTurn >= 150 || controlPercentage >= 0.4) {
        this.strategicPhase = "late";
        console.log(
          `T${this.currentTurn} -> LATE GAME (control:${(
            controlPercentage * 100
          ).toFixed(1)}%)`
        );
      }
    }
  }

  private defendAgainstThreats(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return null;

    // Identify all enemy positions
    const threats: ThreatAssessment[] = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        const distance = this.getDistance(i, ourCapital);
        const threatLevel = armies[i] * (10 - Math.min(distance, 10));
        threats.push({ tile: i, threat: threatLevel, distance });
      }
    }

    if (threats.length === 0) return null;

    // Sort by threat level
    threats.sort((a, b) => b.threat - a.threat);

    // Counter most dangerous threats within range
    for (const threat of threats.slice(0, 3)) {
      for (let i = 0; i < terrain.length; i++) {
        if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
          const adjacent = this.getAdjacentTiles(i);

          if (
            adjacent.includes(threat.tile) &&
            armies[i] > armies[threat.tile] + 1 &&
            !this.wouldCreateLoop(i, threat.tile)
          ) {
            return { from: i, to: threat.tile };
          }
        }
      }
    }

    return null;
  }

  private captureStrategicPositions(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const strategicTargets: StrategicPosition[] = [];

    // Identify strategic positions
    for (let i = 0; i < terrain.length; i++) {
      const adjacent = this.getAdjacentTiles(i);
      const hasOurTile = adjacent.some(
        (adj) => terrain[adj] === this.gameState.playerIndex
      );

      if (!hasOurTile) continue;

      // Enemy capitals - highest priority
      if (
        this.gameState.capitals.includes(i) &&
        terrain[i] !== this.gameState.playerIndex
      ) {
        strategicTargets.push({ tile: i, value: 1000, type: "capital" });
      }
      // Cities - high value
      else if (terrain[i] === -6) {
        strategicTargets.push({ tile: i, value: 500, type: "city" });
      }
      // Enemy cities
      else if (
        this.gameState.cities.includes(i) &&
        terrain[i] !== this.gameState.playerIndex
      ) {
        strategicTargets.push({ tile: i, value: 600, type: "city" });
      }
      // Lookout towers - vision advantage
      else if (terrain[i] === -5) {
        strategicTargets.push({ tile: i, value: 300, type: "lookout" });
      }
    }

    if (strategicTargets.length === 0) return null;

    // Sort by value
    strategicTargets.sort((a, b) => b.value - a.value);

    // Try to capture highest value target
    for (const target of strategicTargets) {
      for (let i = 0; i < terrain.length; i++) {
        if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
          const adjacent = this.getAdjacentTiles(i);

          if (
            adjacent.includes(target.tile) &&
            armies[i] > armies[target.tile] + 1 &&
            !this.wouldCreateLoop(i, target.tile)
          ) {
            if (target.type === "city") {
              this.controlledCities.add(target.tile);
            }
            return { from: i, to: target.tile };
          }
        }
      }
    }

    return null;
  }

  private earlyGameStrategy(): { from: number; to: number } | null {
    // Early game: PURE expansion ONLY - NO distractions
    // This is Iteration 3's winning formula: expand, expand, expand
    // Cities can wait - every turn spent not expanding is exponential growth lost
    const multifront = this.hyperspeedMultiFrontExpansion();
    if (multifront) return multifront;

    return null;
  }

  private midGameStrategy(): { from: number; to: number } | null {
    // Focus: Territory consolidation and enemy pressure
    const weakEnemy = this.eliminateWeakestOpponent();
    if (weakEnemy) return weakEnemy;

    const consolidate = this.consolidateTerritory();
    if (consolidate) return consolidate;

    return null;
  }

  private lateGameStrategy(): { from: number; to: number } | null {
    // Focus: Overwhelming force and capital assault
    const capitalAssault = this.prepareCapitalAssault();
    if (capitalAssault) return capitalAssault;

    const massAttack = this.coordinatedMassAttack();
    if (massAttack) return massAttack;

    return null;
  }

  private rushNearestCity(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;
    const ourCapital = this.gameState.capitals[this.gameState.playerIndex];

    if (ourCapital === -1) return null;

    // Find nearest uncaptured city
    let nearestCity = -1;
    let minDistance = Infinity;

    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === -6 ||
        (this.gameState.cities.includes(i) &&
          terrain[i] !== this.gameState.playerIndex)
      ) {
        const distance = this.getDistance(i, ourCapital);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCity = i;
        }
      }
    }

    if (nearestCity === -1) return null;

    // Path toward it
    return this.pathToward(nearestCity);
  }

  private aggressiveExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find best expansion from strongest positions
    const candidates: Array<{
      from: number;
      to: number;
      score: number;
    }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 2) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            (terrain[adj] === -1 || terrain[adj] === -3) &&
            !this.wouldCreateLoop(i, adj)
          ) {
            // Score based on exploration value and army strength
            const adjOfAdj = this.getAdjacentTiles(adj);
            const fogCount = adjOfAdj.filter((t) => terrain[t] === -3).length;
            const score = fogCount * 10 + armies[i];

            candidates.push({ from: i, to: adj, score });
          }
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return { from: candidates[0].from, to: candidates[0].to };
    }

    return null;
  }

  private eliminateWeakestOpponent(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find weakest opponent
    const opponentStrength = new Map<number, number>();

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] >= 0 && terrain[i] !== this.gameState.playerIndex) {
        const current = opponentStrength.get(terrain[i]) || 0;
        opponentStrength.set(terrain[i], current + armies[i]);
      }
    }

    if (opponentStrength.size === 0) return null;

    // Find weakest
    let weakest = -1;
    let minStrength = Infinity;

    for (const [player, strength] of opponentStrength) {
      if (strength < minStrength) {
        minStrength = strength;
        weakest = player;
      }
    }

    // Attack weakest opponent
    const attacks: Array<{
      from: number;
      to: number;
      advantage: number;
    }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 2) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] === weakest &&
            armies[i] > armies[adj] + 1 &&
            !this.wouldCreateLoop(i, adj)
          ) {
            attacks.push({
              from: i,
              to: adj,
              advantage: armies[i] - armies[adj],
            });
          }
        }
      }
    }

    if (attacks.length > 0) {
      attacks.sort((a, b) => b.advantage - a.advantage);
      return { from: attacks[0].from, to: attacks[0].to };
    }

    return null;
  }

  private consolidateTerritory(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Move interior armies to frontlines
    const frontierTiles = this.getFrontierTiles();
    if (frontierTiles.length === 0) return null;

    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === this.gameState.playerIndex &&
        armies[i] > 5 &&
        !frontierTiles.includes(i)
      ) {
        // Find path to strongest frontier
        let strongestFrontier = -1;
        let maxArmies = 0;

        for (const ft of frontierTiles) {
          if (armies[ft] > maxArmies) {
            maxArmies = armies[ft];
            strongestFrontier = ft;
          }
        }

        if (strongestFrontier !== -1) {
          const move = this.moveTowardTile(i, strongestFrontier);
          if (move) return move;
        }
      }
    }

    return null;
  }

  private prepareCapitalAssault(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find enemy capitals
    const enemyCapitals: number[] = [];

    for (let i = 0; i < this.gameState.capitals.length; i++) {
      if (
        i !== this.gameState.playerIndex &&
        this.gameState.capitals[i] !== -1
      ) {
        enemyCapitals.push(this.gameState.capitals[i]);
      }
    }

    if (enemyCapitals.length === 0) return null;

    // Find our strongest army
    let strongestTile = -1;
    let maxArmies = 0;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > maxArmies) {
        maxArmies = armies[i];
        strongestTile = i;
      }
    }

    if (strongestTile === -1 || maxArmies < 10) return null;

    // Move toward nearest enemy capital
    const nearest = this.findClosest(strongestTile, enemyCapitals);
    if (nearest !== -1) {
      return this.pathToward(nearest);
    }

    return null;
  }

  private coordinatedMassAttack(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Find all possible attacks
    const attacks: Array<{
      from: number;
      to: number;
      advantage: number;
      isCapital: boolean;
    }> = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 3) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] >= 0 &&
            terrain[adj] !== this.gameState.playerIndex &&
            armies[i] > armies[adj] + 1 &&
            !this.wouldCreateLoop(i, adj)
          ) {
            attacks.push({
              from: i,
              to: adj,
              advantage: armies[i] - armies[adj],
              isCapital: this.gameState.capitals.includes(adj),
            });
          }
        }
      }
    }

    if (attacks.length > 0) {
      // Prioritize capitals, then by advantage
      attacks.sort((a, b) => {
        if (a.isCapital && !b.isCapital) return -1;
        if (!a.isCapital && b.isCapital) return 1;
        return b.advantage - a.advantage;
      });

      return { from: attacks[0].from, to: attacks[0].to };
    }

    return null;
  }

  private intelligentExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const targets = this.getPriorityTargets(i);
        if (targets.length > 0) {
          return { from: i, to: targets[0] };
        }
      }
    }

    return null;
  }

  private pathToward(target: number): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    let bestMove: { from: number; to: number; dist: number } | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex && armies[i] > 1) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            (terrain[adj] === -1 ||
              terrain[adj] === -3 ||
              terrain[adj] === this.gameState.playerIndex) &&
            !this.wouldCreateLoop(i, adj)
          ) {
            const dist = this.getDistance(adj, target);
            if (dist < bestDist) {
              bestDist = dist;
              bestMove = { from: i, to: adj, dist };
            }
          }
        }
      }
    }

    if (bestMove) {
      return { from: bestMove.from, to: bestMove.to };
    }

    return null;
  }

  private moveTowardTile(
    from: number,
    target: number
  ): { from: number; to: number } | null {
    const { terrain } = this.gameState;
    const adjacent = this.getAdjacentTiles(from);

    let bestAdj = -1;
    let bestDist = Infinity;

    for (const adj of adjacent) {
      if (
        terrain[adj] === this.gameState.playerIndex &&
        !this.wouldCreateLoop(from, adj)
      ) {
        const dist = this.getDistance(adj, target);
        if (dist < bestDist) {
          bestDist = dist;
          bestAdj = adj;
        }
      }
    }

    if (bestAdj !== -1) {
      return { from, to: bestAdj };
    }

    return null;
  }

  private getFrontierTiles(): number[] {
    const { terrain } = this.gameState;
    const frontier: number[] = [];

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const adjacent = this.getAdjacentTiles(i);
        const hasUnexplored = adjacent.some(
          (adj) =>
            terrain[adj] === -1 ||
            terrain[adj] === -3 ||
            (terrain[adj] >= 0 && terrain[adj] !== this.gameState.playerIndex)
        );

        if (hasUnexplored) {
          frontier.push(i);
        }
      }
    }

    return frontier;
  }

  private findClosest(from: number, targets: number[]): number {
    let closest = -1;
    let minDist = Infinity;

    for (const target of targets) {
      const dist = this.getDistance(from, target);
      if (dist < minDist) {
        minDist = dist;
        closest = target;
      }
    }

    return closest;
  }

  private getDistance(from: number, to: number): number {
    const fromX = from % this.gameState.width;
    const fromY = Math.floor(from / this.gameState.width);
    const toX = to % this.gameState.width;
    const toY = Math.floor(to / this.gameState.width);
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }

  private hyperspeedMultiFrontExpansion(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // SIMPLIFIED EXPANSION (fix for army starvation)
    // Remove frontier concept - iterate over ALL our tiles with >1 army
    // This prevents tiles from getting stuck at 1 army unable to expand

    const expansions: Array<{
      from: number;
      to: number;
      score: number;
    }> = [];

    // Clean up old entries in recentlyExpandedFrom (>10 turns ago)
    for (const [tile, turn] of this.recentlyExpandedFrom.entries()) {
      if (this.currentTurn - turn > 10) {
        this.recentlyExpandedFrom.delete(tile);
      }
    }

    // Iterate over ALL our tiles (not just frontier)
    for (let i = 0; i < terrain.length; i++) {
      // Skip tiles we don't own or tiles with insufficient armies
      if (terrain[i] !== this.gameState.playerIndex || armies[i] <= 1) {
        continue;
      }

      const adjacent = this.getAdjacentTiles(i);

      for (const adj of adjacent) {
        // Only expand to empty/fog tiles
        if (terrain[adj] !== -1 && terrain[adj] !== -3) {
          continue;
        }

        // Skip if would create loop
        if (this.wouldCreateLoop(i, adj)) {
          continue;
        }

        // Calculate position metrics
        const adjRow = Math.floor(adj / this.gameState.width);
        const adjCol = adj % this.gameState.width;

        // Distance from map center (not territory center)
        const centerX = this.gameState.width / 2;
        const centerY = this.gameState.height / 2;
        const distFromCenter = Math.sqrt(
          Math.pow(adjCol - centerX, 2) + Math.pow(adjRow - centerY, 2)
        );

        // Count our neighbors and fog neighbors
        const adjOfAdj = this.getAdjacentTiles(adj);
        const ourNeighbors = adjOfAdj.filter(
          (tile) => terrain[tile] === this.gameState.playerIndex
        ).length;
        const fogNeighbors = adjOfAdj.filter(
          (tile) => terrain[tile] === -3
        ).length;

        // BLOB'S EXACT FORMULA (proven to achieve ~95 tiles)
        let score =
          distFromCenter * 100 -
          ourNeighbors * 50 +
          fogNeighbors * 10 +
          armies[i];

        // CRITICAL FIX: Penalize tiles we recently expanded from
        // This prevents repeatedly expanding from same tile (especially capital)
        const lastExpandedTurn = this.recentlyExpandedFrom.get(i);
        if (lastExpandedTurn !== undefined) {
          const turnsSince = this.currentTurn - lastExpandedTurn;
          if (turnsSince < 5) {
            // Heavy penalty for recent expansions
            score -= 500;
          }
        }

        expansions.push({
          from: i,
          to: adj,
          score,
        });
      }
    }

    if (expansions.length === 0) {
      return null;
    }

    // Sort by score (highest first)
    expansions.sort((a, b) => b.score - a.score);

    // Track that we're expanding from this tile
    this.recentlyExpandedFrom.set(expansions[0].from, this.currentTurn);

    return { from: expansions[0].from, to: expansions[0].to };
  }

  private captureNearbyCityIfEasy(): { from: number; to: number } | null {
    const { armies, terrain } = this.gameState;

    // Only capture cities that are immediately adjacent and easy
    for (let i = 0; i < terrain.length; i++) {
      if (
        terrain[i] === -6 ||
        (this.gameState.cities.includes(i) &&
          terrain[i] !== this.gameState.playerIndex)
      ) {
        const adjacent = this.getAdjacentTiles(i);

        for (const adj of adjacent) {
          if (
            terrain[adj] === this.gameState.playerIndex &&
            armies[adj] > armies[i] + 1 &&
            !this.wouldCreateLoop(adj, i)
          ) {
            return { from: adj, to: i };
          }
        }
      }
    }

    return null;
  }

  private getTerritoryCenter(): { centerX: number; centerY: number } {
    const { terrain } = this.gameState;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === this.gameState.playerIndex) {
        const row = Math.floor(i / this.gameState.width);
        const col = i % this.gameState.width;
        sumX += col;
        sumY += row;
        count++;
      }
    }

    return {
      centerX: count > 0 ? sumX / count : this.gameState.width / 2,
      centerY: count > 0 ? sumY / count : this.gameState.height / 2,
    };
  }
}
