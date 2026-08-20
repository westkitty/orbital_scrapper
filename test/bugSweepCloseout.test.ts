// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CollapseSystem } from "../src/collapse/CollapseSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { ProductionFx } from "../src/presentation/ProductionFx.js";
import { ProgressionSystem } from "../src/progression/ProgressionSystem.js";
import { applyRunCapabilities, resolveRunCapabilities } from "../src/runtime/RunCapabilities.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

function syncGraph(graph, sandbox) {
  graph.sync(sandbox);
}

test("fresh-run capability resolution applies all three persisted handling upgrades", () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const runId = progression.beginRun();
  assert.equal(progression.recordSettlement(runId, 600), true);
  assert.equal(progression.purchaseClampDampers().purchased, true);
  assert.equal(progression.purchaseTetherReinforcement().purchased, true);
  assert.equal(progression.purchaseCutterOptics().purchased, true);

  const reloaded = new ProgressionSystem(storage);
  const capabilities = resolveRunCapabilities(reloaded);
  assert.deepEqual(capabilities, {
    captureSpeedLimit: 2,
    cutterRangeMeters: 12,
    tetherMaxTensionNewtons: 105,
  });

  const applied = {};
  applyRunCapabilities(
    capabilities,
    { setMaxCaptureRelativeSpeed(value) { applied.captureSpeedLimit = value; } },
    { setRangeMeters(value) { applied.cutterRangeMeters = value; } },
    { setMaxTensionNewtons(value) { applied.tetherMaxTensionNewtons = value; } },
  );
  assert.deepEqual(applied, capabilities);
});

test("live impact telemetry clears on the first physics step without a craft impact", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    syncGraph(graph, sandbox);
    assert.equal(sandbox.severConnection("spine-engine").severed, true);
    syncGraph(graph, sandbox);

    let impact = null;
    for (let index = 0; index < 360; index += 1) {
      sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
      syncGraph(graph, sandbox);
      collapse.step(sandbox, graph);
      const diagnostics = collapse.getDiagnostics();
      if (diagnostics.lastImpactImpulse > 0) {
        impact = diagnostics;
        break;
      }
    }
    assert.ok(impact, "danger fixture never produced a physical craft impact");
    assert.ok(impact.lastImpactImpulse > 0);

    const craft = sandbox.getCraftBody();
    craft.setTranslation({ x: 40, y: 0, z: 40 }, true);
    craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
    craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
    syncGraph(graph, sandbox);
    collapse.step(sandbox, graph);

    const cleared = collapse.getDiagnostics();
    assert.equal(cleared.lastImpactBodyId, null);
    assert.equal(cleared.lastImpactForceNewtons, 0);
    assert.equal(cleared.lastImpactImpulse, 0);
    assert.equal(cleared.lastImpactDamage, 0);
  } finally {
    sandbox.dispose();
  }
});

test("separate identical impacts can each reuse the bounded VFX spark pool", async () => {
  const sandbox = await WreckSandbox.create();
  const scene = new THREE.Scene();
  const fx = new ProductionFx(scene);
  const idleTether = { state: "idle", targetId: null, loadRatio: 0 };
  const idleCut = { targetId: null };
  try {
    fx.update(sandbox, null, idleCut, idleTether, { lastImpactBodyId: "panel", lastImpactImpulse: 8 }, 1);
    assert.equal(fx.getDiagnostics().sparkCount, 14);

    for (let index = 1; index <= 30; index += 1) {
      fx.update(sandbox, null, idleCut, idleTether, { lastImpactBodyId: null, lastImpactImpulse: 0 }, 1 + index * 0.05);
    }
    assert.equal(fx.getDiagnostics().sparkCount, 0);

    fx.update(sandbox, null, idleCut, idleTether, { lastImpactBodyId: "panel", lastImpactImpulse: 8 }, 2.55);
    assert.equal(fx.getDiagnostics().sparkCount, 14, "second identical impact was suppressed by stale signature state");
  } finally {
    fx.dispose();
    sandbox.dispose();
  }
});
