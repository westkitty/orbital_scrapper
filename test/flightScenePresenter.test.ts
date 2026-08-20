// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { FlightSandbox } from "../src/physics/FlightSandbox.js";
import { FlightScenePresenter } from "../src/presentation/FlightScenePresenter.js";

test("flight presenter rebuild preserves exactly one managed body object per physics record", async () => {
  const sandbox = await FlightSandbox.create();
  const scene = new THREE.Scene();
  const presenter = new FlightScenePresenter(scene);
  try {
    presenter.rebuild(sandbox);
    const baselineBodies = sandbox.getDiagnostics().activeBodies;
    assert.equal(presenter.getManagedBodyCount(), baselineBodies);

    for (let index = 0; index < 20; index += 1) {
      sandbox.reset();
      presenter.rebuild(sandbox);
      assert.equal(presenter.getManagedBodyCount(), baselineBodies);
      assert.equal(scene.children.filter((child) => child.name === "phase-one-flight-root").length, 1);
    }
  } finally {
    presenter.dispose();
    sandbox.dispose();
  }

  assert.equal(scene.children.filter((child) => child.name === "phase-one-flight-root").length, 0);
});
