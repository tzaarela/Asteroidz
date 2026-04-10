import Phaser from 'phaser';
import { ARENA, ASTEROID, AsteroidType } from '@asteroidz/shared';
import type { ArenaChunk, Asteroid } from '@asteroidz/shared';

interface BoundaryChunk extends ArenaChunk {
  centerX: number;
  centerY: number;
  centerAngle: number;
  body: MatterJS.BodyType | null;
}

interface AsteroidEntry extends Asteroid {
  body: MatterJS.BodyType | null;
}

/**
 * Manages the arena boundary ring (non-destroyable static polygon wall chunks)
 * and the interior asteroid field (normal + rare minable types).
 *
 * Boundary chunks use the same `wall-chunk_N` labels as before so the existing
 * bullet-vs-wall collision handler in matchRuntime.ts requires no changes.
 *
 * Asteroid bodies use labels `asteroid-normal`, `asteroid-crystal`, `asteroid-gold`
 * — matched by the `asteroid-` prefix in the collision router.
 */
export class AsteroidSystem {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private boundaryChunks: Map<string, BoundaryChunk>;
  private asteroids: Map<string, AsteroidEntry>;
  /** Reverse lookup: Matter body id → asteroid id. Used by the collision router. */
  private bodyIdToAsteroid = new Map<number, string>();
  /** Per-player ore totals — client-local, not networked. */
  private oreEarned = new Map<string, number>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.boundaryChunks = new Map();
    this.asteroids = new Map();
    this.graphics = scene.add.graphics();
    this.generateBoundary();
    this.generateAsteroidField();
    this.drawAll();
  }

  /** Look up an asteroid id from a Matter body id. */
  getAsteroidIdForBody(bodyId: number): string | undefined {
    return this.bodyIdToAsteroid.get(bodyId);
  }

  /**
   * Destroy an asteroid: removes its physics body, awards ore to the destroyer
   * if it's a rare type, and redraws.
   */
  destroyAsteroid(asteroidId: string, destroyerId: string | null): void {
    const entry = this.asteroids.get(asteroidId);
    if (!entry || entry.destroyed) return;
    entry.destroyed = true;
    if (entry.body) {
      this.bodyIdToAsteroid.delete(entry.body.id);
      this.scene.matter.world.remove(entry.body);
      entry.body = null;
    }
    if (destroyerId && entry.type !== AsteroidType.Normal) {
      const oreValue = entry.type === AsteroidType.Crystal
        ? ASTEROID.crystalOreValue
        : ASTEROID.goldOreValue;
      const current = this.oreEarned.get(destroyerId) ?? 0;
      this.oreEarned.set(destroyerId, current + oreValue);
    }
    this.drawAll();
  }

  /** How much ore a player has earned this match from destroying rare asteroids. */
  getOreEarned(playerId: string): number {
    return this.oreEarned.get(playerId) ?? 0;
  }

  reset(): void {
    for (const chunk of this.boundaryChunks.values()) {
      if (chunk.body) this.scene.matter.world.remove(chunk.body);
    }
    for (const entry of this.asteroids.values()) {
      if (entry.body) this.scene.matter.world.remove(entry.body);
    }
    this.graphics.clear();
    this.boundaryChunks.clear();
    this.asteroids.clear();
    this.bodyIdToAsteroid.clear();
    this.oreEarned.clear();
    this.generateBoundary();
    this.generateAsteroidField();
    this.drawAll();
  }

  destroy(): void {
    for (const chunk of this.boundaryChunks.values()) {
      if (chunk.body) this.scene.matter.world.remove(chunk.body);
    }
    for (const entry of this.asteroids.values()) {
      if (entry.body) this.scene.matter.world.remove(entry.body);
    }
    this.boundaryChunks.clear();
    this.asteroids.clear();
    this.bodyIdToAsteroid.clear();
    this.graphics.destroy();
  }

  // No per-frame work — purely event-driven
  update(_delta: number): void {}

  // ---------------------------------------------------------------------------
  // Private — boundary ring (non-destroyable, uses wall-chunk_N labels)
  // ---------------------------------------------------------------------------

  private generateBoundary(): void {
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

      const body = this.scene.matter.add.fromVertices(
        centerX, centerY,
        [vertices],
        { isStatic: true, label: `wall-${id}` },
        true,
        0.01,
        10,
      );

      this.boundaryChunks.set(id, {
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

  // ---------------------------------------------------------------------------
  // Private — asteroid field (destroyable, uses asteroid-<type> labels)
  // ---------------------------------------------------------------------------

  private generateAsteroidField(): void {
    let seed: number = ASTEROID.fieldSeed;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    const worldCX = ARENA.worldWidth / 2;
    const worldCY = ARENA.worldHeight / 2;
    // Leave a thin clear ring near the boundary wall
    const maxPlacementRadius = ARENA.arenaRadius * 0.88;
    const placed: Array<{ x: number; y: number }> = [];

    const spawnBatch = (type: AsteroidType, count: number): void => {
      for (let i = 0; i < count; i++) {
        let cx = 0;
        let cy = 0;
        let placedOk = false;

        for (let attempt = 0; attempt < ASTEROID.placementAttempts; attempt++) {
          const angle = rand() * Math.PI * 2;
          const r = rand() * maxPlacementRadius;
          const tx = worldCX + Math.cos(angle) * r;
          const ty = worldCY + Math.sin(angle) * r;

          const tooClose = placed.some(p => {
            const dx = p.x - tx;
            const dy = p.y - ty;
            return dx * dx + dy * dy < ASTEROID.minSpacing * ASTEROID.minSpacing;
          });

          if (!tooClose) {
            cx = tx;
            cy = ty;
            placedOk = true;
            break;
          }
        }

        if (!placedOk) continue;

        // Build an irregular polygon — shrink-only radius jitter keeps shapes
        // convex-ish, which avoids Matter.js decomposing them into sub-bodies
        // with unexpected IDs.
        const vertexCount = ASTEROID.vertexCountMin
          + Math.floor(rand() * (ASTEROID.vertexCountMax - ASTEROID.vertexCountMin + 1));
        const circumRadius = ASTEROID.minRadius + rand() * (ASTEROID.maxRadius - ASTEROID.minRadius);

        const vertices: Array<{ x: number; y: number }> = [];
        for (let v = 0; v < vertexCount; v++) {
          const baseAngle = (2 * Math.PI * v) / vertexCount;
          const angleJitter = (rand() - 0.5) * 0.3;
          const a = baseAngle + angleJitter;
          const r = circumRadius * (1 - ASTEROID.vertexJitter * rand());
          vertices.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }

        const id = `asteroid_${type}_${i}`;
        const label = `asteroid-${type}`;

        const body = this.scene.matter.add.fromVertices(
          cx, cy,
          [vertices],
          { isStatic: true, label },
          true,
          0.01,
          10,
        );

        if (body) {
          this.bodyIdToAsteroid.set(body.id, id);
        }

        placed.push({ x: cx, y: cy });
        this.asteroids.set(id, { id, type, vertices, destroyed: false, body });
      }
    };

    spawnBatch(AsteroidType.Normal, ASTEROID.countNormal);
    spawnBatch(AsteroidType.Crystal, ASTEROID.countCrystal);
    spawnBatch(AsteroidType.Gold, ASTEROID.countGold);
  }

  // ---------------------------------------------------------------------------
  // Private — rendering
  // ---------------------------------------------------------------------------

  private drawAll(): void {
    this.graphics.clear();

    // Boundary ring
    for (const chunk of this.boundaryChunks.values()) {
      const bodyVerts = chunk.body?.vertices;
      const pts: Phaser.Types.Math.Vector2Like[] = bodyVerts
        ? bodyVerts.map(v => ({ x: v.x, y: v.y }))
        : chunk.vertices;
      this.graphics.fillStyle(0x4a4a5a, 1);
      this.graphics.lineStyle(2, 0x7a7a9a, 0.8);
      this.graphics.fillPoints(pts, true, true);
      this.graphics.strokePoints(pts, true, true);
    }

    // Asteroid field
    for (const entry of this.asteroids.values()) {
      if (entry.destroyed) continue;

      const bodyVerts = entry.body?.vertices;
      const pts: Phaser.Types.Math.Vector2Like[] = bodyVerts
        ? bodyVerts.map(v => ({ x: v.x, y: v.y }))
        : entry.vertices;

      switch (entry.type) {
        case AsteroidType.Normal:
          this.graphics.fillStyle(0x5a5a6a, 1);
          this.graphics.lineStyle(2, 0x8a8a9a, 0.8);
          break;
        case AsteroidType.Crystal:
          this.graphics.fillStyle(0x3a6080, 1);
          this.graphics.lineStyle(2, 0x60b0e0, 0.9);
          break;
        case AsteroidType.Gold:
          this.graphics.fillStyle(0x705020, 1);
          this.graphics.lineStyle(2, 0xe0b030, 0.9);
          break;
      }

      this.graphics.fillPoints(pts, true, true);
      this.graphics.strokePoints(pts, true, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  // Winding: outer arc left→center→right, then inner arc right→center→left
  return [
    pt(outerRadius, startAngle),
    pt(outerRadius, centerAngle),
    pt(outerRadius, endAngle),
    pt(innerRadius, endAngle),
    pt(innerRadius, centerAngle),
    pt(innerRadius, startAngle),
  ];
}
