// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightController, NEUTRAL_FLIGHT_INPUT, rotateLocalVector } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";

function stepMany(sandbox, controller, input, count) {
  for (let index = 0; index < count; index += 1) sandbox.step(controller, input);
}

function sortedIds(records) {
  return records.map((record) => record.id).sort();
}

function finiteBody(record) {
  const p = record.body.translation();
  const r = record.body.rotation();
  return [p.x, p.y, p.z, r.x, r.y, r.z, r.w].every(Number.isFinite);
}

test("reference wreck exposes stable modular IDs, attachment points, mass classes, and alternate load paths", async () => {
  const sandbox = await WreckSandbox.create();
  try {
    assert.deepEqual(sortedIds(sandbox.getWreckComponents()), ["engine", "left-rail", "panel", "rear-node", "right-rail", "spine"]);
    assert.deepEqual(sortedIds(sandbox.getConnections()), ["left-rail-rear", "right-rail-rear", "spine-engine", "spine-left-rail", "spine-panel", "spine-right-rail"]);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getConnections().length, 6);

    const spine = sandbox.getWreckComponent("spine");
    assert.deepEqual(spine.attachments.map((attachment) => attachment.id).sort(), ["engine-port", "left-rail-port", "panel-port", "right-rail-port"]);
    assert.equal(sandbox.getWreckComponent("engine").massClass, "heavy");
    assert.equal(sandbox.getWreckComponent("panel").massClass, "light");
    assert.ok(sandbox.getWreckComponent("engine").body.mass() > sandbox.getWreckComponent("panel").body.mass() * 2);

    const leftPath = [sandbox.getConnection("spine-left-rail"), sandbox.getConnection("left-rail-rear")];
    const rightPath = [sandbox.getConnection("spine-right-rail"), sandbox.getConnection("right-rail-rear")];
    assert.equal(leftPath[0].componentAId, "spine");
    assert.equal(leftPath[1].componentBId, "rear-node");
    assert.equal(rightPath[0].componentAId, "spine");
    assert.equal(rightPath[1].componentBId, "rear-node");
  } finally {
    sandbox.dispose();
  }
});

test("intact wreck remains a coherent connected assembly during idle simulation", async () => {
  const sandbox = await WreckSandbox.create();
  const controller = new FlightController();
  try {
    const before = sandbox.getDiagnostics();
    stepMany(sandbox, controller, NEUTRAL_FLIGHT_INPUT, 600);
    const after = sandbox.getDiagnostics();
    assert.equal(after.activeBodies, 7);
    assert.equal(after.activeConstraints, 6);
    assert.equal(after.wreckComponentCount, 6);
    assert.equal(after.wreckConnectionCount, 6);
    assert.ok(after.maxConnectionError < 0.04, `closed wreck drifted across joints: ${after.maxConnectionError}`);
    assert.ok(after.wreckLinearSpeed < 0.08, `idle wreck developed unexpected speed: ${after.wreckLinearSpeed}`);
    assert.ok(after.maxConnectionError <= Math.max(0.04, before.maxConnectionError + 0.03));
    assert.ok(sandbox.getWreckComponents().every(finiteBody));
  } finally {
    sandbox.dispose();
  }
});

test("verified flight path can approach, stop, translate around, rotate, and retreat from the live wreck", async () => {
  const sandbox = await WreckSandbox.create();
  const controller = new FlightController();
  try {
    const start = sandbox.getDiagnostics();
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 60);
    const approach = sandbox.getDiagnostics();
    assert.ok(approach.distanceToWreck < start.distanceToWreck - 1.5, `approach did not close distance: ${approach.distanceToWreck}`);
    assert.ok(approach.linearSpeed > 2, `expected inertial approach speed, got ${approach.linearSpeed}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const working = sandbox.getDiagnostics();
    assert.ok(working.linearSpeed < 0.7, `expected controlled stop, got ${working.linearSpeed}`);
    assert.ok(working.distanceToWreck > 3.5 && working.distanceToWreck < 12, `working distance not useful: ${working.distanceToWreck}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, strafe: 1 }, 50);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const translated = sandbox.getDiagnostics();
    assert.ok(Math.abs(translated.position.x) > 0.8, `expected lateral translation, x=${translated.position.x}`);
    assert.ok(translated.linearSpeed < 0.7, `expected lateral stop, got ${translated.linearSpeed}`);

    const beforeRetreat = translated.distanceToWreck;
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: -1 }, 60);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const retreated = sandbox.getDiagnostics();
    assert.ok(retreated.distanceToWreck > beforeRetreat + 1, `expected retreat to increase distance: before=${beforeRetreat}, after=${retreated.distanceToWreck}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, yaw: 1 }, 45);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const rotated = sandbox.getDiagnostics();
    const forward = rotateLocalVector(rotated.rotation, { x: 0, y: 0, z: -1 });
    assert.ok(forward.z > -0.97, `expected meaningful yaw rotation; forward.z=${forward.z}`);
    assert.ok(rotated.angularSpeed < 0.6, `expected angular braking to settle rotation, got ${rotated.angularSpeed}`);
  } finally {
    sandbox.dispose();
  }
});

test("craft impact transfers momentum without solver explosion or wreck disassembly", async () => {
  const sandbox = await WreckSandbox.create();
  const controller = new FlightController();
  try {
    const spineStart = sandbox.getWreckComponent("spine").body.translation();
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 100);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 120);
    const after = sandbox.getDiagnostics();
    const spineEnd = sandbox.getWreckComponent("spine").body.translation();
    const spineDisplacement = Math.hypot(spineEnd.x - spineStart.x, spineEnd.y - spineStart.y, spineEnd.z - spineStart.z);

    assert.ok(spineDisplacement > 0.01, `craft impact did not transfer measurable momentum to wreck: ${spineDisplacement}`);
    assert.equal(after.activeConstraints, 6);
    assert.ok(after.maxConnectionError < 0.35, `impact destabilized fixed joints: ${after.maxConnectionError}`);
    assert.ok(after.wreckLinearSpeed < 30, `wreck velocity indicates solver explosion: ${after.wreckLinearSpeed}`);
    assert.ok(sandbox.getWreckComponents().every(finiteBody));

    const spine = sandbox.getWreckComponent("spine").body.translation();
    for (const component of sandbox.getWreckComponents()) {
      const position = component.body.translation();
      const distance = Math.hypot(position.x - spine.x, position.y - spine.y, position.z - spine.z);
      assert.ok(distance < 8.5, `${component.id} escaped the intact assembly: distance=${distance}`);
    }
  } finally {
    sandbox.dispose();
  }
});

test("twenty resets rebuild exactly one wreck with the same component and connection sets", async () => {
  const sandbox = await WreckSandbox.create();
  const controller = new FlightController();
  try {
    const baseline = sandbox.getDiagnostics();
    const componentIds = sortedIds(sandbox.getWreckComponents());
    const connectionIds = sortedIds(sandbox.getConnections());

    for (let index = 0; index < 20; index += 1) {
      stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 4);
      sandbox.reset();
      const diagnostics = sandbox.getDiagnostics();
      assert.equal(diagnostics.activeBodies, baseline.activeBodies);
      assert.equal(diagnostics.activeConstraints, baseline.activeConstraints);
      assert.equal(diagnostics.wreckComponentCount, 6);
      assert.equal(diagnostics.wreckConnectionCount, 6);
      assert.equal(diagnostics.generation, baseline.generation + index + 1);
      assert.deepEqual(sortedIds(sandbox.getWreckComponents()), componentIds);
      assert.deepEqual(sortedIds(sandbox.getConnections()), connectionIds);
      assert.ok(Math.abs(diagnostics.position.x) < 1e-6);
      assert.ok(Math.abs(diagnostics.position.y) < 1e-6);
      assert.ok(Math.abs(diagnostics.position.z - 14) < 1e-6);
      assert.ok(diagnostics.linearSpeed < 1e-6);
      assert.ok(diagnostics.maxConnectionError < 1e-5, `reset joint error=${diagnostics.maxConnectionError}`);
      assert.equal(diagnostics.elapsedSeconds, 0);
    }
  } finally {
    sandbox.dispose();
  }
});
