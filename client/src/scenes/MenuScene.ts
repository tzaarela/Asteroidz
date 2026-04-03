import Phaser from 'phaser';
import type { LobbyState } from '@asteroidz/shared';
import { connect, emit, on, off } from '../network/socket';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;
  private createButton!: Phaser.GameObjects.Text;
  private nameInput!: Phaser.GameObjects.DOMElement;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    connect();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Title
    this.titleText = this.add
      .text(cx, cy - 120, 'ASTEROIDZ', {
        fontSize: '56px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Name input (HTML DOM element)
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your name';
    input.maxLength = 20;
    Object.assign(input.style, {
      width: '220px',
      padding: '10px 14px',
      fontSize: '18px',
      fontFamily: 'monospace',
      background: '#1a1a2e',
      color: '#ffffff',
      border: '2px solid #444',
      borderRadius: '6px',
      outline: 'none',
      textAlign: 'center',
    });

    this.nameInput = this.add.dom(cx, cy - 20, input);

    // Create Lobby button
    this.createButton = this.add
      .text(cx, cy + 60, '[ CREATE LOBBY ]', {
        fontSize: '22px',
        color: '#4ECDC4',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.createButton.setColor('#74B9FF'))
      .on('pointerout', () => this.createButton.setColor('#4ECDC4'))
      .on('pointerdown', () => this.onCreateLobby());

    // Validation error message (hidden by default)
    this.errorText = this.add
      .text(cx, cy + 110, '', {
        fontSize: '14px',
        color: '#FF6B6B',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Re-center on resize
    this.scale.on('resize', this.onResize, this);
  }

  private onCreateLobby(): void {
    const input = this.nameInput.node as HTMLInputElement;
    const name = input.value.trim();

    if (!name) {
      this.errorText.setText('Name cannot be empty');
      return;
    }

    this.errorText.setText('');
    this.createButton.disableInteractive().setColor('#888888');

    const handleLobbyState = (lobbyState: LobbyState): void => {
      off('lobby:state', handleLobbyState);
      this.scene.start('GameScene', { lobbyState });
    };

    on('lobby:state', handleLobbyState);
    emit('lobby:create', { name });

    // Store cleanup ref so we can remove it if scene is destroyed before response
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state', handleLobbyState);
    });
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const cx = gameSize.width / 2;
    const cy = gameSize.height / 2;

    this.titleText.setPosition(cx, cy - 120);
    this.nameInput.setPosition(cx, cy - 20);
    this.createButton.setPosition(cx, cy + 60);
    this.errorText.setPosition(cx, cy + 110);
  }

  shutdown(): void {
    this.scale.off('resize', this.onResize, this);
  }
}
