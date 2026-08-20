import { rotateLocalVector } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "../physics/PhysicsSandbox.js";
import type { WreckComponentRecord, WreckSandbox } from "../physics/WreckSandbox.js";

type Vec3 = { x: number; y: number; z: number };

export const TETHER_RANGE_METERS = 11;
export const TETHER_AIM_COSINE = 0.75;
export const TETHER_MIN_LENGTH_METERS = 2.5;
export const TETHER_WINCH_SPEED_METERS_PER_SECOND = 2.2;
export const TETHER_SPRING_NEWTONS_PER_METER = 12;
export const TETHER_DAMPING_NEWTONS_PER_METER_PER_SECOND = 3.5;
export const TETHER_MAX_TENSION_NEWTONS = 70;

export type TetherSystemOptions = {
  maxTensionNewtons?: number;
};

export type TetherState = "idle" | "blocked" | "attached" | "snapped";
export type TetherReleaseReason = "manual" | "overload" | null;

export type TetherDiagnostics = {
  state: TetherState;
  targetId: string | null;
  targetDistance: number;
  aimAlignment: number;
  targetLength: number;
  tensionNewtons: number;
  maxTensionNewtons: number;
  loadRatio: number;
  canAttach: boolean;
  lastReleaseReason: TetherReleaseReason;
};

type TetherCandidate = {
  component: WreckComponentRecord;
  distance: number;
  aimAlignment: number;
  score: number;
};

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(vector: Vec3, amount: number): Vec3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  if (length < 1e-9) return { x: 0, y: 0, z: -1 };
  return scale(vector, 1 / length);
}

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export class TetherSystem {
  private state: TetherState = "idle";
  private targetId: string | null = null;
  private targetLength = 0;
  private targetDistance = Number.POSITIVE_INFINITY;
  private aimAlignment = -1;
  private tensionNewtons = 0;
  private requiresRelease = false;
  private lastReleaseReason: TetherReleaseReason = null;
  private maxTensionNewtons: number;

  constructor(options: TetherSystemOptions = {}) {
    const configured = options.maxTensionNewtons ?? TETHER_MAX_TENSION_NEWTONS;
    if (!validPositive(configured)) throw new Error("Tether max tension must be positive and finite");
    this.maxTensionNewtons = configured;
  }

  setMaxTensionNewtons(value: number): void {
    if (!validPositive(value)) throw new Error("Tether max tension must be positive and finite");
    this.maxTensionNewtons = value;
  }

  reset(): void {
    this.state = "idle";
    this.targetId = null;
    this.targetLength = 0;
    this.targetDistance = Number.POSITIVE_INFINITY;
    this.aimAlignment = -1;
    this.tensionNewtons = 0;
    this.requiresRelease = false;
    this.lastReleaseReason = null;
  }

  attachToComponent(sandbox: WreckSandbox, componentId: string): boolean {
    let component: WreckComponentRecord;
    try {
      component = sandbox.getWreckComponent(componentId);
    } catch {
      return false;
    }
    if (!component.body.isEnabled()) return false;

    const craftPosition = sandbox.getCraftBody().translation();
    const componentPosition = component.body.translation();
    const distance = magnitude(subtract(componentPosition, craftPosition));
    if (distance > TETHER_RANGE_METERS) return false;

    this.targetId = componentId;
    this.targetDistance = distance;
    this.targetLength = Math.max(TETHER_MIN_LENGTH_METERS, distance);
    this.aimAlignment = 1;
    this.tensionNewtons = 0;
    this.requiresRelease = false;
    this.lastReleaseReason = null;
    this.state = "attached";
    return true;
  }

  step(sandbox: WreckSandbox, active: boolean): void {
    if (!active) {
      if (this.requiresRelease) {
        this.targetId = null;
        this.targetLength = 0;
        this.targetDistance = Number.POSITIVE_INFINITY;
        this.aimAlignment = -1;
        this.tensionNewtons = 0;
        this.requiresRelease = false;
        this.state = "idle";
        return;
      }
      if (this.targetId !== null) this.lastReleaseReason = "manual";
      this.targetId = null;
      this.targetLength = 0;
      this.targetDistance = Number.POSITIVE_INFINITY;
      this.aimAlignment = -1;
      this.tensionNewtons = 0;
      this.state = "idle";
      return;
    }

    if (this.requiresRelease) {
      this.state = "snapped";
      this.tensionNewtons = 0;
      return;
    }

    if (this.targetId === null) {
      const candidate = this.selectTarget(sandbox);
      if (!candidate || candidate.distance > TETHER_RANGE_METERS || candidate.aimAlignment < TETHER_AIM_COSINE) {
        this.state = "blocked";
        this.targetDistance = candidate?.distance ?? Number.POSITIVE_INFINITY;
        this.aimAlignment = candidate?.aimAlignment ?? -1;
        this.tensionNewtons = 0;
        return;
      }
      if (!this.attachToComponent(sandbox, candidate.component.id)) {
        this.state = "blocked";
        return;
      }
      this.aimAlignment = candidate.aimAlignment;
    }

    const target = sandbox.getWreckComponent(this.targetId!);
    if (!target.body.isEnabled()) {
      this.reset();
      return;
    }
    const craft = sandbox.getCraftBody();
    const craftPosition = craft.translation();
    const targetPosition = target.body.translation();
    const delta = subtract(targetPosition, craftPosition);
    const distance = magnitude(delta);
    const direction = normalize(delta);
    const relativeVelocity = subtract(target.body.linvel(), craft.linvel());
    const radialSpeed = dot(relativeVelocity, direction);

    this.targetDistance = distance;
    this.targetLength = Math.max(
      TETHER_MIN_LENGTH_METERS,
      this.targetLength - TETHER_WINCH_SPEED_METERS_PER_SECOND * FIXED_TIMESTEP_SECONDS,
    );

    const stretch = Math.max(0, distance - this.targetLength);
    const demandedTension = Math.max(
      0,
      stretch * TETHER_SPRING_NEWTONS_PER_METER
        + radialSpeed * TETHER_DAMPING_NEWTONS_PER_METER_PER_SECOND,
    );

    if (demandedTension > this.maxTensionNewtons) {
      this.state = "snapped";
      this.tensionNewtons = 0;
      this.requiresRelease = true;
      this.lastReleaseReason = "overload";
      return;
    }

    this.tensionNewtons = demandedTension;
    if (demandedTension > 0) {
      const impulseMagnitude = demandedTension * FIXED_TIMESTEP_SECONDS;
      const impulse = scale(direction, impulseMagnitude);
      target.body.applyImpulse(scale(impulse, -1), true);
      craft.applyImpulse(impulse, true);
    }
    this.state = "attached";
  }

  getDiagnostics(sandbox: WreckSandbox): TetherDiagnostics {
    let targetDistance = this.targetDistance;
    let aimAlignment = this.aimAlignment;
    if (this.targetId !== null) {
      const target = sandbox.getWreckComponent(this.targetId);
      if (target.body.isEnabled()) {
        const craft = sandbox.getCraftBody();
        const craftPosition = craft.translation();
        const targetPosition = target.body.translation();
        const delta = subtract(targetPosition, craftPosition);
        targetDistance = magnitude(delta);
        const forward = rotateLocalVector(craft.rotation(), { x: 0, y: 0, z: -1 });
        aimAlignment = targetDistance > 1e-9 ? dot(forward, delta) / targetDistance : 1;
      } else {
        targetDistance = Number.POSITIVE_INFINITY;
        aimAlignment = -1;
      }
    }
    return {
      state: this.state,
      targetId: this.targetId,
      targetDistance,
      aimAlignment,
      targetLength: this.targetLength,
      tensionNewtons: this.tensionNewtons,
      maxTensionNewtons: this.maxTensionNewtons,
      loadRatio: this.tensionNewtons / this.maxTensionNewtons,
      canAttach: this.targetId !== null
        ? targetDistance <= TETHER_RANGE_METERS
        : false,
      lastReleaseReason: this.lastReleaseReason,
    };
  }

  private selectTarget(sandbox: WreckSandbox): TetherCandidate | null {
    const craft = sandbox.getCraftBody();
    const craftPosition = craft.translation();
    const forward = rotateLocalVector(craft.rotation(), { x: 0, y: 0, z: -1 });
    const severedSalvageSides = new Set<string>();
    for (const severed of sandbox.getSeveredConnections()) {
      severedSalvageSides.add(severed.componentBId);
    }

    let best: TetherCandidate | null = null;
    for (const component of sandbox.getWreckComponents()) {
      if (!component.body.isEnabled()) continue;
      const position = component.body.translation();
      const delta = subtract(position, craftPosition);
      const distance = magnitude(delta);
      const aimAlignment = distance > 1e-9 ? dot(forward, delta) / distance : 1;
      const severedSalvageBias = severedSalvageSides.has(component.id) ? 0.45 : 0;
      const lightBias = component.massClass === "light" ? 0.015 : 0;
      const score = aimAlignment + severedSalvageBias + lightBias - distance * 0.002;
      const candidate = { component, distance, aimAlignment, score };
      if (!best || candidate.score > best.score) best = candidate;
    }
    return best;
  }
}
