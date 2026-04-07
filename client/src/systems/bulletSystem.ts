import Phaser from 'phaser';
import { BULLET, AMMO } from '@asteroidz/shared';
import { emit } from '../network/socket';

export class BulletSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Arcade.Sprite;
  private spaceKey: Phaser.Input.Keyboard.Key;
  private bulletGroup: Phaser.Physics.Arcade.Group;
  private ammo: number = AMMO.startingAmmo;
  private lastFireTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    ship: Phaser.Physics.Arcade.Sprite,
    spaceKey: Phaser.Input.Keyboard.Key,
  ) {
    this.scene = scene;
    this.ship = ship;
    this.spaceKey = spaceKey;

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
      this.spaceKey.isDown &&
      this.ammo > 0 &&
      now - this.lastFireTime >= BULLET.fireRateMs
    ) {
      this.fire(now);
    }

    // Despawn bullets that have exceeded max travel distance
    for (const obj of this.bulletGroup.getChildren()) {
      const bullet = obj as Phaser.Physics.Arcade.Sprite;
      if (!bullet.active) continue;

      const dx = bullet.x - (bullet.getData('spawnX') as number);
      const dy = bullet.y - (bullet.getData('spawnY') as number);
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        this.destroyBullet(bullet);
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

  private fire(now: number): void {
    const x = this.ship.x;
    const y = this.ship.y;
    // Subtract 90° to match the local velocity direction (ship texture points north, Phaser angle=0 is east)
    const rotation = Phaser.Math.DegToRad(this.ship.angle - 90);

    const bullet = this.bulletGroup.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return; // pool exhausted

    bullet.setActive(true).setVisible(true);

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setCircle(BULLET.size);
    // Ship texture points north; angle=0 is east in Phaser — subtract 90° to align
    const vel = this.scene.physics.velocityFromAngle(this.ship.angle - 90, BULLET.speed);
    body.velocity.set(vel.x, vel.y);

    bullet.setData('spawnX', x);
    bullet.setData('spawnY', y);

    this.ammo -= 1;
    this.lastFireTime = now;

    emit('player:shoot', { x, y, rotation });
  }
}
