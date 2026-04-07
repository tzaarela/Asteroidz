import Phaser from 'phaser';
import type { LobbyState, PlayerTransform } from '@asteroidz/shared';
import { SHIP } from '@asteroidz/shared';
import { on, off } from '../network/socket';

interface RemoteShipState {
  prev: PlayerTransform;
  target: PlayerTransform;
  sprite: Phaser.Physics.Arcade.Sprite;
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
  private shipGroup: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, myId: string, lobbyState: LobbyState) {
    this.scene = scene;
    this.myId = myId;
    this.lobbyState = lobbyState;
    this.shipGroup = scene.physics.add.group();

    // Pre-spawn sprites for players already in the lobby
    for (const info of lobbyState.players) {
      if (info.id !== myId) {
        this.addPlayer(info.id, info.color, info.name);
      }
    }

    on('player:update', this.handlePlayerUpdate);
  }

  /** Called every frame from GameScene.update(). */
  update(): void {
    for (const entry of this.ships.values()) {
      const { sprite, nameLabel } = entry;

      // Position — simple linear lerp
      sprite.x = Phaser.Math.Linear(entry.prev.x, entry.target.x, LERP);
      sprite.y = Phaser.Math.Linear(entry.prev.y, entry.target.y, LERP);

      // Rotation — shortest-angle interpolation to avoid wrong-direction spin.
      // PlayerTransform.rotation is in [-π, π] so delta is in (-2π, 2π),
      // meaning the while loops each execute at most once.
      let delta = entry.target.rotation - entry.prev.rotation;
      while (delta > Math.PI)  delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      sprite.rotation = entry.prev.rotation + delta * LERP;

      // Write interpolated values back into prev — this is the EMA pattern.
      // The sprite converges toward target across frames rather than jumping.
      entry.prev = {
        x: sprite.x,
        y: sprite.y,
        rotation: sprite.rotation,
        vx: Phaser.Math.Linear(entry.prev.vx, entry.target.vx, LERP),
        vy: Phaser.Math.Linear(entry.prev.vy, entry.target.vy, LERP),
      };

      // Name label sits just above the ship's top edge
      nameLabel.x = sprite.x;
      nameLabel.y = sprite.y - SHIP.size - 4;
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
    off('player:update', this.handlePlayerUpdate);
    for (const [id] of [...this.ships]) {
      this.removePlayer(id);
    }
  }

  /** Returns the Phaser group containing all remote ship sprites — use for overlap registration. */
  getShipGroup(): Phaser.Physics.Arcade.Group {
    return this.shipGroup;
  }

  /** Resolves a remote ship sprite back to the player's socket ID. */
  getPlayerIdForSprite(sprite: Phaser.Physics.Arcade.Sprite): string | undefined {
    for (const [id, entry] of this.ships) {
      if (entry.sprite === sprite) return id;
    }
  }

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
    const textureKey = this.ensureTexture(hexColor);

    const sprite = this.scene.physics.add.sprite(0, 0, textureKey);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(SHIP.size, 0, 0);
    body.setImmovable(true); // Not driven by local physics — exists for hit detection
    this.shipGroup.add(sprite);

    const nameLabel = this.scene.add
      .text(0, 0, name, { fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' })
      .setOrigin(0.5, 1); // bottom-center anchored so it sits above the ship

    const zero: PlayerTransform = { x: 0, y: 0, rotation: 0, vx: 0, vy: 0 };
    this.ships.set(id, { prev: { ...zero }, target: { ...zero }, sprite, nameLabel });
  }

  private removePlayer(id: string): void {
    const entry = this.ships.get(id);
    if (!entry) return;
    this.shipGroup.remove(entry.sprite, false, false);
    entry.sprite.destroy();
    entry.nameLabel.destroy();
    this.ships.delete(id);
  }

  /** Generates a triangle texture for the given hex color, reusing it if already cached. */
  private ensureTexture(hexColor: string): string {
    const key = `ship_${hexColor.replace('#', '')}`;
    if (!this.scene.textures.exists(key)) {
      const color = Phaser.Display.Color.HexStringToColor(hexColor).color;
      const s = SHIP.size;
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(color, 1);
      gfx.fillTriangle(s, 0, 0, s * 2, s * 2, s * 2); // same shape as local ship
      gfx.generateTexture(key, s * 2, s * 2);
      gfx.destroy();
    }
    return key;
  }
}
