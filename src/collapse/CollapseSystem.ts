import { rotateLocalVector } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "../physics/PhysicsSandbox.js";
import type { WreckContactForceEvent, WreckSandbox } from "../physics/WreckSandbox.js";
import type { StructuralGraph } from "../structure/StructuralGraph.js";

type Vec3 = { x: number; y: number; z: number };

export const MAX_HULL_INTEGRITY = 100;
export const HULL_DAMAGE_IMPULSE_THRESHOLD = 1.5;
export const HULL_DAMAGE_PER_IMPULSE = 12;
export const COLLAPSE_THREAT_RANGE_METERS = 20;

export type CollapseSeverityState = "stable" | "elevated" | "danger" | "critical" | "destroyed";
export type CollapseWarningDirection = "none" | "ahead" | "astern" | "port" | "starboard" | "above" | "below";
export type CollapseWarningCue = "quiet" | "caution-pulse" | "danger-pulse" | "critical-alarm" | "hull-failure";

export type CollapseDiagnostics = {
  severityScore: number;
  severityState: CollapseSeverityState;
  hullIntegrity: number;
  destroyed: boolean;
  warningDirection: CollapseWarningDirection;
  warningCue: CollapseWarningCue;
  highestThreatComponentId: string | null;
  highestThreatDistance: number;
  highestThreatClosingSpeed: number;
  lastImpactBodyId: string | null;
  lastImpactForceNewtons: number;
  lastImpactImpulse: number;
  lastImpactDamage: number;
  secondaryBreakCount: number;
  lastSecondaryBreakId: string | null;
};

type ThreatRecord = {
  componentId: string;
  score: number;
  distance: number;
  closingSpeed: number;
};

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function scale(vector: Vec3, amount: number): Vec3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  if (length < 1e-9) return { x: 0, y: 0, z: -1 };
  return scale(vector, 1 / length);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function severityState(score: number, destroyed: boolean): CollapseSeverityState {
  if (destroyed) return "destroyed";
  if (score >= 70) return "critical";
  if (score >= 45) return "danger";
  if (score >= 20) return "elevated";
  return "stable";
}

function warningCue(state: CollapseSeverityState): CollapseWarningCue {
  if (state === "destroyed") return "hull-failure";
  if (state === "critical") return "critical-alarm";
  if (state === "danger") return "danger-pulse";
  if (state === "elevated") return "caution-pulse";
  return "quiet";
}

export class CollapseSystem {
  private hullIntegrity = MAX_HULL_INTEGRITY;
  private severityScore = 0;
  private state: CollapseSeverityState = "stable";
  private warningDirection: CollapseWarningDirection = "none";
  private cue: CollapseWarningCue = "quiet";
  private highestThreat: ThreatRecord | null = null;
  private lastImpactBodyId: string | null = null;
  private lastImpactForceNewtons = 0;
  private lastImpactImpulse = 0;
  private lastImpactDamage = 0;
  private readonly secondaryBreakIds = new Set<string>();
  private lastSecondaryBreakId: string | null = null;

  reset(): void {
    this.hullIntegrity = MAX_HULL_INTEGRITY;
    this.severityScore = 0;
    this.state = "stable";
    this.warningDirection = "none";
    this.cue = "quiet";
    this.highestThreat = null;
    this.lastImpactBodyId = null;
    this.lastImpactForceNewtons = 0;
    this.lastImpactImpulse = 0;
    this.lastImpactDamage = 0;
    this.secondaryBreakIds.clear();
    this.lastSecondaryBreakId = null;
  }

  step(sandbox: WreckSandbox, graph: StructuralGraph): void {
    const impact = this.processContactEvents(sandbox);
    this.highestThreat = this.findHighestThreat(sandbox);

    const impactScore = impact
      ? clamp((impact.impulse - HULL_DAMAGE_IMPULSE_THRESHOLD) * 8, 0, 85)
      : 0;
    const secondaryBreakScore = this.lastSecondaryBreakId && this.secondaryBreakIds.has(this.lastSecondaryBreakId) ? 55 : 0;
    const threatScore = this.highestThreat?.score ?? 0;

    this.severityScore = clamp(Math.max(threatScore, impactScore, secondaryBreakScore), 0, 100);
    const destroyed = this.hullIntegrity <= 0;
    if (destroyed) this.severityScore = 100;
    this.state = severityState(this.severityScore, destroyed);
    this.cue = warningCue(this.state);
    this.warningDirection = this.resolveWarningDirection(sandbox, this.highestThreat?.componentId ?? impact?.bodyId ?? null);

    // Read the graph only as a synchronization guard. Collapse never writes graph state.
    const graphDiagnostics = graph.getDiagnostics();
    if (graphDiagnostics.nodeCount !== sandbox.getWreckComponents().length) {
      this.severityScore = Math.max(this.severityScore, 70);
      this.state = severityState(this.severityScore, destroyed);
      this.cue = warningCue(this.state);
    }
  }

  getDiagnostics(): CollapseDiagnostics {
    return {
      severityScore: this.severityScore,
      severityState: this.state,
      hullIntegrity: this.hullIntegrity,
      destroyed: this.hullIntegrity <= 0,
      warningDirection: this.warningDirection,
      warningCue: this.cue,
      highestThreatComponentId: this.highestThreat?.componentId ?? null,
      highestThreatDistance: this.highestThreat?.distance ?? Number.POSITIVE_INFINITY,
      highestThreatClosingSpeed: this.highestThreat?.closingSpeed ?? 0,
      lastImpactBodyId: this.lastImpactBodyId,
      lastImpactForceNewtons: this.lastImpactForceNewtons,
      lastImpactImpulse: this.lastImpactImpulse,
      lastImpactDamage: this.lastImpactDamage,
      secondaryBreakCount: this.secondaryBreakIds.size,
      lastSecondaryBreakId: this.lastSecondaryBreakId,
    };
  }

  private processContactEvents(sandbox: WreckSandbox): { bodyId: string; impulse: number } | null {
    this.lastImpactDamage = 0;
    let strongestCraftImpact: { bodyId: string; force: number; impulse: number } | null = null;
    const componentIds = new Set(sandbox.getWreckComponents().map((component) => component.id));

    for (const event of sandbox.getContactForceEvents()) {
      const impulse = event.totalForceMagnitude * FIXED_TIMESTEP_SECONDS;
      const craftBodyId = event.bodyAId === "craft"
        ? event.bodyBId
        : event.bodyBId === "craft"
          ? event.bodyAId
          : null;

      if (craftBodyId && componentIds.has(craftBodyId)) {
        if (!strongestCraftImpact || impulse > strongestCraftImpact.impulse) {
          strongestCraftImpact = {
            bodyId: craftBodyId,
            force: event.totalForceMagnitude,
            impulse,
          };
        }
      }

      this.processSecondaryBreak(sandbox, event, impulse, componentIds);
    }

    if (!strongestCraftImpact) return null;

    this.lastImpactBodyId = strongestCraftImpact.bodyId;
    this.lastImpactForceNewtons = strongestCraftImpact.force;
    this.lastImpactImpulse = strongestCraftImpact.impulse;
    if (strongestCraftImpact.impulse > HULL_DAMAGE_IMPULSE_THRESHOLD && this.hullIntegrity > 0) {
      const damage = Math.min(
        this.hullIntegrity,
        (strongestCraftImpact.impulse - HULL_DAMAGE_IMPULSE_THRESHOLD) * HULL_DAMAGE_PER_IMPULSE,
      );
      this.lastImpactDamage = damage;
      this.hullIntegrity = Math.max(0, this.hullIntegrity - damage);
    }

    return { bodyId: strongestCraftImpact.bodyId, impulse: strongestCraftImpact.impulse };
  }

  private processSecondaryBreak(
    sandbox: WreckSandbox,
    event: WreckContactForceEvent,
    impulse: number,
    componentIds: ReadonlySet<string>,
  ): void {
    if (sandbox.areBodiesConnected(event.bodyAId, event.bodyBId)) return;

    const impactedComponentIds = [event.bodyAId, event.bodyBId].filter((id) => componentIds.has(id));
    const candidates = impactedComponentIds
      .flatMap((componentId) => sandbox.getConnectionsForComponent(componentId))
      .filter((connection) => connection.failureImpulseThreshold !== null)
      .filter((connection) => impulse >= connection.failureImpulseThreshold!)
      .filter((connection, index, array) => array.findIndex((candidate) => candidate.id === connection.id) === index)
      .sort((a, b) => (a.failureImpulseThreshold! - b.failureImpulseThreshold!) || a.id.localeCompare(b.id));

    const candidate = candidates[0];
    if (!candidate) return;
    const result = sandbox.breakConnectionFromImpact(candidate.id);
    if (!result.severed) return;
    this.secondaryBreakIds.add(candidate.id);
    this.lastSecondaryBreakId = candidate.id;
  }

  private findHighestThreat(sandbox: WreckSandbox): ThreatRecord | null {
    const spineSection = this.getPhysicalConnectedSection(sandbox, "spine");
    const craft = sandbox.getCraftBody();
    const craftPosition = craft.translation();
    const craftVelocity = craft.linvel();
    let best: ThreatRecord | null = null;

    for (const component of sandbox.getWreckComponents()) {
      if (spineSection.has(component.id)) continue;
      const position = component.body.translation();
      const velocity = component.body.linvel();
      const delta = subtract(position, craftPosition);
      const distance = magnitude(delta);
      if (distance > COLLAPSE_THREAT_RANGE_METERS) continue;
      const direction = normalize(delta);
      const relativeVelocity = subtract(velocity, craftVelocity);
      const closingSpeed = Math.max(0, -dot(relativeVelocity, direction));
      const proximityScore = clamp((1 - distance / COLLAPSE_THREAT_RANGE_METERS) * 20, 0, 20);
      const closingScore = clamp(closingSpeed * 14, 0, 55);
      const massScoreBase = clamp(component.body.mass() * 1.8, 0, 30);
      const massScore = closingSpeed > 0.15 ? massScoreBase : massScoreBase * 0.2;
      const score = clamp(proximityScore + closingScore + massScore, 0, 100);
      const threat = { componentId: component.id, score, distance, closingSpeed };
      if (!best || threat.score > best.score) best = threat;
    }

    return best;
  }

  private getPhysicalConnectedSection(sandbox: WreckSandbox, startId: string): Set<string> {
    const componentIds = new Set(sandbox.getWreckComponents().map((component) => component.id));
    const visited = new Set<string>();
    if (!componentIds.has(startId)) return visited;
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const connection of sandbox.getConnections()) {
        let neighbor: string | null = null;
        if (connection.componentAId === current) neighbor = connection.componentBId;
        else if (connection.componentBId === current) neighbor = connection.componentAId;
        if (neighbor && !visited.has(neighbor)) queue.push(neighbor);
      }
    }

    return visited;
  }

  private resolveWarningDirection(sandbox: WreckSandbox, bodyId: string | null): CollapseWarningDirection {
    if (!bodyId || bodyId === "craft") return "none";
    let targetPosition: Vec3;
    try {
      targetPosition = sandbox.getWreckComponent(bodyId).body.translation();
    } catch {
      return "none";
    }

    const craft = sandbox.getCraftBody();
    const delta = normalize(subtract(targetPosition, craft.translation()));
    const rotation = craft.rotation();
    const forward = rotateLocalVector(rotation, { x: 0, y: 0, z: -1 });
    const right = rotateLocalVector(rotation, { x: 1, y: 0, z: 0 });
    const up = rotateLocalVector(rotation, { x: 0, y: 1, z: 0 });
    const forwardDot = dot(delta, forward);
    const rightDot = dot(delta, right);
    const upDot = dot(delta, up);
    const forwardMagnitude = Math.abs(forwardDot);
    const rightMagnitude = Math.abs(rightDot);
    const upMagnitude = Math.abs(upDot);

    if (forwardMagnitude >= rightMagnitude && forwardMagnitude >= upMagnitude) return forwardDot >= 0 ? "ahead" : "astern";
    if (rightMagnitude >= upMagnitude) return rightDot >= 0 ? "starboard" : "port";
    return upDot >= 0 ? "above" : "below";
  }
}
