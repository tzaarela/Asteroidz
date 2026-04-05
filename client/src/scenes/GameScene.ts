import Phaser from 'phaser';
import type { LobbyState } from '@asteroidz/shared';
import { MatchPhase, ARENA, PHYSICS, SHIP } from '@asteroidz/shared';
import { on, off, emit, getSocketId } from '../network/socket';
import { LobbyPanel } from '../ui/LobbyPanel';

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;
  private myId!: string;
  private lobbyPanel!: LobbyPanel;
  private titleText!: Phaser.GameObjects.Text;

  private shipSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private matchActive = false;

  constructor() {
    super('GameScene');
  }

  init(data: { lobbyState: LobbyState }): void {
    this.lobbyState = data.lobbyState;
    this.myId = getSocketId() ?? '';
    this.shipSprite = null;
    this.matchActive = false;
  }

  create(): void {
    this.titleText = this.add
      .text(this.scale.width / 2, 40, 'ASTEROIDZ', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.lobbyPanel = new LobbyPanel(
      this,
      this.lobbyState,
      this.myId,
      () => this.onLeave(),
      () => this.onStartMatch(),
    );

    on('lobby:state', this.handleLobbyState);
    on('match:state', this.handleMatchState);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state', this.handleLobbyState);
      off('match:state', this.handleMatchState);
    });
  }

  private handleLobbyState = (lobbyState: LobbyState): void => {
    this.lobbyState = lobbyState;
    if (!this.matchActive) {
      this.lobbyPanel.update(lobbyState, this.myId);
    }
  };

  private handleMatchState = (payload: { state: MatchPhase }): void => {
    if (this.matchActive) return;
    if (payload.state !== MatchPhase.Warmup && payload.state !== MatchPhase.Active) return;

    this.matchActive = true;
    this.titleText.destroy();
    this.lobbyPanel.destroy();

    this.physics.world.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);
    this.cameras.main.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);

    this.createLocalShip();
  };

  private createLocalShip(): void {
    const me = this.lobbyState.players.find(p => p.id === this.myId);
    if (!me) return;

    const color = Phaser.Display.Color.HexStringToColor(me.color).color;
    const s = SHIP.size;

    // Draw triangle pointing up — tip at top-center, base at bottom
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillTriangle(s, 0, 0, s * 2, s * 2, s * 2);
    gfx.generateTexture('local_ship', s * 2, s * 2);
    gfx.destroy();

    const cx = ARENA.worldWidth / 2;
    const cy = ARENA.worldHeight / 2;
    this.shipSprite = this.physics.add.sprite(cx, cy, 'local_ship');

    const body = this.shipSprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocity(PHYSICS.maxVelocity);
    // Circular body sized to roughly match the triangle
    body.setCircle(s, 0, 0);

    this.cameras.main.startFollow(this.shipSprite);
  }

  private onLeave(): void {
    emit('lobby:leave');
    this.scene.start('MenuScene');
  }

  private onStartMatch(): void {
    emit('lobby:start');
  }
}
