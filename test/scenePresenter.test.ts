// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PhysicsSandbox } from "../src/physics/PhysicsSandbox.js";
import { ScenePresenter } from "../src/presentation/ScenePresenter.js";

test("scene presenter rebuild does not duplicate managed scene objects", async () => {
  const sandbox = await PhysicsSandbox.create();
  const scene = new THREE.Scene();
  const presenter = new ScenePresenter(scene);

  try {
    presenter.rebuild(sandbox);
    const baselineManaged = presenter.getManagedObjectCount();
    const baselineRoots = scene.children.filter((child) => child.name === "phase-zero-physics-root").length;

    for (let index = 0; index < 20; index += 1) {
      sandbox.reset();
      presenter.rebuild(sandbox);
      assert.equal(presenter.getManagedObjectCount(), baselineManaged);
      assert.equal(scene.children.filter((child) => child.name === "phase-zero-physics-root").length, baselineRoots);
    }
  } finally {
    presenter.dispose();
    sandbox.dispose();
  }
});
