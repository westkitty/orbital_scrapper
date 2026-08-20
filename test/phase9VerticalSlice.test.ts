// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND,
  CargoSystem,
} from "../src/cargo/CargoSystem.js";
import { CollapseSystem, MAX_HULL_INTEGRITY } from "../src/collapse/CollapseSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { ProgressionSystem } from "../src/progression/ProgressionSystem.js";
import { ScannerSystem } from "../src/scanner/ScannerSystem.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function placePanel(sandbox, x, z, velocity) {
  const panel = sandbox.getWreckComponent("panel").body;
  panel.setTranslation({ x, y: 0, z }, true);
  panel.setLinvel(velocity, true);
  panel.setAngvel({ x: 0, y: 0, z: 0 }, true);
  return panel;
}

function syncGraph(graph, sandbox) {
  graph.sync(sandbox);
}

function stepCollapse(sandbox, controller, graph, collapse, input = NEUTRAL_FLIGHT_INPUT) {
  sandbox.step(controller, input);
  syncGraph(graph, sandbox);
  collapse.step(sandbox, graph);
  syncGraph(graph, sandbox);
  return collapse.getDiagnostics();
}

test("persisted Clamp Dampers change the next-run physical capture result at the same relative speed", async () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const firstRun = progression.beginRun();
  progression.recordSettlement(firstRun, 250);
  assert.equal(progression.purchaseClampDampers().purchased, true);

  const persisted = new ProgressionSystem(storage);
  const baseSandbox = await WreckSandbox.create();
  const upgradedSandbox = await WreckSandbox.create();
  const baseCargo = new CargoSystem();
  const upgradedCargo = new CargoSystem({
    maxCaptureRelativeSpeed: persisted.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND),
  });
  try {
    placeCraft(baseSandbox, 0, 6);
    placeCraft(upgradedSandbox, 0, 6);
    baseSandbox.severConnection("spine-panel");
    upgradedSandbox.severConnection("spine-panel");
    const proofVelocity = { x: 0, y: 0, z: -1.6 };
    const basePanel = placePanel(baseSandbox, 0, 3.4, proofVelocity);
    const upgradedPanel = placePanel(upgradedSandbox, 0, 3.4, proofVelocity);

    assert.ok(1.6 > CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND);
    assert.equal(baseCargo.step(baseSandbox, "panel"), null);
    assert.equal(baseCargo.getDiagnostics(baseSandbox).captureState, "blocked-speed");
    assert.equal(basePanel.isEnabled(), true);

    assert.equal(upgradedCargo.step(upgradedSandbox, "panel"), "panel");
    assert.equal(upgradedCargo.getDiagnostics(upgradedSandbox).maxCaptureRelativeSpeed, 2);
    assert.equal(upgradedPanel.isEnabled(), false);
  } finally {
    baseSandbox.dispose();
    upgradedSandbox.dispose();
  }
});

test("scanner risk/value information supports a panel-first order that preserves the second decision while engine-first destroys it", async () => {
  const panelFirst = await WreckSandbox.create({ phase7DangerFixture: true });
  const engineFirst = await WreckSandbox.create({ phase7DangerFixture: true });
  const panelGraph = new StructuralGraph();
  const engineGraph = new StructuralGraph();
  const scanner = new ScannerSystem();
  const panelCollapse = new CollapseSystem();
  const engineCollapse = new CollapseSystem();
  const panelController = new FlightController();
  const engineController = new FlightController();
  try {
    syncGraph(panelGraph, panelFirst);
    syncGraph(engineGraph, engineFirst);
    const panelIntel = scanner.analyzeConnection(panelFirst, panelGraph, "spine-panel");
    const engineIntel = scanner.analyzeConnection(engineFirst, engineGraph, "spine-engine");
    assert.ok(panelIntel && engineIntel);
    assert.equal(panelIntel.riskLevel, "moderate");
    assert.equal(panelIntel.placeholderValueUnits, 250);
    assert.equal(engineIntel.riskLevel, "high");
    assert.equal(engineIntel.placeholderValueUnits, 1200);
    assert.ok(engineIntel.riskScore > panelIntel.riskScore);

    assert.equal(panelFirst.severConnection("spine-panel").severed, true);
    syncGraph(panelGraph, panelFirst);
    for (let index = 0; index < 240; index += 1) {
      stepCollapse(panelFirst, panelController, panelGraph, panelCollapse);
    }
    assert.equal(panelCollapse.getDiagnostics().destroyed, false);
    assert.equal(panelCollapse.getDiagnostics().hullIntegrity, MAX_HULL_INTEGRITY);
    assert.equal(panelFirst.hasConnection("spine-engine"), true);
    assert.equal(panelFirst.severConnection("spine-engine").severed, true, "panel-first order did not preserve the second cut decision");

    assert.equal(engineFirst.severConnection("spine-engine").severed, true);
    syncGraph(engineGraph, engineFirst);
    for (let index = 0; index < 360 && !engineCollapse.getDiagnostics().destroyed; index += 1) {
      stepCollapse(engineFirst, engineController, engineGraph, engineCollapse);
    }
    assert.equal(engineCollapse.getDiagnostics().destroyed, true);
    assert.equal(engineFirst.hasConnection("spine-panel"), true, "engine-first outcome unexpectedly consumed the panel decision through topology mutation");
  } finally {
    panelFirst.dispose();
    engineFirst.dispose();
  }
});

test("destroyed upgraded run recovers the exact physical baseline without corrupting progression", async () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const successfulRun = progression.beginRun();
  progression.recordSettlement(successfulRun, 250);
  progression.purchaseClampDampers();
  const creditsAfterPurchase = progression.getDiagnostics().credits;
  const failedRun = progression.beginRun();

  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  const cargo = new CargoSystem({
    maxCaptureRelativeSpeed: progression.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND),
  });
  try {
    syncGraph(graph, sandbox);
    collapse.step(sandbox, graph);
    assert.equal(sandbox.severConnection("spine-engine").severed, true);
    syncGraph(graph, sandbox);
    for (let index = 0; index < 360 && !collapse.getDiagnostics().destroyed; index += 1) {
      stepCollapse(sandbox, controller, graph, collapse);
    }
    assert.equal(collapse.getDiagnostics().destroyed, true);
    assert.equal(progression.recordFailure(failedRun), true);

    sandbox.reset();
    collapse.reset();
    cargo.reset();
    cargo.setMaxCaptureRelativeSpeed(progression.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND));
    syncGraph(graph, sandbox);
    collapse.step(sandbox, graph);

    assert.equal(sandbox.getBodyRecords().length, 7);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getConnections().length, 6);
    assert.equal(graph.getNodes().length, 6);
    assert.equal(graph.getEdges().length, 6);
    assert.equal(collapse.getDiagnostics().destroyed, false);
    assert.equal(collapse.getDiagnostics().hullIntegrity, MAX_HULL_INTEGRITY);
    assert.equal(cargo.getDiagnostics(sandbox).settlementState, "field");
    assert.equal(cargo.getDiagnostics(sandbox).securedCargoCount, 0);

    const reloaded = new ProgressionSystem(storage).getDiagnostics();
    assert.equal(reloaded.credits, creditsAfterPurchase);
    assert.equal(reloaded.upgrades.clampDampers, true);
    assert.equal(reloaded.failedRuns, 1);
    assert.equal(reloaded.completedRuns, 1);
  } finally {
    sandbox.dispose();
  }
});
