import Phaser from 'phaser';
import { BULLET } from '@asteroidz/shared';
import { on, off } from '../net/socket';
import { Bullet } from '../objects/Bullet';
import type { PlayerInfo } from '@asteroidz/shared';

export class RemoteBulletSystem {
  private scene: Phaser.Scene;
  private bullets: Phaser.Physics.Arcade.Group;
  private getPlayers: () => PlayerInfo[];

  constructor(scene: Phaser.Scene, getPlayers: () => PlayerInfo[]) {
    this.scene = scene;
    this.getPlayers = getPlayers;
    this.bullets = scene.physics.add.group();
    on('player:shoot', this.handleRemoteShoot);
  }

  private ensureTexture(hexColor: string): string {
    const key = `bullet_${hexColor.replace('#', '')}`;
    if (!this.scene.textures.exists(key)) {
      const color = Phaser.Display.Color.HexStringToColor(hexColor).color;
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(color, 1);
      gfx.fillCircle(BULLET.size, BULLET.size, BULLET.size);
      gfx.generateTexture(key, BULLET.size * 2, BULLET.size * 2);
      gfx.destroy();
    }
    return key;
  }

  private handleRemoteShoot = (payload: {
    playerId: string;
    x: number;
    y: number;
    rotation: number;
  }): void => {
    const player = this.getPlayers().find(p => p.id === payload.playerId);
    const color = player?.color ?? '#FFFFFF';
    const textureKey = this.ensureTexture(color);

    const sprite = this.bullets.get(payload.x, payload.y, textureKey) as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return;

    sprite.enableBody(true, payload.x, payload.y, true, true);
    new Bullet(sprite, payload.x, payload.y);

    const dx = Math.cos(payload.rotation);
    const dy = Math.sin(payload.rotation);
    (sprite.body as Phaser.Physics.Arcade.Body).setVelocity(dx * BULLET.speed, dy * BULLET.speed);
  };

  update(): void {
    this.bullets.getChildren().forEach((obj) => {
      const sprite = obj as Phaser.Physics.Arcade.Sprite;
      if (!sprite.active) return;

      const bullet = Bullet.from(sprite);
      if (!bullet) return;
      const dx = sprite.x - bullet.spawnX;
      const dy = sprite.y - bullet.spawnY;
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        sprite.disableBody(true, true);
      }
    });
  }

  getBulletGroup(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }

  destroy(): void {
    off('player:shoot', this.handleRemoteShoot);
    this.bullets.clear(true, true);
  }
}
