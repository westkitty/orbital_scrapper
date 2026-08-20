import RAPIER from "@dimforge/rapier3d-compat";
import type { FlightController, FlightInput } from "../flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "./PhysicsSandbox.js";

type RapierWorld = InstanceType<typeof RAPIER.World>;
type RapierRigidBody = InstanceType<typeof RAPIER.RigidBody>;
type RapierRigidBodyDesc = InstanceType<typeof RAPIER.RigidBodyDesc>;

export type FlightBodyRole = "craft" | "obstacle" | "moving-obstacle" | "target";

export type FlightBodyVisual = {
  size: readonly [number, number, number];
  role: FlightBodyRole;
};

export type FlightBodyRecord = {
  id: string;
  body: RapierRigidBody;
  visual: FlightBodyVisual;
};

export type FlightDiagnostics = {
  generation: number;
  activeBodies: number;
  activeConstraints: number;
  fixedTimestepSeconds: number;
  elapsedSeconds: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  linearSpeed: number;
  angularSpeed: number;
  distanceToTarget: number;
};

const CRAFT_START = Object.freeze({ x: 0, y: 0, z: 12 });
const TARGET_POSITION = Object.freeze({ x: 0, y: 0, z: 0 });

let rapierReady: Promise<void> | null = null;

async function ensureRapierReady(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init().then(() => undefined);
  await rapierReady;
}

function speed(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export class FlightSandbox {
  private world!: RapierWorld;
  private records = new Map<string, FlightBodyRecord>();
  private generation = 0;
  private elapsedSeconds = 0;
  private disposed = false;

  static async create(): Promise<FlightSandbox> {
    await ensureRapierReady();
    const sandbox = new FlightSandbox();
    sandbox.rebuildWorld();
    return sandbox;
  }

  private constructor() {}

  step(controller: FlightController, input: FlightInput): void {
    this.assertAlive();
    controller.apply(this.getCraftBody(), input);
    this.elapsedSeconds += FIXED_TIMESTEP_SECONDS;
    this.advanceMovingObstacle();
    this.world.step();
  }

  reset(): void {
    this.assertAlive();
    this.rebuildWorld();
  }

  getCraftBody(): RapierRigidBody {
    return this.getBodyRecord("craft").body;
  }

  getTargetPosition(): typeof TARGET_POSITION {
    return TARGET_POSITION;
  }

  getBodyRecord(id: string): FlightBodyRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown flight body: ${id}`);
    return record;
  }

  getBodyRecords(): readonly FlightBodyRecord[] {
    return [...this.records.values()];
  }

  getDiagnostics(): FlightDiagnostics {
    this.assertAlive();
    const craft = this.getCraftBody();
    const position = craft.translation();
    const rotation = craft.rotation();
    const linearVelocity = craft.linvel();
    const angularVelocity = craft.angvel();
    return {
      generation: this.generation,
      activeBodies: this.records.size,
      activeConstraints: 0,
      fixedTimestepSeconds: this.world.timestep,
      elapsedSeconds: this.elapsedSeconds,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      linearVelocity: { x: linearVelocity.x, y: linearVelocity.y, z: linearVelocity.z },
      angularVelocity: { x: angularVelocity.x, y: angularVelocity.y, z: angularVelocity.z },
      linearSpeed: speed(linearVelocity),
      angularSpeed: speed(angularVelocity),
      distanceToTarget: Math.hypot(
        position.x - TARGET_POSITION.x,
        position.y - TARGET_POSITION.y,
        position.z - TARGET_POSITION.z,
      ),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.world.free();
    this.records.clear();
    this.disposed = true;
  }

  private rebuildWorld(): void {
    if (this.world) this.world.free();

    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = FIXED_TIMESTEP_SECONDS;
    this.records.clear();
    this.elapsedSeconds = 0;
    this.generation += 1;

    const craft = this.addCuboid(
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

    this.addCuboid(
      "target",
      RAPIER.RigidBodyDesc.fixed().setTranslation(TARGET_POSITION.x, TARGET_POSITION.y, TARGET_POSITION.z),
      [2, 2, 0.5],
      { size: [4, 4, 1], role: "target" },
    );

    this.addCuboid(
      "gate-left",
      RAPIER.RigidBodyDesc.fixed().setTranslation(-2.8, 0, 6),
      [0.7, 2.2, 1],
      { size: [1.4, 4.4, 2], role: "obstacle" },
    );
    this.addCuboid(
      "gate-right",
      RAPIER.RigidBodyDesc.fixed().setTranslation(2.8, 0, 6),
      [0.7, 2.2, 1],
      { size: [1.4, 4.4, 2], role: "obstacle" },
    );
    this.addCuboid(
      "gate-top",
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 3.1, 3),
      [2.2, 0.7, 0.8],
      { size: [4.4, 1.4, 1.6], role: "obstacle" },
    );
    this.addCuboid(
      "gate-bottom",
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -3.1, 3),
      [2.2, 0.7, 0.8],
      { size: [4.4, 1.4, 1.6], role: "obstacle" },
    );
    this.addCuboid(
      "side-wall",
      RAPIER.RigidBodyDesc.fixed().setTranslation(7, 0, 8),
      [0.5, 4, 5],
      { size: [1, 8, 10], role: "obstacle" },
    );
    this.addCuboid(
      "moving-obstacle",
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2.5, -3),
      [1.2, 0.3, 1.2],
      { size: [2.4, 0.6, 2.4], role: "moving-obstacle" },
    );
  }

  private advanceMovingObstacle(): void {
    const body = this.getBodyRecord("moving-obstacle").body;
    body.setNextKinematicTranslation({
      x: Math.sin(this.elapsedSeconds * 0.9) * 3.5,
      y: 2.5,
      z: -3,
    });
  }

  private addCuboid(
    id: string,
    bodyDesc: RapierRigidBodyDesc,
    halfExtents: readonly [number, number, number],
    visual: FlightBodyVisual,
    restitution = 0.08,
  ): RapierRigidBody {
    const body = this.world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setRestitution(restitution)
      .setFriction(0.65);
    this.world.createCollider(collider, body);
    this.records.set(id, { id, body, visual });
    return body;
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error("FlightSandbox has been disposed");
  }
}
