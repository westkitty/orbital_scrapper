// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { WreckSandbox } from "../src/physics/WreckSandbox.js";
import { FlightScenePresenter } from "../src/presentation/FlightScenePresenter.js";

test("wreck presenter rebuild preserves one managed presentation object per physics body", async () => {
  const sandbox = await WreckSandbox.create();
  const scene = new THREE.Scene();
  const presenter = new FlightScenePresenter(scene);
  try {
    presenter.rebuild(sandbox);
    assert.equal(presenter.getManagedBodyCount(), 7);
    for (let index = 0; index < 20; index += 1) {
      sandbox.reset();
      presenter.rebuild(sandbox);
      assert.equal(presenter.getManagedBodyCount(), 7);
    }
  } finally {
    presenter.dispose();
    sandbox.dispose();
  }
});
