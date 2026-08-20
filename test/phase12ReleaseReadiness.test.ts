// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CargoSystem } from "../src/cargo/CargoSystem.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { ProductionAudio } from "../src/presentation/ProductionAudio.js";
import { ProductionFx } from "../src/presentation/ProductionFx.js";
import {
  PROGRESSION_BACKUP_KEY,
  PROGRESSION_SAVE_KEY,
  ProgressionSystem,
} from "../src/progression/ProgressionSystem.js";
import {
  RELEASE_ACTIVE_RIGID_BODY_BUDGET,
  RELEASE_PRODUCTION_SPARK_BUDGET,
  assertReleaseBodyBudget,
  getSimulationBudgetDiagnostics,
} from "../src/runtime/SimulationBudget.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

class FakeAudioParam {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; }
}
class FakeGain {
  gain = new FakeAudioParam();
  connect() {}
}
class FakeOscillator {
  frequency = { value: 0 };
  type = "sine";
  stopped = false;
  connect() {}
  start() {}
  stop() { this.stopped = true; }
}
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  closed = false;
  resumeCalls = 0;
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOscillator(); }
  async resume() { this.resumeCalls += 1; }
  async close() { this.closed = true; }
}

const RELEASE_WRECK_CONFIGURATIONS = [
  ["reference", "intact"],
  ["relay-fork", "intact"],
  ["relay-fork", "missing-right-rail"],
  ["tank-hauler", "intact"],
  ["tank-hauler", "missing-sensor"],
];

test("every shipped wreck configuration stays inside the declared release body budget and supports sleeping", async () => {
  assert.equal(RELEASE_ACTIVE_RIGID_BODY_BUDGET, 24);
  for (const [templateId, variantId] of RELEASE_WRECK_CONFIGURATIONS) {
    const sandbox = await WreckSandbox.create({ templateId, variantId });
    try {
      assert.doesNotThrow(() => assertReleaseBodyBudget(sandbox), `${templateId}/${variantId} exceeded the release body budget`);
      const diagnostics = getSimulationBudgetDiagnostics(sandbox);
      assert.ok(diagnostics.enabledBodies <= RELEASE_ACTIVE_RIGID_BODY_BUDGET);
      const component = sandbox.getWreckComponents()[0];
      component.body.sleep();
      assert.equal(component.body.isSleeping(), true, `${templateId}/${variantId} could not enter Rapier sleep`);
      component.body.wakeUp();
      assert.equal(component.body.isSleeping(), false, `${templateId}/${variantId} could not reactivate from sleep`);
    } finally {
      sandbox.dispose();
    }
  }
});

test("secured cargo leaves expensive active physics while preserving the stable body record", async () => {
  const sandbox = await WreckSandbox.create({ templateId: "reference" });
  const cargo = new CargoSystem();
  try {
    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    const craft = sandbox.getCraftBody();
    const panel = sandbox.getWreckComponent("panel").body;
    const craftPosition = craft.translation();
    panel.setTranslation({ x: craftPosition.x + 1, y: craftPosition.y, z: craftPosition.z }, true);
    panel.setLinvel({ x: 0, y: 0, z: 0 }, true);
    craft.setLinvel({ x: 0, y: 0, z: 0 }, true);

    assert.equal(cargo.step(sandbox, "panel"), "panel");
    const budget = getSimulationBudgetDiagnostics(sandbox, cargo);
    assert.equal(budget.bodyRecords, 7, "capture deleted the stable body record instead of deactivating it");
    assert.equal(budget.disabledBodies, 1);
    assert.equal(budget.securedCargoBodies, 1);
    assert.equal(panel.isEnabled(), false);
    assert.equal(budget.withinActiveBodyBudget, true);
  } finally {
    sandbox.dispose();
  }
});

test("impact presentation uses a fixed reusable spark pool rather than unbounded debris allocation", async () => {
  assert.equal(RELEASE_PRODUCTION_SPARK_BUDGET, 14);
  const sandbox = await WreckSandbox.create({ templateId: "reference" });
  const scene = new THREE.Scene();
  const fx = new ProductionFx(scene);
  try {
    fx.update(sandbox, null, { targetId: null }, { state: "idle", targetId: null, loadRatio: 0 }, { lastImpactBodyId: "panel", lastImpactImpulse: 8 }, 1);
    assert.equal(fx.getDiagnostics().sparkCount, RELEASE_PRODUCTION_SPARK_BUDGET);
    let maximum = fx.getDiagnostics().sparkCount;
    for (let index = 1; index <= 40; index += 1) {
      fx.update(sandbox, null, { targetId: null }, { state: "idle", targetId: null, loadRatio: 0 }, { lastImpactBodyId: "panel", lastImpactImpulse: 8 }, 1 + index * 0.05);
      maximum = Math.max(maximum, fx.getDiagnostics().sparkCount);
    }
    assert.equal(maximum, RELEASE_PRODUCTION_SPARK_BUDGET);
    assert.equal(fx.getDiagnostics().sparkCount, 0, "pooled impact debris did not age back to the idle budget");
  } finally {
    fx.dispose();
    sandbox.dispose();
  }
});

test("mute and re-enable reuse exactly one Web Audio context and seven production nodes", async () => {
  const context = new FakeAudioContext();
  let factoryCalls = 0;
  const audio = new ProductionAudio(() => { factoryCalls += 1; return context; });
  assert.equal(await audio.enable(), true);
  assert.equal(audio.getDiagnostics().nodeCount, 7);
  assert.equal(audio.getDiagnostics().contextCount, 1);
  audio.disable();
  assert.equal(await audio.enable(), true);
  audio.disable();
  assert.equal(await audio.enable(), true);
  const diagnostics = audio.getDiagnostics();
  assert.equal(factoryCalls, 1);
  assert.equal(diagnostics.contextCount, 1);
  assert.equal(diagnostics.nodeCount, 7);
  assert.ok(context.resumeCalls >= 3);
  await audio.dispose();
  assert.equal(context.closed, true);
  assert.equal(audio.getDiagnostics().nodeCount, 0);
});

test("last-known-good progression copy restores a corrupt primary without duplicating or losing progression", () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const firstRun = progression.beginRun();
  assert.equal(progression.recordSettlement(firstRun, 250), true);
  assert.equal(progression.purchaseClampDampers().purchased, true);

  const primary = storage.getItem(PROGRESSION_SAVE_KEY);
  const backup = storage.getItem(PROGRESSION_BACKUP_KEY);
  assert.ok(primary);
  assert.equal(backup, primary, "backup was not synchronized with the latest committed progression state");

  storage.setItem(PROGRESSION_SAVE_KEY, "{corrupt-primary");
  const recovered = new ProgressionSystem(storage);
  const diagnostics = recovered.getDiagnostics();
  assert.equal(diagnostics.loadState, "recovered-backup");
  assert.equal(diagnostics.credits, 100);
  assert.equal(diagnostics.completedRuns, 1);
  assert.equal(diagnostics.failedRuns, 0);
  assert.equal(diagnostics.upgrades.clampDampers, true);
  assert.equal(storage.getItem(PROGRESSION_SAVE_KEY), storage.getItem(PROGRESSION_BACKUP_KEY), "recovery did not heal both copies");

  const secondRun = recovered.beginRun();
  assert.equal(secondRun, 2);
  assert.equal(recovered.recordSettlement(firstRun, 999), false, "backup recovery reopened a stale settled run");
  const reloaded = new ProgressionSystem(storage).getDiagnostics();
  assert.equal(reloaded.completedRuns, 1);
  assert.equal(reloaded.credits, 100);
  assert.equal(reloaded.nextRunId, 3);
});
