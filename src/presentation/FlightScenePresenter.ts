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
  hull: { color: 0x273449 },
  hullLight: { color: 0x52657d },
  dark: { color: 0x0b1220 },
  brass: { color: 0xa17b4a },
  solar: { color: 0x172554, emissive: 0x081b4a, emissiveIntensity: 0.38 },
  canopy: { color: 0x67e8f9, emissive: 0x083344, emissiveIntensity: 0.45 },
  hardpoint: { color: 0xfde68a, emissive: 0x713f12, emissiveIntensity: 0.72 },
  hazard: { color: 0xfb923c, emissive: 0x7c2d12, emissiveIntensity: 0.28 },
};

function material(options = MATERIAL.hull) {
  return new THREE.MeshLambertMaterial({
    color: options.color ?? 0x64748b,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    wireframe: options.wireframe ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

function box(size, options = MATERIAL.hull) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(options));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function cylinder(radius, length, options = MATERIAL.hull, radialSegments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(options));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function torus(radius, tube, options = MATERIAL.brass) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 12), material(options));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addHardpoints(group, component) {
  group.userData.attachmentMarkers = {};
  for (const attachment of component.attachments ?? []) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 4),
      material(MATERIAL.hardpoint),
    );
    marker.name = `attachment-${component.id}-${attachment.id}`;
    marker.position.set(attachment.localPosition.x, attachment.localPosition.y, attachment.localPosition.z);
    marker.userData.attachmentId = attachment.id;
    marker.userData.componentId = component.id;
    marker.castShadow = false;
    marker.receiveShadow = false;
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

    // The release presentation keeps directional/fill lighting but avoids a second
    // dynamic shadow render pass. Structural readability comes from silhouette,
    // material contrast, hardpoints, and the live tool overlays instead.
    this.scene.traverse((object) => {
      if (object.isLight && "castShadow" in object) object.castShadow = false;
    });

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
    const mesh = box([x, y, z], {
      color: ROLE_COLORS[record.visual.role] ?? 0x64748b,
      wireframe: record.visual.role === "target",
    });
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
      const dorsal = box([x * 0.6, y * 0.22, z * 0.72], MATERIAL.hullLight);
      dorsal.position.y = y * 0.5;
      group.add(dorsal);
      const centerRail = box([0.12, y * 0.96, z * 0.84], MATERIAL.brass);
      centerRail.position.x = x * 0.42;
      group.add(centerRail);
    } else if (component.componentType === "engine") {
      const casing = box([x * 0.82, y * 0.9, z * 0.7], MATERIAL.hull);
      casing.position.z = -z * 0.08;
      group.add(casing);
      const core = cylinder(Math.min(x, y) * 0.28, z * 0.66, MATERIAL.brass, 10);
      core.rotation.x = Math.PI / 2;
      core.position.z = z * 0.08;
      group.add(core);
      const nozzle = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(x, y) * 0.32, z * 0.3, 10, 1, true),
        material(MATERIAL.dark),
      );
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.position.z = z * 0.48;
      group.add(nozzle);
    } else if (component.componentType === "panel" || component.componentType === "sensor") {
      group.add(box([x, Math.max(0.09, y * 0.58), z], MATERIAL.dark));
      const inset = box([x * 0.86, y + 0.07, z * 0.8], MATERIAL.solar);
      inset.position.y = y * 0.18;
      group.add(inset);
    } else if (component.componentType === "rail") {
      group.add(box([x, y, z], MATERIAL.hullLight));
      const collar = box([x * 1.3, y * 1.3, Math.min(0.2, z * 0.14)], MATERIAL.brass);
      collar.position.z = z * 0.38;
      group.add(collar);
    } else if (component.componentType === "junction") {
      group.add(box([x, y, z], MATERIAL.hull));
      const cross = box([x * 1.06, Math.min(0.16, y * 0.32), z * 0.4], MATERIAL.brass);
      cross.position.y = y * 0.44;
      group.add(cross);
    } else if (component.componentType === "battery") {
      group.add(box([x, y, z], MATERIAL.dark));
      const band = box([x * 1.03, y * 1.04, Math.max(0.12, z * 0.12)], MATERIAL.hazard);
      group.add(band);
    } else if (component.componentType === "tank") {
      const tank = cylinder(Math.min(y, z) * 0.43, x * 0.9, MATERIAL.hullLight, 12);
      tank.rotation.z = Math.PI / 2;
      group.add(tank);
      const band = torus(Math.min(y, z) * 0.45, 0.06, MATERIAL.brass);
      band.rotation.y = Math.PI / 2;
      group.add(band);
    } else if (component.componentType === "reactor") {
      const core = cylinder(Math.min(x, y) * 0.34, z * 0.82, { color: 0x334155, emissive: 0x164e63, emissiveIntensity: 0.52 }, 12);
      core.rotation.x = Math.PI / 2;
      group.add(core);
      const ring = torus(Math.min(x, y) * 0.44, 0.07, MATERIAL.hazard);
      group.add(ring);
    } else {
      group.add(box([x, y, z], MATERIAL.hull));
      const accent = box([x * 0.72, Math.max(0.08, y * 0.12), z * 0.72], MATERIAL.hullLight);
      accent.position.y = y * 0.45;
      group.add(accent);
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

      const thrusterMaterial = material({ color: 0x1e293b, emissive: 0x0ea5e9, emissiveIntensity: 0.45 });
      const thruster = new THREE.Mesh(new THREE.ConeGeometry(x * 0.11, z * 0.28, 8, 1, true), thrusterMaterial);
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
      thrusterMaterial.emissiveIntensity = 0.42 + thrustLevel * 1.7;
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
