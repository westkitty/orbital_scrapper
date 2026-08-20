// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { TETHER_MAX_TENSION_NEWTONS, TetherSystem } from "../src/tether/TetherSystem.js";

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function stepTether(sandbox, tether, controller, active, count) {
  for (let index = 0; index < count; index += 1) {
    tether.step(sandbox, active);
    sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
  }
}

function distanceBetweenBodies(a, b) {
  const pa = a.translation();
  const pb = b.translation();
  return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
}

test("tether attaches to a physical component, develops bounded tension, and releases cleanly", async () => {
  const sandbox = await WreckSandbox.create();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    stepTether(sandbox, tether, controller, true, 15);
    const attached = tether.getDiagnostics(sandbox);
    assert.equal(attached.state, "attached");
    assert.equal(attached.targetId, "panel");
    assert.ok(attached.tensionNewtons > 0);
    assert.ok(attached.tensionNewtons < TETHER_MAX_TENSION_NEWTONS);

    tether.step(sandbox, false);
    const released = tether.getDiagnostics(sandbox);
    assert.equal(released.state, "idle");
    assert.equal(released.targetId, null);
    assert.equal(released.tensionNewtons, 0);
    assert.equal(released.lastReleaseReason, "manual");
  } finally {
    sandbox.dispose();
  }
});

test("tether winch pulls a detached panel toward the craft without transform movement", async () => {
  const sandbox = await WreckSandbox.create();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    const panel = sandbox.getWreckComponent("panel").body;
    const craft = sandbox.getCraftBody();
    const before = distanceBetweenBodies(panel, craft);
    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    stepTether(sandbox, tether, controller, true, 90);
    const after = distanceBetweenBodies(panel, craft);
    assert.ok(after < before - 0.35, `tether did not pull detached panel closer: before=${before}, after=${after}`);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getBodyRecords().length, 7);
  } finally {
    sandbox.dispose();
  }
});

test("tether arrests and redirects an outward-drifting detached panel", async () => {
  const control = await WreckSandbox.create();
  const tethered = await WreckSandbox.create();
  const tether = new TetherSystem();
  const controllerA = new FlightController();
  const controllerB = new FlightController();
  try {
    placeCraft(control, 0, 6);
    placeCraft(tethered, 0, 6);
    control.severConnection("spine-panel");
    tethered.severConnection("spine-panel");
    const controlPanel = control.getWreckComponent("panel").body;
    const tetheredPanel = tethered.getWreckComponent("panel").body;
    controlPanel.applyImpulse({ x: 0, y: 0, z: -8 }, true);
    tetheredPanel.applyImpulse({ x: 0, y: 0, z: -8 }, true);
    assert.equal(tether.attachToComponent(tethered, "panel"), true);

    for (let index = 0; index < 120; index += 1) {
      control.step(controllerA, NEUTRAL_FLIGHT_INPUT);
      tether.step(tethered, true);
      tethered.step(controllerB, NEUTRAL_FLIGHT_INPUT);
    }

    assert.ok(tetheredPanel.translation().z > controlPanel.translation().z + 0.45,
      `tether did not arrest outward drift: control=${controlPanel.translation().z}, tethered=${tetheredPanel.translation().z}`);
    assert.ok(tetheredPanel.linvel().z > controlPanel.linvel().z + 0.2,
      `tether did not redirect velocity: control=${controlPanel.linvel().z}, tethered=${tetheredPanel.linvel().z}`);
  } finally {
    control.dispose();
    tethered.dispose();
  }
});

test("finite tether load snaps on overload and cannot re-engage until release", async () => {
  const sandbox = await WreckSandbox.create();
  const tether = new TetherSystem();
  try {
    placeCraft(sandbox, 0, 6);
    sandbox.severConnection("spine-panel");
    const panel = sandbox.getWreckComponent("panel").body;
    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    panel.applyImpulse({ x: 140, y: 0, z: -220 }, true);
    tether.step(sandbox, true);
    const snapped = tether.getDiagnostics(sandbox);
    assert.equal(snapped.state, "snapped");
    assert.equal(snapped.lastReleaseReason, "overload");
    assert.equal(snapped.tensionNewtons, 0);

    tether.step(sandbox, true);
    assert.equal(tether.getDiagnostics(sandbox).state, "snapped");
    tether.step(sandbox, false);
    assert.equal(tether.getDiagnostics(sandbox).state, "idle");
  } finally {
    sandbox.dispose();
  }
});

test("bracing the panel before the same cut materially changes post-cut motion", async () => {
  const unbraced = await WreckSandbox.create();
  const braced = await WreckSandbox.create();
  const tether = new TetherSystem();
  const controllerA = new FlightController();
  const controllerB = new FlightController();
  try {
    placeCraft(unbraced, 0, 6);
    placeCraft(braced, 0, 6);

    unbraced.severConnection("spine-panel");
    for (let index = 0; index < 90; index += 1) unbraced.step(controllerA, NEUTRAL_FLIGHT_INPUT);

    assert.equal(tether.attachToComponent(braced, "panel"), true);
    stepTether(braced, tether, controllerB, true, 8);
    braced.severConnection("spine-panel");
    stepTether(braced, tether, controllerB, true, 90);

    const unbracedPanel = unbraced.getWreckComponent("panel").body.translation();
    const unbracedSpine = unbraced.getWreckComponent("spine").body.translation();
    const bracedPanel = braced.getWreckComponent("panel").body.translation();
    const bracedSpine = braced.getWreckComponent("spine").body.translation();
    const unbracedX = unbracedPanel.x - unbracedSpine.x;
    const bracedX = bracedPanel.x - bracedSpine.x;

    assert.ok(unbracedX > bracedX + 0.08,
      `brace did not materially alter cut motion: unbracedX=${unbracedX}, bracedX=${bracedX}`);
    assert.equal(braced.getWreckComponents().length, 6);
    assert.equal(braced.getBodyRecords().length, 7);
  } finally {
    unbraced.dispose();
    braced.dispose();
  }
});

test("tether and wreck reset restore an idle tether and the exact six-joint baseline", async () => {
  const sandbox = await WreckSandbox.create();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    const originalIds = sandbox.getConnections().map((connection) => connection.id).sort();
    for (let index = 0; index < 12; index += 1) {
      placeCraft(sandbox, 0, 6);
      sandbox.severConnection("spine-panel");
      tether.attachToComponent(sandbox, "panel");
      stepTether(sandbox, tether, controller, true, 12);
      sandbox.reset();
      tether.reset();
      assert.equal(tether.getDiagnostics(sandbox).state, "idle");
      assert.equal(sandbox.getConnections().length, 6);
      assert.equal(sandbox.getWreckComponents().length, 6);
      assert.equal(sandbox.getBodyRecords().length, 7);
      assert.deepEqual(sandbox.getConnections().map((connection) => connection.id).sort(), originalIds);
    }
  } finally {
    sandbox.dispose();
  }
});
