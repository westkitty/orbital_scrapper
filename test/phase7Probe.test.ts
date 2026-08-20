// @ts-nocheck
import test from "node:test";
import { CollapseSystem } from "../src/collapse/CollapseSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { StructuralGraph } from "../src/structure/StructuralGraph.js";

test("phase7 stationary diagnostic probe", async () => {
  const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
  const controller = new FlightController();
  const graph = new StructuralGraph();
  const collapse = new CollapseSystem();
  try {
    graph.sync(sandbox);
    sandbox.severConnection("spine-engine");
    graph.sync(sandbox);
    let maximumSeverity = 0;
    const directions = new Set();
    const cues = new Set();
    let sawImpactDamage = false;
    for (let index = 0; index < 360; index += 1) {
      sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
      graph.sync(sandbox);
      collapse.step(sandbox, graph);
      graph.sync(sandbox);
      const diagnostics = collapse.getDiagnostics();
      maximumSeverity = Math.max(maximumSeverity, diagnostics.severityScore);
      directions.add(diagnostics.warningDirection);
      cues.add(diagnostics.warningCue);
      if (diagnostics.lastImpactDamage > 0) sawImpactDamage = true;
      if (diagnostics.destroyed) break;
    }
    console.log("PHASE7_PROBE", JSON.stringify({
      maximumSeverity,
      directions: [...directions],
      cues: [...cues],
      sawImpactDamage,
      final: collapse.getDiagnostics(),
    }));
  } finally {
    sandbox.dispose();
  }
});
