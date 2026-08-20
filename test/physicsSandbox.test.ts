import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_TIMESTEP_SECONDS, PhysicsSandbox } from "../src/physics/PhysicsSandbox.js";

test("Rapier fixed timestep and collision settle a free body on the ground", async () => {
  const sandbox = await PhysicsSandbox.create();
  try {
    const free = sandbox.getBodyRecord("free-fall").body;
    const startY = free.translation().y;

    for (let index = 0; index < 240; index += 1) sandbox.step();

    const endY = free.translation().y;
    assert.equal(sandbox.getDiagnostics().fixedTimestepSeconds, FIXED_TIMESTEP_SECONDS);
    assert.ok(endY < startY - 1, `expected body to fall; start=${startY}, end=${endY}`);
    assert.ok(endY > 0.2, `expected ground collision to prevent tunneling; end=${endY}`);
  } finally {
    sandbox.dispose();
  }
});

test("bridge constraint can be removed and recreated at runtime", async () => {
  const sandbox = await PhysicsSandbox.create();
  try {
    assert.equal(sandbox.getDiagnostics().activeConstraints, 1);
    assert.equal(sandbox.removeBridgeConstraint(), true);
    assert.equal(sandbox.getDiagnostics().activeConstraints, 0);
    assert.equal(sandbox.removeBridgeConstraint(), false);
    assert.equal(sandbox.createBridgeConstraint(), true);
    assert.equal(sandbox.getDiagnostics().activeConstraints, 1);
    assert.equal(sandbox.createBridgeConstraint(), false);
  } finally {
    sandbox.dispose();
  }
});

test("twenty resets preserve exact body and constraint counts", async () => {
  const sandbox = await PhysicsSandbox.create();
  try {
    const baseline = sandbox.getDiagnostics();
    for (let index = 0; index < 20; index += 1) {
      sandbox.removeBridgeConstraint();
      sandbox.reset();
      const diagnostics = sandbox.getDiagnostics();
      assert.equal(diagnostics.activeBodies, baseline.activeBodies);
      assert.equal(diagnostics.activeConstraints, baseline.activeConstraints);
      assert.equal(diagnostics.generation, baseline.generation + index + 1);
    }
  } finally {
    sandbox.dispose();
  }
});
