import RAPIER from "@dimforge/rapier3d-compat";
import type { FlightController, FlightInput } from "../flight/FlightController.js";
import { rotateLocalVector } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "./PhysicsSandbox.js";

type RapierWorld = InstanceType<typeof RAPIER.World>;
type RapierRigidBody = InstanceType<typeof RAPIER.RigidBody>;
type RapierRigidBodyDesc = InstanceType<typeof RAPIER.RigidBodyDesc>;
type RapierImpulseJoint = ReturnType<RapierWorld["createImpulseJoint"]>;
type RapierEventQueue = InstanceType<typeof RAPIER.EventQueue>;
type Vec3 = { x: number; y: number; z: number };

export type WreckBodyRole = "craft" | "wreck-spine" | "wreck-heavy" | "wreck-light" | "wreck-branch";
export type WreckComponentType = "spine" | "engine" | "panel" | "rail" | "junction";
export type WreckMassClass = "light" | "medium" | "heavy";
export type WreckCutClass = "low-risk" | "large-mass";
export type WreckFailureMode = "cut" | "impact-overload";

export type WreckSandboxOptions = {
  phase7DangerFixture?: boolean;
};

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
  failureImpulseThreshold: number | null;
};

export type WreckSeveredConnectionRecord = Omit<WreckConnectionRecord, "joint"> & {
  severedAtSeconds: number;
  failureMode: WreckFailureMode;
};

export type WreckSeverResult = {
  connectionId: string;
  severed: boolean;
  reason: "severed" | "not-cuttable" | "missing";
  cutClass: WreckCutClass | null;
  componentAId: string | null;
  componentBId: string | null;
  failureMode: WreckFailureMode | null;
};

export type WreckContactForceEvent = {
  bodyAId: string;
  bodyBId: string;
  totalForceMagnitude: number;
  maxForceMagnitude: number;
  maxForceDirection: Vec3;
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
  contactForceEventCount: number;
};

const CRAFT_START = Object.freeze({ x: 0, y: 0, z: 14 });
const PHASE7_DANGER_CRAFT_START = Object.freeze({ x: -8.8765024304, y: 0, z: 2.3898275774 });
const PHASE7_DANGER_CRAFT_ROTATION = Object.freeze({ x: 0, y: -0.6231780634, z: 0, w: 0.7820799840 });
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
const CONTACT_FORCE_EVENT_THRESHOLD_NEWTONS = 0.5;
const PHASE7_ENGINE_RELEASE_IMPULSE = 48;

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
  private eventQueue!: RapierEventQueue;
  private bodyRecords = new Map<string, WreckBodyRecord>();
  private components = new Map<string, WreckComponentRecord>();
  private connections = new Map<string, WreckConnectionRecord>();
  private severedConnections = new Map<string, WreckSeveredConnectionRecord>();
  private colliderBodyIds = new Map<number, string>();
  private contactForceEvents: WreckContactForceEvent[] = [];
  private generation = 0;
  private elapsedSeconds = 0;
  private disposed = false;
  private readonly options: Required<WreckSandboxOptions>;

  static async create(options: WreckSandboxOptions = {}): Promise<WreckSandbox> {
    await ensureRapierReady();
    const sandbox = new WreckSandbox(options);
    sandbox.rebuildWorld();
    return sandbox;
  }

  private constructor(options: WreckSandboxOptions) {
    this.options = {
      phase7DangerFixture: options.phase7DangerFixture ?? false,
    };
  }

  step(controller: FlightController, input: FlightInput): void {
    this.assertAlive();
    controller.apply(this.getCraftBody(), input);
    this.elapsedSeconds += FIXED_TIMESTEP_SECONDS;
    this.world.step(this.eventQueue);
    this.captureContactForceEvents();
  }

  reset(): void {
    this.assertAlive();
    this.rebuildWorld();
  }

  isPhase7DangerFixture(): boolean {
    return this.options.phase7DangerFixture;
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

  areBodiesConnected(bodyAId: string, bodyBId: string): boolean {
    return this.getConnections().some((connection) => (
      (connection.componentAId === bodyAId && connection.componentBId === bodyBId)
      || (connection.componentAId === bodyBId && connection.componentBId === bodyAId)
    ));
  }

  getConnections(): readonly WreckConnectionRecord[] {
    return [...this.connections.values()];
  }

  getConnectionsForComponent(componentId: string): readonly WreckConnectionRecord[] {
    return this.getConnections().filter((connection) => (
      connection.componentAId === componentId || connection.componentBId === componentId
    ));
  }

  getCuttableConnections(): readonly WreckConnectionRecord[] {
    return this.getConnections().filter((connection) => connection.cuttable);
  }

  getSeveredConnections(): readonly WreckSeveredConnectionRecord[] {
    return [...this.severedConnections.values()];
  }

  getContactForceEvents(): readonly WreckContactForceEvent[] {
    return this.contactForceEvents;
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

  getConnectionError(id: string): number {
    const connection = this.getConnection(id);
    const componentA = this.getWreckComponent(connection.componentAId).body;
    const componentB = this.getWreckComponent(connection.componentBId).body;
    const worldA = this.worldAnchor(componentA, connection.localAnchorA);
    const worldB = this.worldAnchor(componentB, connection.localAnchorB);
    return Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y, worldA.z - worldB.z);
  }

  getConnectionRelativeSpeed(id: string): number {
    const connection = this.getConnection(id);
    const velocityA = this.getWreckComponent(connection.componentAId).body.linvel();
    const velocityB = this.getWreckComponent(connection.componentBId).body.linvel();
    return Math.hypot(
      velocityA.x - velocityB.x,
      velocityA.y - velocityB.y,
      velocityA.z - velocityB.z,
    );
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
      return {
        connectionId: id,
        severed: false,
        reason: "missing",
        cutClass: null,
        componentAId: null,
        componentBId: null,
        failureMode: null,
      };
    }
    if (!connection.cuttable) {
      return {
        connectionId: id,
        severed: false,
        reason: "not-cuttable",
        cutClass: connection.cutClass,
        componentAId: connection.componentAId,
        componentBId: connection.componentBId,
        failureMode: null,
      };
    }

    return this.removeConnection(connection, "cut", connection.releaseImpulse);
  }

  breakConnectionFromImpact(id: string): WreckSeverResult {
    this.assertAlive();
    const connection = this.connections.get(id);
    if (!connection) {
      return {
        connectionId: id,
        severed: false,
        reason: "missing",
        cutClass: null,
        componentAId: null,
        componentBId: null,
        failureMode: null,
      };
    }
    return this.removeConnection(connection, "impact-overload", 0);
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
      contactForceEventCount: this.contactForceEvents.length,
    };
  }

  getMaxConnectionError(): number {
    this.assertAlive();
    let maximum = 0;
    for (const connection of this.connections.values()) {
      maximum = Math.max(maximum, this.getConnectionError(connection.id));
    }
    return maximum;
  }

  dispose(): void {
    if (this.disposed) return;
    if (this.eventQueue) this.eventQueue.free();
    this.world.free();
    this.bodyRecords.clear();
    this.components.clear();
    this.connections.clear();
    this.severedConnections.clear();
    this.colliderBodyIds.clear();
    this.contactForceEvents = [];
    this.disposed = true;
  }

  private rebuildWorld(): void {
    if (this.eventQueue) this.eventQueue.free();
    if (this.world) this.world.free();

    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = FIXED_TIMESTEP_SECONDS;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.bodyRecords.clear();
    this.components.clear();
    this.connections.clear();
    this.severedConnections.clear();
    this.colliderBodyIds.clear();
    this.contactForceEvents = [];
    this.elapsedSeconds = 0;
    this.generation += 1;

    const craftStart = this.options.phase7DangerFixture ? PHASE7_DANGER_CRAFT_START : CRAFT_START;
    const craft = this.addBody(
      "craft",
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(craftStart.x, craftStart.y, craftStart.z)
        .setLinearDamping(0.025)
        .setAngularDamping(0.08)
        .setCanSleep(false),
      [0.7, 0.4, 1],
      { size: [1.4, 0.8, 2], role: "craft" },
      0.35,
    );
    if (this.options.phase7DangerFixture) craft.setRotation(PHASE7_DANGER_CRAFT_ROTATION, true);
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

    this.connect("spine-engine", "spine", "engine-port", "engine", "spine-port", {
      cuttable: true,
      cutClass: "large-mass",
      releaseImpulse: this.options.phase7DangerFixture ? PHASE7_ENGINE_RELEASE_IMPULSE : 2.2,
    });
    this.connect("spine-panel", "spine", "panel-port", "panel", "spine-port", { cuttable: true, cutClass: "low-risk", releaseImpulse: 0.65 });
    this.connect("spine-left-rail", "spine", "left-rail-port", "left-rail", "spine-port");
    this.connect("left-rail-rear", "left-rail", "rear-port", "rear-node", "left-port", { failureImpulseThreshold: 5.5 });
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
    const colliderDesc = RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setRestitution(restitution)
      .setFriction(0.7)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(CONTACT_FORCE_EVENT_THRESHOLD_NEWTONS);
    const collider = this.world.createCollider(colliderDesc, body);
    this.colliderBodyIds.set(collider.handle, id);
    this.bodyRecords.set(id, { id, body, visual });
    return body;
  }

  private connect(
    id: string,
    componentAId: string,
    attachmentAId: string,
    componentBId: string,
    attachmentBId: string,
    options: {
      cuttable?: boolean;
      cutClass?: WreckCutClass;
      releaseImpulse?: number;
      failureImpulseThreshold?: number;
    } = {},
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
      failureImpulseThreshold: options.failureImpulseThreshold ?? null,
    });
  }

  private removeConnection(
    connection: WreckConnectionRecord,
    failureMode: WreckFailureMode,
    releaseImpulse: number,
  ): WreckSeverResult {
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
    this.connections.delete(connection.id);
    const { joint: _joint, ...severed } = connection;
    this.severedConnections.set(connection.id, {
      ...severed,
      severedAtSeconds: this.elapsedSeconds,
      failureMode,
    });

    componentA.body.wakeUp();
    componentB.body.wakeUp();
    if (releaseImpulse > 0) {
      componentA.body.applyImpulse({ x: -direction.x * releaseImpulse, y: -direction.y * releaseImpulse, z: -direction.z * releaseImpulse }, true);
      componentB.body.applyImpulse({ x: direction.x * releaseImpulse, y: direction.y * releaseImpulse, z: direction.z * releaseImpulse }, true);
    }

    return {
      connectionId: connection.id,
      severed: true,
      reason: "severed",
      cutClass: connection.cutClass,
      componentAId: connection.componentAId,
      componentBId: connection.componentBId,
      failureMode,
    };
  }

  private captureContactForceEvents(): void {
    const events: WreckContactForceEvent[] = [];
    this.eventQueue.drainContactForceEvents((event) => {
      const bodyAId = this.colliderBodyIds.get(event.collider1());
      const bodyBId = this.colliderBodyIds.get(event.collider2());
      if (!bodyAId || !bodyBId) return;
      const direction = event.maxForceDirection();
      events.push({
        bodyAId,
        bodyBId,
        totalForceMagnitude: event.totalForceMagnitude(),
        maxForceMagnitude: event.maxForceMagnitude(),
        maxForceDirection: { x: direction.x, y: direction.y, z: direction.z },
      });
    });
    this.contactForceEvents = events;
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
