import Phaser from 'phaser';
import { BULLET, AMMO } from '@asteroidz/shared';
import { emit } from '../net/socket';
import { Bullet } from '../objects/Bullet';
import type { InputState } from './movement';

export class BulletSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Arcade.Sprite;
  private input: InputState;
  private bulletGroup: Phaser.Physics.Arcade.Group;
  private ammo: number = AMMO.startingAmmo;
  private lastFireTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    ship: Phaser.Physics.Arcade.Sprite,
    input: InputState,
  ) {
    this.scene = scene;
    this.ship = ship;
    this.input = input;

    // Generate a small bright circle texture for bullets
    const gfx = scene.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(BULLET.size, BULLET.size, BULLET.size);
    gfx.generateTexture('bullet', BULLET.size * 2, BULLET.size * 2);
    gfx.destroy();

    this.bulletGroup = scene.physics.add.group({
      maxSize: 50,
      runChildUpdate: false,
    });
  }

  getBulletGroup(): Phaser.Physics.Arcade.Group {
    return this.bulletGroup;
  }

  update(delta: number): void {
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
    for (const obj of this.bulletGroup.getChildren()) {
      const sprite = obj as Phaser.Physics.Arcade.Sprite;
      if (!sprite.active) continue;

      const bullet = Bullet.from(sprite);
      if (!bullet) continue;
      const dx = sprite.x - bullet.spawnX;
      const dy = sprite.y - bullet.spawnY;
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        this.destroyBullet(sprite);
      }
    }
  }

  destroyBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    this.bulletGroup.killAndHide(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setEnable(false);
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

  private fire(now: number): void {
    const x = this.ship.x;
    const y = this.ship.y;
    // Subtract 90° to match the local velocity direction (ship texture points north, Phaser angle=0 is east)
    const rotation = Phaser.Math.DegToRad(this.ship.angle - 90);

    const sprite = this.bulletGroup.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return; // pool exhausted

    sprite.setActive(true).setVisible(true);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setCircle(BULLET.size);
    // Ship texture points north; angle=0 is east in Phaser — subtract 90° to align
    const vel = this.scene.physics.velocityFromAngle(this.ship.angle - 90, BULLET.speed);
    body.velocity.set(vel.x, vel.y);

    new Bullet(sprite, x, y);

    this.ammo -= 1;
    this.lastFireTime = now;

    emit('player:shoot', { x, y, rotation });
  }
}
