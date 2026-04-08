import Phaser from 'phaser';
import type { LobbyState, ScoreEntry } from '@asteroidz/shared';

const FONT = 'monospace';

export class PlayerListPanel {
  private scene: Phaser.Scene;
  private rows: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, lobbyState: LobbyState, myId: string) {
    this.scene = scene;
    this.draw(lobbyState, myId, []);
  }

  update(lobbyState: LobbyState, myId: string, scores: ScoreEntry[] = []): void {
    for (const row of this.rows) row.destroy();
    this.rows = [];
    this.draw(lobbyState, myId, scores);
  }

  destroy(): void {
    for (const row of this.rows) row.destroy();
    this.rows = [];
  }

  private draw(lobbyState: LobbyState, myId: string, scores: ScoreEntry[]): void {
    const x = this.scene.scale.width - 16;
    const startY = 16;
    const rowH = 22;
    const matchActive = scores.length > 0;

    const header = this.scene.add
      .text(x, startY, 'PLAYERS', {
        fontSize: '12px',
        fontFamily: FONT,
        color: '#aaaaaa',
      })
      .setScrollFactor(0)
      .setOrigin(1, 0);
    this.rows.push(header);

    lobbyState.players.forEach((player, i) => {
      const isLeader = player.id === lobbyState.leaderId;
      const isMe = player.id === myId;
      const kills = scores.find(s => s.playerId === player.id)?.kills ?? 0;

      let label = `${isLeader ? '♛ ' : '  '}${player.name}${isMe ? ' (you)' : ''}`;
      if (matchActive) label += `  ${kills}`;

      const row = this.scene.add
        .text(x, startY + (i + 1) * rowH, label, {
          fontSize: '13px',
          fontFamily: FONT,
          color: player.color,
          fontStyle: isMe ? 'bold' : 'normal',
        })
        .setScrollFactor(0)
        .setOrigin(1, 0);

      this.rows.push(row);
    });
  }
}
