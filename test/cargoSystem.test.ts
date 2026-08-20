// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  CARGO_CAPTURE_RADIUS_METERS,
  CARGO_EXTRACTION_DISTANCE_METERS,
  CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND,
  CargoSystem,
} from "../src/cargo/CargoSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "../src/flight/FlightController.js";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { TetherSystem } from "../src/tether/TetherSystem.js";

function placeCraft(sandbox, x, z) {
  const craft = sandbox.getCraftBody();
  craft.setTranslation({ x, y: 0, z }, true);
  craft.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  craft.setLinvel({ x: 0, y: 0, z: 0 }, true);
  craft.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function placePanel(sandbox, x, z, velocity = { x: 0, y: 0, z: 0 }) {
  const panel = sandbox.getWreckComponent("panel").body;
  panel.setTranslation({ x, y: 0, z }, true);
  panel.setLinvel(velocity, true);
  panel.setAngvel({ x: 0, y: 0, z: 0 }, true);
  return panel;
}

test("detached salvage remains an enabled physical body until a valid clamp capture", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  try {
    placeCraft(sandbox, 0, 6);
    assert.equal(sandbox.severConnection("spine-panel").severed, true);
    const panel = sandbox.getWreckComponent("panel").body;
    assert.equal(panel.isEnabled(), true);

    cargo.step(sandbox, null);
    assert.equal(panel.isEnabled(), true);
    assert.equal(cargo.getDiagnostics(sandbox).securedCargoCount, 0);

    placePanel(sandbox, 0, 6 - (CARGO_CAPTURE_RADIUS_METERS - 0.35));
    const captured = cargo.step(sandbox, "panel");
    assert.equal(captured, "panel");
    assert.equal(panel.isEnabled(), false);
    assert.equal(cargo.isSecured("panel"), true);
    assert.equal(cargo.getDiagnostics(sandbox).captureState, "secured");
  } finally {
    sandbox.dispose();
  }
});

test("high relative speed blocks capture until the same salvage is physically slowed", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  try {
    placeCraft(sandbox, 0, 6);
    sandbox.severConnection("spine-panel");
    const panel = placePanel(sandbox, 0, 3.4, { x: 0, y: 0, z: -4 });

    assert.ok(Math.abs(panel.linvel().z) > CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND);
    assert.equal(cargo.step(sandbox, "panel"), null);
    const blocked = cargo.getDiagnostics(sandbox);
    assert.equal(blocked.captureState, "blocked-speed");
    assert.ok(blocked.candidateRelativeSpeed > CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND);
    assert.equal(panel.isEnabled(), true);

    panel.setLinvel({ x: 0, y: 0, z: 0 }, true);
    assert.equal(cargo.step(sandbox, "panel"), "panel");
    assert.equal(panel.isEnabled(), false);
  } finally {
    sandbox.dispose();
  }
});

test("real pre-capture impact damage lowers cargo condition and adjusted value", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    sandbox.severConnection("spine-panel");
    const panel = placePanel(sandbox, 0, 2.8, { x: 0, y: 0, z: 10 });

    let damaged = false;
    for (let index = 0; index < 45; index += 1) {
      sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
      cargo.step(sandbox, null);
      if (cargo.getCondition("panel") < 100) {
        damaged = true;
        break;
      }
    }
    assert.equal(damaged, true, "panel never received measured collision damage");
    assert.ok(cargo.getCondition("panel") < 100);

    placePanel(sandbox, 0, 3.4);
    assert.equal(cargo.step(sandbox, "panel"), "panel");
    const secured = cargo.getSecuredCargo()[0];
    assert.ok(secured.condition < 100);
    assert.ok(secured.adjustedValueUnits < secured.baseValueUnits);
    assert.equal(panel.isEnabled(), false);
  } finally {
    sandbox.dispose();
  }
});

test("careful recovery pays more than otherwise identical impact-damaged salvage", async () => {
  const careful = await WreckSandbox.create();
  const damaged = await WreckSandbox.create();
  const carefulCargo = new CargoSystem();
  const damagedCargo = new CargoSystem();
  const controller = new FlightController();
  try {
    placeCraft(careful, 0, 6);
    placeCraft(damaged, 0, 6);
    careful.severConnection("spine-panel");
    damaged.severConnection("spine-panel");

    placePanel(careful, 0, 3.4);
    assert.equal(carefulCargo.step(careful, "panel"), "panel");

    placePanel(damaged, 0, 2.8, { x: 0, y: 0, z: 10 });
    for (let index = 0; index < 45 && damagedCargo.getCondition("panel") === 100; index += 1) {
      damaged.step(controller, NEUTRAL_FLIGHT_INPUT);
      damagedCargo.step(damaged, null);
    }
    assert.ok(damagedCargo.getCondition("panel") < 100);
    placePanel(damaged, 0, 3.4);
    assert.equal(damagedCargo.step(damaged, "panel"), "panel");

    placeCraft(careful, 0, CARGO_EXTRACTION_DISTANCE_METERS + 3);
    placeCraft(damaged, 0, CARGO_EXTRACTION_DISTANCE_METERS + 3);
    carefulCargo.step(careful, null);
    damagedCargo.step(damaged, null);

    const carefulDiagnostics = carefulCargo.getDiagnostics(careful);
    const damagedDiagnostics = damagedCargo.getDiagnostics(damaged);
    assert.equal(carefulDiagnostics.settlementState, "settled");
    assert.equal(damagedDiagnostics.settlementState, "settled");
    assert.equal(carefulDiagnostics.payoutUnits, 250);
    assert.ok(damagedDiagnostics.payoutUnits < carefulDiagnostics.payoutUnits,
      `damaged payout did not fall: careful=${carefulDiagnostics.payoutUnits}, damaged=${damagedDiagnostics.payoutUnits}`);
  } finally {
    careful.dispose();
    damaged.dispose();
  }
});

test("secured cargo stays disabled and settlement waits for physical extraction distance", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    sandbox.severConnection("spine-panel");
    const panel = placePanel(sandbox, 0, 3.4);
    assert.equal(cargo.step(sandbox, "panel"), "panel");
    assert.equal(cargo.getDiagnostics(sandbox).settlementState, "returning");
    assert.equal(panel.isEnabled(), false);

    const securedPosition = panel.translation();
    for (let index = 0; index < 60; index += 1) sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
    assert.equal(panel.isEnabled(), false);
    assert.deepEqual(panel.translation(), securedPosition);
    assert.equal(cargo.getDiagnostics(sandbox).settlementState, "returning");

    placeCraft(sandbox, 0, CARGO_EXTRACTION_DISTANCE_METERS + 3);
    cargo.step(sandbox, null);
    const settled = cargo.getDiagnostics(sandbox);
    assert.equal(settled.settlementState, "settled");
    assert.equal(settled.payoutUnits, 250);
    assert.deepEqual(settled.securedCargoIds, ["panel"]);
  } finally {
    sandbox.dispose();
  }
});

test("existing tether can physically recover a detached panel into the cargo clamp", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  const tether = new TetherSystem();
  const controller = new FlightController();
  try {
    placeCraft(sandbox, 0, 6);
    sandbox.severConnection("spine-panel");
    assert.equal(tether.attachToComponent(sandbox, "panel"), true);
    const panel = sandbox.getWreckComponent("panel").body;
    let captured = null;

    for (let index = 0; index < 360; index += 1) {
      tether.step(sandbox, true);
      sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
      const tetherDiagnostics = tether.getDiagnostics(sandbox);
      captured = cargo.step(sandbox, tetherDiagnostics.targetId);
      if (captured) {
        tether.reset();
        break;
      }
    }

    assert.equal(captured, "panel");
    assert.equal(panel.isEnabled(), false);
    assert.equal(cargo.getDiagnostics(sandbox).securedCargoCount, 1);
    assert.equal(tether.getDiagnostics(sandbox).state, "idle");
  } finally {
    sandbox.dispose();
  }
});

test("cargo reset restores exact loose enabled baseline without settlement leakage", async () => {
  const sandbox = await WreckSandbox.create();
  const cargo = new CargoSystem();
  try {
    const baselineConnectionIds = sandbox.getConnections().map((connection) => connection.id).sort();
    for (let index = 0; index < 8; index += 1) {
      placeCraft(sandbox, 0, 6);
      sandbox.severConnection("spine-panel");
      placePanel(sandbox, 0, 3.4);
      assert.equal(cargo.step(sandbox, "panel"), "panel");
      assert.equal(sandbox.getWreckComponent("panel").body.isEnabled(), false);

      sandbox.reset();
      cargo.reset();
      assert.equal(sandbox.getWreckComponent("panel").body.isEnabled(), true);
      assert.equal(cargo.getCondition("panel"), 100);
      assert.equal(cargo.getDiagnostics(sandbox).securedCargoCount, 0);
      assert.equal(cargo.getDiagnostics(sandbox).settlementState, "field");
      assert.deepEqual(sandbox.getConnections().map((connection) => connection.id).sort(), baselineConnectionIds);
      assert.equal(sandbox.getWreckComponents().length, 6);
      assert.equal(sandbox.getBodyRecords().length, 7);
    }
  } finally {
    sandbox.dispose();
  }
});
