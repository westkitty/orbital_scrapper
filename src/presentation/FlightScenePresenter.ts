// @ts-nocheck
import * as THREE from "three";

const ROLE_COLORS = {
  craft: 0x60a5fa,
  obstacle: 0x475569,
  "moving-obstacle": 0xf97316,
  target: 0xeab308,
  "wreck-spine": 0x475569,
  "wreck-heavy": 0x9a6b43,
  "wreck-light": 0x8aa36b,
  "wreck-branch": 0x6b7280,
};

const MATERIAL = {
  hull: { color: 0x273449, roughness: 0.54, metalness: 0.62 },
  hullLight: { color: 0x52657d, roughness: 0.48, metalness: 0.58 },
  dark: { color: 0x0b1220, roughness: 0.38, metalness: 0.75 },
  brass: { color: 0xa17b4a, roughness: 0.42, metalness: 0.7 },
  solar: { color: 0x172554, roughness: 0.3, metalness: 0.52, emissive: 0x081b4a, emissiveIntensity: 0.45 },
  canopy: { color: 0x67e8f9, roughness: 0.16, metalness: 0.32, emissive: 0x083344, emissiveIntensity: 0.5 },
  hardpoint: { color: 0xfde68a, roughness: 0.28, metalness: 0.72, emissive: 0x713f12, emissiveIntensity: 0.8 },
  hazard: { color: 0xfb923c, roughness: 0.5, metalness: 0.42, emissive: 0x7c2d12, emissiveIntensity: 0.32 },
};

function material(options) {
  return new THREE.MeshStandardMaterial(options);
}

function box(size, options = MATERIAL.hull) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(options));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radius, length, options = MATERIAL.hull, radialSegments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(options));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addHardpoints(group, component) {
  group.userData.attachmentMarkers = {};
  for (const attachment of component.attachments ?? []) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      material(MATERIAL.hardpoint),
    );
    marker.name = `attachment-${component.id}-${attachment.id}`;
    marker.position.set(attachment.localPosition.x, attachment.localPosition.y, attachment.localPosition.z);
    marker.userData.attachmentId = attachment.id;
    marker.userData.componentId = component.id;
    group.userData.attachmentMarkers[attachment.id] = marker;
    group.add(marker);
  }
}

export class FlightScenePresenter {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.objects = new Map();
    this.thrusterMaterials = [];
    this.detailMeshCount = 0;
  }

  rebuild(sandbox) {
    this.disposeRoot();
    this.root = new THREE.Group();
    this.root.name = "phase-one-flight-root";
    this.scene.add(this.root);
    this.thrusterMaterials = [];
    this.detailMeshCount = 0;

    const components = new Map((sandbox.getWreckComponents?.() ?? []).map((component) => [component.id, component]));
    for (const record of sandbox.getBodyRecords()) {
      const component = components.get(record.id);
      const object = record.visual.role === "craft"
        ? this.createCraft(record)
        : component
          ? this.createWreckComponent(record, component)
          : this.createBody(record);
      object.name = `physics-body-${record.id}`;
      object.userData.physicsBodyId = record.id;
      this.root.add(object);
      this.objects.set(record.id, object);
    }

    this.sync(sandbox);
  }

  createBody(record) {
    const [x, y, z] = record.visual.size;
    const geometry = new THREE.BoxGeometry(x, y, z);
    const bodyMaterial = material({
      color: ROLE_COLORS[record.visual.role] ?? 0x64748b,
      roughness: 0.78,
      metalness: record.visual.role === "wreck-heavy" ? 0.4 : record.visual.role === "target" ? 0.25 : 0.18,
      wireframe: record.visual.role === "target",
    });
    const mesh = new THREE.Mesh(geometry, bodyMaterial);
    mesh.castShadow = record.visual.role !== "target";
    mesh.receiveShadow = true;
    this.detailMeshCount += 1;
    return mesh;
  }

  createWreckComponent(record, component) {
    const group = new THREE.Group();
    group.userData.presentationKind = "production-wreck-component";
    group.userData.componentType = component.componentType;
    group.userData.massClass = component.massClass;
    const [x, y, z] = record.visual.size;

    if (component.componentType === "spine") {
      group.add(box([x, y * 0.82, z], MATERIAL.hull));
      const dorsal = box([x * 0.58, y * 0.24, z * 0.72], MATERIAL.hullLight);
      dorsal.position.y = y * 0.5;
      group.add(dorsal);
      for (const side of [-1, 1]) {
        const rail = box([0.12, y * 0.88, z * 0.9], MATERIAL.brass);
        rail.position.x = side * x * 0.44;
        group.add(rail);
      }
    } else if (component.componentType === "engine") {
      const casing = box([x * 0.78, y * 0.9, z * 0.72], MATERIAL.hull);
      casing.position.z = -z * 0.08;
      group.add(casing);
      const core = cylinder(Math.min(x, y) * 0.28, z * 0.72, MATERIAL.brass, 18);
      core.rotation.x = Math.PI / 2;
      core.position.z = z * 0.08;
      group.add(core);
      const nozzle = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(x, y) * 0.34, z * 0.34, 18, 1, true),
        material(MATERIAL.dark),
      );
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.position.z = z * 0.5;
      group.add(nozzle);
    } else if (component.componentType === "panel" || component.componentType === "sensor") {
      group.add(box([x, Math.max(0.09, y * 0.58), z], MATERIAL.dark));
      const frameThickness = Math.max(0.06, Math.min(x, z) * 0.035);
      for (const side of [-1, 1]) {
        const railX = box([frameThickness, y + 0.06, z], MATERIAL.hullLight);
        railX.position.x = side * (x * 0.5 - frameThickness * 0.5);
        group.add(railX);
        const railZ = box([x, y + 0.06, frameThickness], MATERIAL.hullLight);
        railZ.position.z = side * (z * 0.5 - frameThickness * 0.5);
        group.add(railZ);
      }
      const columns = component.componentType === "sensor" ? 5 : 4;
      for (let index = 0; index < columns; index += 1) {
        const cell = box([x / columns - 0.08, y + 0.075, z * 0.82], MATERIAL.solar);
        cell.position.x = -x * 0.5 + (index + 0.5) * (x / columns);
        cell.position.y = y * 0.18;
        group.add(cell);
      }
    } else if (component.componentType === "rail") {
      group.add(box([x, y, z], MATERIAL.hullLight));
      for (const end of [-1, 1]) {
        const collar = box([x * 1.35, y * 1.35, Math.min(0.18, z * 0.12)], MATERIAL.brass);
        collar.position.z = end * z * 0.42;
        group.add(collar);
      }
    } else if (component.componentType === "junction") {
      group.add(box([x, y, z], MATERIAL.hull));
      const cross = box([x * 1.08, Math.min(0.16, y * 0.32), z * 0.38], MATERIAL.brass);
      cross.position.y = y * 0.44;
      group.add(cross);
    } else if (component.componentType === "battery") {
      group.add(box([x, y, z], MATERIAL.dark));
      for (const offset of [-0.28, 0.28]) {
        const band = box([x * 1.03, y * 1.04, Math.max(0.1, z * 0.1)], MATERIAL.hazard);
        band.position.z = offset * z;
        group.add(band);
      }
      const cap = box([x * 0.7, y * 0.14, z * 0.55], MATERIAL.brass);
      cap.position.y = y * 0.55;
      group.add(cap);
    } else if (component.componentType === "tank") {
      const tank = cylinder(Math.min(y, z) * 0.43, x * 0.9, MATERIAL.hullLight, 20);
      tank.rotation.z = Math.PI / 2;
      group.add(tank);
      for (const side of [-1, 1]) {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(Math.min(y, z) * 0.45, 0.06, 8, 20),
          material(MATERIAL.brass),
        );
        band.rotation.y = Math.PI / 2;
        band.position.x = side * x * 0.28;
        group.add(band);
      }
    } else if (component.componentType === "reactor") {
      const coreMaterial = material({ color: 0x334155, roughness: 0.3, metalness: 0.72, emissive: 0x164e63, emissiveIntensity: 0.6 });
      const core = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(x, y) * 0.34, Math.min(x, y) * 0.34, z * 0.82, 20), coreMaterial);
      core.rotation.x = Math.PI / 2;
      group.add(core);
      for (const offset of [-0.24, 0.24]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(x, y) * 0.44, 0.07, 8, 24), material(MATERIAL.hazard));
        ring.position.z = offset * z;
        group.add(ring);
      }
    } else {
      group.add(box([x, y, z], MATERIAL.hull));
    }

    addHardpoints(group, component);
    group.traverse((object) => { if (object.isMesh) this.detailMeshCount += 1; });
    return group;
  }

  createCraft(record) {
    const group = new THREE.Group();
    group.userData.presentationKind = "production-salvage-craft";
    const [x, y, z] = record.visual.size;

    const hull = box([x * 0.72, y * 0.72, z * 0.86], MATERIAL.hull);
    hull.position.z = z * 0.02;
    group.add(hull);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(x * 0.28, z * 0.48, 8),
      material(MATERIAL.hullLight),
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -(z * 0.58);
    group.add(nose);

    const canopy = box([x * 0.46, y * 0.38, z * 0.32], MATERIAL.canopy);
    canopy.position.set(0, y * 0.38, -z * 0.12);
    group.add(canopy);

    for (const side of [-1, 1]) {
      const pod = box([x * 0.23, y * 0.34, z * 0.74], MATERIAL.hullLight);
      pod.position.x = side * x * 0.54;
      pod.position.z = z * 0.06;
      group.add(pod);

      const thrusterMaterial = material({ color: 0x1e293b, roughness: 0.3, metalness: 0.8, emissive: 0x0ea5e9, emissiveIntensity: 0.5 });
      const thruster = new THREE.Mesh(new THREE.ConeGeometry(x * 0.11, z * 0.28, 12, 1, true), thrusterMaterial);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * x * 0.54, 0, z * 0.55);
      group.add(thruster);
      this.thrusterMaterials.push(thrusterMaterial);
    }

    const keel = box([x * 0.16, y * 0.16, z * 0.86], MATERIAL.brass);
    keel.position.y = -y * 0.46;
    group.add(keel);

    group.traverse((object) => { if (object.isMesh) this.detailMeshCount += 1; });
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

  setFlightEffects(input) {
    const thrustLevel = Math.min(1, Math.max(0,
      Math.abs(input?.forward ?? 0) + Math.abs(input?.strafe ?? 0) * 0.45 + Math.abs(input?.vertical ?? 0) * 0.35,
    ));
    for (const thrusterMaterial of this.thrusterMaterials) {
      thrusterMaterial.emissiveIntensity = 0.45 + thrustLevel * 2.4;
    }
    return thrustLevel;
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

  getManagedObject(bodyId) {
    return this.objects.get(bodyId) ?? null;
  }

  getAttachmentMarkerPosition(componentId, attachmentId) {
    const component = this.objects.get(componentId);
    const marker = component?.userData?.attachmentMarkers?.[attachmentId];
    if (!marker) return null;
    return { x: marker.position.x, y: marker.position.y, z: marker.position.z };
  }

  getPresentationMetrics() {
    const componentKinds = {};
    for (const object of this.objects.values()) {
      const kind = object.userData.componentType ?? object.userData.presentationKind ?? "generic";
      componentKinds[kind] = (componentKinds[kind] ?? 0) + 1;
    }
    return {
      managedBodies: this.getManagedBodyCount(),
      detailMeshes: this.detailMeshCount,
      componentKinds,
      hasProductionCraft: this.objects.get("craft")?.userData?.presentationKind === "production-salvage-craft",
    };
  }

  dispose() {
    this.disposeRoot();
  }

  disposeRoot() {
    if (!this.root) return;
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((entry) => entry.dispose?.());
      else object.material?.dispose?.();
    });
    this.scene.remove(this.root);
    this.objects.clear();
    this.thrusterMaterials = [];
    this.detailMeshCount = 0;
    this.root = null;
  }
}
