import Phaser from 'phaser';
import { PHYSICS } from '@asteroidz/shared';

type MovementKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

export class MovementSystem {
  private scene: Phaser.Scene;
  private ship: Phaser.Physics.Arcade.Sprite;
  private keys: MovementKeys;

  constructor(scene: Phaser.Scene, ship: Phaser.Physics.Arcade.Sprite, keys: MovementKeys) {
    this.scene = scene;
    this.ship = ship;
    this.keys = keys;
  }

  update(delta: number): void {
    const body = this.ship.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000; // ms → seconds

    // Rotation — instant, no angular momentum
    if (this.keys.A.isDown) {
      this.ship.angle -= PHYSICS.rotationSpeed * dt;
    }
    if (this.keys.D.isDown) {
      this.ship.angle += PHYSICS.rotationSpeed * dt;
    }

    // Thrust — sprite texture points north; Phaser angle=0 points east (+x)
    // Subtract 90° so thrust direction matches the visual facing direction
    if (this.keys.W.isDown) {
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
