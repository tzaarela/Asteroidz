import Phaser from 'phaser';
import { ARENA } from '@asteroidz/shared';
import type { ArenaChunk } from '@asteroidz/shared';

interface ChunkState extends ArenaChunk {
  centerX: number;
  centerY: number;
  centerAngle: number;
  body: MatterJS.BodyType | null;
}

export class ArenaSystem {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private chunks: Map<string, ChunkState>;
  /** Reverse lookup: Matter body id → chunk id. Used by the collision router. */
  private bodyIdToChunk = new Map<number, string>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.graphics = scene.add.graphics();
    this.generateChunks();
    this.drawAll();
  }

  /** Look up a wall chunk id from a Matter body id. */
  getChunkIdForBody(bodyId: number): string | undefined {
    return this.bodyIdToChunk.get(bodyId);
  }

  destroyChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.destroyed) return;
    chunk.destroyed = true;
    if (chunk.body) {
      this.bodyIdToChunk.delete(chunk.body.id);
      this.scene.matter.world.remove(chunk.body);
      chunk.body = null;
    }
    this.drawAll();
  }

  reset(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.body) {
        this.scene.matter.world.remove(chunk.body);
      }
    }
    this.graphics.clear();
    this.chunks.clear();
    this.bodyIdToChunk.clear();
    this.generateChunks();
    this.drawAll();
  }

  destroy(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.body) {
        this.scene.matter.world.remove(chunk.body);
      }
    }
    this.chunks.clear();
    this.bodyIdToChunk.clear();
    this.graphics.destroy();
  }

  // No per-frame work — arena is purely event-driven
  update(_delta: number): void {}

  private generateChunks(): void {
    // LCG seeded RNG — identical algorithm to createStarField() in GameScene
    let seed: number = ARENA.arenaChunkSeed;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    const worldCX = ARENA.worldWidth / 2;
    const worldCY = ARENA.worldHeight / 2;
    const arcSpan = (2 * Math.PI) / ARENA.wallChunkCount;
    const halfEffectiveArc = (arcSpan * (1 - 2 * ARENA.chunkArcGapFraction)) / 2;

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

      // Matter polygon body: fromVertices takes world-space vertex arrays and
      // re-centers them around (x, y). Passing the vertices' actual centroid as
      // the anchor keeps the body aligned with the drawn polygon exactly.
      const body = this.scene.matter.add.fromVertices(
        centerX, centerY,
        [vertices],
        { isStatic: true, label: `wall-${id}` },
        true,   // addToWorld
        0.01,   // removeCollinear tolerance
        10,     // minimumArea
      );

      if (body) {
        this.bodyIdToChunk.set(body.id, id);
      }

      this.chunks.set(id, {
        id,
        vertices,
        destroyed: false,
        centerX,
        centerY,
        centerAngle,
        body,
      });
    }
  }

  private drawAll(): void {
    this.graphics.clear();

    for (const chunk of this.chunks.values()) {
      if (chunk.destroyed) continue;
      // Matter.add.fromVertices re-centers the source vertices around the body's
      // centroid, so the physics body's world-space vertices can diverge from the
      // original array. Draw from body.vertices when we have a body so the visual
      // and the collider stay perfectly aligned.
      const bodyVerts = chunk.body?.vertices;
      const pts: Phaser.Types.Math.Vector2Like[] = bodyVerts
        ? bodyVerts.map(v => ({ x: v.x, y: v.y }))
        : chunk.vertices;
      this.graphics.fillStyle(0x4a4a5a, 1);
      this.graphics.lineStyle(2, 0x7a7a9a, 0.8);
      this.graphics.fillPoints(pts, true, true);
      this.graphics.strokePoints(pts, true, true);
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
