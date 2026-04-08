import type Phaser from 'phaser';

/**
 * Data-holder wrapper around a Phaser ship sprite + the per-player metadata
 * (id, color) that gameplay systems need. Used for both the local player
 * (MatchRuntime) and remote players (RemotePlayerSystem). Interpolation state
 * for remotes lives alongside this in RemotePlayerSystem's map entry — the
 * class intentionally stays minimal.
 */
export class Player {
  readonly id: string;
  readonly color: string;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly isLocal: boolean;

  constructor(
    id: string,
    color: string,
    sprite: Phaser.Physics.Arcade.Sprite,
    isLocal: boolean,
  ) {
    this.id = id;
    this.color = color;
    this.sprite = sprite;
    this.isLocal = isLocal;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
