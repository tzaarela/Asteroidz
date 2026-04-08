import Phaser from 'phaser';
import { ARENA, PICKUPS } from '@asteroidz/shared';
import type { PickupType } from '@asteroidz/shared';
import { emit } from '../net/socket';

const PICKUP_SIZE = 10;
const PICKUP_TEXTURE = 'pickup_ammo';

export class PickupSystem {
  private scene: Phaser.Scene;
  private pickupGroup: Phaser.Physics.Arcade.Group;
  private pickups = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Diamond shape: rotate a square 45° — visually distinct from white bullet circles
    const gfx = scene.add.graphics();
    const s = PICKUP_SIZE;
    gfx.fillStyle(0x00ffff, 1);
    gfx.fillTriangle(s, 0, s * 2, s, s, s * 2);
    gfx.fillTriangle(s, 0, 0, s, s, s * 2);
    gfx.generateTexture(PICKUP_TEXTURE, s * 2, s * 2);
    gfx.destroy();

    this.pickupGroup = scene.physics.add.group({
      maxSize: 20,
      runChildUpdate: false,
    });
  }

  getPickupGroup(): Phaser.Physics.Arcade.Group {
    return this.pickupGroup;
  }

  startSpawning(): void {
    this.spawnTimer = this.scene.time.addEvent({
      delay: PICKUPS.spawnIntervalMs,
      loop: true,
      callback: this.spawnAmmoPickup,
      callbackScope: this,
    });
  }

  private spawnAmmoPickup(): void {
    const cx = ARENA.worldWidth / 2;
    const cy = ARENA.worldHeight / 2;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * ARENA.arenaRadius * 0.8;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const pickupId = crypto.randomUUID();
    const type: PickupType = 'ammo' as PickupType;

    this.spawnPickup(pickupId, type, x, y);
    emit('pickup:spawn', { pickupId, type, x, y });
  }

  spawnPickup(id: string, type: PickupType, x: number, y: number): void {
    if (this.pickups.has(id)) return;

    const sprite = this.pickupGroup.get(x, y, PICKUP_TEXTURE) as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return;

    sprite.setActive(true).setVisible(true);
    sprite.setData('pickupId', id);
    sprite.setData('type', type);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setCircle(PICKUP_SIZE);

    this.pickups.set(id, sprite);
  }

  removePickup(id: string): void {
    const sprite = this.pickups.get(id);
    if (!sprite) return;

    this.pickupGroup.killAndHide(sprite);
    (sprite.body as Phaser.Physics.Arcade.Body).setEnable(false);
    this.pickups.delete(id);
  }

  destroy(): void {
    this.spawnTimer?.destroy();
    this.spawnTimer = null;
    this.pickupGroup.clear(true, true);
    this.pickups.clear();
  }
}
