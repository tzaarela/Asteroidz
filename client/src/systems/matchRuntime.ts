import Phaser from 'phaser';
import type { LobbyState, PickupType } from '@asteroidz/shared';
import { SHIP, AMMO } from '@asteroidz/shared';
import { emit } from '../net/socket';
import { MovementSystem } from './movement';
import type { InputState } from './movement';
import { RemotePlayerSystem } from './remotePlayerSystem';
import { BulletSystem } from './bulletSystem';
import { RemoteBulletSystem } from './remoteBulletSystem';
import { PickupSystem } from './pickups';
import { ArenaSystem } from './arena';
import { MatterCollisionRouter } from './matterCollisionRouter';
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
}

/**
 * Owns every gameplay object that only exists for the duration of a match:
 * the local ship, the gameplay systems, Matter collision routing, the arena,
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
  readonly arena: ArenaSystem;
  readonly touch: TouchControls | null;

  private readonly scene: Phaser.Scene;
  private readonly collisions: MatterCollisionRouter;
  private readonly ammoDisplay: Phaser.GameObjects.Graphics;
  private readonly playerColor: number;

  /** Convenience accessor — external callers (GameScene camera, state sender) read the sprite directly. */
  get shipSprite(): Phaser.Physics.Matter.Sprite {
    return this.player.sprite;
  }

  constructor(config: MatchRuntimeConfig) {
    const { scene, lobbyState, myId, inputState, touchInput, isTouchDevice, spawnX, spawnY } = config;
    this.scene = scene;

    const me = lobbyState.players.find(p => p.id === myId);
    if (!me) {
      throw new Error(`MatchRuntime: local player ${myId} not found in lobby state`);
    }

    // Local ship sprite — dynamic Matter body with air friction matching the
    // old Arcade drag feel, and restitution for ship-to-ship bounce.
    const textureKey = ensureShipTexture(scene, me.color);
    const shipSprite = scene.matter.add.sprite(spawnX, spawnY, textureKey, undefined, {
      shape: { type: 'circle', radius: SHIP.size },
      frictionAir: 0.02,
      friction: 0,
      restitution: 0.4,
      label: 'ship-local',
    });
    shipSprite.setOrigin(0.5, 0.4); // keeps rotation visually centered on the body
    this.player = new Player(myId, me.color, shipSprite, true);

    this.playerColor = Phaser.Display.Color.HexStringToColor(me.color).color;
    this.ammoDisplay = scene.add.graphics();

    // Arena walls — polygon Matter bodies. Previously dead code; now wired.
    this.arena = new ArenaSystem(scene);

    // Gameplay systems
    this.movement = new MovementSystem(scene, shipSprite, inputState);
    this.remotePlayers = new RemotePlayerSystem(scene, myId, lobbyState);
    this.remoteBullets = new RemoteBulletSystem(scene, () => lobbyState.players);
    this.bullets = new BulletSystem(scene, shipSprite, inputState);
    this.touch = isTouchDevice ? new TouchControls(scene, touchInput) : null;

    this.pickups = new PickupSystem(scene);
    if (myId === lobbyState.leaderId) {
      this.pickups.startSpawning();
    }

    // Matter collision routing — replaces Arcade overlap callbacks.
    this.collisions = new MatterCollisionRouter(scene);

    // Local bullet hitting a remote ship → report kill.
    this.collisions.on('bullet-local', 'ship-remote', (bulletBody, shipBody) => {
      const bulletSprite = (bulletBody as unknown as { gameObject?: Phaser.Physics.Matter.Sprite }).gameObject;
      if (bulletSprite && this.bullets.owns(bulletSprite)) {
        this.bullets.destroyBullet(bulletSprite);
      }
      const targetId = this.remotePlayers.getPlayerIdForBody(shipBody.id);
      if (targetId) emit('player:hit', { targetId });
    });

    // Local ship touching a pickup → collect.
    this.collisions.on('ship-local', 'pickup', (_shipBody, pickupBody) => {
      const pickupId = this.pickups.getPickupIdForBody(pickupBody.id);
      if (!pickupId) return;
      const type = this.pickups.getPickupType(pickupId) as PickupType;
      this.pickups.removePickup(pickupId);
      this.bullets.addAmmo(AMMO.ammoPerPickup);
      emit('pickup:collected', { pickupId, type });
    });

    // Bullet hitting a wall chunk → despawn the bullet. Wall destruction
    // itself is a future feature; for parity with the old (unwired) Arcade
    // build we just absorb the bullet without destroying the wall.
    this.collisions.on('bullet-local', 'wall-', (bulletBody) => {
      const bulletSprite = (bulletBody as unknown as { gameObject?: Phaser.Physics.Matter.Sprite }).gameObject;
      if (bulletSprite && this.bullets.owns(bulletSprite)) {
        this.bullets.destroyBullet(bulletSprite);
      }
    });
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
    // Remove the body from the world while dead so nothing collides with it.
    this.scene.matter.world.remove(sprite.body as MatterJS.BodyType);
    this.ammoDisplay.setVisible(false);
  }

  /** Reposition and re-enable the ship after the respawn delay. */
  respawnAt(x: number, y: number): void {
    const sprite = this.player.sprite;
    const body = sprite.body as MatterJS.BodyType;
    this.scene.matter.world.add(body);
    sprite.setPosition(x, y);
    sprite.setRotation(0);
    this.scene.matter.body.setVelocity(body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(body, 0);
    sprite.setActive(true).setVisible(true);
    this.ammoDisplay.setVisible(true);
    this.bullets.resetAmmo();
  }

  destroy(): void {
    this.collisions.destroy();
    this.pickups.destroy();
    this.arena.destroy();
    this.player.destroy();
    this.ammoDisplay.destroy();
    this.bullets.destroy();
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
