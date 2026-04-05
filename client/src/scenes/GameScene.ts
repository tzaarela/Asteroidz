import Phaser from 'phaser';
import { ARENA } from '@asteroidz/shared/constants';
import type { LobbyState } from '@asteroidz/shared';

const STAR_COUNT = 300;
const STAR_SEED = 42;

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { lobbyState } = this.scene.settings.data as { lobbyState: LobbyState };
    this.lobbyState = lobbyState;

    this.physics.world.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);
    this.cameras.main.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);

    // Background fill covering the full world
    this.add.rectangle(
      ARENA.worldWidth / 2,
      ARENA.worldHeight / 2,
      ARENA.worldWidth,
      ARENA.worldHeight,
      0x030712
    );

    this.createStarField();
  }

  setFollowTarget(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(60, 40);
  }

  private createStarField(): void {
    const graphics = this.add.graphics();
    let seed = STAR_SEED;

    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    for (let i = 0; i < STAR_COUNT; i++) {
      const x = rand() * ARENA.worldWidth;
      const y = rand() * ARENA.worldHeight;
      const radius = rand() < 0.8 ? 1 : 1.5;
      const alpha = 0.3 + rand() * 0.5;
      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(x, y, radius);
    }
  }
}
