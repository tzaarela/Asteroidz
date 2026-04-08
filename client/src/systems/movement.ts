import Phaser from 'phaser';
import { PHYSICS } from '@asteroidz/shared';

export interface InputState {
  left: boolean;
  right: boolean;
  thrust: boolean;
  shoot: boolean;
}

export class MovementSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Matter.Sprite;
  private input: InputState;

  constructor(scene: Phaser.Scene, ship: Phaser.Physics.Matter.Sprite, input: InputState) {
    this.scene = scene;
    this.ship = ship;
    this.input = input;
  }

  update(delta: number): void {
    const body = this.ship.body as MatterJS.BodyType;
    const dt = delta / 1000; // ms → seconds

    // Rotation — instant, no angular momentum
    if (this.input.left) {
      this.ship.angle -= PHYSICS.rotationSpeed * dt;
    }
    if (this.input.right) {
      this.ship.angle += PHYSICS.rotationSpeed * dt;
    }

    let vx = body.velocity.x;
    let vy = body.velocity.y;

    // Thrust — sprite texture points north; Phaser angle=0 points east (+x)
    // Subtract 90° so thrust direction matches the visual facing direction
    if (this.input.thrust) {
      const thrustRad = Phaser.Math.DegToRad(this.ship.angle - 90);
      vx += Math.cos(thrustRad) * PHYSICS.thrustForce * dt;
      vy += Math.sin(thrustRad) * PHYSICS.thrustForce * dt;
    }

    // Clamp to max velocity
    const speed = Math.hypot(vx, vy);
    if (speed > PHYSICS.maxVelocity) {
      const scale = PHYSICS.maxVelocity / speed;
      vx *= scale;
      vy *= scale;
    }

    // Drag is handled by Matter's frictionAir on the ship body — no manual multiply here.
    this.scene.matter.body.setVelocity(body, { x: vx, y: vy });
  }
}
