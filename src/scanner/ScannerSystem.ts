import { rotateLocalVector } from "../flight/FlightController.js";
import type { WreckComponentType, WreckMassClass, WreckSandbox } from "../physics/WreckSandbox.js";
import type { StructuralEdgeRecord, StructuralGraph, StructuralSupportRecord } from "../structure/StructuralGraph.js";
import type { TetherDiagnostics } from "../tether/TetherSystem.js";

type Vec3 = { x: number; y: number; z: number };
export const SCANNER_RANGE_METERS = 18;
export const SCANNER_AIM_COSINE = 0.55;
export type ScannerRiskLevel = "low" | "moderate" | "high";
export type ScannerEstimate = {
  state: "locked"; connectionId: string; componentAId: string; componentBId: string; relationship: string; displayComponentId: string;
  componentType: WreckComponentType; massClass: WreckMassClass; placeholderValueUnits: number; cargoFragilityMultiplier: number;
  distanceMeters: number; aimAlignment: number; cuttable: boolean; bridge: boolean; alternateLoadPath: boolean; articulationEndpointIds: readonly string[];
  likelyFreeComponentIds: readonly string[]; estimatedFreeMass: number; relativeSpeed: number; temporarySupport: boolean; riskScore: number;
  riskLevel: ScannerRiskLevel; confidence: "estimate"; reasons: readonly string[]; topologyRevision: number; supportRevision: number;
};
export type ScannerDiagnostics = ScannerEstimate | { state: "no-target"; connectionId: null; riskLevel: null; confidence: "estimate"; reasons: readonly string[]; topologyRevision: number; supportRevision: number };
type ScannerCandidate = { edge: StructuralEdgeRecord; distance: number; aimAlignment: number; score: number };
function magnitude(vector: Vec3): number { return Math.hypot(vector.x, vector.y, vector.z); }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function subtract(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function riskLevel(score: number): ScannerRiskLevel { if (score >= 70) return "high"; if (score >= 35) return "moderate"; return "low"; }
function averageVelocity(sandbox: WreckSandbox, componentIds: readonly string[]): Vec3 {
  if (componentIds.length === 0) return { x: 0, y: 0, z: 0 }; let x = 0; let y = 0; let z = 0;
  for (const id of componentIds) { const velocity = sandbox.getWreckComponent(id).body.linvel(); x += velocity.x; y += velocity.y; z += velocity.z; }
  const inverse = 1 / componentIds.length; return { x: x * inverse, y: y * inverse, z: z * inverse };
}
function connectedSectionsWithoutEdge(graph: StructuralGraph, ignoredEdgeId: string): string[][] {
  const nodeIds = graph.getNodes().map((node) => node.id); const edges = graph.getEdges().filter((edge) => edge.id !== ignoredEdgeId); const visited = new Set<string>(); const sections: string[][] = [];
  for (const start of nodeIds) { if (visited.has(start)) continue; const queue = [start]; const section: string[] = [];
    while (queue.length > 0) { const current = queue.shift()!; if (visited.has(current)) continue; visited.add(current); section.push(current);
      for (const edge of edges) { let neighbor: string | null = null; if (edge.componentAId === current) neighbor = edge.componentBId; else if (edge.componentBId === current) neighbor = edge.componentAId; if (neighbor && !visited.has(neighbor)) queue.push(neighbor); }
    }
    sections.push(section.sort());
  }
  return sections.sort((a, b) => a.length - b.length || a.join(",").localeCompare(b.join(",")));
}
function likelyFreeSection(graph: StructuralGraph, edge: StructuralEdgeRecord): readonly string[] {
  if (!graph.isBridge(edge.id)) return []; const sections = connectedSectionsWithoutEdge(graph, edge.id); if (sections.length < 2) return [];
  const withoutSpine = sections.filter((section) => !section.includes("spine")); if (withoutSpine.length === 1) return withoutSpine[0]; return sections[0];
}
function supportForEdge(supports: readonly StructuralSupportRecord[], edge: StructuralEdgeRecord, likelyFree: readonly string[]): StructuralSupportRecord | null {
  const supportedIds = new Set(likelyFree.length > 0 ? likelyFree : [edge.componentAId, edge.componentBId]); return supports.find((support) => supportedIds.has(support.componentId)) ?? null;
}

export class ScannerSystem {
  scan(sandbox: WreckSandbox, graph: StructuralGraph, tetherDiagnostics?: TetherDiagnostics, preferredConnectionId?: string | null): ScannerDiagnostics {
    const candidate = this.selectTarget(sandbox, graph, preferredConnectionId); const graphDiagnostics = graph.getDiagnostics();
    if (!candidate) return { state: "no-target", connectionId: null, riskLevel: null, confidence: "estimate", reasons: ["No live connection is inside scanner range and aim."], topologyRevision: graphDiagnostics.topologyRevision, supportRevision: graphDiagnostics.supportRevision };
    return this.analyzeConnection(sandbox, graph, candidate.edge.id, tetherDiagnostics)!;
  }
  analyzeConnection(sandbox: WreckSandbox, graph: StructuralGraph, connectionId: string, tetherDiagnostics?: TetherDiagnostics): ScannerEstimate | null {
    const edge = graph.getEdges().find((candidate) => candidate.id === connectionId); if (!edge || !sandbox.hasConnection(connectionId)) return null;
    const graphDiagnostics = graph.getDiagnostics(); const craft = sandbox.getCraftBody(); const craftPosition = craft.translation(); const forward = rotateLocalVector(craft.rotation(), { x: 0, y: 0, z: -1 });
    const point = sandbox.getConnectionWorldPoint(connectionId); const delta = subtract(point, craftPosition); const distance = magnitude(delta); const aimAlignment = distance > 1e-9 ? dot(forward, delta) / distance : 1;
    const bridge = graph.isBridge(connectionId); const likelyFree = [...likelyFreeSection(graph, edge)]; const displayComponentId = likelyFree[0] ?? edge.componentBId; const displayComponent = sandbox.getWreckComponent(displayComponentId);
    const articulationSet = new Set(graphDiagnostics.articulationComponentIds); const articulationEndpointIds = [edge.componentAId, edge.componentBId].filter((id) => articulationSet.has(id)); const support = supportForEdge(graph.getSupports(), edge, likelyFree);
    const remainingIds = graph.getNodes().map((node) => node.id).filter((id) => !likelyFree.includes(id)); const freeVelocity = averageVelocity(sandbox, likelyFree.length > 0 ? likelyFree : [edge.componentBId]); const retainedVelocity = averageVelocity(sandbox, remainingIds.length > 0 ? remainingIds : [edge.componentAId]); const relativeSpeed = magnitude(subtract(freeVelocity, retainedVelocity));
    let estimatedFreeMass = 0; let placeholderValueUnits = 0; const valueIds = likelyFree.length > 0 ? likelyFree : [displayComponentId];
    for (const id of valueIds) { const component = sandbox.getWreckComponent(id); estimatedFreeMass += component.body.mass(); placeholderValueUnits += component.salvageValueUnits; }
    const reasons: string[] = []; let score = 10;
    if (bridge) { score += 35; reasons.push(`Bridge connection: severing removes the only permanent path to ${likelyFree.join(", ") || displayComponentId}.`); }
    else { score -= 5; reasons.push("Alternate permanent load path remains if this connection is removed."); }
    if (displayComponent.massClass === "heavy") { score += 35; reasons.push("Likely freed section includes heavy mass."); }
    else if (displayComponent.massClass === "medium") { score += 20; reasons.push("Likely freed section includes medium mass."); }
    else { score += 8; reasons.push("Likely freed section is light in the current fixture."); }
    if (edge.cutClass === "large-mass") { score += 15; reasons.push("Connection is designated as a large-mass cut fixture."); }
    else if (edge.cutClass === "low-risk") { score -= 5; reasons.push("Connection is designated as a lower-risk cut fixture."); }
    if (articulationEndpointIds.length > 0) { score += 10; reasons.push(`Articulation endpoint involved: ${articulationEndpointIds.join(", ")}.`); }
    if (relativeSpeed > 0.05) { const motionContribution = Math.min(20, relativeSpeed * 8); score += motionContribution; reasons.push(`Relative section motion is ${relativeSpeed.toFixed(2)} m/s.`); }
    if (support) { score -= 25; reasons.push(`Temporary tether support is active on ${support.componentId}; estimate reduced while support remains.`); }
    if (displayComponent.cargoFragilityMultiplier >= 1.5) reasons.push(`Recovered ${displayComponent.componentType} is fragile: cargo impact condition loss is ${displayComponent.cargoFragilityMultiplier.toFixed(2)}x baseline.`);
    else if (displayComponent.cargoFragilityMultiplier <= 0.8) reasons.push(`Recovered ${displayComponent.componentType} is robust: cargo impact condition loss is ${displayComponent.cargoFragilityMultiplier.toFixed(2)}x baseline.`);
    if (!edge.cuttable) reasons.push("This connection is not currently cutter-eligible, but its structural consequence can still be inspected.");
    score = clamp(score, 0, 100);
    return { state: "locked", connectionId, componentAId: edge.componentAId, componentBId: edge.componentBId, relationship: `${edge.componentAId} ↔ ${edge.componentBId}`, displayComponentId, componentType: displayComponent.componentType, massClass: displayComponent.massClass, placeholderValueUnits, cargoFragilityMultiplier: displayComponent.cargoFragilityMultiplier, distanceMeters: distance, aimAlignment, cuttable: edge.cuttable, bridge, alternateLoadPath: !bridge, articulationEndpointIds, likelyFreeComponentIds: likelyFree, estimatedFreeMass, relativeSpeed, temporarySupport: support !== null, riskScore: score, riskLevel: riskLevel(score), confidence: "estimate", reasons, topologyRevision: graphDiagnostics.topologyRevision, supportRevision: graphDiagnostics.supportRevision };
  }
  private selectTarget(sandbox: WreckSandbox, graph: StructuralGraph, preferredConnectionId?: string | null): ScannerCandidate | null {
    const craft = sandbox.getCraftBody(); const position = craft.translation(); const forward = rotateLocalVector(craft.rotation(), { x: 0, y: 0, z: -1 }); let best: ScannerCandidate | null = null;
    for (const edge of graph.getEdges()) { if (!sandbox.hasConnection(edge.id)) continue; const point = sandbox.getConnectionWorldPoint(edge.id); const delta = subtract(point, position); const distance = magnitude(delta); const aimAlignment = distance > 1e-9 ? dot(forward, delta) / distance : 1; if (distance > SCANNER_RANGE_METERS || aimAlignment < SCANNER_AIM_COSINE) continue; const preferredBias = edge.id === preferredConnectionId ? 0.25 : 0; const cuttableBias = edge.cuttable ? 0.015 : 0; const score = aimAlignment + preferredBias + cuttableBias - distance * 0.002; const candidate = { edge, distance, aimAlignment, score }; if (!best || candidate.score > best.score) best = candidate; }
    return best;
  }
}
