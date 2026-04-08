import Phaser from 'phaser';
import type { InputState } from '../systems/movement';

export class TouchControls {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, touchInput: InputState) {
    // Support up to 4 simultaneous touch points (default is 2)
    scene.input.addPointer(2);

    const W = scene.scale.width;
    const H = scene.scale.height;
    const btnW = 80;
    const btnH = 70;
    const margin = 20;
    const gap = 10;

    // Left zone (bottom-left): Rotate Left + Rotate Right
    this.makeButton(scene, margin, H - margin - btnH, btnW, btnH, 'L',
      () => { touchInput.left = true; }, () => { touchInput.left = false; });
    this.makeButton(scene, margin + btnW + gap, H - margin - btnH, btnW, btnH, 'R',
      () => { touchInput.right = true; }, () => { touchInput.right = false; });

    // Right zone (bottom-right): Thrust + Shoot
    this.makeButton(scene, W - margin - btnW * 2 - gap, H - margin - btnH, btnW, btnH, 'THRUST',
      () => { touchInput.thrust = true; }, () => { touchInput.thrust = false; });
    this.makeButton(scene, W - margin - btnW, H - margin - btnH, btnW, btnH, 'FIRE',
      () => { touchInput.shoot = true; }, () => { touchInput.shoot = false; });
  }

  private makeButton(
    scene: Phaser.Scene,
    x: number, y: number, w: number, h: number,
    label: string,
    onDown: () => void,
    onUp: () => void,
  ): void {
    const bg = scene.add
      .rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive();

    const text = scene.add
      .text(x + w / 2, y + h / 2, label, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    bg.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    bg.on(Phaser.Input.Events.POINTER_UP, onUp);
    bg.on(Phaser.Input.Events.POINTER_OUT, onUp);

    this.objects.push(bg, text);
  }

  destroy(): void {
    for (const obj of this.objects) obj.destroy();
    this.objects = [];
  }
}
