// Three.js type definitions are intentionally deferred in this narrow Phase 0 spike.
// The implementation is still checked by Vite and exercised by the Node integration tests.
// @ts-nocheck
import * as THREE from "three";

export class ScenePresenter {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.meshes = new Map();
  }

  rebuild(sandbox) {
    this.disposeRoot();
    this.root = new THREE.Group();
    this.root.name = "phase-zero-physics-root";
    this.scene.add(this.root);

    for (const record of sandbox.getBodyRecords()) {
      const [x, y, z] = record.visual.size;
      const geometry = new THREE.BoxGeometry(x, y, z);
      const material = new THREE.MeshStandardMaterial({
        color: record.visual.role === "ground" ? 0x1e293b : record.visual.role === "free" ? 0xeab308 : 0x38bdf8,
        roughness: 0.78,
        metalness: 0.18,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `body-${record.id}`;
      mesh.castShadow = record.visual.role !== "ground";
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.meshes.set(record.id, mesh);
    }

    this.sync(sandbox);
  }

  sync(sandbox) {
    for (const record of sandbox.getBodyRecords()) {
      const mesh = this.meshes.get(record.id);
      if (!mesh) continue;
      const position = record.body.translation();
      const rotation = record.body.rotation();
      mesh.position.set(position.x, position.y, position.z);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  getManagedObjectCount() {
    return this.root?.children.length ?? 0;
  }

  dispose() {
    this.disposeRoot();
  }

  disposeRoot() {
    if (!this.root) return;
    for (const child of this.root.children) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
      else child.material?.dispose?.();
    }
    this.scene.remove(this.root);
    this.meshes.clear();
    this.root = null;
  }
}
