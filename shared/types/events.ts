/**
 * shared/types/events.ts
 *
 * Single source of truth for all Socket.IO event names and payload types.
 * Shared between client and server — import from '@asteroidz/shared'.
 *
 * Usage:
 *   Server: new Server<ClientToServerEvents, ServerToClientEvents>()
 *   Client: io() as Socket<ServerToClientEvents, ClientToServerEvents>
 *
 * TODO (A7): Once game.ts is created, move Vector2, PlayerTransform,
 * PlayerInfo, and ScoreEntry into shared/types/game.ts and import them here.
 */

// ---------------------------------------------------------------------------
// Primitive shared types (to be moved to game.ts in A7)
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
// Domain enums / union types
// ---------------------------------------------------------------------------

export type MatchState = 'warmup' | 'active' | 'victory';

export type PickupType = 'ammo' | 'shield';

// ---------------------------------------------------------------------------
// Lobby payload types
// ---------------------------------------------------------------------------

export interface LobbyState {
  lobbyId: string;
  players: PlayerInfo[];
  leaderId: string;
  matchState: MatchState;
}

// ---------------------------------------------------------------------------
// ClientToServerEvents
// Events that a connected client sends to the server.
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  // --- Lobby ---

  /** Create a new lobby. Server responds with lobby:state. */
  'lobby:create': (payload: { name: string; color: string }) => void;

  /** Join an existing lobby by ID. Server responds with lobby:state. */
  'lobby:join': (payload: { lobbyId: string; name: string; color: string }) => void;

  /** Leave the current lobby. */
  'lobby:leave': () => void;

  /** Leader-only: start the match (transitions warmup → active). */
  'lobby:start': () => void;

  // --- Player ---

  /** Periodic position/state update; relayed to all other players in lobby. */
  'player:update': (payload: PlayerTransform) => void;

  /** Player fired a bullet. Relayed to all others. */
  'player:shoot': (payload: { x: number; y: number; rotation: number }) => void;

  /**
   * Shooter reports a confirmed hit on targetId.
   * Server validates, increments kill count, and broadcasts player:died.
   */
  'player:hit': (payload: { targetId: string }) => void;

  /** Player has respawned at the given position after their death delay. */
  'player:respawn': (payload: { x: number; y: number }) => void;

  // --- Pickups ---

  /** Player collected a pickup. Server removes it for everyone. */
  'pickup:collected': (payload: { pickupId: string; type: PickupType }) => void;

  // --- Arena ---

  /** A wall chunk was destroyed by a bullet. Relayed to all others. */
  'arena:destroy': (payload: { chunkId: string }) => void;
}

// ---------------------------------------------------------------------------
// ServerToClientEvents
// Events that the server sends to one or more clients.
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  // --- Lobby ---

  /** Full lobby snapshot: sent on join, on player join/leave, and on match state change. */
  'lobby:state': (payload: LobbyState) => void;

  // --- Player (relayed) ---

  /** Remote player position update; includes the sender's socket ID. */
  'player:update': (payload: PlayerTransform & { playerId: string }) => void;

  /** Remote player fired; includes the sender's socket ID. */
  'player:shoot': (payload: {
    playerId: string;
    x: number;
    y: number;
    rotation: number;
  }) => void;

  /**
   * Server confirms a kill — broadcast to all players.
   * killerId is null if death was caused by flying into the void.
   */
  'player:died': (payload: { playerId: string; killerId: string | null }) => void;

  /** Server relays a respawn to all other players in the lobby. */
  'player:respawn': (payload: { playerId: string; x: number; y: number }) => void;

  // --- Pickups ---

  /**
   * Server (via lobby leader) spawns a pickup.
   * Sent to all players in the lobby.
   */
  'pickup:spawn': (payload: {
    pickupId: string;
    type: PickupType;
    x: number;
    y: number;
  }) => void;

  /** Server confirms a pickup was collected; removes it for all players. */
  'pickup:collected': (payload: {
    pickupId: string;
    collectorId: string;
    type: PickupType;
  }) => void;

  // --- Arena ---

  /** Server relays wall destruction to all players in the lobby. */
  'arena:destroy': (payload: { chunkId: string; destroyerId: string }) => void;

  // --- Match ---

  /** Current match phase. Sent on state transitions and when a player joins. */
  'match:state': (payload: { state: MatchState }) => void;

  /** Updated kill counts for all players; sent after each confirmed kill. */
  'match:score': (payload: { scores: ScoreEntry[] }) => void;

  /** First player to reach the kill target — match is over. */
  'match:winner': (payload: { winnerId: string; scores: ScoreEntry[] }) => void;

  /** Match is resetting — clients should clear state and return to warmup. */
  'match:reset': () => void;
}
