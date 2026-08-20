// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightController, NEUTRAL_FLIGHT_INPUT, rotateLocalVector } from "../src/flight/FlightController.js";
import { FlightSandbox } from "../src/physics/FlightSandbox.js";
import { FIXED_TIMESTEP_SECONDS } from "../src/physics/PhysicsSandbox.js";
import { FixedStepLoop } from "../src/runtime/FixedStepLoop.js";

function stepMany(sandbox, controller, input, count) {
  for (let index = 0; index < count; index += 1) sandbox.step(controller, input);
}

async function simulateThroughRenderLoop(frameDelta, frameCount) {
  const sandbox = await FlightSandbox.create();
  const controller = new FlightController();
  const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);
  let physicsSteps = 0;
  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      physicsSteps += loop.advance(frameDelta, () => sandbox.step(controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }));
    }
    return { diagnostics: sandbox.getDiagnostics(), physicsSteps };
  } finally {
    sandbox.dispose();
  }
}

test("flight thrust remains frame-rate independent through the fixed-step owner", async () => {
  const atThirty = await simulateThroughRenderLoop(1 / 30, 60);
  const atOneTwenty = await simulateThroughRenderLoop(1 / 120, 240);

  assert.equal(atThirty.physicsSteps, 120);
  assert.equal(atOneTwenty.physicsSteps, 120);
  assert.ok(Math.abs(atThirty.diagnostics.position.z - atOneTwenty.diagnostics.position.z) < 0.03);
  assert.ok(Math.abs(atThirty.diagnostics.linearSpeed - atOneTwenty.diagnostics.linearSpeed) < 0.03);
});

test("precision flight path can approach, brake, translate, retreat, and rotate without debug movement", async () => {
  const sandbox = await FlightSandbox.create();
  const controller = new FlightController();
  try {
    const start = sandbox.getDiagnostics();

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 60);
    const approach = sandbox.getDiagnostics();
    assert.ok(approach.distanceToTarget < start.distanceToTarget - 1.5, `approach did not close distance: ${approach.distanceToTarget}`);
    assert.ok(approach.linearSpeed > 2, `expected inertial approach speed, got ${approach.linearSpeed}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const working = sandbox.getDiagnostics();
    assert.ok(working.linearSpeed < 0.7, `expected controlled stop, got ${working.linearSpeed}`);
    assert.ok(working.distanceToTarget > 2 && working.distanceToTarget < 10, `working distance not useful: ${working.distanceToTarget}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, strafe: 1 }, 50);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const translated = sandbox.getDiagnostics();
    assert.ok(Math.abs(translated.position.x) > 0.8, `expected lateral translation, x=${translated.position.x}`);
    assert.ok(translated.linearSpeed < 0.7, `expected lateral stop, got ${translated.linearSpeed}`);

    const beforeRetreat = translated.distanceToTarget;
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: -1 }, 60);
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 90);
    const retreated = sandbox.getDiagnostics();
    assert.ok(retreated.distanceToTarget > beforeRetreat + 1, `expected retreat to increase distance: before=${beforeRetreat}, after=${retreated.distanceToTarget}`);

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

test("momentum persists without braking and braking materially reduces it", async () => {
  const sandbox = await FlightSandbox.create();
  const controller = new FlightController();
  try {
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 45);
    const powered = sandbox.getDiagnostics();
    stepMany(sandbox, controller, NEUTRAL_FLIGHT_INPUT, 30);
    const coasting = sandbox.getDiagnostics();
    assert.ok(coasting.linearSpeed > powered.linearSpeed * 0.75, `coast lost too much momentum: powered=${powered.linearSpeed}, coast=${coasting.linearSpeed}`);

    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, brake: true }, 60);
    const braked = sandbox.getDiagnostics();
    assert.ok(braked.linearSpeed < coasting.linearSpeed * 0.35, `braking did not materially reduce speed: coast=${coasting.linearSpeed}, braked=${braked.linearSpeed}`);
  } finally {
    sandbox.dispose();
  }
});

test("craft collision body prevents thrusting through the side wall", async () => {
  const sandbox = await FlightSandbox.create();
  const controller = new FlightController();
  try {
    stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, strafe: 1 }, 240);
    const diagnostics = sandbox.getDiagnostics();
    assert.ok(diagnostics.position.x < 6.05, `craft tunneled through wall, x=${diagnostics.position.x}`);
  } finally {
    sandbox.dispose();
  }
});

test("moving obstacle advances and twenty resets preserve the Phase 0 cleanup invariant", async () => {
  const sandbox = await FlightSandbox.create();
  const controller = new FlightController();
  try {
    const baseline = sandbox.getDiagnostics();
    const movingStart = sandbox.getBodyRecord("moving-obstacle").body.translation().x;
    stepMany(sandbox, controller, NEUTRAL_FLIGHT_INPUT, 60);
    const movingEnd = sandbox.getBodyRecord("moving-obstacle").body.translation().x;
    assert.ok(Math.abs(movingEnd - movingStart) > 0.5, `moving obstacle did not move: start=${movingStart}, end=${movingEnd}`);

    for (let index = 0; index < 20; index += 1) {
      stepMany(sandbox, controller, { ...NEUTRAL_FLIGHT_INPUT, forward: 1 }, 3);
      sandbox.reset();
      const diagnostics = sandbox.getDiagnostics();
      assert.equal(diagnostics.activeBodies, baseline.activeBodies);
      assert.equal(diagnostics.activeConstraints, 0);
      assert.equal(diagnostics.generation, baseline.generation + index + 1);
      assert.ok(Math.abs(diagnostics.position.x) < 1e-6);
      assert.ok(Math.abs(diagnostics.position.y) < 1e-6);
      assert.ok(Math.abs(diagnostics.position.z - 12) < 1e-6);
      assert.ok(diagnostics.linearSpeed < 1e-6);
      assert.equal(diagnostics.elapsedSeconds, 0);
    }
  } finally {
    sandbox.dispose();
  }
});
