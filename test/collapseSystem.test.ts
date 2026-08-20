// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { CollapseSystem, MAX_HULL_INTEGRITY } from "../src/collapse/CollapseSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";
import { TetherSystem } from "../src/tether/TetherSystem.js";

const REVERSE_FLIGHT_INPUT = Object.freeze({ ...NEUTRAL_FLIGHT_INPUT, forward: -1 });

function syncGraph(graph, sandbox, tether) {
  graph.sync(sandbox, tether?.getDiagnostics(sandbox));
}

function stepCollapse(sandbox, controller, graph, collapse, input = NEUTRAL_FLIGHT_INPUT, tether = null, tetherActive = false) {
  if (tether) tether.step(sandbox, tetherActive);
  sandbox.step(controller, input);
  syncGraph(graph, sandbox, tether);
  collapse.step(sandbox, graph);
  syncGraph(graph, sandbox, tether);
  return collapse.getDiagnostics();
}

function placeCraft(sandbox, position, velocity = { x: 0, y: 0, z: 0 }) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation(position, true);
  craft.setLinvel(velocity, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

test("critical engine cut creates a live dangerous cascade with warning and physical hull damage", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    syncGraph(graph, sandbox);
    collapse.step(sandbox, graph);
    const baseline = collapse.getDiagnostics();
    assert.equal(baseline.severityState, "stable");
    assert.equal(baseline.hullIntegrity, MAX_HULL_INTEGRITY);

    const cut = sandbox.severConnection("spine-engine");
    assert.equal(cut.severed, true);
    assert.equal(cut.failureMode, "cut");
    syncGraph(graph, sandbox);

    let maximumSeverity = 0;
    let sawCriticalAlarm = false;
    let sawForwardWarning = false;
    let sawImpact = false;
    for (let index = 0; index < 360; index += 1) {
      const diagnostics = stepCollapse(sandbox, controller, graph, collapse);
      maximumSeverity = Math.max(maximumSeverity, diagnostics.severityScore);
      if (diagnostics.warningCue === "critical-alarm") sawCriticalAlarm = true;
      if (diagnostics.warningDirection === "ahead") sawForwardWarning = true;
      if (diagnostics.lastImpactDamage > 0) sawImpact = true;
      if (diagnostics.destroyed) break;
    }

    const final = collapse.getDiagnostics();
    assert.ok(maximumSeverity >= 70, `critical cut never became critical: max=${maximumSeverity}`);
    assert.equal(sawCriticalAlarm, true);
    assert.equal(sawForwardWarning, true);
    assert.equal(sawImpact, true);
    assert.ok(final.hullIntegrity < MAX_HULL_INTEGRITY, `physical debris did not damage hull: ${final.hullIntegrity}`);
    assert.equal(final.destroyed, true);
    assert.equal(final.severityState, "destroyed");
    assert.equal(final.warningCue, "hull-failure");
    assert.equal(final.lastImpactBodyId, "engine");
    assert.ok(final.lastImpactImpulse > 0);
  } finally {
    sandbox.dispose();
  }
});

test("reverse thrust lets the player survive the same critical cut and severity falls as the threat opens distance", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    syncGraph(graph, sandbox);
    const baseline = collapse.getDiagnostics();
    assert.equal(baseline.severityScore, 0);
    assert.equal(sandbox.severConnection("spine-engine").severed, true);
    syncGraph(graph, sandbox);

    let maximumSeverity = 0;
    for (let index = 0; index < 300; index += 1) {
      const diagnostics = stepCollapse(sandbox, controller, graph, collapse, REVERSE_FLIGHT_INPUT);
      maximumSeverity = Math.max(maximumSeverity, diagnostics.severityScore);
    }

    const final = collapse.getDiagnostics();
    assert.ok(maximumSeverity >= 70, `same critical cut did not initially register danger: max=${maximumSeverity}`);
    assert.equal(final.destroyed, false);
    assert.equal(final.hullIntegrity, MAX_HULL_INTEGRITY);
    assert.ok(final.severityScore < maximumSeverity - 30,
      `severity did not fall with live geometry/motion: max=${maximumSeverity}, final=${final.severityScore}`);
    assert.ok(final.severityScore < 20, `escaping threat did not settle back to stable: ${final.severityScore}`);
    assert.equal(final.warningCue, "quiet");
  } finally {
    sandbox.dispose();
  }
});

test("existing low-risk panel cut stays low-risk under the collapse system", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    syncGraph(graph, sandbox);
    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    syncGraph(graph, sandbox);

    let maximumSeverity = 0;
    for (let index = 0; index < 240; index += 1) {
      const diagnostics = stepCollapse(sandbox, controller, graph, collapse);
      maximumSeverity = Math.max(maximumSeverity, diagnostics.severityScore);
    }

    const final = collapse.getDiagnostics();
    assert.ok(maximumSeverity < 45, `low-risk panel cut escalated into danger: max=${maximumSeverity}`);
    assert.equal(final.hullIntegrity, MAX_HULL_INTEGRITY);
    assert.equal(final.destroyed, false);
    assert.equal(final.secondaryBreakCount, 0);
  } finally {
    sandbox.dispose();
  }
});

test("measured non-connected impact impulse can overload one explicitly fragile structural joint", async () => {
  const sandbox = await WreckSandbox.create();
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    syncGraph(graph, sandbox);
    const fragile = sandbox.getConnection("left-rail-rear");
    assert.ok(fragile.failureImpulseThreshold !== null);
    placeCraft(sandbox, { x: -6, y: 0, z: -4.2 }, { x: 18, y: 0, z: 0 });

    for (let index = 0; index < 90 && sandbox.hasConnection("left-rail-rear"); index += 1) {
      stepCollapse(sandbox, controller, graph, collapse);
    }

    syncGraph(graph, sandbox);
    const diagnostics = collapse.getDiagnostics();
    assert.equal(sandbox.hasConnection("left-rail-rear"), false);
    assert.equal(graph.hasEdge("left-rail-rear"), false);
    assert.equal(diagnostics.secondaryBreakCount, 1);
    assert.equal(diagnostics.lastSecondaryBreakId, "left-rail-rear");
    const severed = sandbox.getSeveredConnections().find((connection) => connection.id === "left-rail-rear");
    assert.ok(severed);
    assert.equal(severed.failureMode, "impact-overload");
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getBodyRecords().length, 7);
  } finally {
    sandbox.dispose();
  }
});

test("tethering the heavy engine materially changes its post-cut trajectory through physical force", async () => {
  const freeSandbox = await WreckSandbox.create();
  const tetheredSandbox = await WreckSandbox.create();
  const controllerA = new FlightController();
  const controllerB = new FlightController();
  const graphA = new StructuralGraph();
  const graphB = new StructuralGraph();
  const collapseA = new CollapseSystem();
  const collapseB = new CollapseSystem();
  const tether = new TetherSystem();
  try {
    placeCraft(freeSandbox, { x: 2, y: 0, z: 0.7 });
    placeCraft(tetheredSandbox, { x: 2, y: 0, z: 0.7 });
    syncGraph(graphA, freeSandbox);
    syncGraph(graphB, tetheredSandbox, tether);

    assert.equal(tether.attachToComponent(tetheredSandbox, "engine"), true);
    for (let index = 0; index < 8; index += 1) {
      stepCollapse(tetheredSandbox, controllerB, graphB, collapseB, NEUTRAL_FLIGHT_INPUT, tether, true);
    }

    const freeBefore = freeSandbox.getWreckComponent("engine").body.translation().x;
    const tetheredBefore = tetheredSandbox.getWreckComponent("engine").body.translation().x;
    assert.equal(freeSandbox.severConnection("spine-engine").severed, true);
    assert.equal(tetheredSandbox.severConnection("spine-engine").severed, true);
    syncGraph(graphA, freeSandbox);
    syncGraph(graphB, tetheredSandbox, tether);

    for (let index = 0; index < 90; index += 1) {
      stepCollapse(freeSandbox, controllerA, graphA, collapseA);
      stepCollapse(tetheredSandbox, controllerB, graphB, collapseB, NEUTRAL_FLIGHT_INPUT, tether, true);
    }

    const freeAfter = freeSandbox.getWreckComponent("engine").body.translation().x;
    const tetheredAfter = tetheredSandbox.getWreckComponent("engine").body.translation().x;
    const freeOutwardTravel = freeBefore - freeAfter;
    const tetheredOutwardTravel = tetheredBefore - tetheredAfter;
    assert.ok(freeOutwardTravel > tetheredOutwardTravel + 0.05,
      `tether did not materially change heavy-cut trajectory: free=${freeOutwardTravel}, tethered=${tetheredOutwardTravel}`);
  } finally {
    freeSandbox.dispose();
    tetheredSandbox.dispose();
  }
});

test("collapse reset restores hull, warning, topology, and the exact danger-fixture baseline", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    const originalConnectionIds = sandbox.getConnections().map((connection) => connection.id).sort();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      assert.equal(sandbox.severConnection("spine-engine").severed, true);
      syncGraph(graph, sandbox);
      for (let index = 0; index < 30; index += 1) stepCollapse(sandbox, controller, graph, collapse);

      sandbox.reset();
      collapse.reset();
      syncGraph(graph, sandbox);
      const diagnostics = collapse.getDiagnostics();
      assert.equal(diagnostics.hullIntegrity, MAX_HULL_INTEGRITY);
      assert.equal(diagnostics.severityState, "stable");
      assert.equal(diagnostics.warningCue, "quiet");
      assert.equal(diagnostics.secondaryBreakCount, 0);
      assert.deepEqual(sandbox.getConnections().map((connection) => connection.id).sort(), originalConnectionIds);
      assert.equal(sandbox.getConnections().length, 6);
      assert.equal(graph.getEdges().length, 6);
      assert.equal(graph.getNodes().length, 6);
    }
  } finally {
    sandbox.dispose();
  }
});
