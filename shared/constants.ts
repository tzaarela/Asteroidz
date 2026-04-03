// Shared gameplay constants — single source of truth for all tunable values.
// Import from '@asteroidz/shared/constants' in both client and server.

export const PHYSICS = {
  thrustForce: 200,        // pixels/s² acceleration when thrusting
  rotationSpeed: 180,      // degrees/s
  maxVelocity: 400,        // pixels/s
  drag: 0.98,              // velocity multiplier per frame (1 = no drag, 0 = instant stop)
} as const;

export const BULLET = {
  speed: 600,              // pixels/s
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
} as const;

export const NETWORK = {
  tickRateMs: 50,          // ms between position update broadcasts (~20/s)
  interpolationBufferMs: 100, // ms of interpolation lag for smooth remote movement
} as const;

export const MATCH = {
  killsToWin: 5,
  victoryDisplayMs: 7000,  // ms to show victory screen before returning to warmup
} as const;
