import Phaser from 'phaser';
import { BULLET, AMMO } from '@asteroidz/shared';
import { emit } from '../net/socket';
import { Bullet } from '../objects/Bullet';
import type { InputState } from './movement';

export class BulletSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Matter.Sprite;
  private input: InputState;
  private bullets = new Set<Phaser.Physics.Matter.Sprite>();
  private ammo: number = AMMO.startingAmmo;
  private lastFireTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    ship: Phaser.Physics.Matter.Sprite,
    input: InputState,
  ) {
    this.scene = scene;
    this.ship = ship;
    this.input = input;

    // Generate a small bright circle texture for bullets
    if (!scene.textures.exists('bullet')) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(BULLET.size, BULLET.size, BULLET.size);
      gfx.generateTexture('bullet', BULLET.size * 2, BULLET.size * 2);
      gfx.destroy();
    }
  }

  update(_delta: number): void {
    const now = this.scene.time.now;

    // Fire when Space held, ammo available, and fire rate allows
    if (
      this.input.shoot &&
      this.ammo > 0 &&
      now - this.lastFireTime >= BULLET.fireRateMs
    ) {
      this.fire(now);
    }

    // Despawn bullets that have exceeded max travel distance
    for (const sprite of this.bullets) {
      const bullet = Bullet.from(sprite);
      if (!bullet) continue;
      const dx = sprite.x - bullet.spawnX;
      const dy = sprite.y - bullet.spawnY;
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        this.destroyBullet(sprite);
      }
    }
  }

  destroyBullet(bullet: Phaser.Physics.Matter.Sprite): void {
    if (!this.bullets.has(bullet)) return;
    this.bullets.delete(bullet);
    bullet.destroy();
  }

  /** True if this bullet belongs to the local bullet system — used by the collision router. */
  owns(bullet: Phaser.Physics.Matter.Sprite): boolean {
    return this.bullets.has(bullet);
  }

  resetAmmo(): void {
    this.ammo = AMMO.startingAmmo;
  }

  addAmmo(count: number): void {
    this.ammo = Math.min(this.ammo + count, AMMO.maxAmmo);
  }

  ammoCount(): number {
    return this.ammo;
  }

  destroy(): void {
    for (const sprite of this.bullets) {
      sprite.destroy();
    }
    this.bullets.clear();
  }

  private fire(now: number): void {
    const x = this.ship.x;
    const y = this.ship.y;
    // Subtract 90° to match the local velocity direction (ship texture points north, Phaser angle=0 is east)
    const rotation = Phaser.Math.DegToRad(this.ship.angle - 90);

    const sprite = this.scene.matter.add.sprite(x, y, 'bullet', undefined, {
      shape: { type: 'circle', radius: BULLET.size },
      isSensor: true,
      frictionAir: 0,
      label: 'bullet-local',
    });

    const body = sprite.body as MatterJS.BodyType;
    const vx = Math.cos(rotation) * BULLET.speed;
    const vy = Math.sin(rotation) * BULLET.speed;
    this.scene.matter.body.setVelocity(body, { x: vx, y: vy });

    new Bullet(sprite, x, y);
    this.bullets.add(sprite);

    this.ammo -= 1;
    this.lastFireTime = now;

    emit('player:shoot', { x, y, rotation });
  }
}
