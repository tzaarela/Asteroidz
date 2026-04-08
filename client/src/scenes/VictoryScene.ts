import Phaser from 'phaser';
import type { PlayerInfo, ScoreEntry } from '@asteroidz/shared';
import { MATCH } from '@asteroidz/shared';

interface VictoryData {
  winnerId: string;
  scores: ScoreEntry[];
  players: PlayerInfo[];
}

export class VictoryScene extends Phaser.Scene {
  private winnerId!: string;
  private scores!: ScoreEntry[];
  private players!: PlayerInfo[];

  constructor() {
    super('VictoryScene');
  }

  init(data: VictoryData): void {
    this.winnerId = data.winnerId;
    this.scores = data.scores;
    this.players = data.players;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    this.add
      .rectangle(cx, H / 2, W, H, 0x000000, 0.75)
      .setScrollFactor(0);

    this.add
      .text(cx, 80, 'VICTORY!', {
        fontSize: '48px',
        color: '#FFE66D',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const winner = this.players.find(p => p.id === this.winnerId);
    if (winner) {
      this.add
        .text(cx, 145, `${winner.name} wins!`, {
          fontSize: '24px',
          color: winner.color,
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
    }

    const playerMap = new Map(this.players.map(p => [p.id, p]));
    const sorted = [...this.scores].sort((a, b) => b.kills - a.kills);

    sorted.forEach((entry, i) => {
      const player = playerMap.get(entry.playerId);
      if (!player) return;
      const isWinner = entry.playerId === this.winnerId;
      const y = 210 + i * 36;
      const label = isWinner
        ? `★  ${player.name.padEnd(16)}  ${String(entry.kills).padStart(2)} kills`
        : `   ${player.name.padEnd(16)}  ${String(entry.kills).padStart(2)} kills`;

      this.add
        .text(cx, y, label, {
          fontSize: isWinner ? '20px' : '17px',
          color: player.color,
          fontFamily: 'monospace',
          fontStyle: isWinner ? 'bold' : 'normal',
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
    });

    this.time.delayedCall(MATCH.victoryDisplayMs, () => {
      this.scene.stop();
    });
  }
}
