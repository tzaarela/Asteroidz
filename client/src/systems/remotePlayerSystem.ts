import Phaser from 'phaser';
import type { LobbyState, PlayerTransform } from '@asteroidz/shared';
import { SHIP } from '@asteroidz/shared';
import { on, off } from '../net/socket';
import { ensureShipTexture } from '../utils/shipTexture';
import { Player } from '../objects/Player';

interface RemoteShipState {
  player: Player;
  prev: PlayerTransform;
  target: PlayerTransform;
  nameLabel: Phaser.GameObjects.Text;
}

// Lerp factor per frame. At 60fps and 20Hz updates (~3 frames/tick),
// factor 0.2 gives smooth EMA convergence without overshoot on burst arrivals.
const LERP = 0.2;

export class RemotePlayerSystem {
  private scene: Phaser.Scene;
  private myId: string;
  private lobbyState: LobbyState;
  private ships = new Map<string, RemoteShipState>();
  /** Reverse lookup: Matter body id → player socket id. Used by the collision router. */
  private bodyIdToPlayer = new Map<number, string>();

  constructor(scene: Phaser.Scene, myId: string, lobbyState: LobbyState) {
    this.scene = scene;
    this.myId = myId;
    this.lobbyState = lobbyState;

    // Pre-spawn sprites for players already in the lobby
    for (const info of lobbyState.players) {
      if (info.id !== myId) {
        this.addPlayer(info.id, info.color, info.name);
      }
    }

    on('player:update',   this.handlePlayerUpdate);
    on('player:died',     this.handlePlayerDied);
    on('player:respawn',  this.handlePlayerRespawn);
  }

  /** Called every frame from GameScene.update(). */
  update(): void {
    for (const entry of this.ships.values()) {
      const sprite = entry.player.sprite;
      const { nameLabel } = entry;

      // Position — simple linear lerp
      const nx = Phaser.Math.Linear(entry.prev.x, entry.target.x, LERP);
      const ny = Phaser.Math.Linear(entry.prev.y, entry.target.y, LERP);

      // Rotation — shortest-angle interpolation to avoid wrong-direction spin.
      // PlayerTransform.rotation is in [-π, π] so delta is in (-2π, 2π),
      // meaning the while loops each execute at most once.
      let delta = entry.target.rotation - entry.prev.rotation;
      while (delta > Math.PI)  delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const nrot = entry.prev.rotation + delta * LERP;

      // Matter static bodies require explicit body transforms — direct sprite.x/y
      // assignment does NOT move the body. setPosition/setRotation on the sprite
      // is the Phaser Matter wrapper that drives the body for us.
      sprite.setPosition(nx, ny);
      sprite.setRotation(nrot);

      // Write interpolated values back into prev — this is the EMA pattern.
      // The sprite converges toward target across frames rather than jumping.
      entry.prev = {
        x: nx,
        y: ny,
        rotation: nrot,
        vx: Phaser.Math.Linear(entry.prev.vx, entry.target.vx, LERP),
        vy: Phaser.Math.Linear(entry.prev.vy, entry.target.vy, LERP),
      };

      // Name label sits just above the ship's top edge
      nameLabel.x = nx;
      nameLabel.y = ny - SHIP.size - 4;
    }
  }

  /** Called from GameScene.handleLobbyState when matchActive, to handle departures. */
  syncWithLobbyState(lobbyState: LobbyState): void {
    this.lobbyState = lobbyState;
    const incomingIds = new Set(lobbyState.players.map(p => p.id));
    for (const [id] of this.ships) {
      if (!incomingIds.has(id)) {
        this.removePlayer(id);
      }
    }
  }

  destroy(): void {
    off('player:update',   this.handlePlayerUpdate);
    off('player:died',     this.handlePlayerDied);
    off('player:respawn',  this.handlePlayerRespawn);
    for (const [id] of [...this.ships]) {
      this.removePlayer(id);
    }
  }

  /** Resolves a Matter body back to the owning player's socket ID. */
  getPlayerIdForBody(bodyId: number): string | undefined {
    return this.bodyIdToPlayer.get(bodyId);
  }

  private handlePlayerDied = (payload: { playerId: string; killerId: string | null }): void => {
    if (payload.playerId === this.myId) return;
    const entry = this.ships.get(payload.playerId);
    if (!entry) return;
    const sprite = entry.player.sprite;
    sprite.setActive(false).setVisible(false);
    // Remove the body from the world while dead so it stops colliding with bullets.
    this.scene.matter.world.remove(sprite.body as MatterJS.BodyType);
  };

  private handlePlayerRespawn = (payload: { playerId: string; x: number; y: number }): void => {
    if (payload.playerId === this.myId) return;
    const entry = this.ships.get(payload.playerId);
    if (!entry) return;
    const snap: PlayerTransform = { x: payload.x, y: payload.y, rotation: 0, vx: 0, vy: 0 };
    entry.prev   = { ...snap };
    entry.target = { ...snap };
    const sprite = entry.player.sprite;
    sprite.setPosition(payload.x, payload.y);
    sprite.setActive(true).setVisible(true);
    // Re-add the body to the world on respawn.
    this.scene.matter.world.add(sprite.body as MatterJS.BodyType);
  };

  private handlePlayerUpdate = (payload: PlayerTransform & { playerId: string }): void => {
    if (payload.playerId === this.myId) return;

    const entry = this.ships.get(payload.playerId);
    if (!entry) {
      // Late-join: player was in the game before we got a lobby:state for them.
      const info = this.lobbyState.players.find(p => p.id === payload.playerId);
      if (!info) return; // Unknown player — discard until lobby:state catches up
      this.addPlayer(payload.playerId, info.color, info.name);
      // Snap directly to real position — avoids lerping from (0, 0)
      const newEntry = this.ships.get(payload.playerId)!;
      newEntry.prev = { ...payload };
      newEntry.target = { ...payload };
      return;
    }

    // Shift the buffer: previous target becomes the new starting point
    entry.prev = { ...entry.target };
    entry.target = { x: payload.x, y: payload.y, rotation: payload.rotation, vx: payload.vx, vy: payload.vy };
  }

  private addPlayer(id: string, hexColor: string, name: string): void {
    const textureKey = ensureShipTexture(this.scene, hexColor);

    // Kinematic static sensor — position driven by network, emits collision events
    // for bullets but does not respond to forces and does not push the local ship.
    const sprite = this.scene.matter.add.sprite(0, 0, textureKey, undefined, {
      shape: { type: 'circle', radius: SHIP.size },
      isStatic: true,
      isSensor: true,
      label: 'ship-remote',
    });
    sprite.setOrigin(0.5, 0.4);

    const body = sprite.body as MatterJS.BodyType;
    this.bodyIdToPlayer.set(body.id, id);

    const nameLabel = this.scene.add
      .text(0, 0, name, { fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' })
      .setOrigin(0.5, 1); // bottom-center anchored so it sits above the ship

    const zero: PlayerTransform = { x: 0, y: 0, rotation: 0, vx: 0, vy: 0 };
    const player = new Player(id, hexColor, sprite, false);
    this.ships.set(id, { player, prev: { ...zero }, target: { ...zero }, nameLabel });
  }

  private removePlayer(id: string): void {
    const entry = this.ships.get(id);
    if (!entry) return;
    const body = entry.player.sprite.body as MatterJS.BodyType | null;
    if (body) this.bodyIdToPlayer.delete(body.id);
    entry.player.destroy();
    entry.nameLabel.destroy();
    this.ships.delete(id);
  }

}
