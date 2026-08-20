// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { CUTTER_DURATION_SECONDS, CuttingSystem } from "../src/cutting/CuttingSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { FIXED_TIMESTEP_SECONDS } from "../src/physics/PhysicsSandbox.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function stepCutter(sandbox, cutter, controller, active, count) {
  for (let index = 0; index < count; index += 1) {
    cutter.step(sandbox, active);
    sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
  }
}

function stepsToCut() {
  return Math.ceil(CUTTER_DURATION_SECONDS / FIXED_TIMESTEP_SECONDS) + 4;
}

function sortedIds(records) {
  return records.map((record) => record.id).sort();
}

test("only designated Phase 3 connections are cuttable and non-cuttable structure is protected", async () => {
  const sandbox = await WreckSandbox.create();
  try {
    assert.deepEqual(sortedIds(sandbox.getCuttableConnections()), ["spine-engine", "spine-panel"]);
    assert.equal(sandbox.getConnection("spine-panel").cutClass, "low-risk");
    assert.equal(sandbox.getConnection("spine-engine").cutClass, "large-mass");
    assert.equal(sandbox.getConnection("left-rail-rear").cuttable, false);

    const result = sandbox.severConnection("left-rail-rear");
    assert.equal(result.severed, false);
    assert.equal(result.reason, "not-cuttable");
    assert.equal(sandbox.getConnections().length, 6);
    assert.equal(sandbox.getWreckComponents().length, 6);
  } finally {
    sandbox.dispose();
  }
});

test("cutter acquires the low-risk target and range loss interrupts progress without severing", async () => {
  const sandbox = await WreckSandbox.create();
  const cutter = new CuttingSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    cutter.step(sandbox, false);
    const acquired = cutter.getDiagnostics(sandbox);
    assert.equal(acquired.targetId, "spine-panel");
    assert.equal(acquired.targetClass, "low-risk");
    assert.equal(acquired.canCut, true);
    assert.equal(acquired.state, "tracking");

    stepCutter(sandbox, cutter, controller, true, 20);
    const partial = cutter.getDiagnostics(sandbox);
    assert.ok(partial.progress01 > 0.2 && partial.progress01 < 0.8, `unexpected partial progress=${partial.progress01}`);
    assert.equal(sandbox.getConnections().length, 6);

    placeCraft(sandbox, 0, 20);
    cutter.step(sandbox, true);
    const interrupted = cutter.getDiagnostics(sandbox);
    assert.equal(interrupted.state, "blocked");
    assert.equal(interrupted.progress01, 0);
    assert.equal(sandbox.getConnections().length, 6);
  } finally {
    sandbox.dispose();
  }
});

test("low-risk cut removes exactly the panel joint while preserving the body and producing physical separation", async () => {
  const sandbox = await WreckSandbox.create();
  const cutter = new CuttingSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    stepCutter(sandbox, cutter, controller, true, stepsToCut());
    const cut = cutter.getDiagnostics(sandbox);
    assert.equal(cut.state, "complete");
    assert.equal(cut.lastCompletedConnectionId, "spine-panel");
    assert.equal(sandbox.hasConnection("spine-panel"), false);
    assert.equal(sandbox.getConnections().length, 5);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getBodyRecords().length, 7);
    assert.equal(sandbox.getSeveredConnections().length, 1);
    assert.ok(sandbox.getWreckComponent("panel").body.isDynamic());

    const separationAtCut = sandbox.getSeveredConnectionSeparation("spine-panel");
    stepCutter(sandbox, cutter, controller, false, 60);
    const separationAfter = sandbox.getSeveredConnectionSeparation("spine-panel");
    assert.ok(separationAfter > separationAtCut + 0.05, `panel did not separate physically: cut=${separationAtCut}, after=${separationAfter}`);
  } finally {
    sandbox.dispose();
  }
});

test("large-mass cut severs the engine joint without deleting the heavy component", async () => {
  const sandbox = await WreckSandbox.create();
  const cutter = new CuttingSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, -2.5, 6);
    cutter.step(sandbox, false);
    const target = cutter.getDiagnostics(sandbox);
    assert.equal(target.targetId, "spine-engine");
    assert.equal(target.targetClass, "large-mass");
    assert.equal(target.canCut, true);

    stepCutter(sandbox, cutter, controller, true, stepsToCut());
    assert.equal(sandbox.hasConnection("spine-engine"), false);
    assert.equal(sandbox.getConnections().length, 5);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getBodyRecords().length, 7);
    assert.ok(sandbox.getWreckComponent("engine").body.mass() > sandbox.getWreckComponent("panel").body.mass() * 2);

    stepCutter(sandbox, cutter, controller, false, 90);
    assert.ok(sandbox.getSeveredConnectionSeparation("spine-engine") > 0.03, "engine did not develop measurable post-cut separation");
  } finally {
    sandbox.dispose();
  }
});

test("repeated cut then reset restores every original connection exactly once", async () => {
  const sandbox = await WreckSandbox.create();
  const cutter = new CuttingSystem();
  const controller = new FlightController();
  const originalIds = sortedIds(sandbox.getConnections());
  try {
    for (let index = 0; index < 12; index += 1) {
      placeCraft(sandbox, 0, 6);
      cutter.reset();
      stepCutter(sandbox, cutter, controller, true, stepsToCut());
      assert.equal(sandbox.getConnections().length, 5);
      assert.equal(sandbox.getSeveredConnections().length, 1);

      sandbox.reset();
      cutter.reset();
      assert.equal(sandbox.getConnections().length, 6);
      assert.equal(sandbox.getSeveredConnections().length, 0);
      assert.deepEqual(sortedIds(sandbox.getConnections()), originalIds);
      assert.equal(new Set(sandbox.getConnections().map((connection) => connection.id)).size, 6);
      assert.ok(sandbox.getDiagnostics().maxConnectionError < 1e-5);
    }
  } finally {
    sandbox.dispose();
  }
});
