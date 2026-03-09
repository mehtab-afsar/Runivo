

# Runivo — Territory System: Complete Game Logic

## PART 1: HOW TERRITORY IS DISTRIBUTED ON THE MAP

### The Hex Grid System

```
THE WORLD IS DIVIDED INTO HEXAGONS USING UBER'S H3 SYSTEM

Why hexagons?
├── Every neighbor is equidistant (unlike squares with diagonal issues)
├── Natural tiling with no gaps
├── Smooth movement detection (6 neighbors vs 4/8 for squares)
└── Industry standard (Uber, Niantic, etc.)

Resolution 9 specs:
├── Edge length: ~174m
├── Area: ~0.1km² (105,332 m²)
├── Hex-to-hex center distance: ~330m
├── A runner at 3 m/s crosses a hex in ~58-116 seconds depending on path
└── A city like London contains ~16,000 hex cells at res 9
```

### Initial Map State — All Hexes Start Neutral

```javascript
// The map doesn't pre-generate hexes. Hexes are "born" on first interaction.
// This is critical — you can't store 510 million land hexes upfront.

const HEX_STATES = {
  NEUTRAL: 'neutral',      // No owner — gray on map
  CLAIMED: 'claimed',      // Owned by a player — player's color
  CONTESTED: 'contested',  // Currently being sieged — flashing/pulsing
};

// A hex only gets a database entry when someone first claims it
// Before that, it's implicitly neutral (no row = neutral)

function getHexState(hexId) {
  const hex = territoryDB.get(hexId);
  if (!hex) {
    return {
      id: hexId,
      state: HEX_STATES.NEUTRAL,
      ownerId: null,
      ownerName: null,
      defense: 0,
      tier: 'normal',
      claimedAt: null,
      lastVisitedAt: null,
      lastFortifiedAt: null,
      contiguityBonus: 0,
    };
  }
  return hex;
}
```

### How Hexes Appear on the Map

```
MAP RENDERING LOGIC:

When app loads:
1. Get user's current GPS position
2. Calculate viewport bounds (visible map area)
3. h3.polygonToCells(viewportPolygon, 9) → all hex IDs in view
4. Query local IndexedDB for any hex IDs that have owners
5. Render:
   - Owned by you     → YOUR color (solid fill, 60% opacity)
   - Owned by enemy   → THEIR color (solid fill, 40% opacity)  
   - Owned by clubmate → CLUB color (solid fill, 50% opacity)
   - Neutral           → Not rendered (transparent, map shows through)
   - Currently contested → Pulsing border animation

Visual layers (bottom to top):
1. Base map (street/satellite/dark — cosmetic choice)
2. Hex grid lines (subtle, 10% opacity white)
3. Territory fill (colored hexes)
4. Your current hex highlight (bright border)
5. Siege progress ring (circular progress indicator on hex)
6. Run route trail (polyline of your GPS trace)
```

```javascript
// Efficient hex rendering — only render what's visible + buffer
function getVisibleTerritories(center, zoomLevel) {
  // Buffer ring: load 2 hex rings beyond viewport for smooth scrolling
  const viewportHexes = h3.polygonToCells(getViewportPolygon(center, zoomLevel), 9);
  const bufferedHexes = new Set();

  viewportHexes.forEach(hex => {
    bufferedHexes.add(hex);
    h3.gridDisk(hex, 2).forEach(neighbor => bufferedHexes.add(neighbor));
  });

  // Batch query IndexedDB
  const ownedHexes = territoryDB.getMultiple([...bufferedHexes]);

  return ownedHexes.filter(h => h.ownerId !== null);
}
```

### Territory Distribution Density Analysis

```
HOW DENSE IS THE HEX GRID IN REAL SCENARIOS?

City Park (1 km² area):
├── ~10 hexes
├── A single run through the park touches 4-6 hexes
└── Claimable in 2-3 runs

Neighborhood (4 km²):
├── ~40 hexes  
├── A daily 5km runner covers 8-15 hexes per run
└── Fully claimable in ~4-5 runs

City District (25 km²):
├── ~250 hexes
├── Would take weeks of daily running to claim meaningfully
└── Natural territory boundaries form around runner habits

Full City (600 km² — London):
├── ~6,000 hexes  
├── No single player can hold this
└── Creates natural competition zones
```

---

## PART 2: HOW TERRITORY CAPTURE WORKS (Complete State Machine)

### The Five Phases of Territory Interaction

```
PHASE 1: DETECTION
  "Which hex am I in right now?"

PHASE 2: CLASSIFICATION  
  "Is this hex neutral, mine, or enemy?"

PHASE 3: ACTION
  "Start claiming / capturing / fortifying"

PHASE 4: PROGRESSION
  "Accumulate time toward completion"

PHASE 5: RESOLUTION
  "Claim succeeds, fails, or gets interrupted"
```

### Complete Capture State Machine

```javascript
/**
 * TERRITORY CLAIM ENGINE — Complete Implementation
 * 
 * This is the core game loop that runs during every active run.
 * Called every 1-3 seconds with fresh GPS data.
 */

const CLAIM_CONFIG = {
  // Time required to claim (seconds)
  neutralClaimTime: 15,
  
  // Enemy capture base time + defense scaling
  enemyCaptureBaseTime: 45,
  enemyCaptureDefenseMultiplier: 1.2, // seconds per defense point
  
  // Speed bonus threshold and multiplier
  speedBonusThreshold: 3.5,  // m/s (~12.6 km/h)
  speedBonusMultiplier: 1.4, // 40% faster capture when running fast
  
  // Fortification
  fortifyInterval: 8,         // Every 8 seconds in own hex
  fortifyDefenseGain: 4,      // +4 defense per tick
  fortifyMaxDefense: 100,
  
  // Anti-exploit
  minimumSpeedForProgress: 0.8,  // Must be moving (m/s)
  maximumSpeedForProgress: 12.0, // Can't be in a car
  minimumAccuracy: 30,           // GPS accuracy must be < 30m
  
  // Siege persistence
  siegeTimeoutSeconds: 300,      // Siege progress on a hex expires after 5 min away
};


class TerritoryClaimEngine {
  constructor(userId, userProfile) {
    this.userId = userId;
    this.userTier = userProfile.subscriptionTier;
    this.userLevel = userProfile.level;
    this.userColor = userProfile.color;
    this.userName = userProfile.displayName;
    
    // Active state
    this.currentHexId = null;
    this.previousHexId = null;
    this.hexEnteredAt = null;         // Timestamp when entered current hex
    
    // Siege progress — persists across multiple visits within one run
    this.siegeMap = new Map();         // hexId → SiegeState
    
    // Fortify tracking
    this.fortifyMap = new Map();      // hexId → accumulated seconds
    
    // Run results
    this.results = {
      hexesClaimed: [],               // Neutral hexes claimed
      hexesCaptured: [],              // Enemy hexes taken
      hexesFortified: [],             // Own hexes fortified  
      hexesVisited: new Set(),        // All unique hexes entered
      xpEarned: 0,
      coinsEarned: 0,
      diamondsEarned: 0,
      siegeProgressSnapshots: [],     // For post-run review
    };
    
    // Territory limits
    this.maxTerritories = this.calculateMaxTerritories();
    this.currentTerritoryCount = userProfile.territoryCount;
  }

  calculateMaxTerritories() {
    let base = this.userTier === 'free' ? 20 : 100;
    
    // Level bonuses
    if (this.userLevel >= 5)  base += 2;
    if (this.userLevel >= 10) base += 5;
    if (this.userLevel >= 17) base += 10;
    
    return base;
  }

  /**
   * MAIN TICK — Called every GPS update (1-3 seconds)
   * 
   * @param {Object} gpsPoint - { lat, lng, speed, accuracy, timestamp, altitude }
   * @param {string} activityType - 'run', 'walk', 'cycle', etc.
   * @returns {Array<GameEvent>} - Events that occurred this tick
   */
  processTick(gpsPoint, activityType) {
    const events = [];
    
    // ─── STEP 1: VALIDATE GPS POINT ───
    if (!this.isValidGPS(gpsPoint, activityType)) {
      events.push({ type: 'GPS_INVALID', reason: 'speed_or_accuracy', point: gpsPoint });
      return events;
    }

    // ─── STEP 2: DETERMINE CURRENT HEX ───
    const hexId = h3.latLngToCell(gpsPoint.lat, gpsPoint.lng, 9);
    const hexChanged = hexId !== this.currentHexId;
    
    this.previousHexId = this.currentHexId;
    this.currentHexId = hexId;
    this.results.hexesVisited.add(hexId);

    // ─── STEP 3: HANDLE HEX TRANSITION ───
    if (hexChanged) {
      this.hexEnteredAt = gpsPoint.timestamp;
      events.push({ 
        type: 'HEX_ENTERED', 
        hexId, 
        previousHexId: this.previousHexId 
      });
      
      // Clean up expired siege progress on other hexes
      this.cleanExpiredSieges(gpsPoint.timestamp);
    }

    // ─── STEP 4: GET HEX DATA ───
    const hex = getHexState(hexId);
    
    // ─── STEP 5: CALCULATE SPEED MULTIPLIER ───
    const speedMult = this.getSpeedMultiplier(gpsPoint.speed, activityType);
    const timeInHex = (gpsPoint.timestamp - this.hexEnteredAt) / 1000;

    // ─── STEP 6: ROUTE BASED ON HEX OWNERSHIP ───
    
    // ════════════════════════════════════
    // CASE A: NEUTRAL HEX — CLAIM IT
    // ════════════════════════════════════
    if (hex.state === 'neutral' || hex.ownerId === null) {
      events.push(...this.processNeutralHex(hexId, hex, gpsPoint, speedMult));
    }
    
    // ════════════════════════════════════
    // CASE B: YOUR OWN HEX — FORTIFY IT
    // ════════════════════════════════════
    else if (hex.ownerId === this.userId) {
      events.push(...this.processOwnHex(hexId, hex, gpsPoint, speedMult));
    }
    
    // ════════════════════════════════════
    // CASE C: ENEMY HEX — CAPTURE IT
    // ════════════════════════════════════
    else {
      events.push(...this.processEnemyHex(hexId, hex, gpsPoint, speedMult));
    }

    return events;
  }


  // ═══════════════════════════════════════════════
  // CASE A: NEUTRAL HEX CLAIMING
  // ═══════════════════════════════════════════════
  
  processNeutralHex(hexId, hex, gpsPoint, speedMult) {
    const events = [];
    
    // Check territory limit
    if (this.currentTerritoryCount >= this.maxTerritories) {
      events.push({ 
        type: 'TERRITORY_LIMIT', 
        hexId,
        current: this.currentTerritoryCount, 
        max: this.maxTerritories,
        message: `Territory limit reached (${this.maxTerritories}). Upgrade to hold more.`
      });
      return events;
    }

    // Get or create siege progress
    const siege = this.getOrCreateSiege(hexId, CLAIM_CONFIG.neutralClaimTime, 'claim');
    
    // Calculate progress increment
    // deltaTime since last tick (approximated from GPS interval)
    const deltaTime = this.getTickDelta(gpsPoint.timestamp);
    const progressIncrement = deltaTime * speedMult;
    
    siege.accumulated += progressIncrement;
    siege.lastUpdateAt = gpsPoint.timestamp;

    // Check completion
    if (siege.accumulated >= siege.required) {
      // ✅ CLAIMED!
      const result = this.executeClaimNeutral(hexId, gpsPoint);
      events.push(result);
      this.siegeMap.delete(hexId);
    } else {
      // ⏳ In progress
      const progress = siege.accumulated / siege.required;
      const remaining = (siege.required - siege.accumulated) / speedMult;
      
      events.push({
        type: 'CLAIMING_PROGRESS',
        hexId,
        progress: Math.min(progress, 0.99),
        progressPercent: Math.round(progress * 100),
        secondsRemaining: Math.ceil(remaining),
        required: siege.required,
        accumulated: siege.accumulated,
      });
    }

    return events;
  }

  executeClaimNeutral(hexId, gpsPoint) {
    const xpReward = 25;
    const coinReward = 10;
    
    // Update hex in local database
    const hexData = {
      id: hexId,
      state: 'claimed',
      ownerId: this.userId,
      ownerName: this.userName,
      ownerColor: this.userColor,
      defense: 50,               // New claims start at 50 defense
      tier: 'normal',
      claimedAt: new Date().toISOString(),
      lastVisitedAt: new Date().toISOString(),
      lastFortifiedAt: null,
    };
    
    territoryDB.put(hexData);
    
    // Update counters
    this.currentTerritoryCount++;
    this.results.hexesClaimed.push(hexId);
    this.results.xpEarned += xpReward;
    this.results.coinsEarned += coinReward;
    
    // Queue for server sync
    this.queuePendingAction({
      type: 'CLAIM_NEUTRAL',
      hexId,
      gpsProof: {
        lat: gpsPoint.lat,
        lng: gpsPoint.lng,
        timestamp: gpsPoint.timestamp,
        accuracy: gpsPoint.accuracy,
        speed: gpsPoint.speed,
      },
      timestamp: new Date().toISOString(),
    });

    // Calculate and apply contiguity bonus
    const contiguity = this.calculateContiguity(hexId);
    
    return {
      type: 'HEX_CLAIMED',
      hexId,
      xp: xpReward,
      coins: coinReward,
      newDefense: 50,
      contiguityBonus: contiguity,
      totalOwned: this.currentTerritoryCount,
      message: `Territory claimed! +${xpReward} XP, +${coinReward} coins`,
    };
  }


  // ═══════════════════════════════════════════════
  // CASE B: OWN HEX FORTIFICATION
  // ═══════════════════════════════════════════════

  processOwnHex(hexId, hex, gpsPoint, speedMult) {
    const events = [];
    
    // Refresh decay timer (just being here resets it)
    hex.lastVisitedAt = new Date().toISOString();
    territoryDB.put(hex);
    
    // Already at max defense — nothing to do
    if (hex.defense >= CLAIM_CONFIG.fortifyMaxDefense) {
      events.push({ 
        type: 'HEX_MAX_DEFENSE', 
        hexId, 
        defense: hex.defense,
        message: 'Territory at maximum defense!'
      });
      return events;
    }

    // Accumulate fortify time
    const currentFortTime = this.fortifyMap.get(hexId) || 0;
    const deltaTime = this.getTickDelta(gpsPoint.timestamp);
    const newFortTime = currentFortTime + deltaTime;
    this.fortifyMap.set(hexId, newFortTime);

    // Check if we've hit a fortify tick
    const previousTicks = Math.floor(currentFortTime / CLAIM_CONFIG.fortifyInterval);
    const currentTicks = Math.floor(newFortTime / CLAIM_CONFIG.fortifyInterval);
    const newTicks = currentTicks - previousTicks;

    if (newTicks > 0) {
      const defenseGain = Math.min(
        newTicks * CLAIM_CONFIG.fortifyDefenseGain,
        CLAIM_CONFIG.fortifyMaxDefense - hex.defense
      );
      
      hex.defense += defenseGain;
      hex.lastFortifiedAt = new Date().toISOString();
      territoryDB.put(hex);

      const xpReward = 10 * newTicks;
      this.results.xpEarned += xpReward;
      this.results.hexesFortified.push({ hexId, defenseGain });

      events.push({
        type: 'HEX_FORTIFIED',
        hexId,
        defenseGain,
        newDefense: hex.defense,
        xp: xpReward,
        message: `Defense +${defenseGain}! Now at ${hex.defense}/100`,
      });

      this.queuePendingAction({
        type: 'FORTIFY',
        hexId,
        defenseGain,
        newDefense: hex.defense,
        gpsProof: { lat: gpsPoint.lat, lng: gpsPoint.lng, timestamp: gpsPoint.timestamp },
      });
    }

    return events;
  }


  // ═══════════════════════════════════════════════
  // CASE C: ENEMY HEX CAPTURE
  // ═══════════════════════════════════════════════

  processEnemyHex(hexId, hex, gpsPoint, speedMult) {
    const events = [];
    
    // Check territory limit
    if (this.currentTerritoryCount >= this.maxTerritories) {
      events.push({ 
        type: 'TERRITORY_LIMIT', 
        hexId,
        current: this.currentTerritoryCount,
        max: this.maxTerritories
      });
      return events;
    }

    // Calculate required capture time based on defense
    const captureTime = CLAIM_CONFIG.enemyCaptureBaseTime + 
                        (CLAIM_CONFIG.enemyCaptureDefenseMultiplier * hex.defense);
    
    // Get or create siege
    const siege = this.getOrCreateSiege(hexId, captureTime, 'capture');
    
    // Add progress
    const deltaTime = this.getTickDelta(gpsPoint.timestamp);
    const progressIncrement = deltaTime * speedMult;
    siege.accumulated += progressIncrement;
    siege.lastUpdateAt = gpsPoint.timestamp;

    // Check completion
    if (siege.accumulated >= siege.required) {
      // ⚔️ CAPTURED!
      const result = this.executeCapture(hexId, hex, gpsPoint);
      events.push(result);
      this.siegeMap.delete(hexId);
    } else {
      const progress = siege.accumulated / siege.required;
      const remaining = (siege.required - siege.accumulated) / speedMult;
      
      events.push({
        type: 'CAPTURING_PROGRESS',
        hexId,
        progress: Math.min(progress, 0.99),
        progressPercent: Math.round(progress * 100),
        secondsRemaining: Math.ceil(remaining),
        enemyName: hex.ownerName,
        enemyDefense: hex.defense,
        message: `Capturing ${hex.ownerName}'s territory... ${Math.round(progress * 100)}%`,
      });
    }

    return events;
  }

  executeCapture(hexId, hex, gpsPoint) {
    const previousOwner = {
      id: hex.ownerId,
      name: hex.ownerName,
    };
    
    const xpReward = 60;
    const coinReward = 25;

    // Transfer ownership
    const updatedHex = {
      ...hex,
      state: 'claimed',
      ownerId: this.userId,
      ownerName: this.userName,
      ownerColor: this.userColor,
      defense: 30,                    // Captured hexes start weaker than fresh claims
      claimedAt: new Date().toISOString(),
      lastVisitedAt: new Date().toISOString(),
      previousOwnerId: previousOwner.id,
      capturedAt: new Date().toISOString(),
    };
    
    territoryDB.put(updatedHex);

    this.currentTerritoryCount++;
    this.results.hexesCaptured.push({ hexId, previousOwner: previousOwner.id });
    this.results.xpEarned += xpReward;
    this.results.coinsEarned += coinReward;

    // Queue sync with full GPS proof chain
    this.queuePendingAction({
      type: 'CAPTURE_ENEMY',
      hexId,
      previousOwnerId: previousOwner.id,
      gpsProof: {
        lat: gpsPoint.lat,
        lng: gpsPoint.lng,
        timestamp: gpsPoint.timestamp,
        accuracy: gpsPoint.accuracy,
        speed: gpsPoint.speed,
      },
      captureTime: this.siegeMap.get(hexId)?.required,
      timestamp: new Date().toISOString(),
    });

    // The previous owner's territory count decrements server-side on sync

    return {
      type: 'HEX_CAPTURED',
      hexId,
      previousOwner: previousOwner.name,
      previousOwnerId: previousOwner.id,
      xp: xpReward,
      coins: coinReward,
      newDefense: 30,
      totalOwned: this.currentTerritoryCount,
      message: `⚔️ Captured ${previousOwner.name}'s territory! +${xpReward} XP`,
    };
  }


  // ═══════════════════════════════════════════════
  // SIEGE MANAGEMENT
  // ═══════════════════════════════════════════════

  getOrCreateSiege(hexId, requiredTime, type) {
    if (!this.siegeMap.has(hexId)) {
      this.siegeMap.set(hexId, {
        hexId,
        type,                    // 'claim' or 'capture'
        accumulated: 0,
        required: requiredTime,
        startedAt: Date.now(),
        lastUpdateAt: Date.now(),
      });
    }
    return this.siegeMap.get(hexId);
  }

  cleanExpiredSieges(currentTimestamp) {
    // Remove siege progress for hexes not visited in 5 minutes
    const expiry = CLAIM_CONFIG.siegeTimeoutSeconds * 1000;
    
    for (const [hexId, siege] of this.siegeMap.entries()) {
      if (hexId === this.currentHexId) continue; // Don't expire current hex
      
      if (currentTimestamp - siege.lastUpdateAt > expiry) {
        this.siegeMap.delete(hexId);
      }
    }
  }


  // ═══════════════════════════════════════════════
  // CONTIGUITY CALCULATION
  // ═══════════════════════════════════════════════

  calculateContiguity(hexId) {
    const neighbors = h3.gridDisk(hexId, 1).filter(h => h !== hexId); // 6 neighbors
    let ownedNeighborCount = 0;

    neighbors.forEach(neighborId => {
      const neighbor = getHexState(neighborId);
      if (neighbor.ownerId === this.userId) {
        ownedNeighborCount++;
      }
    });

    // Return bonus data
    return {
      ownedNeighbors: ownedNeighborCount,
      defenseBonus: ownedNeighborCount * 3,          // +3 defense per adjacent owned hex
      incomeMultiplier: 1 + (ownedNeighborCount * 0.08), // +8% income per neighbor
    };
  }


  // ═══════════════════════════════════════════════
  // VALIDATION & UTILITIES
  // ═══════════════════════════════════════════════

  isValidGPS(point, activityType) {
    // Accuracy check
    if (point.accuracy > CLAIM_CONFIG.minimumAccuracy) return false;
    
    // Speed check (activity-aware)
    const profile = SPEED_PROFILES[activityType] || SPEED_PROFILES.run;
    if (point.speed < CLAIM_CONFIG.minimumSpeedForProgress) return false;
    if (point.speed > profile.max) return false;
    
    return true;
  }

  getSpeedMultiplier(speed, activityType) {
    const profile = SPEED_PROFILES[activityType] || SPEED_PROFILES.run;
    if (!profile.bonusThreshold) return 1.0;
    return speed >= profile.bonusThreshold ? CLAIM_CONFIG.speedBonusMultiplier : 1.0;
  }

  getTickDelta(currentTimestamp) {
    if (!this._lastTickTimestamp) {
      this._lastTickTimestamp = currentTimestamp;
      return 0;
    }
    const delta = (currentTimestamp - this._lastTickTimestamp) / 1000;
    this._lastTickTimestamp = currentTimestamp;
    
    // Cap at 10 seconds to prevent time manipulation
    return Math.min(delta, 10);
  }

  queuePendingAction(action) {
    // Write to IndexedDB pending queue for later Supabase sync
    pendingActionsDB.add({
      ...action,
      userId: this.userId,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
  }
}
```

---

## PART 3: WHAT HAPPENS ONCE TERRITORY IS CAPTURED

### Capture Consequences — Complete Flow

```
WHEN A HEX IS CAPTURED, 7 THINGS HAPPEN:

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  1. OWNERSHIP TRANSFER                                        ║
║     Old owner loses the hex                                   ║
║     New owner gains the hex                                   ║
║     Defense resets to 30 (not 50 — captured = weakened)        ║
║                                                               ║
║  2. ATTACKER REWARDS                                          ║
║     +60 XP                                                    ║
║     +25 coins                                                 ║
║     Mission progress updated                                  ║
║     Streak contribution                                       ║
║                                                               ║
║  3. DEFENDER CONSEQUENCES                                     ║
║     Territory count decremented                               ║
║     Passive income from that hex stops                        ║
║     Contiguity bonuses on adjacent hexes recalculated         ║
║     Gets notified (if Territory Lord+)                        ║
║                                                               ║
║  4. CONTIGUITY CASCADE                                        ║
║     Neighbors of captured hex recalculate their bonuses       ║
║     If defender's territory chain breaks, all isolated         ║
║     hexes lose their contiguity defense bonuses               ║
║                                                               ║
║  5. TERRITORY EVENT LOG                                       ║
║     Event recorded for both players                           ║
║     Visible in battle log / activity feed                     ║
║                                                               ║
║  6. CLUB IMPACT                                               ║
║     If either player is in a club:                            ║
║       - Club territory map updates                            ║
║       - Club activity feed shows capture                      ║
║       - If club war is active, capture counts toward war      ║
║                                                               ║
║  7. LEADERBOARD UPDATE                                        ║
║     Attacker's territory count goes up                        ║
║     Defender's territory count goes down                      ║
║     XP leaderboard updated                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Server-Side Capture Validation (Supabase Edge Function)

```javascript
// This runs when pending actions sync to the server
async function validateCapture(action, userId) {
  const validationResult = {
    valid: true,
    errors: [],
  };

  // 1. Verify hex exists and was owned by claimed previous owner
  const { data: hex } = await supabase
    .from('territories')
    .select('*')
    .eq('hex_id', action.hexId)
    .single();

  if (!hex) {
    // Hex was neutral at sync time — maybe someone else got it first
    // Downgrade to a neutral claim if still unclaimed
    return { valid: true, downgrade: 'CLAIM_NEUTRAL' };
  }

  if (hex.owner_id !== action.previousOwnerId) {
    // Someone else already captured it between the run and sync
    validationResult.valid = false;
    validationResult.errors.push('OWNERSHIP_CHANGED_SINCE_CAPTURE');
    return validationResult;
  }

  // 2. Validate GPS proof
  const gps = action.gpsProof;
  const hexCenter = h3.cellToLatLng(action.hexId);
  const distFromCenter = haversine(
    { lat: gps.lat, lng: gps.lng },
    { lat: hexCenter[0], lng: hexCenter[1] }
  );

  // GPS point should be within hex bounds (with accuracy margin)
  // H3 res 9 hex has ~174m edges, so center-to-edge is ~150m
  if (distFromCenter > 200 + gps.accuracy) {
    validationResult.valid = false;
    validationResult.errors.push('GPS_OUTSIDE_HEX_BOUNDS');
    return validationResult;
  }

  // 3. Verify timing is plausible
  const captureTime = action.captureTime;
  const expectedMinTime = 45 + 1.2 * hex.defense;
  const minWithSpeedBonus = expectedMinTime / CLAIM_CONFIG.speedBonusMultiplier;

  // Allow 20% tolerance for timing inconsistencies
  if (captureTime < minWithSpeedBonus * 0.8) {
    validationResult.valid = false;
    validationResult.errors.push('CAPTURE_TOO_FAST');
    return validationResult;
  }

  // 4. Check for concurrent captures (conflict resolution)
  const { data: pendingCaptures } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('hex_id', action.hexId)
    .eq('type', 'CAPTURE_ENEMY')
    .eq('sync_status', 'pending')
    .neq('user_id', userId);

  if (pendingCaptures && pendingCaptures.length > 0) {
    // Multiple people captured same hex — resolve by timestamp
    return { valid: true, conflictResolution: 'EARLIEST_TIMESTAMP_WINS' };
  }

  return validationResult;
}


// Apply validated capture on server
async function applyCapture(action, userId) {
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('territory_count, total_xp, coins')
    .eq('id', userId)
    .single();

  const { data: previousOwner } = await supabase
    .from('profiles')
    .select('territory_count')
    .eq('id', action.previousOwnerId)
    .single();

  // Transaction: update hex + both players atomically
  await supabase.rpc('process_territory_capture', {
    p_hex_id: action.hexId,
    p_new_owner_id: userId,
    p_previous_owner_id: action.previousOwnerId,
    p_new_defense: 30,
    p_xp_reward: 60,
    p_coin_reward: 25,
    p_captured_at: action.timestamp,
  });

  // Log territory event
  await supabase.from('territory_events').insert({
    hex_id: action.hexId,
    event_type: 'captured',
    actor_id: userId,
    previous_owner_id: action.previousOwnerId,
    defense_at_event: action.previousDefense || 0,
  });

  // Send notification to previous owner (if they have alerts enabled)
  await sendPushNotification(action.previousOwnerId, {
    title: '🏴 Territory Lost!',
    body: `${action.attackerName} captured your territory!`,
    data: { hexId: action.hexId, type: 'territory_lost' },
  });
}
```

### Post-Capture State Diagram

```
BEFORE CAPTURE:
┌─────────────────────────────────┐
│  Hex: 89283082803ffff           │
│  Owner: PlayerA (red)           │
│  Defense: 75                    │
│  Passive Income: 5 coins/day    │
│  Contiguity: 3 neighbors owned  │
│  Defense Bonus: +9              │
│  Effective Defense: 84          │
└─────────────────────────────────┘

AFTER CAPTURE BY PlayerB:
┌─────────────────────────────────┐
│  Hex: 89283082803ffff           │
│  Owner: PlayerB (blue)          │  ← New owner
│  Defense: 30                    │  ← Reset low (captured = weakened)
│  Passive Income: 5 coins/day   │  ← Now goes to PlayerB
│  Contiguity: 0 neighbors owned │  ← PlayerB has no adjacent hexes yet
│  Defense Bonus: +0             │  ← No contiguity bonus
│  Effective Defense: 30         │  ← Vulnerable to recapture!
└─────────────────────────────────┘

IMPACT ON PlayerA's ADJACENT HEXES:
┌─────────────────────────────────┐
│  Adjacent Hex 1 (PlayerA):      │
│  Contiguity: 3 → 2             │  ← Lost a neighbor
│  Defense Bonus: +9 → +6        │  ← Weakened
│  Income Mult: 1.24 → 1.16     │  ← Less income
└─────────────────────────────────┘

This creates a CHAIN WEAKNESS effect:
Capturing one hex weakens all surrounding enemy hexes.
Strategic play = identify the linchpin hex in enemy territory.
```

---

## PART 4: DIAMOND ALLOCATION SYSTEM

### Current Problem

Diamonds are earned via "hard missions or subscription." That's too vague. Here's a complete, balanced system:

### Diamond Economy Design

```
DIAMOND SOURCES:
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  SOURCE                        AMOUNT    FREQUENCY           ║
║  ─────────────────────────────────────────────────────────── ║
║  Empire Builder subscription   50        Monthly             ║
║  Hard daily mission            1-2       ~1 per day          ║
║  Weekly mission completion     3-5       Weekly              ║
║  Monthly mission completion    8-12      Monthly             ║
║  Level up (every level)        2         Per level           ║
║  Level up (milestone: 5,10,15) 5         3 times ever        ║
║  First capture ever            5         One time            ║
║  50th territory captured       10        One time            ║
║  7-day streak                  3         Weekly              ║
║  30-day streak                 10        Monthly             ║
║  Weekend War winner            5-10      Weekly event        ║
║  King of the Hill (monthly)    15-25     Monthly event       ║
║  Club War victory              5         Per war             ║
║  Season completion             20        Quarterly           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

EXPECTED DIAMOND INCOME PER MONTH:
  Free casual player (runs 3x/week):     8-15 diamonds
  Free dedicated player (daily):         20-35 diamonds
  Empire Builder subscriber:             50 + 20-35 = 70-85 diamonds

DIAMOND SINKS:
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  PURCHASE                      COST     EFFECT               ║
║  ─────────────────────────────────────────────────────────── ║
║  Territory Shield (24h)        5        Hex can't be captured ║
║  Instant Fortify (+50 def)     8        One hex to max       ║
║  XP Boost (2× for 1 hour)     3        Double XP            ║
║  Coin Boost (2× for 1 hour)   3        Double coins         ║
║  Capture Speed Boost (1 run)  5        50% faster captures  ║
║  Rename Territory              2        Custom hex name      ║
║  Custom Territory Color        10       Unique hex color     ║
║  Territory Banner              15       Visual flair on hex  ║
║  Profile Badge                 5-25     Cosmetic badges      ║
║  Club Banner Upgrade           20       Custom club visuals  ║
║  Extra Mission Slot (+1 daily) 10       4th daily mission    ║
║  Streak Recovery               15       Don't lose streak    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Diamond Allocation Implementation

```javascript
const DIAMOND_REWARDS = {
  // ═══ ACHIEVEMENT-BASED (One-time) ═══
  achievements: {
    FIRST_TERRITORY:    { diamonds: 5,  trigger: (stats) => stats.totalClaimed >= 1 },
    TERRITORY_10:       { diamonds: 5,  trigger: (stats) => stats.totalClaimed >= 10 },
    TERRITORY_50:       { diamonds: 10, trigger: (stats) => stats.totalClaimed >= 50 },
    TERRITORY_100:      { diamonds: 15, trigger: (stats) => stats.totalClaimed >= 100 },
    FIRST_CAPTURE:      { diamonds: 5,  trigger: (stats) => stats.totalCaptured >= 1 },
    CAPTURES_50:        { diamonds: 10, trigger: (stats) => stats.totalCaptured >= 50 },
    DISTANCE_100KM:     { diamonds: 10, trigger: (stats) => stats.totalDistanceKm >= 100 },
    DISTANCE_500KM:     { diamonds: 20, trigger: (stats) => stats.totalDistanceKm >= 500 },
    DISTANCE_1000KM:    { diamonds: 30, trigger: (stats) => stats.totalDistanceKm >= 1000 },
  },

  // ═══ LEVEL-UP REWARDS ═══
  levelUp: {
    base: 2,              // Every level gives 2 diamonds
    milestones: {         // Bonus at milestone levels
      5:  5,
      10: 10,
      15: 15,
      20: 25,
    },
  },

  // ═══ STREAK REWARDS ═══
  streaks: {
    7:  { diamonds: 3 },
    14: { diamonds: 5 },
    30: { diamonds: 10 },
    60: { diamonds: 15 },
    90: { diamonds: 25 },
  },

  // ═══ MISSION REWARDS ═══
  missions: {
    daily: {
      easy:   { diamonds: 0, coins: 15, xp: 50 },
      medium: { diamonds: 0, coins: 30, xp: 100 },
      hard:   { diamonds: 1, coins: 50, xp: 200 },
    },
    // Bonus for completing ALL daily missions
    dailyCompletion: { diamonds: 1, coins: 25, xp: 75 },
    
    weekly: {
      completion: { diamonds: 5, coins: 200, xp: 500 },
    },
    monthly: {
      completion: { diamonds: 12, coins: 1000, xp: 2000 },
    },
  },
};


// Diamond Award Engine
class DiamondEngine {
  constructor(userId) {
    this.userId = userId;
    this.awardedAchievements = new Set(); // Load from DB on init
  }

  async initialize() {
    const awarded = await achievementsDB.getAll(this.userId);
    awarded.forEach(a => this.awardedAchievements.add(a.id));
  }

  // Check all diamond-granting conditions after a run
  checkRewards(runResult, userStats) {
    const rewards = [];

    // Check achievements
    for (const [id, achievement] of Object.entries(DIAMOND_REWARDS.achievements)) {
      if (this.awardedAchievements.has(id)) continue;
      
      if (achievement.trigger(userStats)) {
        rewards.push({
          type: 'ACHIEVEMENT',
          id,
          diamonds: achievement.diamonds,
          message: `Achievement unlocked! +${achievement.diamonds} 💎`,
        });
        this.awardedAchievements.add(id);
        achievementsDB.put({ id, userId: this.userId, awardedAt: new Date() });
      }
    }

    // Check level up
    if (runResult.leveledUp) {
      const level = runResult.newLevel;
      let diamonds = DIAMOND_REWARDS.levelUp.base;
      
      if (DIAMOND_REWARDS.levelUp.milestones[level]) {
        diamonds += DIAMOND_REWARDS.levelUp.milestones[level];
      }
      
      rewards.push({
        type: 'LEVEL_UP',
        level,
        diamonds,
        message: `Level ${level}! +${diamonds} 💎`,
      });
    }

    // Check streak milestones
    const streak = userStats.currentStreak;
    if (DIAMOND_REWARDS.streaks[streak]) {
      rewards.push({
        type: 'STREAK_MILESTONE',
        streak,
        diamonds: DIAMOND_REWARDS.streaks[streak].diamonds,
        message: `${streak}-day streak! +${DIAMOND_REWARDS.streaks[streak].diamonds} 💎`,
      });
    }

    // Check mission completion diamonds
    if (runResult.completedMissions) {
      runResult.completedMissions.forEach(mission => {
        const missionReward = DIAMOND_REWARDS.missions.daily[mission.difficulty];
        if (missionReward.diamonds > 0) {
          rewards.push({
            type: 'MISSION_COMPLETE',
            missionId: mission.id,
            diamonds: missionReward.diamonds,
          });
        }
      });

      // All daily missions completed bonus
      if (runResult.allDailyMissionsComplete) {
        rewards.push({
          type: 'DAILY_COMPLETE',
          diamonds: DIAMOND_REWARDS.missions.dailyCompletion.diamonds,
          message: 'All daily missions complete! +1 💎',
        });
      }
    }

    return rewards;
  }
}
```

### Diamond Spending — Purchase Validation

```javascript
async function purchaseWithDiamonds(userId, itemId) {
  const SHOP_ITEMS = {
    'shield_24h':       { cost: 5,  type: 'consumable', requiresHexId: true },
    'instant_fortify':  { cost: 8,  type: 'consumable', requiresHexId: true },
    'xp_boost_1h':      { cost: 3,  type: 'consumable' },
    'coin_boost_1h':    { cost: 3,  type: 'consumable' },
    'capture_boost':    { cost: 5,  type: 'consumable' },
    'rename_territory': { cost: 2,  type: 'consumable', requiresHexId: true },
    'custom_color':     { cost: 10, type: 'permanent' },
    'territory_banner': { cost: 15, type: 'permanent' },
    'streak_recovery':  { cost: 15, type: 'consumable' },
    'extra_mission':    { cost: 10, type: 'consumable', duration: '24h' },
  };

  const item = SHOP_ITEMS[itemId];
  if (!item) throw new Error('Invalid item');

  // Atomic transaction: check balance and deduct
  const { data, error } = await supabase.rpc('purchase_diamond_item', {
    p_user_id: userId,
    p_item_id: itemId,
    p_cost: item.cost,
  });

  // Supabase function ensures balance >= cost before deducting
  // Prevents race conditions from double-purchasing

  return data;
}
```

---

## PART 5: MULTI-PLAYER SIMULTANEOUS CAPTURE — THE CRITICAL QUESTION

### Scenario: 3-5 Players Run the Same Path at the Same Time

```
SCENARIO:
Players A, B, C, D, E all start running together through the same 
neighborhood at the same time. They pass through 10 hexes.

QUESTION: Who gets the territories?

This is the MOST IMPORTANT design decision in the entire game.
There are 4 possible approaches. Let me analyze each.
```

### Approach 1: First-Come-First-Served (FCFS) ❌

```
How it works:
  First player to complete the claim timer wins the hex.
  Everyone else's progress is wasted.

Problem:
  ├── GPS variance means one person is always "first" by milliseconds
  ├── Faster runners always win (they enter hex first, finish timer first)
  ├── Incredibly frustrating for group runners
  ├── Running clubs become pointless (your clubmate steals your hexes)
  └── Creates toxic "I was here first!" dynamics

Verdict: TERRIBLE. Do not use.
```

### Approach 2: Everyone Gets It (Clone Ownership) ❌

```
How it works:
  Every player who completes the claim timer gets their own copy.
  Hex can have multiple owners.

Problem:
  ├── Defeats the entire territory competition concept
  ├── No conflict, no strategy, no tension
  ├── Map becomes meaningless (everything is multi-owned)
  ├── Passive income multiplied per player (economy breaks)
  └── "Territory game" with no territory scarcity = not a game

Verdict: TERRIBLE. Destroys the core loop.
```

### Approach 3: Simultaneous Contest (Race) ⚠️

```
How it works:
  All players accumulate progress simultaneously.
  First to 100% progress wins.
  Others are blocked out.

Problem:
  ├── Better than FCFS because skill matters
  ├── Speed bonus becomes ultra-important (arms race)
  ├── But still frustrating for the losers who invested time
  ├── Group runs become competitive instead of cooperative
  └── Offline-first architecture makes real-time race detection hard

Verdict: OKAY for enemies. BAD for allies/friends.
```

### Approach 4: THE CORRECT SOLUTION — Context-Aware Resolution ✅

```
DIFFERENT RULES FOR DIFFERENT RELATIONSHIPS:

╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  CASE 1: ALLIES (Same Club)                                   ║
║  ─────────────────────────────────────────────────────────────║
║  → COOPERATIVE CLAIMING                                        ║
║  All club members' time in the hex STACKS.                     ║
║  3 clubmates in same hex = 3× claim speed.                     ║
║  One person gets assigned ownership (longest time in hex).     ║
║  All participants get XP and coins.                            ║
║  The hex is club territory — benefits all members.             ║
║                                                                ║
║  CASE 2: STRANGERS (No relationship, neutral hex)              ║
║  ─────────────────────────────────────────────────────────────║
║  → FIRST TO COMPLETE WINS, BUT CONSOLATION FOR OTHERS          ║
║  Simultaneous claim = first to reach 100% gets ownership.     ║
║  Others who had >50% progress get:                             ║
║    - 50% of the XP reward (effort recognized)                  ║
║    - 0 coins (didn't win the hex)                              ║
║    - Their siege progress carries over to ADJACENT hexes       ║
║      (momentum bonus: start next hex at 25% progress)          ║
║                                                                ║
║  CASE 3: ENEMIES (One trying to capture other's hex)           ║
║  ─────────────────────────────────────────────────────────────║
║  → ATTACKER vs DEFENDER SIMULTANEOUS PRESENCE                  ║
║  If the OWNER is also running through their own hex:           ║
║    - Owner's presence PAUSES the attacker's progress           ║
║    - Owner automatically fortifies while present               ║
║    - "Active Defense" — your physical presence protects hex    ║
║  If both enter at the same time:                               ║
║    - Owner has priority — their hex, their advantage           ║
║    - Attacker progress is halved while owner is present        ║
║                                                                ║
║  CASE 4: MULTIPLE ENEMIES (3 unallied players, neutral hex)    ║
║  ─────────────────────────────────────────────────────────────║
║  → INDEPENDENT PROGRESS RACE                                   ║
║  Each player tracks their own siege progress independently.    ║
║  First to 100% wins.                                          ║
║  No stacking, no interference between unallied attackers.     ║
║  If two complete in the same sync window:                      ║
║    - Earliest GPS timestamp wins                               ║
║    - Loser's claim is rejected, they get consolation XP        ║
║                                                                ║
║  CASE 5: ALLIED ATTACK (Club members attacking enemy hex)      ║
║  ─────────────────────────────────────────────────────────────║
║  → COOPERATIVE SIEGE                                           ║
║  Club members' capture progress STACKS.                        ║
║  3 clubmates = capture at 3× speed.                           ║
║  This is the main tactical advantage of clubs.                 ║
║  All participants share XP. Owner is assigned to longest       ║
║  contributor. Hex becomes club territory.                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

### Implementation — Multi-Player Resolution Engine

```javascript
/**
 * CONFLICT RESOLUTION ENGINE
 * 
 * This runs SERVER-SIDE when pending actions are synced.
 * Multiple players may have submitted claims for the same hex.
 * This engine resolves who actually gets it.
 */

class ConflictResolutionEngine {
  
  /**
   * Process all pending claims for a single hex
   * Called when syncing pending actions to Supabase
   */
  async resolveHexClaims(hexId, pendingClaims) {
    // Sort by completion timestamp (earliest first)
    const sortedClaims = pendingClaims.sort((a, b) => 
      new Date(a.completedAt) - new Date(b.completedAt)
    );

    // Get current hex state from database
    const hex = await this.getHexFromDB(hexId);
    
    // Group claims by relationship
    const grouped = this.groupByRelationship(sortedClaims);
    
    // ═══ NEUTRAL HEX — Multiple claimants ═══
    if (!hex || hex.owner_id === null) {
      return this.resolveNeutralHexConflict(hexId, grouped);
    }
    
    // ═══ OWNED HEX — Multiple attackers ═══
    return this.resolveOwnedHexConflict(hexId, hex, grouped);
  }

  groupByRelationship(claims) {
    const groups = {};
    
    claims.forEach(claim => {
      const clubId = claim.clubId || 'solo_' + claim.userId;
      if (!groups[clubId]) groups[clubId] = [];
      groups[clubId].push(claim);
    });
    
    return groups;
  }

  async resolveNeutralHexConflict(hexId, groupedClaims) {
    const results = [];
    const groups = Object.values(groupedClaims);
    
    if (groups.length === 1 && groups[0].length >= 1) {
      // ═══ CASE: All claimants are in the same club (or single person) ═══
      const clubClaims = groups[0];
      
      // Winner = person who spent the most time in the hex
      const winner = clubClaims.reduce((best, claim) => 
        claim.timeInHex > best.timeInHex ? claim : best
      );
      
      // Award the hex to winner
      results.push({
        userId: winner.userId,
        hexId,
        result: 'CLAIMED',
        xp: 25,
        coins: 10,
      });
      
      // All other club members get participation rewards
      clubClaims
        .filter(c => c.userId !== winner.userId)
        .forEach(claim => {
          results.push({
            userId: claim.userId,
            hexId,
            result: 'ASSISTED_CLAIM',
            xp: 15,         // 60% XP — you helped but didn't get ownership
            coins: 5,       // 50% coins
            message: `Helped claim territory! ${winner.userName} is the owner.`,
          });
        });
    } 
    else {
      // ═══ CASE: Multiple unrelated players/clubs ═══
      // First to complete wins
      let winnerFound = false;
      
      for (const group of groups) {
        // Sort this group's claims by completion time
        const earliest = group.sort((a, b) => 
          new Date(a.completedAt) - new Date(b.completedAt)
        )[0];
        
        if (!winnerFound) {
          // First group's earliest claimer wins
          winnerFound = true;
          
          results.push({
            userId: earliest.userId,
            hexId,
            result: 'CLAIMED',
            xp: 25,
            coins: 10,
          });
          
          // Club assist rewards for winner's group
          group.filter(c => c.userId !== earliest.userId).forEach(claim => {
            results.push({
              userId: claim.userId,
              hexId,
              result: 'ASSISTED_CLAIM',
              xp: 15,
              coins: 5,
            });
          });
        } 
        else {
          // Losing group — consolation rewards
          group.forEach(claim => {
            results.push({
              userId: claim.userId,
              hexId,
              result: 'CLAIM_CONTESTED_LOST',
              xp: 12,                    // ~50% XP for effort
              coins: 0,                  // No coins — didn't win
              momentumBonus: 0.25,       // 25% head start on adjacent hexes
              message: 'Another runner claimed this territory first!',
            });
          });
        }
      }
    }
    
    return results;
  }

  async resolveOwnedHexConflict(hexId, hex, groupedClaims) {
    const results = [];
    const ownerId = hex.owner_id;
    const groups = Object.values(groupedClaims);
    
    // Check if owner is among the claimants (active defense)
    const ownerGroup = groups.find(group => 
      group.some(c => c.userId === ownerId)
    );
    
    if (ownerGroup) {
      // ═══ OWNER IS PRESENT — Active Defense ═══
      const ownerClaim = ownerGroup.find(c => c.userId === ownerId);
      
      // Owner automatically fortifies
      results.push({
        userId: ownerId,
        hexId,
        result: 'ACTIVE_DEFENSE',
        xp: 20,           // Bonus XP for defending in person
        defenseGain: 10,   // Bonus defense for being physically present
        message: 'You defended your territory in person! +10 defense',
      });
      
      // All attackers' progress is halved retroactively
      groups.forEach(group => {
        if (group === ownerGroup) return;
        
        group.forEach(claim => {
          const adjustedProgress = claim.siegeProgress * 0.5; // Halved
          const required = 45 + 1.2 * (hex.defense + 10); // Owner boosted defense
          
          if (adjustedProgress >= required) {
            // Even with halving, they still captured — impressive
            results.push({
              userId: claim.userId,
              hexId,
              result: 'CAPTURED_AGAINST_ACTIVE_DEFENSE',
              xp: 90,    // 50% bonus XP for overcoming active defense
              coins: 35,
              message: '⚔️ Captured territory despite active defense! Legendary!',
            });
          } else {
            // Failed to capture due to active defense
            results.push({
              userId: claim.userId,
              hexId,
              result: 'CAPTURE_REPELLED',
              xp: 30,    // Effort XP
              coins: 0,
              message: `${hex.owner_name} defended this territory in person!`,
            });
          }
        });
      });
    } 
    else {
      // ═══ OWNER NOT PRESENT — Standard capture resolution ═══
      // Same logic as neutral but with capture math
      let captureSucceeded = false;
      
      for (const group of groups) {
        // Check if this group is a club — stack their progress
        const isClub = group.length > 1 && group[0].clubId === group[1]?.clubId;
        
        let effectiveProgress;
        if (isClub) {
          // Club stacking: sum of all members' progress
          effectiveProgress = group.reduce((sum, c) => sum + c.siegeProgress, 0);
        } else {
          // Solo: just the one player's progress
          effectiveProgress = group[0].siegeProgress;
        }
        
        const required = 45 + 1.2 * hex.defense;
        
        if (effectiveProgress >= required && !captureSucceeded) {
          captureSucceeded = true;
          
          // Winner = highest contributor in group
          const winner = group.reduce((best, c) => 
            c.siegeProgress > best.siegeProgress ? c : best
          );
          
          results.push({
            userId: winner.userId,
            hexId,
            result: 'CAPTURED',
            xp: 60,
            coins: 25,
          });
          
          // Club assists
          group.filter(c => c.userId !== winner.userId).forEach(c => {
            results.push({
              userId: c.userId,
              hexId,
              result: 'ASSISTED_CAPTURE',
              xp: 35,
              coins: 12,
              message: `Helped capture enemy territory!`,
            });
          });
        } 
        else if (!captureSucceeded) {
          // Didn't complete capture
          group.forEach(c => {
            const progress = (isClub ? effectiveProgress : c.siegeProgress) / required;
            results.push({
              userId: c.userId,
              hexId,
              result: 'CAPTURE_INCOMPLETE',
              xp: Math.round(progress * 30), // Partial XP based on progress
              coins: 0,
              progressMade: progress,
              message: `Siege ${Math.round(progress * 100)}% complete. Come back to finish!`,
            });
          });
        }
        else {
          // Someone else already captured it this round
          group.forEach(c => {
            results.push({
              userId: c.userId,
              hexId,
              result: 'CAPTURE_CONTESTED_LOST',
              xp: 15,
              coins: 0,
              message: 'Another player captured this first!',
            });
          });
        }
      }
    }
    
    return results;
  }
}
```

### Visual Timeline — 4 Players Running Together

```
TIME ──────────────────────────────────────────────────────────►

HEX #1 (Neutral)
┌──────────────────────────────────────────────────┐
│ 0s        5s        10s       15s                │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player A    │ ← Enters first (by 1 sec)
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player B    │ ← Same club as A
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player C    │ ← Different club
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player D    │ ← Solo
│                                                  │
│ A+B are in same club → COOPERATIVE               │
│ Their combined progress finishes at ~8 seconds    │
│ A gets ownership (entered first), B gets assist   │
│ C and D were too slow → consolation XP            │
└──────────────────────────────────────────────────┘
                                                    
RESULT: Player A claims hex. B assisted. C and D get partial XP.

HEX #2 (Enemy — owned by Player E, defense 60)
┌──────────────────────────────────────────────────────────────┐
│ Required: 45 + 1.2×60 = 117 seconds                         │
│                                                              │
│ 0s    20s    40s    60s    80s    100s   117s                │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player A      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Player B      │
│ A+B combined = 2× speed → finish at ~59 seconds!            │
│                                                              │
│ Player C (different club) solo = needs full 117 sec          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ (left hex)   │
│ Only accumulated 70 seconds → 60% progress                   │
│                                                              │
│ Player D exits hex at 40 seconds → 34% progress             │
└──────────────────────────────────────────────────────────────┘

RESULT: A+B cooperative capture at 59s. A gets ownership.
        B gets assist rewards. C gets 60% effort XP.
        D gets 34% effort XP. All progress tracked.
```

### Local Detection of Other Players (During Run)

```javascript
/**
 * How do we know other players are in the same hex DURING the run?
 * 
 * The app is offline-first, so we can't always check real-time.
 * Solution: OPTIMISTIC LOCAL + SERVER RECONCILIATION
 */

// DURING RUN (client-side):
// Each player independently tracks their own siege progress.
// They don't know about other players in real-time.
// Claims are optimistic — "I claimed this hex" stored locally.

// AFTER RUN (sync to server):
// Server receives pending actions from multiple players.
// ConflictResolutionEngine resolves who actually gets what.
// Results are pushed back to each client.

// OPTIONAL: Real-time presence (for Territory Lord+ subscribers)
// Uses Supabase Realtime to broadcast current hex presence
class RealtimePresence {
  constructor(supabase, userId) {
    this.channel = supabase.channel('territory-presence');
    
    this.channel.on('presence', { event: 'sync' }, () => {
      this.updateNearbyPlayers();
    });
    
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          userId,
          currentHexId: null,
          timestamp: Date.now(),
        });
      }
    });
  }

  updateCurrentHex(hexId) {
    this.channel.track({
      userId: this.userId,
      currentHexId: hexId,
      timestamp: Date.now(),
    });
  }

  // Get list of other players currently in a specific hex
  getPlayersInHex(hexId) {
    const presenceState = this.channel.presenceState();
    const players = [];
    
    for (const [key, data] of Object.entries(presenceState)) {
      data.forEach(presence => {
        if (presence.currentHexId === hexId && presence.userId !== this.userId) {
          players.push(presence);
        }
      });
    }
    
    return players;
  }
}

// When real-time shows other players in the same hex:
// UI shows their avatar and progress bar alongside yours
// "⚔️ 2 other runners are competing for this hex!"
// Creates tension and urgency even during the run
```

### The Momentum System (Consolation for Losers)

```javascript
/**
 * MOMENTUM BONUS
 * 
 * When you lose a contested claim, you don't walk away empty-handed.
 * Your effort carries forward as a "momentum" bonus on adjacent hexes.
 * 
 * This solves the frustration of "I spent 2 minutes and got nothing."
 */

const MOMENTUM_RULES = {
  // When you lose a contested claim with >50% progress:
  bonusProgressOnAdjacentHex: 0.25,  // Start next hex at 25% progress
  
  // When you lose with >80% progress:
  bonusProgressOnAdjacentHex80: 0.40, // Start next hex at 40% progress
  
  // Momentum expires after:
  expirySeconds: 120,                 // 2 minutes — use it or lose it
  
  // Only applies to hexes within 1 ring of the lost hex
  applyRadius: 1,
};

// In ClaimEngine, when a claim is lost:
handleClaimLost(lostHexId, progressPercent) {
  if (progressPercent < 0.5) return; // No momentum below 50%
  
  const bonus = progressPercent >= 0.8 
    ? MOMENTUM_RULES.bonusProgressOnAdjacentHex80
    : MOMENTUM_RULES.bonusProgressOnAdjacentHex;
  
  const adjacentHexes = h3.gridDisk(lostHexId, 1).filter(h => h !== lostHexId);
  
  adjacentHexes.forEach(hexId => {
    const existing = this.siegeMap.get(hexId);
    if (!existing) {
      const hex = getHexState(hexId);
      const required = hex.ownerId === null ? 15 : 45 + 1.2 * hex.defense;
      
      this.siegeMap.set(hexId, {
        hexId,
        type: hex.ownerId === null ? 'claim' : 'capture',
        accumulated: required * bonus,  // Start with bonus progress
        required,
        startedAt: Date.now(),
        lastUpdateAt: Date.now(),
        isMomentumBonus: true,
      });
    }
  });
  
  // UI notification
  return {
    type: 'MOMENTUM_GAINED',
    bonus: Math.round(bonus * 100) + '%',
    affectedHexes: adjacentHexes.length,
    message: `Lost the race, but gained momentum! ${Math.round(bonus * 100)}% head start on adjacent territories.`,
    expiresIn: MOMENTUM_RULES.expirySeconds,
  };
}
```

---

## PART 6: COMPLETE GAME FLOW — ONE FULL RUN

```
PLAYER OPENS APP
│
├── Auth check → Load profile from Supabase/IndexedDB
├── initialSync() → Pull latest territory state
├── Load daily missions
└── Map renders with current territory state

PLAYER TAPS "START RUN"
│
├── Select activity type (run/walk/cycle/etc.)
├── GPS tracking begins
├── ClaimEngine initialized
├── MissionTracker initialized
├── DiamondEngine loaded
└── Timer starts

RUNNING — GPS TICK EVERY 1-3 SECONDS
│
├── processTick(gpsPoint, activityType)
│   ├── Validate GPS (speed, accuracy)
│   ├── Determine current hex (H3 resolution 9)
│   ├── Classify hex (neutral/own/enemy)
│   ├── Process action:
│   │   ├── Neutral → Claim progress
│   │   ├── Own → Fortify + decay reset
│   │   └── Enemy → Capture progress (with speed multiplier)
│   ├── Check siege completion
│   ├── Update mission progress
│   └── Return events for UI
│
├── UI updates in real-time:
│   ├── Route trail on map
│   ├── Current hex highlighted
│   ├── Siege progress ring (circular progress indicator)
│   ├── Distance/duration/pace stats
│   ├── XP/Coins earned counter
│   ├── Mission progress bars
│   └── Real-time alerts (Territory Lord+)
│
├── All data written to IndexedDB (offline-first)
└── No server calls during run

PLAYER TAPS "END RUN"
│
├── ClaimEngine.getRunSummary() calculates totals
├── Calorie calculation (MET-based by activity type)
├── Level-up check (XP thresholds)
├── Streak update (consecutive day check)
├── Diamond rewards check (achievements, streaks, missions)
│
├── POST-RUN SUMMARY SCREEN:
│   ├── Route map with claimed/captured hexes highlighted
│   ├── Distance, Duration, Avg Pace
│   ├── Territories: 3 claimed, 1 captured, 2 fortified
│   ├── +185 XP (+30 running, +75 claiming, +60 capture, +20 fortify)
│   ├── +55 Coins (+5 running, +30 claiming, +25 capture, -5 fortify cost)
│   ├── +1 💎 (hard mission completed)
│   ├── Mission progress (2/3 daily missions complete)
│   ├── Level progress bar
│   └── Streak: 🔥 7 days → +3 💎 bonus!
│
├── BACKGROUND SYNC (when online):
│   ├── Upload run data to Supabase (runs table)
│   ├── Sync pending territory actions
│   ├── ConflictResolutionEngine processes overlapping claims
│   ├── Server validates GPS proofs
│   ├── Territory ownership finalized
│   ├── If any claims were contested → push notification:
│   │   "Your claim on hex X was contested — another runner got there first!
│   │    You earned 12 XP for the attempt + momentum bonus."
│   ├── Leaderboard updated
│   └── Profile stats updated
│
└── App returns to map view with updated territory

OVERNIGHT (Server-side cron):
│
├── Territory decay calculation
│   ├── Hexes not visited in 3+ days lose defense
│   ├── Hexes at 0 defense become neutral
│   └── Notifications sent for decaying territories
│
├── Passive income distribution
│   ├── 5 coins × contiguity_multiplier per owned hex
│   ├── Only if player ran at least once in past 24h
│   ├── Minus maintenance cost (1 coin/hex above 10 hexes)
│   └── Premium subscribers get 2× rate
│
├── Daily mission reset (new missions generated)
├── Weekly mission progress check (if Sunday)
├── Monthly mission progress check (if 1st)
├── Club stats aggregation
└── Leaderboard weekly table refresh
```

---

## SUMMARY: Key Design Decisions

```
╔══════════════════════════════════════════════════════════════╗
║  TERRITORY DISTRIBUTION                                      ║
║  → H3 Res 9 hexes, born on first interaction, not pre-made  ║
║  → Only owned hexes are stored; neutral = absence of data    ║
║                                                              ║
║  CAPTURE MECHANIC                                            ║
║  → Siege progress persists per-hex within a run              ║
║  → Leave and return = progress continues                     ║
║  → Run ends = all siege progress resets                      ║
║  → Captured hexes start at defense 30 (weakened)             ║
║                                                              ║
║  MULTI-PLAYER RESOLUTION                                     ║
║  → Club members COOPERATE (stacked progress)                 ║
║  → Strangers COMPETE (first to finish wins)                  ║
║  → Owner presence BLOCKS/SLOWS attackers                     ║
║  → Losers get MOMENTUM bonus on adjacent hexes               ║
║  → All participants get EFFORT XP (never zero reward)        ║
║                                                              ║
║  DIAMOND ECONOMY                                             ║
║  → Multiple small sources (streaks, levels, missions)        ║
║  → Large sources gated behind skill (events, achievements)   ║
║  → Meaningful sinks (shields, boosts, cosmetics)             ║
║  → Free players earn 15-35/month; subscribers earn 70-85     ║
║  → Nothing purchasable with diamonds is game-breaking        ║
║                                                              ║
║  CORE PRINCIPLE                                              ║
║  → Running is ALWAYS rewarded. You never waste a run.        ║
║  → Losing a contest still gives XP + momentum.              ║
║  → The game rewards showing up and moving your body.         ║
╚══════════════════════════════════════════════════════════════╝
```

This is a complete, production-ready game logic system. Every edge case — from solo runners to 5-person pile-ups on the same hex — has a defined resolution path that feels fair and keeps players motivated to run again tomorrow.