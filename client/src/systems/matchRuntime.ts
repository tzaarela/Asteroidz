import Phaser from 'phaser';
import type { LobbyState } from '@asteroidz/shared';
import { PHYSICS, SHIP, AMMO } from '@asteroidz/shared';
import { MovementSystem } from './movement';
import type { InputState } from './movement';
import { RemotePlayerSystem } from './remotePlayerSystem';
import { BulletSystem } from './bulletSystem';
import { RemoteBulletSystem } from './remoteBulletSystem';
import { PickupSystem } from './pickups';
import { TouchControls } from '../ui/touchControls';
import { ensureShipTexture } from '../utils/shipTexture';
import { Player } from '../objects/Player';

export interface MatchRuntimeConfig {
  scene: Phaser.Scene;
  lobbyState: LobbyState;
  myId: string;
  inputState: InputState;
  touchInput: InputState;
  isTouchDevice: boolean;
  spawnX: number;
  spawnY: number;
  onBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;
  onPickup: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;
}

/**
 * Owns every gameplay object that only exists for the duration of a match:
 * the local ship, the five gameplay systems, physics overlap colliders,
 * touch overlay, and the local ammo display. Constructed when the match
 * transitions into Warmup/Active, destroyed on match reset.
 */
export class MatchRuntime {
  readonly player: Player;
  readonly movement: MovementSystem;
  readonly remotePlayers: RemotePlayerSystem;
  readonly bullets: BulletSystem;
  readonly remoteBullets: RemoteBulletSystem;
  readonly pickups: PickupSystem;
  readonly touch: TouchControls | null;

  private readonly scene: Phaser.Scene;
  private readonly bulletHitCollider: Phaser.Physics.Arcade.Collider;
  private readonly pickupCollider: Phaser.Physics.Arcade.Collider;
  private readonly ammoDisplay: Phaser.GameObjects.Graphics;
  private readonly playerColor: number;

  /** Convenience accessor — external callers (GameScene camera, state sender) read the sprite directly. */
  get shipSprite(): Phaser.Physics.Arcade.Sprite {
    return this.player.sprite;
  }

  constructor(config: MatchRuntimeConfig) {
    const { scene, lobbyState, myId, inputState, touchInput, isTouchDevice, spawnX, spawnY, onBulletHit, onPickup } = config;
    this.scene = scene;

    const me = lobbyState.players.find(p => p.id === myId);
    if (!me) {
      throw new Error(`MatchRuntime: local player ${myId} not found in lobby state`);
    }

    // Local ship sprite — wrapped in a Player for gameplay systems to consume.
    const textureKey = ensureShipTexture(scene, me.color);
    const shipSprite = scene.physics.add.sprite(spawnX, spawnY, textureKey);
    shipSprite.setOrigin(0.5, 0.4); // keeps rotation visually centered on the body
    const body = shipSprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocity(PHYSICS.maxVelocity);
    body.setCircle(SHIP.size, 0, 0);
    this.player = new Player(myId, me.color, shipSprite, true);

    this.playerColor = Phaser.Display.Color.HexStringToColor(me.color).color;
    this.ammoDisplay = scene.add.graphics();

    // Gameplay systems
    this.movement = new MovementSystem(scene, shipSprite, inputState);
    this.remotePlayers = new RemotePlayerSystem(scene, myId, lobbyState);
    this.remoteBullets = new RemoteBulletSystem(scene, () => lobbyState.players);
    this.bullets = new BulletSystem(scene, shipSprite, inputState);
    this.touch = isTouchDevice ? new TouchControls(scene, touchInput) : null;

    // Physics overlaps
    this.bulletHitCollider = scene.physics.add.overlap(
      this.bullets.getBulletGroup(),
      this.remotePlayers.getShipGroup(),
      onBulletHit,
    ) as Phaser.Physics.Arcade.Collider;

    this.pickups = new PickupSystem(scene);
    this.pickupCollider = scene.physics.add.overlap(
      this.shipSprite,
      this.pickups.getPickupGroup(),
      onPickup,
    ) as Phaser.Physics.Arcade.Collider;

    if (myId === lobbyState.leaderId) {
      this.pickups.startSpawning();
    }
  }

  /** Pumps gameplay systems and draws the ammo HUD. Called from GameScene.update. */
  update(delta: number, isDead: boolean): void {
    if (!isDead) {
      this.movement.update(delta);
      this.bullets.update(delta);
    }
    this.updateAmmoDisplay();
    this.remotePlayers.update();
    this.remoteBullets.update();
  }

  /** Hide/disable the local ship — called when the player dies. */
  hideShip(): void {
    const sprite = this.player.sprite;
    sprite.setActive(false).setVisible(false);
    (sprite.body as Phaser.Physics.Arcade.Body).setEnable(false);
    this.ammoDisplay.setVisible(false);
  }

  /** Reposition and re-enable the ship after the respawn delay. */
  respawnAt(x: number, y: number): void {
    const sprite = this.player.sprite;
    sprite.setPosition(x, y);
    sprite.setRotation(0);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(true);
    sprite.setActive(true).setVisible(true);
    this.ammoDisplay.setVisible(true);
    this.bullets.resetAmmo();
  }

  destroy(): void {
    this.bulletHitCollider.destroy();
    this.pickupCollider.destroy();
    this.pickups.destroy();
    this.player.destroy();
    this.ammoDisplay.destroy();
    this.remotePlayers.destroy();
    this.remoteBullets.destroy();
    this.touch?.destroy();
  }

  private updateAmmoDisplay(): void {
    const gfx = this.ammoDisplay;
    const ship = this.player.sprite;
    const ammo = this.bullets.ammoCount();
    const dotRadius = 3;
    const dotSpacing = 10;
    const totalWidth = (AMMO.maxAmmo - 1) * dotSpacing;

    gfx.clear();
    gfx.setPosition(ship.x - totalWidth / 2, ship.y + SHIP.size + 6);

    for (let i = 0; i < AMMO.maxAmmo; i++) {
      const x = i * dotSpacing;
      if (i < ammo) {
        gfx.fillStyle(this.playerColor, 1);
        gfx.fillCircle(x, 0, dotRadius);
      } else {
        gfx.lineStyle(1, this.playerColor, 0.3);
        gfx.strokeCircle(x, 0, dotRadius);
      }
    }
  }
}
