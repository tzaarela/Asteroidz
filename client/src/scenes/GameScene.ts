import Phaser from 'phaser';
import type { LobbyState, PlayerTransform, ScoreEntry } from '@asteroidz/shared';
import { MatchPhase, ARENA, PHYSICS, SHIP, NETWORK, RESPAWN, AMMO } from '@asteroidz/shared';
import { on, off, emit, getSocketId } from '../network/socket';
import { LobbyPanel } from '../ui/LobbyPanel';
import { MovementSystem } from '../systems/movement';
import { RemotePlayerSystem } from '../systems/remotePlayerSystem';
import { BulletSystem } from '../systems/bulletSystem';
import { RemoteBulletSystem } from '../systems/remoteBulletSystem';

const STAR_COUNT = 300;
const STAR_SEED = 42;

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;
  private myId!: string;
  private lobbyPanel!: LobbyPanel;
  private titleText!: Phaser.GameObjects.Text;

  private shipSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private movementSystem: MovementSystem | null = null;
  private remotePlayerSystem: RemotePlayerSystem | null = null;
  private bulletSystem: BulletSystem | null = null;
  private remoteBulletSystem: RemoteBulletSystem | null = null;
  private bulletHitCollider: Phaser.Physics.Arcade.Collider | null = null;
  private keys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; SPACE: Phaser.Input.Keyboard.Key } | null = null;
  private killCountText: Phaser.GameObjects.Text | null = null;
  private matchActive = false;
  private tickAccumulator = 0;
  private isDead = false;

  constructor() {
    super('GameScene');
  }

  init(data: { lobbyState: LobbyState }): void {
    this.lobbyState = data.lobbyState;
    this.myId = getSocketId() ?? '';
    this.shipSprite = null;
    this.movementSystem = null;
    this.remotePlayerSystem = null;
    this.bulletSystem = null;
    this.remoteBulletSystem = null;
    this.matchActive = false;
    this.tickAccumulator = 0;
    this.isDead = false;
  }

  create(): void {
    this.physics.world.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);
    this.cameras.main.setBounds(0, 0, ARENA.worldWidth, ARENA.worldHeight);

    this.keys = this.input.keyboard!.addKeys('W,A,D,SPACE') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      SPACE: Phaser.Input.Keyboard.Key;
    };

    this.add.rectangle(
      ARENA.worldWidth / 2,
      ARENA.worldHeight / 2,
      ARENA.worldWidth,
      ARENA.worldHeight,
      0x030712
    );

    this.createStarField();

    this.titleText = this.add
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

    on('lobby:state',  this.handleLobbyState);
    on('match:state',  this.handleMatchState);
    on('match:reset',  this.handleMatchReset);
    on('match:score',  this.handleMatchScore);
    on('player:died',  this.handlePlayerDied);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state',  this.handleLobbyState);
      off('match:state',  this.handleMatchState);
      off('match:reset',  this.handleMatchReset);
      off('match:score',  this.handleMatchScore);
      off('player:died',  this.handlePlayerDied);
      this.remotePlayerSystem?.destroy();
      this.remoteBulletSystem?.destroy();
      this.bulletSystem = null;
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
    if (!this.matchActive) {
      this.lobbyPanel.update(lobbyState, this.myId);
    } else {
      this.remotePlayerSystem?.syncWithLobbyState(lobbyState);
    }
  };

  private handleMatchState = (payload: { state: MatchPhase }): void => {
    if (this.matchActive) return;
    if (payload.state !== MatchPhase.Warmup && payload.state !== MatchPhase.Active) return;

    this.matchActive = true;
    this.titleText.destroy();
    this.lobbyPanel.destroy();

    const me = this.lobbyState.players.find(p => p.id === this.myId);
    this.killCountText = this.add
      .text(20, 20, '0', {
        fontSize: '32px',
        color: me?.color ?? '#ffffff',
        fontFamily: 'monospace',
      })
      .setScrollFactor(0);

    this.createLocalShip();
    this.remotePlayerSystem = new RemotePlayerSystem(this, this.myId, this.lobbyState);
    this.remoteBulletSystem = new RemoteBulletSystem(this, () => this.lobbyState.players);
    this.bulletSystem = new BulletSystem(this, this.shipSprite!, this.keys!.SPACE);
    this.bulletHitCollider = this.physics.add.overlap(
      this.bulletSystem.getBulletGroup(),
      this.remotePlayerSystem.getShipGroup(),
      this.onBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    ) as Phaser.Physics.Arcade.Collider;
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

    this.setFollowTarget(this.shipSprite);
    this.movementSystem = new MovementSystem(this, this.shipSprite, this.keys!);
  }

  private handleMatchScore = (payload: { scores: ScoreEntry[] }): void => {
    const entry = payload.scores.find(s => s.playerId === this.myId);
    if (entry) {
      this.killCountText?.setText(String(entry.kills));
    }
  };

  private onBulletHitPlayer = (
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    remoteShip: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void => {
    this.bulletSystem!.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
    const targetId = this.remotePlayerSystem!.getPlayerIdForSprite(
      remoteShip as Phaser.Physics.Arcade.Sprite,
    );
    if (targetId) emit('player:hit', { targetId });
  };

  update(_time: number, delta: number): void {
    if (!this.isDead) {
      this.movementSystem?.update(delta);
      this.bulletSystem?.update(delta);
    }
    this.remotePlayerSystem?.update();
    this.remoteBulletSystem?.update();

    if (this.shipSprite) {
      this.tickAccumulator += delta;
      if (this.tickAccumulator >= NETWORK.tickRateMs) {
        this.tickAccumulator -= NETWORK.tickRateMs;
        this.sendPlayerState();
      }
    }
  }

  private sendPlayerState(): void {
    if (!this.shipSprite) return;
    const body = this.shipSprite.body as Phaser.Physics.Arcade.Body;
    const payload: PlayerTransform = {
      x: this.shipSprite.x,
      y: this.shipSprite.y,
      rotation: Phaser.Math.DegToRad(this.shipSprite.angle),
      vx: body.velocity.x,
      vy: body.velocity.y,
    };
    emit('player:update', payload);
  }

  private handlePlayerDied = (payload: { playerId: string; killerId: string | null }): void => {
    if (payload.playerId !== this.myId) return;
    this.isDead = true;
    if (this.shipSprite) {
      this.shipSprite.setActive(false).setVisible(false);
      (this.shipSprite.body as Phaser.Physics.Arcade.Body).setEnable(false);
    }
    this.time.delayedCall(RESPAWN.delayMs, () => this.respawnLocalShip());
  };

  private calculateSafeSpawnPosition(): { x: number; y: number } {
    const cx = ARENA.worldWidth / 2;
    const cy = ARENA.worldHeight / 2;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * ARENA.arenaRadius * 0.8; // stay 20% away from arena wall
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  private respawnLocalShip(): void {
    if (!this.shipSprite) return;
    const { x, y } = this.calculateSafeSpawnPosition();
    this.shipSprite.setPosition(x, y);
    this.shipSprite.setRotation(0);
    const body = this.shipSprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(true);
    this.shipSprite.setActive(true).setVisible(true);
    this.bulletSystem?.resetAmmo();
    this.isDead = false;
    emit('player:respawn', { x, y });
  }

  private handleMatchReset = (): void => {
    this.bulletHitCollider?.destroy();
    this.bulletHitCollider = null;
    this.shipSprite?.destroy();
    this.shipSprite = null;
    this.movementSystem = null;
    this.remotePlayerSystem?.destroy();
    this.remotePlayerSystem = null;
    this.remoteBulletSystem?.destroy();
    this.remoteBulletSystem = null;
    this.bulletSystem = null;
    this.killCountText?.destroy();
    this.killCountText = null;
    this.isDead = false;

    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(
      ARENA.worldWidth / 2 - this.scale.width / 2,
      ARENA.worldHeight / 2 - this.scale.height / 2,
    );

    this.titleText = this.add
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

    this.matchActive = false;
  };

  private onLeave(): void {
    emit('lobby:leave');
    this.scene.start('MenuScene');
  }

  private onStartMatch(): void {
    emit('lobby:start');
  }
}
