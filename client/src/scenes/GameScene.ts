import Phaser from 'phaser';
import { ARENA } from '@asteroidz/shared/constants';
import type { LobbyState } from '@asteroidz/shared';
import { on, off, emit, getSocketId } from '../network/socket';
import { LobbyPanel } from '../ui/LobbyPanel';

const STAR_COUNT = 300;
const STAR_SEED = 42;

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;
  private myId!: string;
  private lobbyPanel!: LobbyPanel;

  constructor() {
    super('GameScene');
  }

  init(data: { lobbyState: LobbyState }): void {
    this.lobbyState = data.lobbyState;
    this.myId = getSocketId() ?? '';
  }

  create(): void {
    this.physics.world.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);
    this.cameras.main.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);

    this.add.rectangle(
      ARENA.worldWidth / 2,
      ARENA.worldHeight / 2,
      ARENA.worldWidth,
      ARENA.worldHeight,
      0x030712
    );

    this.createStarField();

    this.add
      .text(this.scale.width / 2, 40, 'ASTEROIDZ', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.lobbyPanel = new LobbyPanel(
      this,
      this.lobbyState,
      this.myId,
      () => this.onLeave(),
      () => this.onStartMatch(),
    );

    on('lobby:state', this.handleLobbyState);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state', this.handleLobbyState);
    });
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

  private handleLobbyState = (lobbyState: LobbyState): void => {
    this.lobbyState = lobbyState;
    this.lobbyPanel.update(lobbyState, this.myId);
  };

  private onLeave(): void {
    emit('lobby:leave');
    this.scene.start('MenuScene');
  }

  private onStartMatch(): void {
    emit('lobby:start');
  }
}
