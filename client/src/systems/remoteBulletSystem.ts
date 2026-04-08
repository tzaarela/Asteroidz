import Phaser from 'phaser';
import { BULLET } from '@asteroidz/shared';
import { on, off } from '../net/socket';
import { Bullet } from '../objects/Bullet';
import type { PlayerInfo } from '@asteroidz/shared';

export class RemoteBulletSystem {
  private scene: Phaser.Scene;
  private bullets = new Set<Phaser.Physics.Matter.Sprite>();
  private getPlayers: () => PlayerInfo[];

  constructor(scene: Phaser.Scene, getPlayers: () => PlayerInfo[]) {
    this.scene = scene;
    this.getPlayers = getPlayers;
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

    const sprite = this.scene.matter.add.sprite(payload.x, payload.y, textureKey, undefined, {
      shape: { type: 'circle', radius: BULLET.size },
      isSensor: true,
      frictionAir: 0,
      label: 'bullet-remote',
    });

    new Bullet(sprite, payload.x, payload.y);

    const dx = Math.cos(payload.rotation);
    const dy = Math.sin(payload.rotation);
    this.scene.matter.body.setVelocity(
      sprite.body as MatterJS.BodyType,
      { x: dx * BULLET.speed, y: dy * BULLET.speed },
    );

    this.bullets.add(sprite);
  };

  update(): void {
    for (const sprite of this.bullets) {
      const bullet = Bullet.from(sprite);
      if (!bullet) continue;
      const dx = sprite.x - bullet.spawnX;
      const dy = sprite.y - bullet.spawnY;
      if (dx * dx + dy * dy >= BULLET.maxDistance * BULLET.maxDistance) {
        this.bullets.delete(sprite);
        sprite.destroy();
      }
    }
  }

  destroy(): void {
    off('player:shoot', this.handleRemoteShoot);
    for (const sprite of this.bullets) {
      sprite.destroy();
    }
    this.bullets.clear();
  }
}
