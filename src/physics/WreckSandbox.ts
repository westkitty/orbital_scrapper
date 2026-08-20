import RAPIER from "@dimforge/rapier3d-compat";
import type { FlightController, FlightInput } from "../flight/FlightController.js";
import { rotateLocalVector } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "./PhysicsSandbox.js";

type RapierWorld = InstanceType<typeof RAPIER.World>;
type RapierRigidBody = InstanceType<typeof RAPIER.RigidBody>;
type RapierRigidBodyDesc = InstanceType<typeof RAPIER.RigidBodyDesc>;
type RapierImpulseJoint = ReturnType<RapierWorld["createImpulseJoint"]>;
type Vec3 = { x: number; y: number; z: number };

export type WreckBodyRole = "craft" | "wreck-spine" | "wreck-heavy" | "wreck-light" | "wreck-branch";
export type WreckComponentType = "spine" | "engine" | "panel" | "rail" | "junction";
export type WreckMassClass = "light" | "medium" | "heavy";
export type WreckCutClass = "low-risk" | "large-mass";

export type WreckBodyVisual = {
  size: readonly [number, number, number];
  role: WreckBodyRole;
};

export type WreckBodyRecord = {
  id: string;
  body: RapierRigidBody;
  visual: WreckBodyVisual;
};

export type WreckAttachmentPoint = {
  id: string;
  localPosition: Vec3;
};

export type WreckComponentRecord = WreckBodyRecord & {
  componentType: WreckComponentType;
  massClass: WreckMassClass;
  attachments: readonly WreckAttachmentPoint[];
};

export type WreckConnectionRecord = {
  id: string;
  componentAId: string;
  attachmentAId: string;
  componentBId: string;
  attachmentBId: string;
  localAnchorA: Vec3;
  localAnchorB: Vec3;
  joint: RapierImpulseJoint;
  cuttable: boolean;
  cutClass: WreckCutClass | null;
  releaseImpulse: number;
};

export type WreckSeveredConnectionRecord = Omit<WreckConnectionRecord, "joint"> & {
  severedAtSeconds: number;
};

export type WreckSeverResult = {
  connectionId: string;
  severed: boolean;
  reason: "severed" | "not-cuttable" | "missing";
  cutClass: WreckCutClass | null;
  componentAId: string | null;
  componentBId: string | null;
};

export type WreckDiagnostics = {
  generation: number;
  activeBodies: number;
  activeConstraints: number;
  fixedTimestepSeconds: number;
  elapsedSeconds: number;
  position: Vec3;
  rotation: { x: number; y: number; z: number; w: number };
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  linearSpeed: number;
  angularSpeed: number;
  distanceToWreck: number;
  wreckComponentCount: number;
  wreckConnectionCount: number;
  wreckCuttableConnectionCount: number;
  wreckSeveredConnectionCount: number;
  wreckLinearSpeed: number;
  maxConnectionError: number;
};

const CRAFT_START = Object.freeze({ x: 0, y: 0, z: 14 });
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

let rapierReady: Promise<void> | null = null;

async function ensureRapierReady(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init().then(() => undefined);
  await rapierReady;
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export class WreckSandbox {
  private world!: RapierWorld;
  private bodyRecords = new Map<string, WreckBodyRecord>();
  private components = new Map<string, WreckComponentRecord>();
  private connections = new Map<string, WreckConnectionRecord>();
  private severedConnections = new Map<string, WreckSeveredConnectionRecord>();
  private generation = 0;
  private elapsedSeconds = 0;
  private disposed = false;

  static async create(): Promise<WreckSandbox> {
    await ensureRapierReady();
    const sandbox = new WreckSandbox();
    sandbox.rebuildWorld();
    return sandbox;
  }

  private constructor() {}

  step(controller: FlightController, input: FlightInput): void {
    this.assertAlive();
    controller.apply(this.getCraftBody(), input);
    this.elapsedSeconds += FIXED_TIMESTEP_SECONDS;
    this.world.step();
  }

  reset(): void {
    this.assertAlive();
    this.rebuildWorld();
  }

  getCraftBody(): RapierRigidBody {
    return this.getBodyRecord("craft").body;
  }

  getBodyRecord(id: string): WreckBodyRecord {
    const record = this.bodyRecords.get(id);
    if (!record) throw new Error(`Unknown wreck-scene body: ${id}`);
    return record;
  }

  getBodyRecords(): readonly WreckBodyRecord[] {
    return [...this.bodyRecords.values()];
  }

  getWreckComponent(id: string): WreckComponentRecord {
    const record = this.components.get(id);
    if (!record) throw new Error(`Unknown wreck component: ${id}`);
    return record;
  }

  getWreckComponents(): readonly WreckComponentRecord[] {
    return [...this.components.values()];
  }

  getConnection(id: string): WreckConnectionRecord {
    const record = this.connections.get(id);
    if (!record) throw new Error(`Unknown wreck connection: ${id}`);
    return record;
  }

  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }

  getConnections(): readonly WreckConnectionRecord[] {
    return [...this.connections.values()];
  }

  getCuttableConnections(): readonly WreckConnectionRecord[] {
    return this.getConnections().filter((connection) => connection.cuttable);
  }

  getSeveredConnections(): readonly WreckSeveredConnectionRecord[] {
    return [...this.severedConnections.values()];
  }

  getConnectionWorldPoint(id: string): Vec3 {
    const connection = this.getConnection(id);
    const componentA = this.getWreckComponent(connection.componentAId).body;
    const componentB = this.getWreckComponent(connection.componentBId).body;
    const worldA = this.worldAnchor(componentA, connection.localAnchorA);
    const worldB = this.worldAnchor(componentB, connection.localAnchorB);
    return {
      x: (worldA.x + worldB.x) * 0.5,
      y: (worldA.y + worldB.y) * 0.5,
      z: (worldA.z + worldB.z) * 0.5,
    };
  }

  getSeveredConnectionSeparation(id: string): number {
    const connection = this.severedConnections.get(id);
    if (!connection) return 0;
    const componentA = this.getWreckComponent(connection.componentAId).body;
    const componentB = this.getWreckComponent(connection.componentBId).body;
    const worldA = this.worldAnchor(componentA, connection.localAnchorA);
    const worldB = this.worldAnchor(componentB, connection.localAnchorB);
    return Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y, worldA.z - worldB.z);
  }

  severConnection(id: string): WreckSeverResult {
    this.assertAlive();
    const connection = this.connections.get(id);
    if (!connection) {
      return { connectionId: id, severed: false, reason: "missing", cutClass: null, componentAId: null, componentBId: null };
    }
    if (!connection.cuttable) {
      return {
        connectionId: id,
        severed: false,
        reason: "not-cuttable",
        cutClass: connection.cutClass,
        componentAId: connection.componentAId,
        componentBId: connection.componentBId,
      };
    }

    const componentA = this.getWreckComponent(connection.componentAId);
    const componentB = this.getWreckComponent(connection.componentBId);
    const positionA = componentA.body.translation();
    const positionB = componentB.body.translation();
    let direction = { x: positionB.x - positionA.x, y: positionB.y - positionA.y, z: positionB.z - positionA.z };
    let length = magnitude(direction);
    if (length < 1e-6) {
      direction = { x: 1, y: 0, z: 0 };
      length = 1;
    }
    direction = { x: direction.x / length, y: direction.y / length, z: direction.z / length };

    this.world.removeImpulseJoint(connection.joint, true);
    this.connections.delete(id);
    const { joint: _joint, ...severed } = connection;
    this.severedConnections.set(id, { ...severed, severedAtSeconds: this.elapsedSeconds });

    componentA.body.wakeUp();
    componentB.body.wakeUp();
    const impulse = connection.releaseImpulse;
    if (impulse > 0) {
      componentA.body.applyImpulse({ x: -direction.x * impulse, y: -direction.y * impulse, z: -direction.z * impulse }, true);
      componentB.body.applyImpulse({ x: direction.x * impulse, y: direction.y * impulse, z: direction.z * impulse }, true);
    }

    return {
      connectionId: id,
      severed: true,
      reason: "severed",
      cutClass: connection.cutClass,
      componentAId: connection.componentAId,
      componentBId: connection.componentBId,
    };
  }

  getDiagnostics(): WreckDiagnostics {
    this.assertAlive();
    const craft = this.getCraftBody();
    const spine = this.getWreckComponent("spine").body;
    const position = craft.translation();
    const rotation = craft.rotation();
    const linearVelocity = craft.linvel();
    const angularVelocity = craft.angvel();
    const wreckPosition = spine.translation();
    const wreckVelocity = spine.linvel();

    return {
      generation: this.generation,
      activeBodies: this.bodyRecords.size,
      activeConstraints: this.connections.size,
      fixedTimestepSeconds: this.world.timestep,
      elapsedSeconds: this.elapsedSeconds,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      linearVelocity: { x: linearVelocity.x, y: linearVelocity.y, z: linearVelocity.z },
      angularVelocity: { x: angularVelocity.x, y: angularVelocity.y, z: angularVelocity.z },
      linearSpeed: magnitude(linearVelocity),
      angularSpeed: magnitude(angularVelocity),
      distanceToWreck: Math.hypot(position.x - wreckPosition.x, position.y - wreckPosition.y, position.z - wreckPosition.z),
      wreckComponentCount: this.components.size,
      wreckConnectionCount: this.connections.size,
      wreckCuttableConnectionCount: this.getCuttableConnections().length,
      wreckSeveredConnectionCount: this.severedConnections.size,
      wreckLinearSpeed: magnitude(wreckVelocity),
      maxConnectionError: this.getMaxConnectionError(),
    };
  }

  getMaxConnectionError(): number {
    this.assertAlive();
    let maximum = 0;
    for (const connection of this.connections.values()) {
      const componentA = this.getWreckComponent(connection.componentAId).body;
      const componentB = this.getWreckComponent(connection.componentBId).body;
      const worldA = this.worldAnchor(componentA, connection.localAnchorA);
      const worldB = this.worldAnchor(componentB, connection.localAnchorB);
      maximum = Math.max(maximum, Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y, worldA.z - worldB.z));
    }
    return maximum;
  }

  dispose(): void {
    if (this.disposed) return;
    this.world.free();
    this.bodyRecords.clear();
    this.components.clear();
    this.connections.clear();
    this.severedConnections.clear();
    this.disposed = true;
  }

  private rebuildWorld(): void {
    if (this.world) this.world.free();

    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = FIXED_TIMESTEP_SECONDS;
    this.bodyRecords.clear();
    this.components.clear();
    this.connections.clear();
    this.severedConnections.clear();
    this.elapsedSeconds = 0;
    this.generation += 1;

    const craft = this.addBody(
      "craft",
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(CRAFT_START.x, CRAFT_START.y, CRAFT_START.z)
        .setLinearDamping(0.025)
        .setAngularDamping(0.08)
        .setCanSleep(false),
      [0.7, 0.4, 1],
      { size: [1.4, 0.8, 2], role: "craft" },
      0.35,
    );
    craft.enableCcd(true);
    craft.setAdditionalSolverIterations(4);

    this.addComponent("spine", "spine", "medium", { x: 0, y: 0, z: 0 }, [1.5, 0.7, 2.8], { size: [3, 1.4, 5.6], role: "wreck-spine" }, [
      { id: "engine-port", localPosition: { x: -1.5, y: 0, z: 0.7 } },
      { id: "panel-port", localPosition: { x: 1.5, y: 0, z: 0.5 } },
      { id: "left-rail-port", localPosition: { x: -1, y: 0, z: -2.8 } },
      { id: "right-rail-port", localPosition: { x: 1, y: 0, z: -2.8 } },
    ]);

    this.addComponent("engine", "engine", "heavy", { x: -2.6, y: 0, z: 0.7 }, [1.1, 1.1, 1.4], { size: [2.2, 2.2, 2.8], role: "wreck-heavy" }, [
      { id: "spine-port", localPosition: { x: 1.1, y: 0, z: 0 } },
    ]);

    this.addComponent("panel", "panel", "light", { x: 3.3, y: 0, z: 0.5 }, [1.8, 0.18, 1.3], { size: [3.6, 0.36, 2.6], role: "wreck-light" }, [
      { id: "spine-port", localPosition: { x: -1.8, y: 0, z: 0 } },
    ]);

    this.addComponent("left-rail", "rail", "light", { x: -1, y: 0, z: -4.2 }, [0.25, 0.25, 1.4], { size: [0.5, 0.5, 2.8], role: "wreck-branch" }, [
      { id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } },
      { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } },
    ]);

    this.addComponent("right-rail", "rail", "light", { x: 1, y: 0, z: -4.2 }, [0.25, 0.25, 1.4], { size: [0.5, 0.5, 2.8], role: "wreck-branch" }, [
      { id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } },
      { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } },
    ]);

    this.addComponent("rear-node", "junction", "medium", { x: 0, y: 0, z: -6.3 }, [1.5, 0.7, 0.7], { size: [3, 1.4, 1.4], role: "wreck-branch" }, [
      { id: "left-port", localPosition: { x: -1, y: 0, z: 0.7 } },
      { id: "right-port", localPosition: { x: 1, y: 0, z: 0.7 } },
    ]);

    this.connect("spine-engine", "spine", "engine-port", "engine", "spine-port", { cuttable: true, cutClass: "large-mass", releaseImpulse: 2.2 });
    this.connect("spine-panel", "spine", "panel-port", "panel", "spine-port", { cuttable: true, cutClass: "low-risk", releaseImpulse: 0.65 });
    this.connect("spine-left-rail", "spine", "left-rail-port", "left-rail", "spine-port");
    this.connect("left-rail-rear", "left-rail", "rear-port", "rear-node", "left-port");
    this.connect("spine-right-rail", "spine", "right-rail-port", "right-rail", "spine-port");
    this.connect("right-rail-rear", "right-rail", "rear-port", "rear-node", "right-port");
  }

  private addComponent(
    id: string,
    componentType: WreckComponentType,
    massClass: WreckMassClass,
    position: Vec3,
    halfExtents: readonly [number, number, number],
    visual: WreckBodyVisual,
    attachments: readonly WreckAttachmentPoint[],
  ): WreckComponentRecord {
    const body = this.addBody(
      id,
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.035)
        .setAngularDamping(0.08)
        .setCanSleep(true),
      halfExtents,
      visual,
      0.06,
    );
    body.setAdditionalSolverIterations(8);
    const record: WreckComponentRecord = { id, body, visual, componentType, massClass, attachments };
    this.components.set(id, record);
    this.bodyRecords.set(id, record);
    return record;
  }

  private addBody(
    id: string,
    bodyDesc: RapierRigidBodyDesc,
    halfExtents: readonly [number, number, number],
    visual: WreckBodyVisual,
    restitution: number,
  ): RapierRigidBody {
    const body = this.world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setRestitution(restitution)
      .setFriction(0.7);
    this.world.createCollider(collider, body);
    this.bodyRecords.set(id, { id, body, visual });
    return body;
  }

  private connect(
    id: string,
    componentAId: string,
    attachmentAId: string,
    componentBId: string,
    attachmentBId: string,
    options: { cuttable?: boolean; cutClass?: WreckCutClass; releaseImpulse?: number } = {},
  ): void {
    const componentA = this.getWreckComponent(componentAId);
    const componentB = this.getWreckComponent(componentBId);
    const localAnchorA = this.requireAttachment(componentA, attachmentAId).localPosition;
    const localAnchorB = this.requireAttachment(componentB, attachmentBId).localPosition;
    const data = RAPIER.JointData.fixed(localAnchorA, IDENTITY, localAnchorB, IDENTITY);
    const joint = this.world.createImpulseJoint(data, componentA.body, componentB.body, true);
    const cuttable = options.cuttable ?? false;
    this.connections.set(id, {
      id,
      componentAId,
      attachmentAId,
      componentBId,
      attachmentBId,
      localAnchorA,
      localAnchorB,
      joint,
      cuttable,
      cutClass: cuttable ? (options.cutClass ?? null) : null,
      releaseImpulse: cuttable ? (options.releaseImpulse ?? 0) : 0,
    });
  }

  private requireAttachment(component: WreckComponentRecord, attachmentId: string): WreckAttachmentPoint {
    const attachment = component.attachments.find((candidate) => candidate.id === attachmentId);
    if (!attachment) throw new Error(`Unknown attachment ${component.id}.${attachmentId}`);
    return attachment;
  }

  private worldAnchor(body: RapierRigidBody, localAnchor: Vec3): Vec3 {
    const translation = body.translation();
    const rotation = body.rotation();
    const rotated = rotateLocalVector(rotation, localAnchor);
    return { x: translation.x + rotated.x, y: translation.y + rotated.y, z: translation.z + rotated.z };
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error("WreckSandbox has been disposed");
  }
}
