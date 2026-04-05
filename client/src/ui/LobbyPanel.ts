import Phaser from 'phaser';
import type { LobbyState } from '@asteroidz/shared';

const FONT = 'monospace';

export class LobbyPanel {
  private scene: Phaser.Scene;
  private cx: number;
  private cy: number;

  // Static elements — created once
  private header: Phaser.GameObjects.Text;
  private leaveButton: Phaser.GameObjects.Text;
  private startButton: Phaser.GameObjects.Text;

  // Dynamic player rows — rebuilt on each update
  private playerRows: Phaser.GameObjects.Text[] = [];

  private onLeave: () => void;
  private onStart: () => void;

  constructor(
    scene: Phaser.Scene,
    lobbyState: LobbyState,
    myId: string,
    onLeave: () => void,
    onStart: () => void,
  ) {
    this.scene = scene;
    this.onLeave = onLeave;
    this.onStart = onStart;

    const { width, height } = scene.scale;
    this.cx = width / 2;
    this.cy = height / 2;

    // Header
    this.header = scene.add
      .text(this.cx, this.cy - 140, '', {
        fontSize: '20px',
        color: '#FFE66D',
        fontFamily: FONT,
      })
      .setOrigin(0.5);

    // Leave button
    this.leaveButton = scene.add
      .text(this.cx, this.cy + 130, '[ LEAVE LOBBY ]', {
        fontSize: '18px',
        color: '#FF6B6B',
        fontFamily: FONT,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.leaveButton.setColor('#ff9999'))
      .on('pointerout', () => this.leaveButton.setColor('#FF6B6B'))
      .on('pointerdown', () => this.onLeave());

    // Start match button — visibility toggled in update()
    this.startButton = scene.add
      .text(this.cx, this.cy + 80, '[ START MATCH ]', {
        fontSize: '22px',
        color: '#4ECDC4',
        fontFamily: FONT,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.startButton.setColor('#74B9FF'))
      .on('pointerout', () => this.startButton.setColor('#4ECDC4'))
      .on('pointerdown', () => this.onStart());

    this.update(lobbyState, myId);
  }

  update(lobbyState: LobbyState, myId: string): void {
    this.header.setText(`LOBBY: ${lobbyState.code}`);

    // Rebuild player rows
    for (const row of this.playerRows) row.destroy();
    this.playerRows = [];

    const rowStartY = this.cy - 90;
    const rowSpacing = 36;

    lobbyState.players.forEach((player, i) => {
      const isMe = player.id === myId;
      const isLeader = player.id === lobbyState.leaderId;

      let label = `● ${player.name}`;
      if (isLeader) label += '  ♛';
      if (isMe) label += '  (you)';

      const row = this.scene.add
        .text(this.cx, rowStartY + i * rowSpacing, label, {
          fontSize: '18px',
          color: player.color,
          fontFamily: FONT,
        })
        .setOrigin(0.5);

      this.playerRows.push(row);
    });

    // Start button only visible to the leader
    const amLeader = myId === lobbyState.leaderId;
    this.startButton.setVisible(amLeader);
    if (amLeader) {
      this.startButton.setInteractive({ useHandCursor: true });
    } else {
      this.startButton.disableInteractive();
    }
  }

  destroy(): void {
    this.header.destroy();
    this.leaveButton.destroy();
    this.startButton.destroy();
    for (const row of this.playerRows) row.destroy();
    this.playerRows = [];
  }
}
