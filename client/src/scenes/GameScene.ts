import Phaser from 'phaser';
import type { LobbyState, PlayerTransform, ScoreEntry, PickupType } from '@asteroidz/shared';
import { MatchPhase, ARENA, NETWORK, RESPAWN, AMMO } from '@asteroidz/shared';
import { on, off, emit, getSocketId } from '../net/socket';
import { LobbyPanel } from '../ui/LobbyPanel';
import { PlayerListPanel } from '../ui/PlayerListPanel';
import type { InputState } from '../systems/movement';
import { MatchRuntime } from '../systems/matchRuntime';

const STAR_COUNT = 300;
const STAR_SEED = 42;

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;
  private myId!: string;
  private lobbyPanel!: LobbyPanel;
  private playerListPanel!: PlayerListPanel;
  private currentScores: ScoreEntry[] = [];
  private titleText!: Phaser.GameObjects.Text;

  private runtime: MatchRuntime | null = null;
  private keys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; SPACE: Phaser.Input.Keyboard.Key } | null = null;
  private inputState: InputState = { left: false, right: false, thrust: false, shoot: false };
  private touchInput: InputState = { left: false, right: false, thrust: false, shoot: false };
  private isTouchDevice = false;
  private matchActive = false;
  private tickAccumulator = 0;
  private isDead = false;

  constructor() {
    super('GameScene');
  }

  init(data: { lobbyState: LobbyState }): void {
    this.lobbyState = data.lobbyState;
    this.myId = getSocketId() ?? '';
    this.runtime = null;
    this.inputState = { left: false, right: false, thrust: false, shoot: false };
    this.touchInput = { left: false, right: false, thrust: false, shoot: false };
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

    this.isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      this.sys.game.device.input.touch;

    this.add.rectangle(
      ARENA.worldWidth / 2,
      ARENA.worldHeight / 2,
      ARENA.worldWidth,
      ARENA.worldHeight,
      0x030712,
    );

    this.createStarField();
    this.buildPreMatchUi();

    on('lobby:state',      this.handleLobbyState);
    on('match:state',      this.handleMatchState);
    on('match:reset',      this.handleMatchReset);
    on('match:winner',     this.handleMatchWinner);
    on('player:died',      this.handlePlayerDied);
    on('match:score',      this.handleMatchScore);
    on('pickup:spawn',     this.handlePickupSpawn);
    on('pickup:collected', this.handlePickupCollected);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state',      this.handleLobbyState);
      off('match:state',      this.handleMatchState);
      off('match:reset',      this.handleMatchReset);
      off('match:winner',     this.handleMatchWinner);
      off('player:died',      this.handlePlayerDied);
      off('match:score',      this.handleMatchScore);
      off('pickup:spawn',     this.handlePickupSpawn);
      off('pickup:collected', this.handlePickupCollected);
      this.playerListPanel?.destroy();
      this.runtime?.destroy();
      this.runtime = null;
    });
  }

  /**
   * Creates (or recreates) the title text + lobby/player-list panels shown
   * before a match starts. Called from create() and from handleMatchReset().
   */
  private buildPreMatchUi(): void {
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

    this.playerListPanel = new PlayerListPanel(this, this.lobbyState, this.myId);
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
      this.runtime?.remotePlayers.syncWithLobbyState(lobbyState);
    }
    this.playerListPanel.update(lobbyState, this.myId, this.currentScores);
  };

  private handleMatchScore = (payload: { scores: ScoreEntry[] }): void => {
    this.currentScores = payload.scores;
    this.playerListPanel.update(this.lobbyState, this.myId, this.currentScores);
  };

  private handleMatchState = (payload: { state: MatchPhase }): void => {
    if (this.matchActive) return;
    if (payload.state !== MatchPhase.Warmup && payload.state !== MatchPhase.Active) return;

    this.matchActive = true;
    this.titleText.destroy();
    this.lobbyPanel.destroy();

    const spawn = this.calculateSafeSpawnPosition();
    this.runtime = new MatchRuntime({
      scene: this,
      lobbyState: this.lobbyState,
      myId: this.myId,
      inputState: this.inputState,
      touchInput: this.touchInput,
      isTouchDevice: this.isTouchDevice,
      spawnX: spawn.x,
      spawnY: spawn.y,
      onBulletHit: this.onBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      onPickup: this.onPickupCollected as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    });

    this.cameras.main.startFollow(this.runtime.shipSprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(60, 40);
  };

  private onBulletHitPlayer = (
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    remoteShip: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void => {
    if (!this.runtime) return;
    this.runtime.bullets.destroyBullet(bullet as Phaser.Physics.Arcade.Sprite);
    const targetId = this.runtime.remotePlayers.getPlayerIdForSprite(
      remoteShip as Phaser.Physics.Arcade.Sprite,
    );
    if (targetId) emit('player:hit', { targetId });
  };

  private onPickupCollected = (
    _ship: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    pickupObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void => {
    if (!this.runtime) return;
    const sprite = pickupObj as Phaser.Physics.Arcade.Sprite;
    const pickupId = sprite.getData('pickupId') as string;
    const type = sprite.getData('type') as PickupType;
    this.runtime.pickups.removePickup(pickupId);
    this.runtime.bullets.addAmmo(AMMO.ammoPerPickup);
    emit('pickup:collected', { pickupId, type });
  };

  private handlePickupSpawn = (payload: { pickupId: string; type: PickupType; x: number; y: number }): void => {
    this.runtime?.pickups.spawnPickup(payload.pickupId, payload.type, payload.x, payload.y);
  };

  private handlePickupCollected = (payload: { pickupId: string; collectorId: string; type: PickupType }): void => {
    this.runtime?.pickups.removePickup(payload.pickupId);
  };

  update(_time: number, delta: number): void {
    if (this.keys) {
      this.inputState.left   = this.keys.A.isDown     || this.touchInput.left;
      this.inputState.right  = this.keys.D.isDown     || this.touchInput.right;
      this.inputState.thrust = this.keys.W.isDown     || this.touchInput.thrust;
      this.inputState.shoot  = this.keys.SPACE.isDown || this.touchInput.shoot;
    }

    this.runtime?.update(delta, this.isDead);

    if (this.runtime) {
      this.tickAccumulator += delta;
      if (this.tickAccumulator >= NETWORK.tickRateMs) {
        this.tickAccumulator -= NETWORK.tickRateMs;
        this.sendPlayerState();
      }
    }
  }

  private sendPlayerState(): void {
    if (!this.runtime) return;
    const ship = this.runtime.shipSprite;
    const body = ship.body as Phaser.Physics.Arcade.Body;
    const payload: PlayerTransform = {
      x: ship.x,
      y: ship.y,
      rotation: Phaser.Math.DegToRad(ship.angle),
      vx: body.velocity.x,
      vy: body.velocity.y,
    };
    emit('player:update', payload);
  }

  private handlePlayerDied = (payload: { playerId: string; killerId: string | null }): void => {
    if (payload.playerId !== this.myId) return;
    this.isDead = true;
    this.runtime?.hideShip();
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
    if (!this.runtime) return;
    const { x, y } = this.calculateSafeSpawnPosition();
    this.runtime.respawnAt(x, y);
    this.isDead = false;
    emit('player:respawn', { x, y });
  }

  private handleMatchWinner = (payload: { winnerId: string; scores: ScoreEntry[] }): void => {
    this.scene.launch('VictoryScene', {
      winnerId: payload.winnerId,
      scores: payload.scores,
      players: this.lobbyState.players,
    });
  };

  private handleMatchReset = (): void => {
    this.scene.stop('VictoryScene');
    this.runtime?.destroy();
    this.runtime = null;
    this.touchInput = { left: false, right: false, thrust: false, shoot: false };
    this.isDead = false;

    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(
      ARENA.worldWidth / 2 - this.scale.width / 2,
      ARENA.worldHeight / 2 - this.scale.height / 2,
    );

    this.currentScores = [];
    this.playerListPanel.destroy();
    this.buildPreMatchUi();

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
