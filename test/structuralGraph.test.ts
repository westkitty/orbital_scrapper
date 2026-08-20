// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";
import { TetherSystem } from "../src/tether/TetherSystem.js";

function sortedIds(records) {
  return records.map((record) => record.id).sort();
}

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function stepTether(sandbox, tether, controller, active, count, graph) {
  for (let index = 0; index < count; index += 1) {
    tether.step(sandbox, active);
    sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
    graph?.sync(sandbox, tether.getDiagnostics(sandbox));
  }
}

test("structural graph mirrors baseline component and connection identity exactly", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  try {
    const sync = graph.sync(sandbox);
    assert.equal(sync.topologyChanged, true);
    assert.deepEqual(sortedIds(graph.getNodes()), sortedIds(sandbox.getWreckComponents()));
    assert.deepEqual(sortedIds(graph.getEdges()), sortedIds(sandbox.getConnections()));
    assert.equal(graph.getDiagnostics().nodeCount, 6);
    assert.equal(graph.getDiagnostics().edgeCount, 6);
    assert.equal(graph.getDiagnostics().supportCount, 0);
    assert.deepEqual(graph.getConnectedSection("spine"), ["engine", "left-rail", "panel", "rear-node", "right-rail", "spine"]);
  } finally {
    sandbox.dispose();
  }
});

test("bridge and articulation analysis reflects the known alternate-load-path wreck topology", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  try {
    graph.sync(sandbox);
    assert.deepEqual(graph.getBridgeConnectionIds(), ["spine-engine", "spine-panel"]);
    assert.deepEqual(graph.getArticulationComponentIds(), ["spine"]);
    assert.equal(graph.isBridge("spine-left-rail"), false);
    assert.equal(graph.isBridge("left-rail-rear"), false);
  } finally {
    sandbox.dispose();
  }
});

test("low-risk and large-mass cuts remove the same edge from physics and graph without deleting nodes", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  try {
    graph.sync(sandbox);
    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    graph.sync(sandbox);
    assert.equal(sandbox.hasConnection("spine-panel"), false);
    assert.equal(graph.hasEdge("spine-panel"), false);
    assert.equal(graph.hasNode("panel"), true);
    assert.equal(graph.getEdges().length, 5);
    assert.deepEqual(graph.getConnectedSection("panel"), ["panel"]);
    assert.deepEqual(graph.getConnectedSection("spine"), ["engine", "left-rail", "rear-node", "right-rail", "spine"]);

    sandbox.reset();
    graph.sync(sandbox);
    assert.equal(graph.hasEdge("spine-panel"), true);
    assert.equal(sandbox.severConnection("spine-engine").severed, true);
    graph.sync(sandbox);
    assert.equal(sandbox.hasConnection("spine-engine"), false);
    assert.equal(graph.hasEdge("spine-engine"), false);
    assert.equal(graph.hasNode("engine"), true);
    assert.deepEqual(graph.getConnectedSection("engine"), ["engine"]);
    assert.equal(graph.getEdges().length, sandbox.getConnections().length);
  } finally {
    sandbox.dispose();
  }
});

test("tether brace is temporary support state and never becomes permanent wreck topology", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    graph.sync(sandbox, tether.getDiagnostics(sandbox));
    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    stepTether(sandbox, tether, controller, true, 8, graph);
    let diagnostics = graph.getDiagnostics();
    assert.equal(diagnostics.edgeCount, 6);
    assert.equal(diagnostics.supportCount, 1);
    assert.deepEqual(sortedIds(graph.getSupports()), ["tether:panel"]);

    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    graph.sync(sandbox, tether.getDiagnostics(sandbox));
    diagnostics = graph.getDiagnostics();
    assert.equal(diagnostics.edgeCount, 5);
    assert.equal(diagnostics.supportCount, 1);
    assert.equal(graph.hasEdge("spine-panel"), false);

    tether.step(sandbox, false);
    graph.sync(sandbox, tether.getDiagnostics(sandbox));
    diagnostics = graph.getDiagnostics();
    assert.equal(diagnostics.edgeCount, 5);
    assert.equal(diagnostics.supportCount, 0);
    assert.equal(graph.hasEdge("spine-panel"), false);
  } finally {
    sandbox.dispose();
  }
});

test("matched braced and unbraced cuts preserve synchronized topology while support changes the physical result", async () => {
  const unbraced = await WreckSandbox.create();
  const braced = await WreckSandbox.create();
  const graphA = new StructuralGraph();
  const graphB = new StructuralGraph();
  const tether = new TetherSystem();
  const controllerA = new FlightController();
  const controllerB = new FlightController();
  try {
    placeCraft(unbraced, 0, 6);
    placeCraft(braced, 0, 6);
    graphA.sync(unbraced);
    graphB.sync(braced, tether.getDiagnostics(braced));

    unbraced.severConnection("spine-panel");
    graphA.sync(unbraced);
    for (let index = 0; index < 90; index += 1) unbraced.step(controllerA, NEUTRAL_FLIGHT_INPUT);

    assert.equal(tether.attachToComponent(braced, "panel"), true);
    stepTether(braced, tether, controllerB, true, 8, graphB);
    braced.severConnection("spine-panel");
    stepTether(braced, tether, controllerB, true, 90, graphB);

    assert.deepEqual(sortedIds(graphA.getEdges()), sortedIds(unbraced.getConnections()));
    assert.deepEqual(sortedIds(graphB.getEdges()), sortedIds(braced.getConnections()));
    assert.equal(graphA.getSupports().length, 0);
    assert.equal(graphB.getSupports().length, 1);
    assert.equal(graphA.hasEdge("spine-panel"), false);
    assert.equal(graphB.hasEdge("spine-panel"), false);

    const unbracedPanel = unbraced.getWreckComponent("panel").body.translation();
    const unbracedSpine = unbraced.getWreckComponent("spine").body.translation();
    const bracedPanel = braced.getWreckComponent("panel").body.translation();
    const bracedSpine = braced.getWreckComponent("spine").body.translation();
    const unbracedX = unbracedPanel.x - unbracedSpine.x;
    const bracedX = bracedPanel.x - bracedSpine.x;
    assert.ok(unbracedX > bracedX + 0.08, `brace no longer changes motion: unbraced=${unbracedX}, braced=${bracedX}`);
  } finally {
    unbraced.dispose();
    braced.dispose();
  }
});

test("repeated cut tether and reset restores the exact graph without duplicate nodes edges or supports", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const tether = new TetherSystem();
  const controller = new FlightController();
  const baselineNodes = sortedIds(sandbox.getWreckComponents());
  const baselineEdges = sortedIds(sandbox.getConnections());
  try {
    graph.sync(sandbox);
    for (let index = 0; index < 12; index += 1) {
      placeCraft(sandbox, 0, 6);
      sandbox.severConnection("spine-panel");
      tether.attachToComponent(sandbox, "panel");
      stepTether(sandbox, tether, controller, true, 6, graph);
      assert.equal(graph.getEdges().length, 5);
      assert.equal(graph.getSupports().length, 1);

      sandbox.reset();
      tether.reset();
      graph.sync(sandbox, tether.getDiagnostics(sandbox));
      assert.deepEqual(sortedIds(graph.getNodes()), baselineNodes);
      assert.deepEqual(sortedIds(graph.getEdges()), baselineEdges);
      assert.equal(new Set(graph.getNodes().map((node) => node.id)).size, 6);
      assert.equal(new Set(graph.getEdges().map((edge) => edge.id)).size, 6);
      assert.equal(graph.getSupports().length, 0);
      assert.equal(graph.getDiagnostics().spineSectionSize, 6);
    }
  } finally {
    sandbox.dispose();
  }
});
