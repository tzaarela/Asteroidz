import Phaser from 'phaser';
import type { LobbyState } from '@asteroidz/shared';
import { connect, emit, on, off } from '../net/socket';

type ResizableElement = {
  obj: { setPosition(x: number, y: number): unknown };
  offsetY: number;
};

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private nameInput!: Phaser.GameObjects.DOMElement;
  private errorText!: Phaser.GameObjects.Text;

  // Create-mode only
  private createButton!: Phaser.GameObjects.Text;

  // Join-mode only
  private lobbyCode: string | null = null;
  private codeText!: Phaser.GameObjects.Text;
  private joinButton!: Phaser.GameObjects.Text;
  private createFallbackText!: Phaser.GameObjects.Text;

  // Populated by buildCreateMode / buildJoinMode — drives onResize without mode-awareness
  private resizableElements: ResizableElement[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    connect();

    this.resizableElements = [];
    this.lobbyCode = MenuScene.parseLobbyCode();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Title — always present
    this.titleText = this.add
      .text(cx, cy - 120, 'ASTEROIDZ', {
        fontSize: '56px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.resizableElements.push({ obj: this.titleText, offsetY: -120 });

    if (this.lobbyCode) {
      this.buildJoinMode(cx, cy);
    } else {
      this.buildCreateMode(cx, cy);
    }

    this.scale.on('resize', this.onResize, this);
  }

  // ---------------------------------------------------------------------------
  // URL parsing
  // ---------------------------------------------------------------------------

  private static parseLobbyCode(): string | null {
    const match = window.location.pathname.match(/^\/game\/([A-Z0-9]{1,10})$/i);
    return match ? match[1].toUpperCase() : null;
  }

  // ---------------------------------------------------------------------------
  // Create mode (C2 behaviour — unchanged)
  // ---------------------------------------------------------------------------

  private buildCreateMode(cx: number, cy: number): void {
    this.nameInput = this.add.dom(cx, cy - 20, this.makeNameInput());
    this.resizableElements.push({ obj: this.nameInput, offsetY: -20 });

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
    this.resizableElements.push({ obj: this.createButton, offsetY: 60 });

    this.errorText = this.add
      .text(cx, cy + 110, '', {
        fontSize: '14px',
        color: '#FF6B6B',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.resizableElements.push({ obj: this.errorText, offsetY: 110 });
  }

  private onCreateLobby(): void {
    const name = this.getNameInputValue();
    if (!name) {
      this.errorText.setText('Name cannot be empty');
      return;
    }

    this.errorText.setText('');
    if (this.lobbyCode) {
      // Called from the join-mode fallback link — disable join button instead
      this.joinButton.disableInteractive().setColor('#888888');
    } else {
      this.createButton.disableInteractive().setColor('#888888');
    }

    const handleLobbyState = (lobbyState: LobbyState): void => {
      off('lobby:state', handleLobbyState);
      this.scene.start('GameScene', { lobbyState });
    };

    on('lobby:state', handleLobbyState);
    emit('lobby:create', { name });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state', handleLobbyState);
    });
  }

  // ---------------------------------------------------------------------------
  // Join mode (C3 — URL-driven)
  // ---------------------------------------------------------------------------

  private buildJoinMode(cx: number, cy: number): void {
    this.codeText = this.add
      .text(cx, cy - 60, `Joining lobby: ${this.lobbyCode}`, {
        fontSize: '20px',
        color: '#FFE66D',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.resizableElements.push({ obj: this.codeText, offsetY: -60 });

    this.nameInput = this.add.dom(cx, cy, this.makeNameInput());
    this.resizableElements.push({ obj: this.nameInput, offsetY: 0 });

    this.joinButton = this.add
      .text(cx, cy + 70, '[ JOIN LOBBY ]', {
        fontSize: '22px',
        color: '#4ECDC4',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.joinButton.setColor('#74B9FF'))
      .on('pointerout', () => this.joinButton.setColor('#4ECDC4'))
      .on('pointerdown', () => this.onJoinLobby());
    this.resizableElements.push({ obj: this.joinButton, offsetY: 70 });

    this.errorText = this.add
      .text(cx, cy + 120, '', {
        fontSize: '14px',
        color: '#FF6B6B',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.resizableElements.push({ obj: this.errorText, offsetY: 120 });

    this.createFallbackText = this.add
      .text(cx, cy + 155, '[ Create a new lobby instead ]', {
        fontSize: '14px',
        color: '#888888',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.createFallbackText.setColor('#aaaaaa'))
      .on('pointerout', () => this.createFallbackText.setColor('#888888'))
      .on('pointerdown', () => this.onCreateLobby());
    this.resizableElements.push({ obj: this.createFallbackText, offsetY: 155 });
  }

  private onJoinLobby(): void {
    const name = this.getNameInputValue();
    if (!name) {
      this.errorText.setText('Name cannot be empty');
      return;
    }

    this.errorText.setText('');
    this.createFallbackText.setVisible(false);
    this.joinButton.disableInteractive().setColor('#888888');

    const handleLobbyState = (lobbyState: LobbyState): void => {
      off('lobby:error', handleLobbyError);
      off('lobby:state', handleLobbyState);
      this.scene.start('GameScene', { lobbyState });
    };

    const handleLobbyError = (payload: { message: string }): void => {
      off('lobby:state', handleLobbyState);
      off('lobby:error', handleLobbyError);
      this.errorText.setText(payload.message);
      this.joinButton.setInteractive({ useHandCursor: true }).setColor('#4ECDC4');
      this.createFallbackText.setVisible(true);
    };

    on('lobby:state', handleLobbyState);
    on('lobby:error', handleLobbyError);
    emit('lobby:join', { lobbyId: this.lobbyCode!, name });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off('lobby:state', handleLobbyState);
      off('lobby:error', handleLobbyError);
    });
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private makeNameInput(): HTMLInputElement {
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
    return input;
  }

  private getNameInputValue(): string {
    return (this.nameInput.node as HTMLInputElement).value.trim();
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  private onResize(gameSize: Phaser.Structs.Size): void {
    const cx = gameSize.width / 2;
    const cy = gameSize.height / 2;
    for (const el of this.resizableElements) {
      el.obj.setPosition(cx, cy + el.offsetY);
    }
  }

  shutdown(): void {
    this.scale.off('resize', this.onResize, this);
  }
}
