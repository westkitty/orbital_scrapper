import RAPIER from "@dimforge/rapier3d-compat";

type FlightRigidBody = InstanceType<typeof RAPIER.RigidBody>;

type Vec3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

export type FlightInput = {
  forward: number;
  strafe: number;
  vertical: number;
  pitch: number;
  yaw: number;
  roll: number;
  brake: boolean;
};

export const NEUTRAL_FLIGHT_INPUT: FlightInput = Object.freeze({
  forward: 0,
  strafe: 0,
  vertical: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  brake: false,
});

export type FlightTuning = {
  mainThrustNewtons: number;
  reverseThrustNewtons: number;
  lateralThrustNewtons: number;
  verticalThrustNewtons: number;
  pitchTorque: number;
  yawTorque: number;
  rollTorque: number;
  brakeAcceleration: number;
  angularBrakeTorque: number;
};

export const DEFAULT_FLIGHT_TUNING: FlightTuning = Object.freeze({
  mainThrustNewtons: 22,
  reverseThrustNewtons: 16,
  lateralThrustNewtons: 16,
  verticalThrustNewtons: 16,
  pitchTorque: 5.2,
  yawTorque: 5.2,
  rollTorque: 4.4,
  brakeAcceleration: 11,
  angularBrakeTorque: 7.5,
});

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function clampMagnitude(vector: Vec3, maximum: number): Vec3 {
  const length = magnitude(vector);
  if (length <= maximum || length === 0) return vector;
  const scale = maximum / length;
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

export function rotateLocalVector(rotation: Quat, vector: Vec3): Vec3 {
  const { x, y, z, w } = rotation;
  const ix = w * vector.x + y * vector.z - z * vector.y;
  const iy = w * vector.y + z * vector.x - x * vector.z;
  const iz = w * vector.z + x * vector.y - y * vector.x;
  const iw = -x * vector.x - y * vector.y - z * vector.z;

  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}

export class FlightController {
  constructor(readonly tuning: FlightTuning = DEFAULT_FLIGHT_TUNING) {}

  apply(body: FlightRigidBody, input: FlightInput): void {
    body.resetForces(false);
    body.resetTorques(false);

    const forwardAxis = clampAxis(input.forward);
    const localForce = {
      x: clampAxis(input.strafe) * this.tuning.lateralThrustNewtons,
      y: clampAxis(input.vertical) * this.tuning.verticalThrustNewtons,
      z: -forwardAxis * (forwardAxis >= 0 ? this.tuning.mainThrustNewtons : this.tuning.reverseThrustNewtons),
    };
    const rotation = body.rotation();
    body.addForce(rotateLocalVector(rotation, localForce), true);

    const localTorque = {
      x: clampAxis(input.pitch) * this.tuning.pitchTorque,
      y: clampAxis(input.yaw) * this.tuning.yawTorque,
      z: -clampAxis(input.roll) * this.tuning.rollTorque,
    };
    body.addTorque(rotateLocalVector(rotation, localTorque), true);

    if (input.brake) {
      const velocity = body.linvel();
      const mass = Math.max(body.mass(), 0.001);
      const maxBrakeForce = mass * this.tuning.brakeAcceleration;
      body.addForce(clampMagnitude({ x: -velocity.x * mass * 8, y: -velocity.y * mass * 8, z: -velocity.z * mass * 8 }, maxBrakeForce), true);

      const angularVelocity = body.angvel();
      body.addTorque(clampMagnitude({ x: -angularVelocity.x * 4, y: -angularVelocity.y * 4, z: -angularVelocity.z * 4 }, this.tuning.angularBrakeTorque), true);
    }
  }
}
