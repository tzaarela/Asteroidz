import Phaser from 'phaser';
import { SHIP } from '@asteroidz/shared';

/**
 * Generates (once per color) a ship texture and returns its cache key.
 * Used for both the local player and all remote players so every ship
 * in the match shares the same visual definition.
 *
 * Shape: colored body triangle, white tip highlight, orange outer flame,
 * yellow inner flame. Texture size is (s*2) × (s*3) — taller than the hit
 * circle so the flames can extend past the ship's bottom edge.
 */
export function ensureShipTexture(scene: Phaser.Scene, hexColor: string): string {
  const key = `ship_${hexColor.replace('#', '')}`;
  if (scene.textures.exists(key)) return key;

  const color = Phaser.Display.Color.HexStringToColor(hexColor).color;
  const s = SHIP.size;
  const gfx = scene.add.graphics();

  // Main ship body
  gfx.fillStyle(color, 1);
  gfx.fillTriangle(
    s, 0,           // tip
    0, s * 2,       // bottom left
    s * 2, s * 2,   // bottom right
  );

  // Tip highlight
  gfx.fillStyle(0xffffff, 1);
  gfx.fillTriangle(
    s, 0,
    s * 0.7, s * 0.7,
    s * 1.3, s * 0.7,
  );

  // Engine flames (outer)
  gfx.fillStyle(0xffa500, 1); // orange
  gfx.fillTriangle(
    s * 0.75, s * 2,
    s * 1.25, s * 2,
    s, s * 2.8,
  );

  // Engine flames (inner)
  gfx.fillStyle(0xffff00, 1); // yellow
  gfx.fillTriangle(
    s * 0.85, s * 2,
    s * 1.15, s * 2,
    s, s * 2.5,
  );

  gfx.generateTexture(key, s * 2, s * 3);
  gfx.destroy();
  return key;
}
