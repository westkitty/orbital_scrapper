// @ts-nocheck
import * as THREE from "three";
import { CARGO_CAPTURE_RADIUS_METERS } from "../cargo/CargoSystem.js";

const COLOR_SAFE = new THREE.Color(0x5eead4);
const COLOR_CAUTION = new THREE.Color(0xfbbf24);
const COLOR_DANGER = new THREE.Color(0xfb7185);
const COLOR_SCANNER = new THREE.Color(0x67e8f9);
const COLOR_CUTTER = new THREE.Color(0xfde68a);

function riskColor(risk) {
  if (risk === "high") return COLOR_DANGER;
  if (risk === "moderate") return COLOR_CAUTION;
  return COLOR_SAFE;
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export class ProductionFx {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "phase11-fx-root";
    this.scene.add(this.root);
    this.lastTime = 0;
    this.lastImpactSignature = "";
    this.sparkPool = [];

    this.scannerRoot = new THREE.Group();
    this.scannerRoot.name = "phase11-scanner-marker";
    const scannerRingMaterial = new THREE.MeshBasicMaterial({ color: COLOR_SCANNER, transparent: true, opacity: 0.86, depthTest: false });
    this.scannerRingMaterial = scannerRingMaterial;
    const scannerRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 28), scannerRingMaterial);
    this.scannerRoot.add(scannerRing);
    for (let index = 0; index < 4; index += 1) {
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(index % 2 === 0 ? 0.28 : 0.035, index % 2 === 0 ? 0.035 : 0.28, 0.025),
        scannerRingMaterial.clone(),
      );
      const angle = index * Math.PI * 0.5;
      tick.position.set(Math.cos(angle) * 0.82, Math.sin(angle) * 0.82, 0);
      this.scannerRoot.add(tick);
    }
    this.scannerRoot.visible = false;
    this.root.add(this.scannerRoot);

    this.cutterRoot = new THREE.Group();
    this.cutterRoot.name = "phase11-cutter-marker";
    this.cutterOuterMaterial = new THREE.MeshBasicMaterial({ color: COLOR_CUTTER, transparent: true, opacity: 0.8, depthTest: false });
    this.cutterProgressMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    this.cutterRoot.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 24), this.cutterOuterMaterial));
    this.cutterProgress = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 6, 24), this.cutterProgressMaterial);
    this.cutterRoot.add(this.cutterProgress);
    this.cutterRoot.visible = false;
    this.root.add(this.cutterRoot);

    this.tetherPositions = new Float32Array(6);
    this.tetherGeometry = new THREE.BufferGeometry();
    this.tetherGeometry.setAttribute("position", new THREE.BufferAttribute(this.tetherPositions, 3));
    this.tetherMaterial = new THREE.LineBasicMaterial({ color: COLOR_SCANNER, transparent: true, opacity: 0.92 });
    this.tetherLine = new THREE.Line(this.tetherGeometry, this.tetherMaterial);
    this.tetherLine.name = "phase11-tether-line";
    this.tetherLine.visible = false;
    this.root.add(this.tetherLine);
    this.tetherEndMaterial = new THREE.MeshBasicMaterial({ color: COLOR_SCANNER, transparent: true, opacity: 0.9 });
    this.tetherEnd = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.tetherEndMaterial);
    this.tetherEnd.visible = false;
    this.root.add(this.tetherEnd);

    this.captureMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.16, depthWrite: false });
    this.captureRing = new THREE.Mesh(new THREE.TorusGeometry(CARGO_CAPTURE_RADIUS_METERS, 0.035, 6, 48), this.captureMaterial);
    this.captureRing.name = "phase11-cargo-envelope";
    this.captureRing.rotation.x = Math.PI / 2;
    this.root.add(this.captureRing);

    for (let index = 0; index < 14; index += 1) {
      const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045, 0),
        new THREE.MeshBasicMaterial({ color: index % 2 ? 0xfbbf24 : 0xf8fafc, transparent: true, opacity: 0 }),
      );
      spark.visible = false;
      spark.userData.life = 0;
      spark.userData.velocity = new THREE.Vector3();
      this.sparkPool.push(spark);
      this.root.add(spark);
    }
  }

  update(sandbox, scan, cut, tether, collapse, elapsedSeconds = 0) {
    const delta = this.lastTime > 0 ? Math.min(0.05, Math.max(0, elapsedSeconds - this.lastTime)) : 0;
    this.lastTime = elapsedSeconds;

    if (scan?.state === "locked" && scan.connectionId && sandbox.hasConnection(scan.connectionId)) {
      const point = sandbox.getConnectionWorldPoint(scan.connectionId);
      this.scannerRoot.visible = true;
      this.scannerRoot.position.set(point.x, point.y, point.z);
      const color = riskColor(scan.riskLevel);
      this.scannerRoot.children.forEach((child) => child.material?.color?.copy?.(color));
      const pulse = 1 + Math.sin(elapsedSeconds * 6) * 0.06;
      this.scannerRoot.scale.setScalar(pulse);
    } else {
      this.scannerRoot.visible = false;
    }

    if (cut?.targetId && sandbox.hasConnection(cut.targetId)) {
      const point = sandbox.getConnectionWorldPoint(cut.targetId);
      this.cutterRoot.visible = true;
      this.cutterRoot.position.set(point.x, point.y, point.z);
      const progress = Math.max(0, Math.min(1, cut.progress01 ?? 0));
      const scale = 0.55 + progress * 0.55;
      this.cutterProgress.scale.setScalar(scale);
      this.cutterProgressMaterial.opacity = cut.state === "cutting" ? 0.55 + progress * 0.45 : 0.45;
      this.cutterOuterMaterial.color.copy(cut.canCut ? COLOR_CUTTER : COLOR_DANGER);
    } else {
      this.cutterRoot.visible = false;
    }

    if (tether?.state === "attached" && tether.targetId) {
      const target = sandbox.getWreckComponent(tether.targetId);
      if (target.body.isEnabled()) {
        const craft = sandbox.getCraftBody().translation();
        const targetPosition = target.body.translation();
        this.tetherPositions[0] = craft.x;
        this.tetherPositions[1] = craft.y;
        this.tetherPositions[2] = craft.z;
        this.tetherPositions[3] = targetPosition.x;
        this.tetherPositions[4] = targetPosition.y;
        this.tetherPositions[5] = targetPosition.z;
        this.tetherGeometry.attributes.position.needsUpdate = true;
        const load = Math.max(0, Math.min(1, tether.loadRatio ?? 0));
        const color = COLOR_SCANNER.clone().lerp(COLOR_CAUTION, Math.min(1, load * 1.25)).lerp(COLOR_DANGER, Math.max(0, load - 0.7) / 0.3);
        this.tetherMaterial.color.copy(color);
        this.tetherEndMaterial.color.copy(color);
        this.tetherMaterial.opacity = 0.65 + load * 0.35;
        this.tetherLine.visible = true;
        this.tetherEnd.visible = true;
        this.tetherEnd.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
        this.tetherEnd.scale.setScalar(0.85 + load * 0.65);
      }
    } else {
      this.tetherLine.visible = false;
      this.tetherEnd.visible = false;
    }

    const craftPosition = sandbox.getCraftBody().translation();
    this.captureRing.position.set(craftPosition.x, craftPosition.y, craftPosition.z);
    this.captureMaterial.opacity = tether?.state === "attached" ? 0.28 : 0.1;

    const impactSignature = collapse?.lastImpactBodyId && collapse.lastImpactImpulse > 0
      ? `${collapse.lastImpactBodyId}:${collapse.lastImpactImpulse.toFixed(3)}`
      : "";
    if (!impactSignature) {
      this.lastImpactSignature = "";
    } else if (impactSignature !== this.lastImpactSignature) {
      this.lastImpactSignature = impactSignature;
      this.spawnImpact(sandbox, collapse.lastImpactBodyId, collapse.lastImpactImpulse);
    }

    for (const spark of this.sparkPool) {
      if (!spark.visible) continue;
      spark.userData.life -= delta;
      if (spark.userData.life <= 0) {
        spark.visible = false;
        spark.material.opacity = 0;
        continue;
      }
      spark.position.addScaledVector(spark.userData.velocity, delta);
      spark.userData.velocity.multiplyScalar(0.97);
      spark.material.opacity = Math.min(1, spark.userData.life * 2.2);
    }
  }

  getDiagnostics() {
    return {
      rootName: this.root.name,
      scannerVisible: this.scannerRoot.visible,
      cutterVisible: this.cutterRoot.visible,
      tetherVisible: this.tetherLine.visible,
      tetherColor: `#${this.tetherMaterial.color.getHexString()}`,
      sparkCount: this.sparkPool.filter((spark) => spark.visible).length,
      objectCount: this.root.children.length,
    };
  }

  dispose() {
    disposeObject(this.root);
    this.scene.remove(this.root);
  }

  spawnImpact(sandbox, bodyId, impulse) {
    let origin = null;
    try {
      origin = bodyId === "craft" ? sandbox.getCraftBody().translation() : sandbox.getWreckComponent(bodyId).body.translation();
    } catch {
      return;
    }
    const energy = Math.min(1, Math.max(0.15, impulse / 12));
    for (let index = 0; index < this.sparkPool.length; index += 1) {
      const spark = this.sparkPool[index];
      const angle = (index / this.sparkPool.length) * Math.PI * 2;
      const rise = ((index % 5) - 2) * 0.16;
      spark.position.set(origin.x, origin.y, origin.z);
      spark.userData.velocity.set(Math.cos(angle) * (0.8 + energy * 1.5), rise, Math.sin(angle) * (0.8 + energy * 1.5));
      spark.userData.life = 0.35 + energy * 0.55;
      spark.material.opacity = 1;
      spark.visible = true;
    }
  }
}
