/**
 * shared/types/game.ts
 *
 * Single source of truth for all game domain types.
 * These are the data contracts between client and server.
 * Shared between both workspaces — import from '@asteroidz/shared'.
 */

// ---------------------------------------------------------------------------
// Primitive shared types (moved from events.ts)
// ---------------------------------------------------------------------------

export interface Vector2 {
  x: number;
  y: number;
}

/** Full kinematic state of a ship at a point in time. */
export interface PlayerTransform {
  x: number;
  y: number;
  rotation: number; // radians
  vx: number;
  vy: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: string; // hex string, e.g. '#ff4444'
}

export interface ScoreEntry {
  playerId: string;
  kills: number;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum MatchPhase {
  Warmup = 'warmup',
  Active = 'active',
  Victory = 'victory',
}

export enum PickupType {
  Ammo = 'ammo',
  Shield = 'shield',
}

// ---------------------------------------------------------------------------
// Game state interfaces
// ---------------------------------------------------------------------------

/** Full runtime state of a player. Sent at ~20 updates/sec — keep lean. */
export interface Player {
  id: string;
  name: string;
  color: string;
  position: Vector2;
  rotation: number; // radians
  velocity: { vx: number; vy: number };
  ammo: number;
  hasShield: boolean;
  kills: number;
  alive: boolean;
}

export interface Bullet {
  id: string;
  ownerId: string;
  position: Vector2;
  direction: { dx: number; dy: number };
  spawnTime: number;
}

export interface Pickup {
  id: string;
  type: PickupType;
  position: Vector2;
}

export interface ArenaChunk {
  id: string;
  vertices: Vector2[]; // polygon points
  destroyed: boolean;
}

export interface LobbyState {
  code: string;
  players: PlayerInfo[];
  leaderId: string;
  matchPhase: MatchPhase;
}

export interface MatchState {
  phase: MatchPhase;
  scores: Record<string, number>; // playerId → kills
  winnerId: string | null;
}
