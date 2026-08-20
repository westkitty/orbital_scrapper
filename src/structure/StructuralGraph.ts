import type {
  WreckComponentType,
  WreckCutClass,
  WreckMassClass,
  WreckSandbox,
} from "../physics/WreckSandbox.js";
import type { TetherDiagnostics } from "../tether/TetherSystem.js";

export type StructuralNodeRecord = {
  id: string;
  componentType: WreckComponentType;
  massClass: WreckMassClass;
};

export type StructuralEdgeRecord = {
  id: string;
  componentAId: string;
  componentBId: string;
  cuttable: boolean;
  cutClass: WreckCutClass | null;
};

export type StructuralSupportRecord = {
  id: string;
  kind: "tether";
  source: "craft";
  componentId: string;
  tensionNewtons: number;
  loadRatio: number;
};

export type StructuralGraphSyncResult = {
  topologyChanged: boolean;
  supportChanged: boolean;
};

export type StructuralGraphDiagnostics = {
  nodeCount: number;
  edgeCount: number;
  supportCount: number;
  topologyRevision: number;
  supportRevision: number;
  bridgeConnectionIds: readonly string[];
  articulationComponentIds: readonly string[];
  spineSectionSize: number;
};

function sameNode(a: StructuralNodeRecord, b: StructuralNodeRecord): boolean {
  return a.id === b.id && a.componentType === b.componentType && a.massClass === b.massClass;
}

function sameEdge(a: StructuralEdgeRecord, b: StructuralEdgeRecord): boolean {
  return a.id === b.id
    && a.componentAId === b.componentAId
    && a.componentBId === b.componentBId
    && a.cuttable === b.cuttable
    && a.cutClass === b.cutClass;
}

function sameSupport(a: StructuralSupportRecord, b: StructuralSupportRecord): boolean {
  return a.id === b.id
    && a.kind === b.kind
    && a.source === b.source
    && a.componentId === b.componentId
    && Math.abs(a.tensionNewtons - b.tensionNewtons) < 1e-9
    && Math.abs(a.loadRatio - b.loadRatio) < 1e-9;
}

function reconcileMap<T>(
  current: Map<string, T>,
  next: Map<string, T>,
  equal: (a: T, b: T) => boolean,
): boolean {
  let changed = false;

  for (const id of current.keys()) {
    if (!next.has(id)) {
      current.delete(id);
      changed = true;
    }
  }

  for (const [id, value] of next) {
    const existing = current.get(id);
    if (!existing || !equal(existing, value)) {
      current.set(id, value);
      changed = true;
    }
  }

  return changed;
}

export class StructuralGraph {
  private readonly nodes = new Map<string, StructuralNodeRecord>();
  private readonly edges = new Map<string, StructuralEdgeRecord>();
  private readonly supports = new Map<string, StructuralSupportRecord>();
  private topologyRevision = 0;
  private supportRevision = 0;

  sync(sandbox: WreckSandbox, tetherDiagnostics?: TetherDiagnostics): StructuralGraphSyncResult {
    const nextNodes = new Map<string, StructuralNodeRecord>();
    for (const component of sandbox.getWreckComponents()) {
      nextNodes.set(component.id, {
        id: component.id,
        componentType: component.componentType,
        massClass: component.massClass,
      });
    }

    const nextEdges = new Map<string, StructuralEdgeRecord>();
    for (const connection of sandbox.getConnections()) {
      if (!nextNodes.has(connection.componentAId) || !nextNodes.has(connection.componentBId)) {
        throw new Error(`Physical connection ${connection.id} references a missing graph node`);
      }
      nextEdges.set(connection.id, {
        id: connection.id,
        componentAId: connection.componentAId,
        componentBId: connection.componentBId,
        cuttable: connection.cuttable,
        cutClass: connection.cutClass,
      });
    }

    const nodeChanged = reconcileMap(this.nodes, nextNodes, sameNode);
    const edgeChanged = reconcileMap(this.edges, nextEdges, sameEdge);
    const topologyChanged = nodeChanged || edgeChanged;
    if (topologyChanged) this.topologyRevision += 1;

    const nextSupports = new Map<string, StructuralSupportRecord>();
    if (tetherDiagnostics?.state === "attached" && tetherDiagnostics.targetId && this.nodes.has(tetherDiagnostics.targetId)) {
      const support: StructuralSupportRecord = {
        id: `tether:${tetherDiagnostics.targetId}`,
        kind: "tether",
        source: "craft",
        componentId: tetherDiagnostics.targetId,
        tensionNewtons: tetherDiagnostics.tensionNewtons,
        loadRatio: tetherDiagnostics.loadRatio,
      };
      nextSupports.set(support.id, support);
    }

    const supportChanged = reconcileMap(this.supports, nextSupports, sameSupport);
    if (supportChanged) this.supportRevision += 1;

    return { topologyChanged, supportChanged };
  }

  getNodes(): readonly StructuralNodeRecord[] {
    return [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getEdges(): readonly StructuralEdgeRecord[] {
    return [...this.edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getSupports(): readonly StructuralSupportRecord[] {
    return [...this.supports.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id);
  }

  getConnectedSection(startComponentId: string): readonly string[] {
    if (!this.nodes.has(startComponentId)) return [];
    return [...this.walkFrom(startComponentId)].sort();
  }

  isBridge(connectionId: string): boolean {
    const edge = this.edges.get(connectionId);
    if (!edge) return false;
    return !this.walkFrom(edge.componentAId, connectionId).has(edge.componentBId);
  }

  getBridgeConnectionIds(): readonly string[] {
    return this.getEdges().filter((edge) => this.isBridge(edge.id)).map((edge) => edge.id);
  }

  getArticulationComponentIds(): readonly string[] {
    if (this.nodes.size <= 2) return [];
    const baselineComponents = this.countConnectedComponents();
    const articulation: string[] = [];
    for (const node of this.nodes.values()) {
      if (this.countConnectedComponents(node.id) > baselineComponents) articulation.push(node.id);
    }
    return articulation.sort();
  }

  getDiagnostics(): StructuralGraphDiagnostics {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      supportCount: this.supports.size,
      topologyRevision: this.topologyRevision,
      supportRevision: this.supportRevision,
      bridgeConnectionIds: this.getBridgeConnectionIds(),
      articulationComponentIds: this.getArticulationComponentIds(),
      spineSectionSize: this.getConnectedSection("spine").length,
    };
  }

  private walkFrom(startComponentId: string, ignoredEdgeId?: string, ignoredNodeId?: string): Set<string> {
    const visited = new Set<string>();
    if (!this.nodes.has(startComponentId) || startComponentId === ignoredNodeId) return visited;
    const queue = [startComponentId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current) || current === ignoredNodeId) continue;
      visited.add(current);

      for (const edge of this.edges.values()) {
        if (edge.id === ignoredEdgeId) continue;
        let neighbor: string | null = null;
        if (edge.componentAId === current) neighbor = edge.componentBId;
        else if (edge.componentBId === current) neighbor = edge.componentAId;
        if (neighbor && neighbor !== ignoredNodeId && !visited.has(neighbor)) queue.push(neighbor);
      }
    }

    return visited;
  }

  private countConnectedComponents(ignoredNodeId?: string): number {
    const remaining = [...this.nodes.keys()].filter((id) => id !== ignoredNodeId);
    const visited = new Set<string>();
    let count = 0;

    for (const id of remaining) {
      if (visited.has(id)) continue;
      count += 1;
      for (const reached of this.walkFrom(id, undefined, ignoredNodeId)) visited.add(reached);
    }

    return count;
  }
}
