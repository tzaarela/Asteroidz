import Phaser from 'phaser';
import { ARENA } from '@asteroidz/shared';
import type { ArenaChunk } from '@asteroidz/shared';

interface ChunkState extends ArenaChunk {
  centerX: number;
  centerY: number;
  centerAngle: number;
  bodySprite: Phaser.Physics.Arcade.Image;
}

export class ArenaSystem {
  private scene: Phaser.Scene;
  private staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private graphics: Phaser.GameObjects.Graphics;
  private chunks: Map<string, ChunkState>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.staticGroup = scene.physics.add.staticGroup();
    this.graphics = scene.add.graphics();
    this.generateChunks();
    this.drawAll();
  }

  getStaticGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.staticGroup;
  }

  destroyChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.destroyed) return;
    chunk.destroyed = true;
    this.staticGroup.remove(chunk.bodySprite, true, true);
    this.drawAll();
  }

  reset(): void {
    this.staticGroup.clear(true, true);
    this.graphics.clear();
    this.chunks.clear();
    this.staticGroup = this.scene.physics.add.staticGroup();
    this.generateChunks();
    this.drawAll();
  }

  // No per-frame work — arena is purely event-driven
  update(_delta: number): void {}

  private generateChunks(): void {
    // LCG seeded RNG — identical algorithm to createStarField() in GameScene
    let seed = ARENA.arenaChunkSeed;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    const worldCX = ARENA.worldWidth / 2;
    const worldCY = ARENA.worldHeight / 2;
    const arcSpan = (2 * Math.PI) / ARENA.wallChunkCount;
    const halfEffectiveArc = (arcSpan * (1 - 2 * ARENA.chunkArcGapFraction)) / 2;
    const depth = ARENA.chunkOuterRadius - ARENA.chunkInnerRadius;
    const avgRadius = (ARENA.chunkInnerRadius + ARENA.chunkOuterRadius) / 2;
    const chordLength = 2 * avgRadius * Math.sin(halfEffectiveArc);

    for (let i = 0; i < ARENA.wallChunkCount; i++) {
      const id = `chunk_${i}`;
      const centerAngle = (2 * Math.PI * i) / ARENA.wallChunkCount;
      const centerX = worldCX + ARENA.arenaRadius * Math.cos(centerAngle);
      const centerY = worldCY + ARENA.arenaRadius * Math.sin(centerAngle);

      const startAngle = centerAngle - halfEffectiveArc;
      const endAngle = centerAngle + halfEffectiveArc;

      // 6-vertex trapezoid with jitter — exactly 12 rand() calls per chunk for determinism
      const vertices = buildTrapezoidVertices(
        worldCX, worldCY,
        ARENA.chunkInnerRadius, ARENA.chunkOuterRadius,
        startAngle, endAngle, centerAngle,
        ARENA.chunkVertexJitter, rand,
      );

      // Axis-aligned physics body: orient to best match the chunk's tangential direction
      const absSin = Math.abs(Math.sin(centerAngle));
      const absCos = Math.abs(Math.cos(centerAngle));
      const bodyW = absSin > absCos ? chordLength : depth;
      const bodyH = absSin > absCos ? depth : chordLength;

      // Invisible static body carrier — '__DEFAULT' is Phaser's built-in 32×32 white texture
      const bodySprite = this.staticGroup.create(centerX, centerY, '__DEFAULT') as Phaser.Physics.Arcade.Image;
      bodySprite.setAlpha(0);
      bodySprite.setDisplaySize(1, 1);
      const staticBody = bodySprite.body as Phaser.Physics.Arcade.StaticBody;
      staticBody.setSize(bodyW, bodyH);
      staticBody.reset(centerX, centerY);

      bodySprite.setData('chunkId', id);

      this.chunks.set(id, {
        id,
        vertices,
        destroyed: false,
        centerX,
        centerY,
        centerAngle,
        bodySprite,
      });
    }
  }

  private drawAll(): void {
    this.graphics.clear();

    for (const chunk of this.chunks.values()) {
      if (chunk.destroyed) continue;
      this.graphics.fillStyle(0x4a4a5a, 1);
      this.graphics.lineStyle(2, 0x7a7a9a, 0.8);
      this.graphics.fillPoints(chunk.vertices as Phaser.Types.Math.Vector2Like[], true, true);
      this.graphics.strokePoints(chunk.vertices as Phaser.Types.Math.Vector2Like[], true, true);
    }
  }
}

function buildTrapezoidVertices(
  worldCX: number,
  worldCY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  centerAngle: number,
  jitter: number,
  rand: () => number,
): Array<{ x: number; y: number }> {
  const j = (): number => (rand() * 2 - 1) * jitter;

  const pt = (radius: number, angle: number): { x: number; y: number } => ({
    x: worldCX + radius * Math.cos(angle) + j(),
    y: worldCY + radius * Math.sin(angle) + j(),
  });

  // Winding: outer arc left→center→right, then inner arc right→center→left (closes polygon)
  return [
    pt(outerRadius, startAngle),   // outer-left
    pt(outerRadius, centerAngle),  // outer-mid (jagged)
    pt(outerRadius, endAngle),     // outer-right
    pt(innerRadius, endAngle),     // inner-right
    pt(innerRadius, centerAngle),  // inner-mid (jagged)
    pt(innerRadius, startAngle),   // inner-left
  ];
}
