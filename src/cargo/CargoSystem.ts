import { FIXED_TIMESTEP_SECONDS } from "../physics/PhysicsSandbox.js";
import type { WreckComponentRecord, WreckComponentType, WreckSandbox } from "../physics/WreckSandbox.js";

type Vec3 = { x: number; y: number; z: number };

export const CARGO_CAPTURE_RADIUS_METERS = 3;
export const CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND = 1.35;
export const CARGO_DAMAGE_IMPULSE_THRESHOLD = 0.8;
export const CARGO_CONDITION_DAMAGE_PER_EXCESS_IMPULSE = 10;
export const CARGO_EXTRACTION_DISTANCE_METERS = 11.5;

const CARGO_BASE_VALUE_BY_TYPE: Readonly<Record<WreckComponentType, number>> = Object.freeze({
  spine: 800,
  engine: 1200,
  panel: 250,
  rail: 300,
  junction: 600,
});

export type CargoSystemOptions = {
  maxCaptureRelativeSpeed?: number;
};

export type CargoCaptureState = "idle" | "tracking" | "blocked-speed" | "secured";
export type CargoSettlementState = "field" | "returning" | "settled";

export type SecuredCargoRecord = {
  componentId: string;
  componentType: WreckComponentType;
  condition: number;
  baseValueUnits: number;
  adjustedValueUnits: number;
  securedAtSeconds: number;
  mass: number;
};

export type CargoDiagnostics = {
  captureState: CargoCaptureState;
  candidateId: string | null;
  candidateDistance: number;
  candidateRelativeSpeed: number;
  captureRadiusMeters: number;
  maxCaptureRelativeSpeed: number;
  securedCargoCount: number;
  securedCargoIds: readonly string[];
  candidateCondition: number;
  candidateBaseValueUnits: number;
  candidateAdjustedValueUnits: number;
  lastDamageComponentId: string | null;
  lastDamageImpulse: number;
  lastConditionDamage: number;
  settlementState: CargoSettlementState;
  extractionDistanceMeters: number;
  currentWreckDistance: number;
  payoutUnits: number;
  settlementItems: readonly SecuredCargoRecord[];
};

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export class CargoSystem {
  private readonly conditions = new Map<string, number>();
  private readonly securedCargo = new Map<string, SecuredCargoRecord>();
  private captureState: CargoCaptureState = "idle";
  private candidateId: string | null = null;
  private candidateDistance = Number.POSITIVE_INFINITY;
  private candidateRelativeSpeed = 0;
  private lastDamageComponentId: string | null = null;
  private lastDamageImpulse = 0;
  private lastConditionDamage = 0;
  private settlementState: CargoSettlementState = "field";
  private payoutUnits = 0;
  private maxCaptureRelativeSpeed: number;

  constructor(options: CargoSystemOptions = {}) {
    const configured = options.maxCaptureRelativeSpeed ?? CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND;
    if (!validPositive(configured)) throw new Error("Cargo max capture relative speed must be positive and finite");
    this.maxCaptureRelativeSpeed = configured;
  }

  setMaxCaptureRelativeSpeed(value: number): void {
    if (!validPositive(value)) throw new Error("Cargo max capture relative speed must be positive and finite");
    this.maxCaptureRelativeSpeed = value;
  }

  reset(): void {
    this.conditions.clear();
    this.securedCargo.clear();
    this.captureState = "idle";
    this.candidateId = null;
    this.candidateDistance = Number.POSITIVE_INFINITY;
    this.candidateRelativeSpeed = 0;
    this.lastDamageComponentId = null;
    this.lastDamageImpulse = 0;
    this.lastConditionDamage = 0;
    this.settlementState = "field";
    this.payoutUnits = 0;
  }

  step(sandbox: WreckSandbox, tetherTargetId: string | null): string | null {
    this.processLooseCargoDamage(sandbox);
    const capturedId = this.tryCapture(sandbox, tetherTargetId);

    const wreckDistance = sandbox.getDiagnostics().distanceToWreck;
    if (this.securedCargo.size > 0 && this.settlementState !== "settled") {
      if (wreckDistance >= CARGO_EXTRACTION_DISTANCE_METERS) {
        this.settlementState = "settled";
        this.payoutUnits = [...this.securedCargo.values()].reduce((sum, cargo) => sum + cargo.adjustedValueUnits, 0);
      } else {
        this.settlementState = "returning";
      }
    }

    return capturedId;
  }

  getDiagnostics(sandbox: WreckSandbox): CargoDiagnostics {
    const candidate = this.resolveExistingComponent(sandbox, this.candidateId);
    const condition = this.candidateId ? this.getCondition(this.candidateId) : 100;
    const componentType = candidate?.componentType ?? null;
    const baseValue = componentType ? CARGO_BASE_VALUE_BY_TYPE[componentType] : 0;
    const settlementItems = [...this.securedCargo.values()];
    return {
      captureState: this.captureState,
      candidateId: this.candidateId,
      candidateDistance: this.candidateDistance,
      candidateRelativeSpeed: this.candidateRelativeSpeed,
      captureRadiusMeters: CARGO_CAPTURE_RADIUS_METERS,
      maxCaptureRelativeSpeed: this.maxCaptureRelativeSpeed,
      securedCargoCount: settlementItems.length,
      securedCargoIds: settlementItems.map((cargo) => cargo.componentId),
      candidateCondition: condition,
      candidateBaseValueUnits: baseValue,
      candidateAdjustedValueUnits: Math.round(baseValue * condition / 100),
      lastDamageComponentId: this.lastDamageComponentId,
      lastDamageImpulse: this.lastDamageImpulse,
      lastConditionDamage: this.lastConditionDamage,
      settlementState: this.settlementState,
      extractionDistanceMeters: CARGO_EXTRACTION_DISTANCE_METERS,
      currentWreckDistance: sandbox.getDiagnostics().distanceToWreck,
      payoutUnits: this.payoutUnits,
      settlementItems,
    };
  }

  getCondition(componentId: string): number {
    return this.conditions.get(componentId) ?? 100;
  }

  getSecuredCargo(): readonly SecuredCargoRecord[] {
    return [...this.securedCargo.values()];
  }

  isSecured(componentId: string): boolean {
    return this.securedCargo.has(componentId);
  }

  private tryCapture(sandbox: WreckSandbox, tetherTargetId: string | null): string | null {
    if (!tetherTargetId) {
      if (this.securedCargo.size === 0) {
        this.captureState = "idle";
        this.candidateId = null;
        this.candidateDistance = Number.POSITIVE_INFINITY;
        this.candidateRelativeSpeed = 0;
      }
      return null;
    }

    const candidate = this.resolveExistingComponent(sandbox, tetherTargetId);
    if (!candidate || !this.isEligibleLooseCargo(sandbox, candidate)) {
      if (this.securedCargo.size === 0) this.captureState = "idle";
      return null;
    }

    const craft = sandbox.getCraftBody();
    const distance = magnitude(subtract(candidate.body.translation(), craft.translation()));
    const relativeSpeed = magnitude(subtract(candidate.body.linvel(), craft.linvel()));
    this.candidateId = candidate.id;
    this.candidateDistance = distance;
    this.candidateRelativeSpeed = relativeSpeed;
    this.captureState = "tracking";

    if (distance > CARGO_CAPTURE_RADIUS_METERS) return null;
    if (relativeSpeed > this.maxCaptureRelativeSpeed) {
      this.captureState = "blocked-speed";
      return null;
    }

    const condition = this.getCondition(candidate.id);
    const baseValueUnits = CARGO_BASE_VALUE_BY_TYPE[candidate.componentType];
    const adjustedValueUnits = Math.round(baseValueUnits * condition / 100);
    const secured: SecuredCargoRecord = {
      componentId: candidate.id,
      componentType: candidate.componentType,
      condition,
      baseValueUnits,
      adjustedValueUnits,
      securedAtSeconds: sandbox.getDiagnostics().elapsedSeconds,
      mass: candidate.body.mass(),
    };

    candidate.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    candidate.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    candidate.body.setEnabled(false);
    this.securedCargo.set(candidate.id, secured);
    this.captureState = "secured";
    this.candidateRelativeSpeed = 0;
    return candidate.id;
  }

  private processLooseCargoDamage(sandbox: WreckSandbox): void {
    this.lastConditionDamage = 0;
    let strongest: { componentId: string; impulse: number; damage: number } | null = null;

    for (const event of sandbox.getContactForceEvents()) {
      const impulse = event.totalForceMagnitude * FIXED_TIMESTEP_SECONDS;
      if (impulse <= CARGO_DAMAGE_IMPULSE_THRESHOLD) continue;

      for (const componentId of [event.bodyAId, event.bodyBId]) {
        const component = this.resolveExistingComponent(sandbox, componentId);
        if (!component || !this.isEligibleLooseCargo(sandbox, component)) continue;
        const damage = (impulse - CARGO_DAMAGE_IMPULSE_THRESHOLD) * CARGO_CONDITION_DAMAGE_PER_EXCESS_IMPULSE;
        if (!strongest || damage > strongest.damage) strongest = { componentId, impulse, damage };
      }
    }

    if (!strongest) return;
    const before = this.getCondition(strongest.componentId);
    const appliedDamage = Math.min(before, strongest.damage);
    this.conditions.set(strongest.componentId, clamp(before - appliedDamage, 0, 100));
    this.lastDamageComponentId = strongest.componentId;
    this.lastDamageImpulse = strongest.impulse;
    this.lastConditionDamage = appliedDamage;
  }

  private isEligibleLooseCargo(sandbox: WreckSandbox, component: WreckComponentRecord): boolean {
    if (component.id === "spine" || !component.body.isEnabled() || this.securedCargo.has(component.id)) return false;
    return sandbox.getConnectionsForComponent(component.id).length === 0;
  }

  private resolveExistingComponent(sandbox: WreckSandbox, componentId: string | null): WreckComponentRecord | null {
    if (!componentId) return null;
    try {
      return sandbox.getWreckComponent(componentId);
    } catch {
      return null;
    }
  }
}
