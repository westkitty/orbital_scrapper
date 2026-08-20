// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAMP_DAMPERS_COST_UNITS,
  CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND,
  ProgressionSystem,
} from "../src/progression/ProgressionSystem.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("settlement credit, one upgrade purchase, and next-run capability persist across reload", () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const firstRun = progression.beginRun();

  assert.equal(progression.recordSettlement(firstRun, 250), true);
  assert.equal(progression.recordSettlement(firstRun, 250), false, "same settlement credited twice");
  assert.equal(progression.getDiagnostics().credits, 250);

  const purchase = progression.purchaseClampDampers();
  assert.equal(purchase.purchased, true);
  assert.equal(purchase.reason, "purchased");
  assert.equal(purchase.credits, 250 - CLAMP_DAMPERS_COST_UNITS);

  const reloaded = new ProgressionSystem(storage);
  assert.equal(reloaded.getDiagnostics().loadState, "loaded");
  assert.equal(reloaded.hasClampDampers(), true);
  assert.equal(reloaded.getDiagnostics().credits, 250 - CLAMP_DAMPERS_COST_UNITS);
  assert.equal(reloaded.getCaptureSpeedLimit(1.35), CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND);
  const secondRun = reloaded.beginRun();
  assert.equal(secondRun, firstRun + 1);
  assert.equal(reloaded.recordSettlement(firstRun, 250), false, "stale first run replay credited after a newer run began");
  assert.equal(reloaded.recordFailure(firstRun), false, "stale first run replay recorded failure after a newer run began");
});

test("failed run accounting is idempotent and preserves earned progression", () => {
  const storage = new MemoryStorage();
  const progression = new ProgressionSystem(storage);
  const settledRun = progression.beginRun();
  progression.recordSettlement(settledRun, 250);
  progression.purchaseClampDampers();
  const creditsBeforeFailure = progression.getDiagnostics().credits;
  const failedRun = progression.beginRun();

  assert.equal(progression.recordFailure(failedRun), true);
  assert.equal(progression.recordFailure(failedRun), false, "same failure counted twice");
  assert.equal(progression.recordSettlement(failedRun, 999), false, "destroyed run was allowed to settle afterward");

  const reloaded = new ProgressionSystem(storage);
  const diagnostics = reloaded.getDiagnostics();
  assert.equal(diagnostics.failedRuns, 1);
  assert.equal(diagnostics.completedRuns, 1);
  assert.equal(diagnostics.credits, creditsBeforeFailure);
  assert.equal(diagnostics.upgrades.clampDampers, true);
});

test("corrupt or unsupported save data recovers to safe version-one defaults", () => {
  const malformed = new MemoryStorage();
  malformed.setItem("orbital-scrapper-progression-v1", "{not-json");
  const recoveredMalformed = new ProgressionSystem(malformed);
  assert.equal(recoveredMalformed.getDiagnostics().loadState, "recovered");
  assert.equal(recoveredMalformed.getDiagnostics().credits, 0);
  assert.equal(recoveredMalformed.hasClampDampers(), false);

  const future = new MemoryStorage();
  future.setItem("orbital-scrapper-progression-v1", JSON.stringify({ version: 99, credits: 999999 }));
  const recoveredFuture = new ProgressionSystem(future);
  assert.equal(recoveredFuture.getDiagnostics().loadState, "recovered");
  assert.equal(recoveredFuture.getDiagnostics().version, 1);
  assert.equal(recoveredFuture.getDiagnostics().nextRunId, 1);
});
