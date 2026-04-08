import type Phaser from 'phaser';

/**
 * Data-holder wrapper around a bullet sprite plus its spawn origin.
 * The spawn origin is needed by the distance-based despawn check. Previously
 * this was stored as loose `sprite.setData('spawnX' | 'spawnY', ...)` calls;
 * now it lives on the Bullet and is attached to the sprite under a single
 * 'bullet' data key so the pool pattern still works.
 */
export class Bullet {
  readonly sprite: Phaser.Physics.Matter.Sprite;
  readonly spawnX: number;
  readonly spawnY: number;

  constructor(sprite: Phaser.Physics.Matter.Sprite, spawnX: number, spawnY: number) {
    this.sprite = sprite;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    sprite.setData('bullet', this);
  }

  /** Retrieve the Bullet wrapper previously attached via the constructor. */
  static from(sprite: Phaser.Physics.Matter.Sprite): Bullet | undefined {
    return sprite.getData('bullet') as Bullet | undefined;
  }
}
