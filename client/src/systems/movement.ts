import Phaser from 'phaser';
import { PHYSICS } from '@asteroidz/shared';

export interface InputState {
  left: boolean;
  right: boolean;
  thrust: boolean;
  shoot: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
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

    // Strafe — perpendicular to facing direction
    // angle-180° = left lateral; angle+0° = right lateral (both 90° off the thrust axis)
    if (this.input.strafeLeft) {
      const strafeRad = Phaser.Math.DegToRad(this.ship.angle - 180);
      vx += Math.cos(strafeRad) * PHYSICS.strafeForce * dt;
      vy += Math.sin(strafeRad) * PHYSICS.strafeForce * dt;
    }
    if (this.input.strafeRight) {
      const strafeRad = Phaser.Math.DegToRad(this.ship.angle);
      vx += Math.cos(strafeRad) * PHYSICS.strafeForce * dt;
      vy += Math.sin(strafeRad) * PHYSICS.strafeForce * dt;
    }

    // Clamp to max velocity; strafing alone uses the lower strafe cap
    const speedCap = this.input.thrust ? PHYSICS.maxVelocity : PHYSICS.maxStrafeVelocity;
    const speed = Math.hypot(vx, vy);
    if (speed > speedCap) {
      const scale = speedCap / speed;
      vx *= scale;
      vy *= scale;
    }

    // Drag is handled by Matter's frictionAir on the ship body — no manual multiply here.
    this.scene.matter.body.setVelocity(body, { x: vx, y: vy });
  }
}
