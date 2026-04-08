import Phaser from 'phaser';
import type { LobbyState, PlayerTransform, ScoreEntry, PickupType } from '@asteroidz/shared';
import { MatchPhase, ARENA, PHYSICS, SHIP, NETWORK, RESPAWN, AMMO } from '@asteroidz/shared';
import { on, off, emit, getSocketId } from '../network/socket';
import { LobbyPanel } from '../ui/LobbyPanel';
import { PlayerListPanel } from '../ui/PlayerListPanel';
import { MovementSystem } from '../systems/movement';
import type { InputState } from '../systems/movement';
import { TouchControls } from '../ui/touchControls';
import { RemotePlayerSystem } from '../systems/remotePlayerSystem';
import { BulletSystem } from '../systems/bulletSystem';
import { RemoteBulletSystem } from '../systems/remoteBulletSystem';
import { PickupSystem } from '../systems/pickups';

const STAR_COUNT = 300;
const STAR_SEED = 42;

export class GameScene extends Phaser.Scene {
  private lobbyState!: LobbyState;
  private myId!: string;
  private lobbyPanel!: LobbyPanel;
  private playerListPanel!: PlayerListPanel;
  private currentScores: ScoreEntry[] = [];
  private titleText!: Phaser.GameObjects.Text;

  private shipSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private movementSystem: MovementSystem | null = null;
  private remotePlayerSystem: RemotePlayerSystem | null = null;
  private bulletSystem: BulletSystem | null = null;
  private remoteBulletSystem: RemoteBulletSystem | null = null;
  private bulletHitCollider: Phaser.Physics.Arcade.Collider | null = null;
  private pickupSystem: PickupSystem | null = null;
  private pickupCollider: Phaser.Physics.Arcade.Collider | null = null;
  private keys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; SPACE: Phaser.Input.Keyboard.Key } | null = null;
  private inputState: InputState = { left: false, right: false, thrust: false, shoot: false };
  private touchInput: InputState = { left: false, right: false, thrust: false, shoot: false };
  private touchControls: TouchControls | null = null;
  private isTouchDevice = false;
  private matchActive = false;
  private tickAccumulator = 0;
  private isDead = false;
  private ammoDisplay: Phaser.GameObjects.Graphics | null = null;
  private playerColor: number = 0xffffff;

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
    this.pickupSystem = null;
    this.pickupCollider = null;
    this.touchControls = null;
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

    this.playerListPanel = new PlayerListPanel(this, this.lobbyState, this.myId);

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
      this.remotePlayerSystem?.destroy();
      this.remoteBulletSystem?.destroy();
      this.pickupSystem?.destroy();
      this.touchControls?.destroy();
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

    this.createLocalShip();
    this.remotePlayerSystem = new RemotePlayerSystem(this, this.myId, this.lobbyState);
    this.remoteBulletSystem = new RemoteBulletSystem(this, () => this.lobbyState.players);
    this.bulletSystem = new BulletSystem(this, this.shipSprite!, this.inputState);
    if (this.isTouchDevice) {
      this.touchControls = new TouchControls(this, this.touchInput);
    }
    this.bulletHitCollider = this.physics.add.overlap(
      this.bulletSystem.getBulletGroup(),
      this.remotePlayerSystem.getShipGroup(),
      this.onBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    ) as Phaser.Physics.Arcade.Collider;

    this.pickupSystem = new PickupSystem(this);
    this.pickupCollider = this.physics.add.overlap(
      this.shipSprite!,
      this.pickupSystem.getPickupGroup(),
      this.onPickupCollected as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    ) as Phaser.Physics.Arcade.Collider;

    if (this.myId === this.lobbyState.leaderId) {
      this.pickupSystem.startSpawning();
    }
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

    this.playerColor = color;
    this.ammoDisplay = this.add.graphics();

    this.setFollowTarget(this.shipSprite);
    this.movementSystem = new MovementSystem(this, this.shipSprite, this.inputState);
  }

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

  private onPickupCollected = (
    _ship: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    pickupObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void => {
    const sprite = pickupObj as Phaser.Physics.Arcade.Sprite;
    const pickupId = sprite.getData('pickupId') as string;
    const type = sprite.getData('type') as PickupType;
    this.pickupSystem!.removePickup(pickupId);
    this.bulletSystem!.addAmmo(AMMO.ammoPerPickup);
    emit('pickup:collected', { pickupId, type });
  };

  private handlePickupSpawn = (payload: { pickupId: string; type: PickupType; x: number; y: number }): void => {
    this.pickupSystem?.spawnPickup(payload.pickupId, payload.type, payload.x, payload.y);
  };

  private handlePickupCollected = (payload: { pickupId: string; collectorId: string; type: PickupType }): void => {
    this.pickupSystem?.removePickup(payload.pickupId);
  };

  update(_time: number, delta: number): void {
    if (this.keys) {
      this.inputState.left   = this.keys.A.isDown     || this.touchInput.left;
      this.inputState.right  = this.keys.D.isDown     || this.touchInput.right;
      this.inputState.thrust = this.keys.W.isDown     || this.touchInput.thrust;
      this.inputState.shoot  = this.keys.SPACE.isDown || this.touchInput.shoot;
    }

    if (!this.isDead) {
      this.movementSystem?.update(delta);
      this.bulletSystem?.update(delta);
    }
    if (this.ammoDisplay && this.shipSprite && this.bulletSystem) {
      this.updateAmmoDisplay();
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

  private updateAmmoDisplay(): void {
    const gfx = this.ammoDisplay!;
    const ship = this.shipSprite!;
    const ammo = this.bulletSystem!.ammoCount();
    const dotRadius = 3;
    const dotSpacing = 10;
    const totalWidth = (AMMO.maxAmmo - 1) * dotSpacing;

    gfx.clear();
    gfx.setPosition(ship.x - totalWidth / 2, ship.y + SHIP.size + 6);

    for (let i = 0; i < AMMO.maxAmmo; i++) {
      const x = i * dotSpacing;
      if (i < ammo) {
        gfx.fillStyle(this.playerColor, 1);
        gfx.fillCircle(x, 0, dotRadius);
      } else {
        gfx.lineStyle(1, this.playerColor, 0.3);
        gfx.strokeCircle(x, 0, dotRadius);
      }
    }
  }

  private handlePlayerDied = (payload: { playerId: string; killerId: string | null }): void => {
    if (payload.playerId !== this.myId) return;
    this.isDead = true;
    if (this.shipSprite) {
      this.shipSprite.setActive(false).setVisible(false);
      (this.shipSprite.body as Phaser.Physics.Arcade.Body).setEnable(false);
      this.ammoDisplay?.setVisible(false);
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
    this.ammoDisplay?.setVisible(true);
    this.bulletSystem?.resetAmmo();
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
    this.bulletHitCollider?.destroy();
    this.bulletHitCollider = null;
    this.pickupCollider?.destroy();
    this.pickupCollider = null;
    this.pickupSystem?.destroy();
    this.pickupSystem = null;
    this.shipSprite?.destroy();
    this.shipSprite = null;
    this.ammoDisplay?.destroy();
    this.ammoDisplay = null;
    this.movementSystem = null;
    this.remotePlayerSystem?.destroy();
    this.remotePlayerSystem = null;
    this.remoteBulletSystem?.destroy();
    this.remoteBulletSystem = null;
    this.bulletSystem = null;
    this.touchControls?.destroy();
    this.touchControls = null;
    this.touchInput = { left: false, right: false, thrust: false, shoot: false };
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

    this.currentScores = [];
    this.playerListPanel.destroy();
    this.playerListPanel = new PlayerListPanel(this, this.lobbyState, this.myId);

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
