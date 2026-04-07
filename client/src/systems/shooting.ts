import Phaser from 'phaser';
import { BULLET, AMMO, SHIP } from '@asteroidz/shared';
import { emit } from '../network/socket';

export class ShootingSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Arcade.Sprite;
  private spaceKey: Phaser.Input.Keyboard.Key;
  private bullets: Phaser.Physics.Arcade.Group;
  private ammo: number;
  private lastFireTime: number;

  constructor(
    scene: Phaser.Scene,
    ship: Phaser.Physics.Arcade.Sprite,
    spaceKey: Phaser.Input.Keyboard.Key,
    playerColorHex: string,
  ) {
    this.scene = scene;
    this.ship = ship;
    this.spaceKey = spaceKey;
    this.ammo = AMMO.startingAmmo;
    // Allow firing immediately on spawn
    this.lastFireTime = -BULLET.fireRateMs;

    // Generate a small filled-circle texture in the player's color
    const color = Phaser.Display.Color.HexStringToColor(playerColorHex).color;
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillCircle(BULLET.size, BULLET.size, BULLET.size);
    gfx.generateTexture('bullet_local', BULLET.size * 2, BULLET.size * 2);
    gfx.destroy();

    this.bullets = scene.physics.add.group();
  }

  update(time: number): void {
    // Fire on Space press if ammo available and fire rate allows
    if (
      Phaser.Input.Keyboard.JustDown(this.spaceKey) &&
      this.ammo > 0 &&
      time - this.lastFireTime >= BULLET.fireRateMs
    ) {
      this.fire(time);
    }

    // Despawn bullets that have exceeded max travel distance
    this.bullets.getChildren().forEach((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Sprite;
      if (!bullet.active) return;

      const dx = bullet.x - (bullet.getData('spawnX') as number);
      const dy = bullet.y - (bullet.getData('spawnY') as number);
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        this.despawnBullet(bullet);
      }
    });
  }

  private fire(time: number): void {
    this.ammo--;
    this.lastFireTime = time;

    // Facing direction — matches movement.ts thrust angle offset
    const facingDeg = this.ship.angle - 90;
    const facingRad = Phaser.Math.DegToRad(facingDeg);
    const dx = Math.cos(facingRad);
    const dy = Math.sin(facingRad);

    // Spawn at the triangle tip: SHIP.size pixels ahead of the ship center
    const noseX = this.ship.x + dx * SHIP.size;
    const noseY = this.ship.y + dy * SHIP.size;

    // Get pooled bullet (or create new one if none available)
    const bullet = this.bullets.get(noseX, noseY, 'bullet_local') as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return;

    // Re-enable physics body and position for pooled bullets
    bullet.enableBody(true, noseX, noseY, true, true);
    bullet.setData('spawnX', noseX);
    bullet.setData('spawnY', noseY);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(dx * BULLET.speed, dy * BULLET.speed);

    emit('player:shoot', { x: noseX, y: noseY, rotation: facingRad });
  }

  private despawnBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    // Disable physics body and hide — returns bullet to the pool
    bullet.disableBody(true, true);
  }

  get ammoCount(): number {
    return this.ammo;
  }

  destroy(): void {
    this.bullets.clear(true, true);
  }
}
