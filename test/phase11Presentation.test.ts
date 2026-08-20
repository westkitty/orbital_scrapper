// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { ProductionAudio, VACUUM_AUDIO_CHANNELS, derivePresentationAudioMix } from "../src/presentation/ProductionAudio.js";
import { ProductionFx } from "../src/presentation/ProductionFx.js";
import { FlightScenePresenter } from "../src/presentation/FlightScenePresenter.js";
import { ScannerSystem } from "../src/scanner/ScannerSystem.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";
import { TetherSystem } from "../src/tether/TetherSystem.js";

function snapshotPhysics(sandbox) {
  return {
    bodies: sandbox.getBodyRecords().map((record) => {
      const p = record.body.translation(); const q = record.body.rotation();
      return [record.id, p.x, p.y, p.z, q.x, q.y, q.z, q.w];
    }),
    connections: sandbox.getConnections().map((connection) => {
      const point = sandbox.getConnectionWorldPoint(connection.id);
      return [connection.id, point.x, point.y, point.z];
    }),
  };
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
  started = false;
  stopped = false;
  connect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  closed = false;
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOscillator(); }
  async resume() {}
  async close() { this.closed = true; }
}

test("production presenter preserves Rapier transforms and exact component-local attachment coordinates", async () => {
  const sandbox = await WreckSandbox.create({ templateId: "reference" });
  const scene = new THREE.Scene();
  const presenter = new FlightScenePresenter(scene);
  try {
    const before = snapshotPhysics(sandbox);
    presenter.rebuild(sandbox);
    presenter.sync(sandbox);
    const after = snapshotPhysics(sandbox);
    assert.deepEqual(after, before, "presentation rebuild or sync mutated authoritative physics state");
    assert.equal(presenter.getManagedBodyCount(), sandbox.getBodyRecords().length);
    assert.equal(scene.children.filter((child) => child.name === "phase-one-flight-root").length, 1);

    for (const component of sandbox.getWreckComponents()) {
      for (const attachment of component.attachments) {
        assert.deepEqual(
          presenter.getAttachmentMarkerPosition(component.id, attachment.id),
          attachment.localPosition,
          `${component.id}/${attachment.id} presentation hardpoint drifted from physics-local attachment`,
        );
      }
    }
  } finally {
    presenter.dispose();
    sandbox.dispose();
  }
  assert.equal(scene.children.filter((child) => child.name === "phase-one-flight-root").length, 0);
});

test("production presenter covers every Phase 10 component class through the same body ownership path", async () => {
  const expectedKinds = new Set(["spine", "engine", "panel", "rail", "junction", "battery", "sensor", "tank", "reactor"]);
  const seen = new Set();
  for (const templateId of ["reference", "relay-fork", "tank-hauler"]) {
    const sandbox = await WreckSandbox.create({ templateId });
    const scene = new THREE.Scene();
    const presenter = new FlightScenePresenter(scene);
    try {
      presenter.rebuild(sandbox);
      const metrics = presenter.getPresentationMetrics();
      assert.equal(metrics.managedBodies, sandbox.getBodyRecords().length);
      assert.equal(metrics.hasProductionCraft, true);
      assert.ok(metrics.detailMeshes > metrics.managedBodies * 2, `${templateId} remained too close to one-box-per-body greybox presentation`);
      for (const component of sandbox.getWreckComponents()) seen.add(component.componentType);
      for (const component of sandbox.getWreckComponents()) {
        const object = presenter.getManagedObject(component.id);
        assert.equal(object?.userData?.presentationKind, "production-wreck-component");
        assert.equal(object?.userData?.componentType, component.componentType);
      }
    } finally {
      presenter.dispose();
      sandbox.dispose();
    }
  }
  assert.deepEqual([...seen].sort(), [...expectedKinds].sort());
});

test("vacuum-aware audio mix uses conduction instrumentation and severity-driven music rather than exterior-air channels", () => {
  assert.deepEqual(VACUUM_AUDIO_CHANNELS, [
    "ship-hum",
    "thruster-conduction",
    "tether-conduction",
    "cutter-conduction",
    "impact-structure",
    "warning-instrumentation",
    "collapse-music",
  ]);
  assert.equal(VACUUM_AUDIO_CHANNELS.some((channel) => /exterior|air|whoosh|boom/i.test(channel)), false);

  const stable = derivePresentationAudioMix({ severityScore: 0, severityState: "stable", warningCue: "quiet", thrustLevel: 0, tetherLoadRatio: 0, cutterProgress01: 0, cutterActive: false, impactImpulse: 0, hullIntegrity: 100 });
  const danger = derivePresentationAudioMix({ severityScore: 55, severityState: "danger", warningCue: "danger-pulse", thrustLevel: 0.8, tetherLoadRatio: 0.7, cutterProgress01: 0.6, cutterActive: true, impactImpulse: 5, hullIntegrity: 72 });
  const critical = derivePresentationAudioMix({ severityScore: 90, severityState: "critical", warningCue: "critical-alarm", thrustLevel: 0.8, tetherLoadRatio: 0.7, cutterProgress01: 0.6, cutterActive: true, impactImpulse: 5, hullIntegrity: 72 });
  assert.ok(stable.collapseMusic < danger.collapseMusic && danger.collapseMusic < critical.collapseMusic);
  assert.ok(danger.thrusterConduction > stable.thrusterConduction);
  assert.ok(danger.tetherConduction > stable.tetherConduction);
  assert.ok(danger.cutterConduction > stable.cutterConduction);
  assert.ok(danger.impactStructure > stable.impactStructure);
  assert.ok(critical.warningInstrumentation > stable.warningInstrumentation);
});

test("production audio graph is user-enabled disposable presentation state", async () => {
  const context = new FakeAudioContext();
  const audio = new ProductionAudio(() => context);
  assert.equal(audio.getDiagnostics().state, "muted");
  assert.equal(await audio.enable(), true);
  assert.equal(audio.getDiagnostics().state, "ready");
  audio.update({ severityScore: 78, severityState: "critical", warningCue: "critical-alarm", thrustLevel: 0.6, tetherLoadRatio: 0.8, cutterProgress01: 0.4, cutterActive: true, impactImpulse: 4, hullIntegrity: 60 });
  const live = audio.getDiagnostics();
  assert.ok(live.severityGain > 0.1);
  assert.equal(live.channels.length, 7);
  audio.disable();
  assert.equal(audio.getDiagnostics().state, "muted");
  await audio.dispose();
  assert.equal(context.closed, true);
});

test("production VFX communicate live scan cutter tether load and impact without altering topology", async () => {
  const sandbox = await WreckSandbox.create();
  const graph = new StructuralGraph();
  const scanner = new ScannerSystem();
  const tether = new TetherSystem();
  const scene = new THREE.Scene();
  const fx = new ProductionFx(scene);
  try {
    graph.sync(sandbox, tether.getDiagnostics(sandbox));
    const scan = scanner.analyzeConnection(sandbox, graph, "spine-panel");
    assert.ok(scan);
    const cut = { targetId: "spine-panel", state: "cutting", progress01: 0.5, canCut: true };
    const baselineEdges = sandbox.getConnections().map((connection) => connection.id);
    fx.update(sandbox, scan, cut, { state: "idle", targetId: null, loadRatio: 0 }, { lastImpactBodyId: null, lastImpactImpulse: 0 }, 1);
    const scanned = fx.getDiagnostics();
    assert.equal(scanned.scannerVisible, true);
    assert.equal(scanned.cutterVisible, true);
    assert.deepEqual(sandbox.getConnections().map((connection) => connection.id), baselineEdges);

    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    assert.equal(sandbox.getWreckComponent("panel").body.isEnabled(), true);
    const attached = { state: "attached", targetId: "panel", loadRatio: 0.15 };
    fx.update(sandbox, null, { targetId: null }, attached, { lastImpactBodyId: null, lastImpactImpulse: 0 }, 1.1);
    const lightLoad = fx.getDiagnostics();
    assert.equal(lightLoad.tetherVisible, true);
    fx.update(sandbox, null, { targetId: null }, { ...attached, loadRatio: 0.95 }, { lastImpactBodyId: "panel", lastImpactImpulse: 8 }, 1.2);
    const heavyLoad = fx.getDiagnostics();
    assert.equal(heavyLoad.tetherVisible, true);
    assert.notEqual(heavyLoad.tetherColor, lightLoad.tetherColor);
    assert.ok(heavyLoad.sparkCount > 0);
    assert.equal(sandbox.getWreckComponents().length, 6);
    assert.equal(sandbox.getBodyRecords().length, 7);
  } finally {
    fx.dispose();
    sandbox.dispose();
  }
  assert.equal(scene.children.filter((child) => child.name === "phase11-fx-root").length, 0);
});
