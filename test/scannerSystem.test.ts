// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { ScannerSystem } from "../src/scanner/ScannerSystem.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";
import { TetherSystem } from "../src/tether/TetherSystem.js";

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function syncGraph(graph, sandbox, tether) {
  graph.sync(sandbox, tether?.getDiagnostics(sandbox));
}

function stepTether(sandbox, tether, controller, graph, active, count) {
  for (let index = 0; index < count; index += 1) {
    tether.step(sandbox, active);
    sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
    syncGraph(graph, sandbox, tether);
  }
}

test("scanner distinguishes safe alternate path, low-mass bridge, and high-mass critical connection with explicit reasons", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  try {
    syncGraph(graph, sandbox);

    const safe = scanner.analyzeConnection(sandbox, graph, "left-rail-rear");
    const panel = scanner.analyzeConnection(sandbox, graph, "spine-panel");
    const engine = scanner.analyzeConnection(sandbox, graph, "spine-engine");

    assert.ok(safe);
    assert.equal(safe.riskLevel, "low");
    assert.equal(safe.bridge, false);
    assert.equal(safe.alternateLoadPath, true);
    assert.deepEqual(safe.likelyFreeComponentIds, []);
    assert.ok(safe.reasons.some((reason) => reason.includes("Alternate permanent load path")));

    assert.ok(panel);
    assert.equal(panel.riskLevel, "moderate");
    assert.equal(panel.bridge, true);
    assert.deepEqual(panel.likelyFreeComponentIds, ["panel"]);
    assert.equal(panel.displayComponentId, "panel");
    assert.equal(panel.componentType, "panel");
    assert.equal(panel.massClass, "light");
    assert.equal(panel.placeholderValueUnits, 250);
    assert.equal(panel.confidence, "estimate");

    assert.ok(engine);
    assert.equal(engine.riskLevel, "high");
    assert.equal(engine.bridge, true);
    assert.deepEqual(engine.likelyFreeComponentIds, ["engine"]);
    assert.equal(engine.displayComponentId, "engine");
    assert.equal(engine.componentType, "engine");
    assert.equal(engine.massClass, "heavy");
    assert.equal(engine.placeholderValueUnits, 1200);
    assert.ok(engine.riskScore > panel.riskScore);
    assert.ok(engine.estimatedFreeMass > panel.estimatedFreeMass);
  } finally {
    sandbox.dispose();
  }
});

test("scanner target acquisition follows a current aimed connection and exposes relationship identity", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  try {
    syncGraph(graph, sandbox);
    const scan = scanner.scan(sandbox, graph, undefined, "spine-panel");
    assert.equal(scan.state, "locked");
    assert.equal(scan.connectionId, "spine-panel");
    assert.equal(scan.relationship, "spine ↔ panel");
    assert.equal(scan.displayComponentId, "panel");
    assert.equal(scan.componentType, "panel");
    assert.ok(scan.distanceMeters < 18);
    assert.ok(scan.aimAlignment > 0.9);
    assert.deepEqual(scan.likelyFreeComponentIds, ["panel"]);
  } finally {
    sandbox.dispose();
  }
});

test("temporary tether support lowers the panel estimate without mutating permanent topology", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    syncGraph(graph, sandbox, tether);
    const unbraced = scanner.analyzeConnection(sandbox, graph, "spine-panel", tether.getDiagnostics(sandbox));
    assert.ok(unbraced);
    assert.equal(unbraced.riskLevel, "moderate");
    assert.equal(unbraced.temporarySupport, false);

    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    stepTether(sandbox, tether, controller, graph, true, 8);
    const braced = scanner.analyzeConnection(sandbox, graph, "spine-panel", tether.getDiagnostics(sandbox));
    assert.ok(braced);
    assert.equal(braced.temporarySupport, true);
    assert.equal(braced.riskLevel, "low");
    assert.ok(braced.riskScore < unbraced.riskScore);
    assert.ok(braced.reasons.some((reason) => reason.includes("Temporary tether support")));
    assert.equal(graph.getEdges().length, 6);
    assert.equal(graph.getSupports().length, 1);
  } finally {
    sandbox.dispose();
  }
});

test("scanner does not retain stale connection data after a physical cut", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  try {
    syncGraph(graph, sandbox);
    const before = scanner.analyzeConnection(sandbox, graph, "spine-panel");
    assert.ok(before);
    const revisionBefore = before.topologyRevision;

    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    syncGraph(graph, sandbox);
    assert.equal(scanner.analyzeConnection(sandbox, graph, "spine-panel"), null);
    const after = scanner.scan(sandbox, graph, undefined, "spine-panel");
    assert.equal(graph.hasEdge("spine-panel"), false);
    assert.equal(graph.getEdges().length, 5);
    assert.ok(graph.getDiagnostics().topologyRevision > revisionBefore);
    if (after.state === "locked") assert.notEqual(after.connectionId, "spine-panel");
  } finally {
    sandbox.dispose();
  }
});

test("matched braced and unbraced cuts change both predicted risk and the later physical outcome", async () => {
  const unbracedSandbox = await WreckSandbox.create();
  const bracedSandbox = await WreckSandbox.create();
  const unbracedGraph = new StructuralGraph();
  const bracedGraph = new StructuralGraph();
  const scanner = new ScannerSystem();
  const tether = new TetherSystem();
  const controllerA = new FlightController();
  const controllerB = new FlightController();
  try {
    placeCraft(unbracedSandbox, 0, 6);
    placeCraft(bracedSandbox, 0, 6);
    syncGraph(unbracedGraph, unbracedSandbox);
    syncGraph(bracedGraph, bracedSandbox, tether);

    const unbracedEstimate = scanner.analyzeConnection(unbracedSandbox, unbracedGraph, "spine-panel");
    assert.ok(unbracedEstimate);
    assert.equal(unbracedEstimate.riskLevel, "moderate");

    assert.equal(tether.attachToComponent(bracedSandbox, "panel"), true);
    stepTether(bracedSandbox, tether, controllerB, bracedGraph, true, 8);
    const bracedEstimate = scanner.analyzeConnection(bracedSandbox, bracedGraph, "spine-panel", tether.getDiagnostics(bracedSandbox));
    assert.ok(bracedEstimate);
    assert.equal(bracedEstimate.riskLevel, "low");
    assert.ok(bracedEstimate.riskScore < unbracedEstimate.riskScore);

    unbracedSandbox.severConnection("spine-panel");
    syncGraph(unbracedGraph, unbracedSandbox);
    for (let index = 0; index < 90; index += 1) unbracedSandbox.step(controllerA, NEUTRAL_FLIGHT_INPUT);

    bracedSandbox.severConnection("spine-panel");
    syncGraph(bracedGraph, bracedSandbox, tether);
    stepTether(bracedSandbox, tether, controllerB, bracedGraph, true, 90);

    const unbracedPanel = unbracedSandbox.getWreckComponent("panel").body.translation();
    const unbracedSpine = unbracedSandbox.getWreckComponent("spine").body.translation();
    const bracedPanel = bracedSandbox.getWreckComponent("panel").body.translation();
    const bracedSpine = bracedSandbox.getWreckComponent("spine").body.translation();
    const unbracedX = unbracedPanel.x - unbracedSpine.x;
    const bracedX = bracedPanel.x - bracedSpine.x;

    assert.ok(unbracedX > bracedX + 0.08,
      `physical brace outcome regressed: unbracedX=${unbracedX}, bracedX=${bracedX}`);
    assert.equal(unbracedGraph.getEdges().length, 5);
    assert.equal(bracedGraph.getEdges().length, 5);
    assert.equal(scanner.analyzeConnection(unbracedSandbox, unbracedGraph, "spine-panel"), null);
    assert.equal(scanner.analyzeConnection(bracedSandbox, bracedGraph, "spine-panel", tether.getDiagnostics(bracedSandbox)), null);
  } finally {
    unbracedSandbox.dispose();
    bracedSandbox.dispose();
  }
});

test("repeated cut tether and reset clears stale scanner state and restores the baseline estimate", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  const tether = new TetherSystem();
  try {
    for (let index = 0; index < 12; index += 1) {
      placeCraft(sandbox, 0, 6);
      syncGraph(graph, sandbox, tether);
      const baseline = scanner.analyzeConnection(sandbox, graph, "spine-panel", tether.getDiagnostics(sandbox));
      assert.ok(baseline);
      assert.equal(baseline.riskLevel, "moderate");

      sandbox.severConnection("spine-panel");
      syncGraph(graph, sandbox, tether);
      assert.equal(scanner.analyzeConnection(sandbox, graph, "spine-panel", tether.getDiagnostics(sandbox)), null);
      tether.attachToComponent(sandbox, "panel");
      syncGraph(graph, sandbox, tether);

      sandbox.reset();
      tether.reset();
      syncGraph(graph, sandbox, tether);
      const restored = scanner.analyzeConnection(sandbox, graph, "spine-panel", tether.getDiagnostics(sandbox));
      assert.ok(restored);
      assert.equal(restored.riskLevel, "moderate");
      assert.equal(restored.temporarySupport, false);
      assert.equal(graph.getNodes().length, 6);
      assert.equal(graph.getEdges().length, 6);
      assert.equal(graph.getSupports().length, 0);
    }
  } finally {
    sandbox.dispose();
  }
});
