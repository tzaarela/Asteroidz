// Shared gameplay constants — single source of truth for all tunable values.
// Import from '@asteroidz/shared/constants' in both client and server.

export const PHYSICS = {
  thrustForce: 10,        // pixels/s² acceleration when thrusting
  strafeForce: 6,         // pixels/s² acceleration when strafing (Q/E)
  rotationSpeed: 180,      // degrees/s
  maxVelocity: 30,        // pixels/s
  maxStrafeVelocity: 20,  // pixels/s cap when strafing without forward thrust
  drag: 0.98,              // velocity multiplier per frame (1 = no drag, 0 = instant stop)
} as const;

export const SHIP = {
  size: 20,  // half-height of triangle in pixels; used for texture size and physics body radius
} as const;

export const BULLET = {
  speed: 30,              // pixels/s
  maxDistance: 800,        // pixels before despawn
  size: 4,                 // radius in pixels
  fireRateMs: 200,         // minimum ms between shots
} as const;

export const AMMO = {
  startingAmmo: 5,
  maxAmmo: 5,
  ammoPerPickup: 5,
} as const;

export const RESPAWN = {
  delayMs: 2500,           // ms before respawn after death
  invulnerabilityMs: 2000, // ms of spawn invulnerability after respawn
} as const;

export const PICKUPS = {
  spawnIntervalMs: 10000,  // ms between pickup spawns
  types: {
    ammo: 'ammo',
    shield: 'shield',
  },
} as const;

export const ARENA = {
  worldWidth: 3200,        // pixels
  worldHeight: 3200,       // pixels
  arenaRadius: 1400,       // pixels — radius of the playable circular area
  wallChunkCount: 24,      // number of polygon wall chunks forming the boundary
  arenaChunkSeed: 77,      // LCG seed for chunk vertex jitter (separate from STAR_SEED=42)
  chunkInnerRadius: 1340,  // arenaRadius - 60; inner face of wall ring
  chunkOuterRadius: 1460,  // arenaRadius + 60; outer face of wall ring
  chunkArcGapFraction: 0.08, // fraction of arc span removed as gap on each side
  chunkVertexJitter: 18,   // ±px random displacement per polygon vertex
} as const;

export const ASTEROID = {
  fieldSeed: 137,           // LCG seed — different from ARENA seed (77) and STAR_SEED (42)
  countNormal: 50,          // number of normal (gray) asteroids
  countCrystal: 8,          // number of silver/blue crystal asteroids
  countGold: 4,             // number of gold nugget asteroids
  minSpacing: 80,           // minimum px between asteroid centers
  placementAttempts: 30,    // max retries per asteroid before giving up
  minRadius: 22,            // minimum polygon circumradius in px
  maxRadius: 55,            // maximum polygon circumradius in px
  vertexCountMin: 5,        // minimum polygon sides
  vertexCountMax: 8,        // maximum polygon sides
  vertexJitter: 0.35,       // fraction of radius for shrink-only per-vertex noise
  crystalOreValue: 5,       // ore points for destroying a crystal asteroid
  goldOreValue: 10,         // ore points for destroying a gold asteroid
} as const;

export const NETWORK = {
  tickRateMs: 50,          // ms between position update broadcasts (~20/s)
  interpolationBufferMs: 100, // ms of interpolation lag for smooth remote movement
} as const;

export const MATCH = {
  killsToWin: 3,
  victoryDisplayMs: 7000,  // ms to show victory screen before returning to warmup
} as const;

export const PLAYER_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#FFE66D', // yellow
  '#A29BFE', // purple
  '#55EFC4', // mint
  '#FD79A8', // pink
  '#74B9FF', // sky blue
  '#FDCB6E', // orange
] as const;
