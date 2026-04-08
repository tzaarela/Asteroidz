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
  private ship: Phaser.Physics.Arcade.Sprite;
  private input: InputState;

  constructor(scene: Phaser.Scene, ship: Phaser.Physics.Arcade.Sprite, input: InputState) {
    this.scene = scene;
    this.ship = ship;
    this.input = input;
  }

  update(delta: number): void {
    const body = this.ship.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000; // ms → seconds

    // Rotation — instant, no angular momentum
    if (this.input.left) {
      this.ship.angle -= PHYSICS.rotationSpeed * dt;
    }
    if (this.input.right) {
      this.ship.angle += PHYSICS.rotationSpeed * dt;
    }

    // Thrust — sprite texture points north; Phaser angle=0 points east (+x)
    // Subtract 90° so thrust direction matches the visual facing direction
    if (this.input.thrust) {
      const thrustDeg = this.ship.angle - 90;
      const thrust = this.scene.physics.velocityFromAngle(thrustDeg, PHYSICS.thrustForce * dt);
      body.velocity.x += thrust.x;
      body.velocity.y += thrust.y;

      // Clamp to max velocity after adding thrust
      const speed = body.velocity.length();
      if (speed > PHYSICS.maxVelocity) {
        body.velocity.scale(PHYSICS.maxVelocity / speed);
      }
    }

    // Drag — per-frame velocity multiplier; gradually coasts to a stop
    body.velocity.x *= PHYSICS.drag;
    body.velocity.y *= PHYSICS.drag;
  }
}
