// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { CargoSystem } from "../src/cargo/CargoSystem.js";
import { CollapseSystem } from "../src/collapse/CollapseSystem.js";
import { CUTTER_DURATION_SECONDS, CUTTER_RANGE_METERS, CuttingSystem } from "../src/cutting/CuttingSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { CUTTER_OPTICS_RANGE_METERS, ProgressionSystem, TETHER_REINFORCEMENT_MAX_TENSION_NEWTONS } from "../src/progression/ProgressionSystem.js";
import { ScannerSystem } from "../src/scanner/ScannerSystem.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";
import { TETHER_MAX_TENSION_NEWTONS, TetherSystem } from "../src/tether/TetherSystem.js";
import { WRECK_TEMPLATES } from "../src/wreck/WreckCatalog.js";

class MemoryStorage { values = new Map(); getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, value); } }
function placeCraftAtConnection(sandbox, connectionId, distance) {
  const point = sandbox.getConnectionWorldPoint(connectionId); const craft = sandbox.getCraftBody();
  craft.setTranslation({ x: point.x, y: point.y, z: point.z + distance }, true); craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true); craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
function placeComponentAtCraftClamp(sandbox, componentId) {
  const craftPosition = sandbox.getCraftBody().translation(); const component = sandbox.getWreckComponent(componentId).body;
  component.setTranslation({ x: craftPosition.x, y: craftPosition.y, z: craftPosition.z - 2.4 }, true); component.setLinvel({ x: 0, y: 0, z: 0 }, true); component.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
function syncGraph(graph, sandbox, tether = null) { graph.sync(sandbox, tether?.getDiagnostics(sandbox)); }

test("Phase 10 catalog exposes three reusable wreck templates with distinct mass value fragility and bounded variants", () => {
  assert.deepEqual(WRECK_TEMPLATES.map((template) => template.id), ["reference", "relay-fork", "tank-hauler"]);
  const relay = WRECK_TEMPLATES.find((template) => template.id === "relay-fork"); const hauler = WRECK_TEMPLATES.find((template) => template.id === "tank-hauler"); assert.ok(relay && hauler);
  const sensor = relay.components.find((component) => component.id === "sensor-wing"); const battery = relay.components.find((component) => component.id === "battery"); const tank = hauler.components.find((component) => component.id === "tank"); const reactor = hauler.components.find((component) => component.id === "reactor"); assert.ok(sensor && battery && tank && reactor);
  assert.equal(sensor.massClass, "light"); assert.equal(sensor.salvageValueUnits, 1100); assert.equal(sensor.cargoFragilityMultiplier, 2.2); assert.equal(battery.massClass, "medium");
  assert.equal(tank.massClass, "heavy"); assert.equal(tank.salvageValueUnits, 700); assert.equal(tank.cargoFragilityMultiplier, 0.65); assert.equal(reactor.salvageValueUnits, 1800);
  assert.ok(reactor.salvageValueUnits > tank.salvageValueUnits); assert.ok(sensor.cargoFragilityMultiplier > tank.cargoFragilityMultiplier);
  assert.deepEqual(relay.variants.map((variant) => variant.id), ["intact", "missing-right-rail"]); assert.deepEqual(hauler.variants.map((variant) => variant.id), ["intact", "missing-sensor"]);
});

test("reference template remains the exact Phase 9 six-component six-connection baseline", async () => {
  const sandbox = await WreckSandbox.create({ templateId: "reference" });
  try {
    assert.equal(sandbox.getTemplateId(), "reference"); assert.equal(sandbox.getVariantId(), "intact");
    assert.deepEqual(sandbox.getWreckComponents().map((component) => component.id), ["spine", "engine", "panel", "left-rail", "right-rail", "rear-node"]);
    assert.deepEqual(sandbox.getConnections().map((connection) => connection.id), ["spine-engine", "spine-panel", "spine-left-rail", "left-rail-rear", "spine-right-rail", "right-rail-rear"]);
    assert.equal(sandbox.getWreckComponent("panel").salvageValueUnits, 250); assert.equal(sandbox.getWreckComponent("engine").salvageValueUnits, 1200); assert.equal(sandbox.getWreckComponent("panel").cargoFragilityMultiplier, 1); assert.equal(sandbox.getBodyRecords().length, 7);
  } finally { sandbox.dispose(); }
});

test("every intact template remains coherent and resets to the same data-driven component and connection set", async () => {
  const controller = new FlightController();
  for (const template of WRECK_TEMPLATES) {
    const sandbox = await WreckSandbox.create({ templateId: template.id });
    try {
      const componentIds = sandbox.getWreckComponents().map((component) => component.id).sort(); const connectionIds = sandbox.getConnections().map((connection) => connection.id).sort();
      for (let index = 0; index < 180; index += 1) sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
      assert.equal(sandbox.getWreckComponents().length, template.components.length, `${template.id} lost a component while intact`); assert.equal(sandbox.getConnections().length, template.connections.length, `${template.id} lost a joint while intact`); assert.ok(sandbox.getMaxConnectionError() < 0.08, `${template.id} connection error drifted to ${sandbox.getMaxConnectionError()}`);
      sandbox.reset(); assert.deepEqual(sandbox.getWreckComponents().map((component) => component.id).sort(), componentIds); assert.deepEqual(sandbox.getConnections().map((connection) => connection.id).sort(), connectionIds); assert.equal(sandbox.getBodyRecords().length, template.components.length + 1);
    } finally { sandbox.dispose(); }
  }
});

test("existing scanner cutter tether cargo and collapse systems operate on every new cuttable module without template-specific tool code", async () => {
  for (const template of WRECK_TEMPLATES) {
    for (const cutDefinition of template.connections.filter((connection) => connection.cuttable)) {
      const sandbox = await WreckSandbox.create({ templateId: template.id }); const graph = new StructuralGraph(); const scanner = new ScannerSystem(); const cutter = new CuttingSystem(); const tether = new TetherSystem(); const cargo = new CargoSystem(); const collapse = new CollapseSystem();
      try {
        syncGraph(graph, sandbox, tether); const estimate = scanner.analyzeConnection(sandbox, graph, cutDefinition.id, tether.getDiagnostics(sandbox)); assert.ok(estimate, `${template.id}/${cutDefinition.id} scanner could not inspect live connection`); assert.ok(estimate.placeholderValueUnits > 0); assert.equal(estimate.cargoFragilityMultiplier, sandbox.getWreckComponent(estimate.displayComponentId).cargoFragilityMultiplier);
        placeCraftAtConnection(sandbox, cutDefinition.id, 6); const steps = Math.ceil(CUTTER_DURATION_SECONDS / (1 / 60)) + 2; for (let index = 0; index < steps; index += 1) cutter.step(sandbox, true);
        const cut = cutter.getDiagnostics(sandbox); assert.equal(cut.state, "complete", `${template.id}/${cutDefinition.id} cutter did not complete`); assert.equal(cut.lastCompletedConnectionId, cutDefinition.id); assert.equal(sandbox.hasConnection(cutDefinition.id), false); assert.equal(sandbox.getWreckComponent(cutDefinition.componentBId).body.isEnabled(), true);
        syncGraph(graph, sandbox, tether); collapse.step(sandbox, graph); assert.equal(graph.hasEdge(cutDefinition.id), false);
        assert.equal(tether.attachToComponent(sandbox, cutDefinition.componentBId), true, `${template.id}/${cutDefinition.id} detached salvage was not tether-compatible`); placeComponentAtCraftClamp(sandbox, cutDefinition.componentBId); assert.equal(cargo.step(sandbox, cutDefinition.componentBId), cutDefinition.componentBId, `${template.id}/${cutDefinition.id} detached salvage was not cargo-compatible`); assert.equal(sandbox.getWreckComponent(cutDefinition.componentBId).body.isEnabled(), false);
      } finally { sandbox.dispose(); }
    }
  }
});

test("missing-section variants change topology and decisions without bespoke simulation branches", async () => {
  const intactRelay = await WreckSandbox.create({ templateId: "relay-fork", variantId: "intact" }); const strippedRelay = await WreckSandbox.create({ templateId: "relay-fork", variantId: "missing-right-rail" }); const strippedHauler = await WreckSandbox.create({ templateId: "tank-hauler", variantId: "missing-sensor" }); const intactGraph = new StructuralGraph(); const strippedGraph = new StructuralGraph();
  try {
    syncGraph(intactGraph, intactRelay); syncGraph(strippedGraph, strippedRelay); assert.equal(intactGraph.isBridge("left-rail-rear"), false); assert.equal(strippedGraph.isBridge("left-rail-rear"), true); assert.equal(strippedRelay.getWreckComponents().some((component) => component.id === "right-rail"), false); assert.equal(strippedRelay.getConnections().some((connection) => connection.componentAId === "right-rail" || connection.componentBId === "right-rail"), false);
    assert.equal(strippedHauler.getWreckComponents().some((component) => component.id === "sensor-pod"), false); assert.equal(strippedHauler.hasConnection("tail-sensor"), false); assert.equal(strippedHauler.getWreckComponents().length, 5); assert.equal(strippedHauler.getConnections().length, 4);
    strippedRelay.reset(); assert.equal(strippedRelay.getVariantId(), "missing-right-rail"); assert.equal(strippedRelay.getWreckComponents().some((component) => component.id === "right-rail"), false);
  } finally { intactRelay.dispose(); strippedRelay.dispose(); strippedHauler.dispose(); }
});

test("new layouts expose different risk value and fragility decisions through the same scanner", async () => {
  const relay = await WreckSandbox.create({ templateId: "relay-fork" }); const hauler = await WreckSandbox.create({ templateId: "tank-hauler" }); const scanner = new ScannerSystem(); const relayGraph = new StructuralGraph(); const haulerGraph = new StructuralGraph();
  try {
    syncGraph(relayGraph, relay); syncGraph(haulerGraph, hauler); const sensor = scanner.analyzeConnection(relay, relayGraph, "spine-sensor"); const battery = scanner.analyzeConnection(relay, relayGraph, "spine-battery"); const reactor = scanner.analyzeConnection(hauler, haulerGraph, "spine-reactor"); const tank = scanner.analyzeConnection(hauler, haulerGraph, "spine-tank"); assert.ok(sensor && battery && reactor && tank);
    assert.equal(sensor.placeholderValueUnits, 1100); assert.equal(sensor.cargoFragilityMultiplier, 2.2); assert.equal(sensor.riskLevel, "moderate"); assert.equal(battery.placeholderValueUnits, 950); assert.ok(battery.riskScore > sensor.riskScore);
    assert.equal(reactor.placeholderValueUnits, 1800); assert.equal(tank.placeholderValueUnits, 700); assert.ok(reactor.riskScore >= tank.riskScore); assert.ok(reactor.placeholderValueUnits > tank.placeholderValueUnits); assert.ok(reactor.cargoFragilityMultiplier > tank.cargoFragilityMultiplier);
  } finally { relay.dispose(); hauler.dispose(); }
});

test("Tether Reinforcement changes the same overload outcome while preserving bounded force", async () => {
  const storage = new MemoryStorage(); const progression = new ProgressionSystem(storage); const run = progression.beginRun(); progression.recordSettlement(run, 500); assert.equal(progression.purchaseTetherReinforcement().purchased, true); const persisted = new ProgressionSystem(storage);
  const baseSandbox = await WreckSandbox.create(); const upgradedSandbox = await WreckSandbox.create(); const baseTether = new TetherSystem(); const upgradedTether = new TetherSystem({ maxTensionNewtons: persisted.getTetherMaxTension(TETHER_MAX_TENSION_NEWTONS) });
  try {
    for (const sandbox of [baseSandbox, upgradedSandbox]) { const craft = sandbox.getCraftBody(); craft.setTranslation({ x: 0, y: 0, z: 10 }, true); craft.setLinvel({ x: 0, y: 0, z: 0 }, true); assert.equal(sandbox.severConnection("spine-panel").severed, true); }
    assert.equal(baseTether.attachToComponent(baseSandbox, "panel"), true); assert.equal(upgradedTether.attachToComponent(upgradedSandbox, "panel"), true); for (let index = 0; index < 175; index += 1) { baseTether.step(baseSandbox, true); upgradedTether.step(upgradedSandbox, true); }
    assert.equal(baseTether.getDiagnostics(baseSandbox).state, "snapped"); const upgraded = upgradedTether.getDiagnostics(upgradedSandbox); assert.equal(upgraded.state, "attached"); assert.equal(upgraded.maxTensionNewtons, TETHER_REINFORCEMENT_MAX_TENSION_NEWTONS); assert.ok(upgraded.tensionNewtons > TETHER_MAX_TENSION_NEWTONS); assert.ok(upgraded.tensionNewtons < TETHER_REINFORCEMENT_MAX_TENSION_NEWTONS);
  } finally { baseSandbox.dispose(); upgradedSandbox.dispose(); }
});

test("Cutter Optics changes the same out-of-range cut into a valid physical joint removal", async () => {
  const storage = new MemoryStorage(); const progression = new ProgressionSystem(storage); const run = progression.beginRun(); progression.recordSettlement(run, 500); assert.equal(progression.purchaseCutterOptics().purchased, true); const persisted = new ProgressionSystem(storage);
  const baseSandbox = await WreckSandbox.create(); const upgradedSandbox = await WreckSandbox.create(); const baseCutter = new CuttingSystem(); const upgradedCutter = new CuttingSystem({ rangeMeters: persisted.getCutterRange(CUTTER_RANGE_METERS) });
  try {
    placeCraftAtConnection(baseSandbox, "spine-panel", 10.5); placeCraftAtConnection(upgradedSandbox, "spine-panel", 10.5); baseCutter.step(baseSandbox, true); const blocked = baseCutter.getDiagnostics(baseSandbox); assert.equal(blocked.targetId, "spine-panel"); assert.equal(blocked.state, "blocked"); assert.equal(baseSandbox.hasConnection("spine-panel"), true);
    const steps = Math.ceil(CUTTER_DURATION_SECONDS / (1 / 60)) + 2; for (let index = 0; index < steps; index += 1) upgradedCutter.step(upgradedSandbox, true); const completed = upgradedCutter.getDiagnostics(upgradedSandbox); assert.equal(completed.rangeMeters, CUTTER_OPTICS_RANGE_METERS); assert.equal(completed.state, "complete"); assert.equal(completed.lastCompletedConnectionId, "spine-panel"); assert.equal(upgradedSandbox.hasConnection("spine-panel"), false); assert.equal(upgradedSandbox.getWreckComponent("panel").body.isEnabled(), true);
  } finally { baseSandbox.dispose(); upgradedSandbox.dispose(); }
});

test("Phase 10 progression offers three capability choices rather than payout multipliers", () => {
  const storage = new MemoryStorage(); const progression = new ProgressionSystem(storage); const run = progression.beginRun(); progression.recordSettlement(run, 600);
  assert.equal(progression.purchaseClampDampers().purchased, true); assert.equal(progression.purchaseTetherReinforcement().purchased, true); assert.equal(progression.purchaseCutterOptics().purchased, true);
  const diagnostics = progression.getDiagnostics(); assert.deepEqual(diagnostics.upgrades, { clampDampers: true, tetherReinforcement: true, cutterOptics: true }); assert.equal(progression.getCaptureSpeedLimit(1.35), 2); assert.equal(progression.getTetherMaxTension(TETHER_MAX_TENSION_NEWTONS), 105); assert.equal(progression.getCutterRange(CUTTER_RANGE_METERS), 12); assert.equal(diagnostics.credits, 150);
});

test("Phase 9 version-one saves migrate in place while new upgrade fields default safely", () => {
  const storage = new MemoryStorage(); storage.setItem("orbital-scrapper-progression-v1", JSON.stringify({ version: 1, credits: 314, upgrades: { clampDampers: true }, nextRunId: 8, completedRuns: 4, failedRuns: 2, lastSettledRunId: 6, lastFailedRunId: 7 }));
  const progression = new ProgressionSystem(storage); const diagnostics = progression.getDiagnostics(); assert.equal(diagnostics.loadState, "migrated"); assert.equal(diagnostics.version, 2); assert.equal(diagnostics.credits, 314); assert.equal(diagnostics.nextRunId, 8); assert.equal(diagnostics.upgrades.clampDampers, true); assert.equal(diagnostics.upgrades.tetherReinforcement, false); assert.equal(diagnostics.upgrades.cutterOptics, false); const persisted = JSON.parse(storage.getItem("orbital-scrapper-progression-v1")); assert.equal(persisted.version, 2); assert.equal(persisted.credits, 314);
});
