// @ts-nocheck
import * as THREE from "three";

const ROLE_COLORS = {
  craft: 0x38bdf8,
  obstacle: 0x475569,
  "moving-obstacle": 0xf97316,
  target: 0xeab308,
  "wreck-spine": 0x64748b,
  "wreck-heavy": 0xb45309,
  "wreck-light": 0xa3e635,
  "wreck-branch": 0x94a3b8,
};

export class FlightScenePresenter {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.objects = new Map();
  }

  rebuild(sandbox) {
    this.disposeRoot();
    this.root = new THREE.Group();
    this.root.name = "phase-one-flight-root";
    this.scene.add(this.root);

    for (const record of sandbox.getBodyRecords()) {
      const object = record.visual.role === "craft"
        ? this.createCraft(record)
        : this.createBody(record);
      object.name = `physics-body-${record.id}`;
      this.root.add(object);
      this.objects.set(record.id, object);
    }

    this.sync(sandbox);
  }

  createBody(record) {
    const [x, y, z] = record.visual.size;
    const geometry = new THREE.BoxGeometry(x, y, z);
    const material = new THREE.MeshStandardMaterial({
      color: ROLE_COLORS[record.visual.role] ?? 0x64748b,
      roughness: 0.82,
      metalness: record.visual.role === "wreck-heavy" ? 0.35 : record.visual.role === "target" ? 0.25 : 0.12,
      wireframe: record.visual.role === "target",
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = record.visual.role !== "target";
    mesh.receiveShadow = true;
    return mesh;
  }

  createCraft(record) {
    const group = new THREE.Group();
    const [x, y, z] = record.visual.size;

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(x, y, z),
      new THREE.MeshStandardMaterial({ color: ROLE_COLORS.craft, roughness: 0.64, metalness: 0.3 }),
    );
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0.15 }),
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -(z / 2 + 0.4);
    nose.castShadow = true;
    group.add(nose);

    const lateralMarker = new THREE.Mesh(
      new THREE.BoxGeometry(x + 0.7, 0.09, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }),
    );
    lateralMarker.position.z = 0.25;
    group.add(lateralMarker);

    return group;
  }

  sync(sandbox) {
    for (const record of sandbox.getBodyRecords()) {
      const object = this.objects.get(record.id);
      if (!object) continue;
      object.visible = record.body.isEnabled?.() ?? true;
      if (!object.visible) continue;
      const position = record.body.translation();
      const rotation = record.body.rotation();
      object.position.set(position.x, position.y, position.z);
      object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  updateCamera(sandbox, camera) {
    const craft = sandbox.getCraftBody();
    const position = craft.translation();
    const rotation = craft.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

    const offset = new THREE.Vector3(0, 2.4, 7.5).applyQuaternion(quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    camera.position.set(position.x + offset.x, position.y + offset.y, position.z + offset.z);
    camera.up.set(0, 1, 0).applyQuaternion(quaternion);
    camera.lookAt(
      position.x + forward.x * 5,
      position.y + forward.y * 5,
      position.z + forward.z * 5,
    );
  }

  getManagedBodyCount() {
    return this.root?.children.length ?? 0;
  }

  dispose() {
    this.disposeRoot();
  }

  disposeRoot() {
    if (!this.root) return;
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    this.scene.remove(this.root);
    this.objects.clear();
    this.root = null;
  }
}
