import RAPIER from "@dimforge/rapier3d-compat";

export const FIXED_TIMESTEP_SECONDS = 1 / 60;

type RapierWorld = InstanceType<typeof RAPIER.World>;
type RapierRigidBody = InstanceType<typeof RAPIER.RigidBody>;
type RapierRigidBodyDesc = InstanceType<typeof RAPIER.RigidBodyDesc>;
type RapierImpulseJoint = ReturnType<RapierWorld["createImpulseJoint"]>;

export type BodyVisual = {
  size: readonly [number, number, number];
  role: "ground" | "linked" | "free";
};

export type BodyRecord = {
  id: string;
  body: RapierRigidBody;
  visual: BodyVisual;
};

export type PhysicsDiagnostics = {
  generation: number;
  activeBodies: number;
  activeConstraints: number;
  fixedTimestepSeconds: number;
  bridgeConstraintPresent: boolean;
};

let rapierReady: Promise<void> | null = null;

async function ensureRapierReady(): Promise<void> {
  if (!rapierReady) {
    rapierReady = RAPIER.init().then(() => undefined);
  }
  await rapierReady;
}

export class PhysicsSandbox {
  private world!: RapierWorld;
  private records = new Map<string, BodyRecord>();
  private bridgeJoint: RapierImpulseJoint | null = null;
  private generation = 0;
  private disposed = false;

  static async create(): Promise<PhysicsSandbox> {
    await ensureRapierReady();
    const sandbox = new PhysicsSandbox();
    sandbox.rebuildWorld();
    return sandbox;
  }

  private constructor() {}

  step(): void {
    this.assertAlive();
    this.world.step();
  }

  reset(): void {
    this.assertAlive();
    this.rebuildWorld();
  }

  removeBridgeConstraint(): boolean {
    this.assertAlive();
    if (!this.bridgeJoint) return false;
    this.world.removeImpulseJoint(this.bridgeJoint, true);
    this.bridgeJoint = null;
    return true;
  }

  createBridgeConstraint(): boolean {
    this.assertAlive();
    if (this.bridgeJoint) return false;

    const left = this.requireBody("linked-left");
    const right = this.requireBody("linked-right");
    const identity = { x: 0, y: 0, z: 0, w: 1 };
    const jointData = RAPIER.JointData.fixed(
      { x: 0.75, y: 0, z: 0 },
      identity,
      { x: -0.75, y: 0, z: 0 },
      identity,
    );

    this.bridgeJoint = this.world.createImpulseJoint(jointData, left, right, true);
    return true;
  }

  hasBridgeConstraint(): boolean {
    return this.bridgeJoint !== null;
  }

  getBodyRecord(id: string): BodyRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown physics body: ${id}`);
    return record;
  }

  getBodyRecords(): readonly BodyRecord[] {
    return [...this.records.values()];
  }

  getDiagnostics(): PhysicsDiagnostics {
    this.assertAlive();
    return {
      generation: this.generation,
      activeBodies: this.records.size,
      activeConstraints: this.bridgeJoint ? 1 : 0,
      fixedTimestepSeconds: this.world.timestep,
      bridgeConstraintPresent: this.bridgeJoint !== null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.world.free();
    this.records.clear();
    this.bridgeJoint = null;
    this.disposed = true;
  }

  private rebuildWorld(): void {
    if (this.world) this.world.free();

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_TIMESTEP_SECONDS;
    this.records.clear();
    this.bridgeJoint = null;
    this.generation += 1;

    this.addCuboid(
      "ground",
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
      [6, 0.5, 6],
      { size: [12, 1, 12], role: "ground" },
    );

    this.addCuboid(
      "linked-left",
      RAPIER.RigidBodyDesc.dynamic().setTranslation(-0.75, 4, 0),
      [0.5, 0.5, 0.5],
      { size: [1, 1, 1], role: "linked" },
    );

    this.addCuboid(
      "linked-right",
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0.75, 4, 0),
      [0.5, 0.5, 0.5],
      { size: [1, 1, 1], role: "linked" },
    );

    this.addCuboid(
      "free-fall",
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 7, 2),
      [0.4, 0.4, 0.4],
      { size: [0.8, 0.8, 0.8], role: "free" },
    );

    this.createBridgeConstraint();
  }

  private addCuboid(
    id: string,
    bodyDesc: RapierRigidBodyDesc,
    halfExtents: readonly [number, number, number],
    visual: BodyVisual,
  ): void {
    const body = this.world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(...halfExtents).setRestitution(0.05);
    this.world.createCollider(collider, body);
    this.records.set(id, { id, body, visual });
  }

  private requireBody(id: string): RapierRigidBody {
    return this.getBodyRecord(id).body;
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error("PhysicsSandbox has been disposed");
  }
}
