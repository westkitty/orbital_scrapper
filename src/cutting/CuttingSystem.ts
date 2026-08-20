import { rotateLocalVector } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "../physics/PhysicsSandbox.js";
import type { WreckConnectionRecord, WreckCutClass, WreckSandbox } from "../physics/WreckSandbox.js";

type Vec3 = { x: number; y: number; z: number };

export const CUTTER_RANGE_METERS = 9;
export const CUTTER_AIM_COSINE = 0.92;
export const CUTTER_DURATION_SECONDS = 0.75;

export type CuttingState = "idle" | "tracking" | "blocked" | "cutting" | "complete";

export type CuttingDiagnostics = {
  state: CuttingState;
  targetId: string | null;
  targetClass: WreckCutClass | null;
  targetDistance: number;
  aimAlignment: number;
  canCut: boolean;
  progress01: number;
  lastCompletedConnectionId: string | null;
  lastSeparationDistance: number;
};

type Candidate = {
  connection: WreckConnectionRecord;
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

export class CuttingSystem {
  private state: CuttingState = "idle";
  private targetId: string | null = null;
  private targetClass: WreckCutClass | null = null;
  private targetDistance = Number.POSITIVE_INFINITY;
  private aimAlignment = -1;
  private progressSeconds = 0;
  private progressTargetId: string | null = null;
  private lastCompletedConnectionId: string | null = null;
  private requiresRelease = false;

  reset(): void {
    this.state = "idle";
    this.targetId = null;
    this.targetClass = null;
    this.targetDistance = Number.POSITIVE_INFINITY;
    this.aimAlignment = -1;
    this.progressSeconds = 0;
    this.progressTargetId = null;
    this.lastCompletedConnectionId = null;
    this.requiresRelease = false;
  }

  step(sandbox: WreckSandbox, active: boolean): void {
    if (!active && this.requiresRelease) {
      this.requiresRelease = false;
      this.progressSeconds = 0;
      this.progressTargetId = null;
    }

    if (this.requiresRelease) {
      this.state = "complete";
      return;
    }

    const candidate = this.selectTarget(sandbox);
    this.targetId = candidate?.connection.id ?? null;
    this.targetClass = candidate?.connection.cutClass ?? null;
    this.targetDistance = candidate?.distance ?? Number.POSITIVE_INFINITY;
    this.aimAlignment = candidate?.aimAlignment ?? -1;

    if (!candidate) {
      this.progressSeconds = 0;
      this.progressTargetId = null;
      this.state = active ? "blocked" : "idle";
      return;
    }

    const canCut = candidate.distance <= CUTTER_RANGE_METERS && candidate.aimAlignment >= CUTTER_AIM_COSINE;
    if (!active) {
      this.progressSeconds = 0;
      this.progressTargetId = null;
      this.state = canCut ? "tracking" : "blocked";
      return;
    }

    if (!canCut) {
      this.progressSeconds = 0;
      this.progressTargetId = candidate.connection.id;
      this.state = "blocked";
      return;
    }

    if (this.progressTargetId !== candidate.connection.id) {
      this.progressSeconds = 0;
      this.progressTargetId = candidate.connection.id;
    }

    this.progressSeconds += FIXED_TIMESTEP_SECONDS;
    this.state = "cutting";

    if (this.progressSeconds + 1e-9 < CUTTER_DURATION_SECONDS) return;

    const result = sandbox.severConnection(candidate.connection.id);
    if (!result.severed) {
      this.progressSeconds = 0;
      this.progressTargetId = null;
      this.state = "blocked";
      return;
    }

    this.progressSeconds = CUTTER_DURATION_SECONDS;
    this.progressTargetId = null;
    this.lastCompletedConnectionId = candidate.connection.id;
    this.requiresRelease = true;
    this.state = "complete";
  }

  getDiagnostics(sandbox: WreckSandbox): CuttingDiagnostics {
    const canCut = this.targetId !== null
      && sandbox.hasConnection(this.targetId)
      && this.targetDistance <= CUTTER_RANGE_METERS
      && this.aimAlignment >= CUTTER_AIM_COSINE;
    return {
      state: this.state,
      targetId: this.targetId,
      targetClass: this.targetClass,
      targetDistance: this.targetDistance,
      aimAlignment: this.aimAlignment,
      canCut,
      progress01: Math.min(1, this.progressSeconds / CUTTER_DURATION_SECONDS),
      lastCompletedConnectionId: this.lastCompletedConnectionId,
      lastSeparationDistance: this.lastCompletedConnectionId
        ? sandbox.getSeveredConnectionSeparation(this.lastCompletedConnectionId)
        : 0,
    };
  }

  private selectTarget(sandbox: WreckSandbox): Candidate | null {
    const craft = sandbox.getCraftBody();
    const position = craft.translation();
    const rotation = craft.rotation();
    const forward = rotateLocalVector(rotation, { x: 0, y: 0, z: -1 });
    let best: Candidate | null = null;

    for (const connection of sandbox.getCuttableConnections()) {
      const point = sandbox.getConnectionWorldPoint(connection.id);
      const delta = { x: point.x - position.x, y: point.y - position.y, z: point.z - position.z };
      const distance = magnitude(delta);
      const aimAlignment = distance > 1e-6 ? dot(forward, delta) / distance : 1;
      const lowRiskBias = connection.cutClass === "low-risk" ? 0.025 : 0;
      const score = aimAlignment + lowRiskBias - distance * 0.001;
      const candidate = { connection, distance, aimAlignment, score };
      if (!best || candidate.score > best.score) best = candidate;
    }

    return best;
  }
}
