import type Phaser from 'phaser';

/**
 * Routes Matter `collisionstart` events to typed handlers keyed by label pair.
 * Arcade used explicit overlap(groupA, groupB, cb) registrations; Matter has a
 * single global event stream per world, so we dispatch by body labels here.
 *
 * Handler labels are matched exactly OR by prefix when the registered label
 * ends in '-' (e.g. 'wall-' matches 'wall-chunk_3'). Handlers always receive
 * bodies in the order their labels were registered in the pair, regardless of
 * which one Matter put in bodyA.
 */
export type BodyPair = [a: MatterJS.BodyType, b: MatterJS.BodyType];
export type CollisionHandler = (a: MatterJS.BodyType, b: MatterJS.BodyType) => void;

interface HandlerEntry {
  labelA: string;
  labelB: string;
  handler: CollisionHandler;
}

export class MatterCollisionRouter {
  private scene: Phaser.Scene;
  private handlers: HandlerEntry[] = [];
  private listener: (event: { pairs: MatterJS.IPair[] }) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.listener = (event) => {
      for (const pair of event.pairs) {
        this.dispatch(pair.bodyA as MatterJS.BodyType, pair.bodyB as MatterJS.BodyType);
      }
    };
    scene.matter.world.on('collisionstart', this.listener);
  }

  /**
   * Register a handler for a label pair. Use a trailing '-' on either label
   * to match any body whose label starts with that prefix (e.g. 'wall-').
   */
  on(labelA: string, labelB: string, handler: CollisionHandler): void {
    this.handlers.push({ labelA, labelB, handler });
  }

  destroy(): void {
    this.scene.matter.world.off('collisionstart', this.listener);
    this.handlers = [];
  }

  private dispatch(a: MatterJS.BodyType, b: MatterJS.BodyType): void {
    for (const entry of this.handlers) {
      if (matches(a.label, entry.labelA) && matches(b.label, entry.labelB)) {
        entry.handler(a, b);
      } else if (matches(b.label, entry.labelA) && matches(a.label, entry.labelB)) {
        entry.handler(b, a);
      }
    }
  }
}

function matches(label: string, pattern: string): boolean {
  if (pattern.endsWith('-')) return label.startsWith(pattern);
  return label === pattern;
}
