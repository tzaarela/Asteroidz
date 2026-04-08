import Phaser from 'phaser';
import { ARENA, PICKUPS } from '@asteroidz/shared';
import type { PickupType } from '@asteroidz/shared';
import { emit } from '../net/socket';

const PICKUP_SIZE = 10;
const PICKUP_TEXTURE = 'pickup_ammo';

interface PickupEntry {
  sprite: Phaser.Physics.Matter.Sprite;
  type: PickupType;
}

export class PickupSystem {
  private scene: Phaser.Scene;
  private pickups = new Map<string, PickupEntry>();
  /** Reverse lookup: Matter body id → pickup id. Used by the collision router. */
  private bodyIdToPickup = new Map<number, string>();
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Diamond shape: rotate a square 45° — visually distinct from white bullet circles
    if (!scene.textures.exists(PICKUP_TEXTURE)) {
      const gfx = scene.add.graphics();
      const s = PICKUP_SIZE;
      gfx.fillStyle(0x00ffff, 1);
      gfx.fillTriangle(s, 0, s * 2, s, s, s * 2);
      gfx.fillTriangle(s, 0, 0, s, s, s * 2);
      gfx.generateTexture(PICKUP_TEXTURE, s * 2, s * 2);
      gfx.destroy();
    }
  }

  startSpawning(): void {
    this.spawnTimer = this.scene.time.addEvent({
      delay: PICKUPS.spawnIntervalMs,
      loop: true,
      callback: this.spawnAmmoPickup,
      callbackScope: this,
    });
  }

  /** Look up a pickup id by its Matter body id. */
  getPickupIdForBody(bodyId: number): string | undefined {
    return this.bodyIdToPickup.get(bodyId);
  }

  getPickupType(id: string): PickupType | undefined {
    return this.pickups.get(id)?.type;
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

    const sprite = this.scene.matter.add.sprite(x, y, PICKUP_TEXTURE, undefined, {
      shape: { type: 'circle', radius: PICKUP_SIZE },
      isStatic: true,
      isSensor: true,
      label: 'pickup',
    });
    sprite.setData('pickupId', id);
    sprite.setData('type', type);

    const body = sprite.body as MatterJS.BodyType;
    this.pickups.set(id, { sprite, type });
    this.bodyIdToPickup.set(body.id, id);
  }

  removePickup(id: string): void {
    const entry = this.pickups.get(id);
    if (!entry) return;

    const body = entry.sprite.body as MatterJS.BodyType;
    this.bodyIdToPickup.delete(body.id);
    entry.sprite.destroy();
    this.pickups.delete(id);
  }

  destroy(): void {
    this.spawnTimer?.destroy();
    this.spawnTimer = null;
    for (const entry of this.pickups.values()) {
      entry.sprite.destroy();
    }
    this.pickups.clear();
    this.bodyIdToPickup.clear();
  }
}
