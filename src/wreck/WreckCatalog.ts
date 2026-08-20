export type Vec3 = { x: number; y: number; z: number };

export type WreckBodyRole = "craft" | "wreck-spine" | "wreck-heavy" | "wreck-light" | "wreck-branch";
export type WreckComponentType = "spine" | "engine" | "panel" | "rail" | "junction" | "battery" | "sensor" | "tank" | "reactor";
export type WreckMassClass = "light" | "medium" | "heavy";
export type WreckCutClass = "low-risk" | "large-mass";
export type WreckTemplateId = "reference" | "relay-fork" | "tank-hauler";

export type WreckAttachmentDefinition = {
  id: string;
  localPosition: Vec3;
};

export type WreckComponentDefinition = {
  id: string;
  componentType: WreckComponentType;
  massClass: WreckMassClass;
  position: Vec3;
  halfExtents: readonly [number, number, number];
  visual: { size: readonly [number, number, number]; role: WreckBodyRole };
  attachments: readonly WreckAttachmentDefinition[];
  salvageValueUnits: number;
  cargoFragilityMultiplier: number;
};

export type WreckConnectionDefinition = {
  id: string;
  componentAId: string;
  attachmentAId: string;
  componentBId: string;
  attachmentBId: string;
  cuttable?: boolean;
  cutClass?: WreckCutClass;
  releaseImpulse?: number;
  failureImpulseThreshold?: number;
};

export type WreckVariantDefinition = { id: string; label: string; missingComponentIds: readonly string[] };
export type WreckTemplateDefinition = {
  id: WreckTemplateId;
  label: string;
  description: string;
  components: readonly WreckComponentDefinition[];
  connections: readonly WreckConnectionDefinition[];
  variants: readonly WreckVariantDefinition[];
};

const REFERENCE: WreckTemplateDefinition = {
  id: "reference", label: "Reference Wreck",
  description: "The proven six-component baseline with a low-risk panel, high-risk engine, and alternate rear load path.",
  components: [
    { id: "spine", componentType: "spine", massClass: "medium", position: { x: 0, y: 0, z: 0 }, halfExtents: [1.5, 0.7, 2.8], visual: { size: [3, 1.4, 5.6], role: "wreck-spine" }, attachments: [{ id: "engine-port", localPosition: { x: -1.5, y: 0, z: 0.7 } }, { id: "panel-port", localPosition: { x: 1.5, y: 0, z: 0.5 } }, { id: "left-rail-port", localPosition: { x: -1, y: 0, z: -2.8 } }, { id: "right-rail-port", localPosition: { x: 1, y: 0, z: -2.8 } }], salvageValueUnits: 800, cargoFragilityMultiplier: 1 },
    { id: "engine", componentType: "engine", massClass: "heavy", position: { x: -2.6, y: 0, z: 0.7 }, halfExtents: [1.1, 1.1, 1.4], visual: { size: [2.2, 2.2, 2.8], role: "wreck-heavy" }, attachments: [{ id: "spine-port", localPosition: { x: 1.1, y: 0, z: 0 } }], salvageValueUnits: 1200, cargoFragilityMultiplier: 1 },
    { id: "panel", componentType: "panel", massClass: "light", position: { x: 3.3, y: 0, z: 0.5 }, halfExtents: [1.8, 0.18, 1.3], visual: { size: [3.6, 0.36, 2.6], role: "wreck-light" }, attachments: [{ id: "spine-port", localPosition: { x: -1.8, y: 0, z: 0 } }], salvageValueUnits: 250, cargoFragilityMultiplier: 1 },
    { id: "left-rail", componentType: "rail", massClass: "light", position: { x: -1, y: 0, z: -4.2 }, halfExtents: [0.25, 0.25, 1.4], visual: { size: [0.5, 0.5, 2.8], role: "wreck-branch" }, attachments: [{ id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } }, { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } }], salvageValueUnits: 300, cargoFragilityMultiplier: 1 },
    { id: "right-rail", componentType: "rail", massClass: "light", position: { x: 1, y: 0, z: -4.2 }, halfExtents: [0.25, 0.25, 1.4], visual: { size: [0.5, 0.5, 2.8], role: "wreck-branch" }, attachments: [{ id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } }, { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } }], salvageValueUnits: 300, cargoFragilityMultiplier: 1 },
    { id: "rear-node", componentType: "junction", massClass: "medium", position: { x: 0, y: 0, z: -6.3 }, halfExtents: [1.5, 0.7, 0.7], visual: { size: [3, 1.4, 1.4], role: "wreck-branch" }, attachments: [{ id: "left-port", localPosition: { x: -1, y: 0, z: 0.7 } }, { id: "right-port", localPosition: { x: 1, y: 0, z: 0.7 } }], salvageValueUnits: 600, cargoFragilityMultiplier: 1 },
  ],
  connections: [
    { id: "spine-engine", componentAId: "spine", attachmentAId: "engine-port", componentBId: "engine", attachmentBId: "spine-port", cuttable: true, cutClass: "large-mass", releaseImpulse: 2.2 },
    { id: "spine-panel", componentAId: "spine", attachmentAId: "panel-port", componentBId: "panel", attachmentBId: "spine-port", cuttable: true, cutClass: "low-risk", releaseImpulse: 0.65 },
    { id: "spine-left-rail", componentAId: "spine", attachmentAId: "left-rail-port", componentBId: "left-rail", attachmentBId: "spine-port" },
    { id: "left-rail-rear", componentAId: "left-rail", attachmentAId: "rear-port", componentBId: "rear-node", attachmentBId: "left-port", failureImpulseThreshold: 5.5 },
    { id: "spine-right-rail", componentAId: "spine", attachmentAId: "right-rail-port", componentBId: "right-rail", attachmentBId: "spine-port" },
    { id: "right-rail-rear", componentAId: "right-rail", attachmentAId: "rear-port", componentBId: "rear-node", attachmentBId: "right-port" },
  ], variants: [{ id: "intact", label: "Intact baseline", missingComponentIds: [] }],
};

const RELAY_FORK: WreckTemplateDefinition = {
  id: "relay-fork", label: "Relay Fork",
  description: "A split communications hull with a valuable fragile sensor wing, a medium battery block, and a redundant rear frame.",
  components: [
    { id: "spine", componentType: "spine", massClass: "medium", position: { x: 0, y: 0, z: 0 }, halfExtents: [1.3, 0.6, 2.4], visual: { size: [2.6, 1.2, 4.8], role: "wreck-spine" }, attachments: [{ id: "battery-port", localPosition: { x: -1.3, y: 0, z: 0.8 } }, { id: "sensor-port", localPosition: { x: 1.3, y: 0, z: 0.9 } }, { id: "left-rail-port", localPosition: { x: -0.8, y: 0, z: -2.4 } }, { id: "right-rail-port", localPosition: { x: 0.8, y: 0, z: -2.4 } }], salvageValueUnits: 750, cargoFragilityMultiplier: 1 },
    { id: "battery", componentType: "battery", massClass: "medium", position: { x: -2.3, y: 0, z: 0.8 }, halfExtents: [1, 0.8, 1], visual: { size: [2, 1.6, 2], role: "wreck-heavy" }, attachments: [{ id: "spine-port", localPosition: { x: 1, y: 0, z: 0 } }], salvageValueUnits: 950, cargoFragilityMultiplier: 1.2 },
    { id: "sensor-wing", componentType: "sensor", massClass: "light", position: { x: 3, y: 0, z: 0.9 }, halfExtents: [1.7, 0.14, 0.9], visual: { size: [3.4, 0.28, 1.8], role: "wreck-light" }, attachments: [{ id: "spine-port", localPosition: { x: -1.7, y: 0, z: 0 } }], salvageValueUnits: 1100, cargoFragilityMultiplier: 2.2 },
    { id: "left-rail", componentType: "rail", massClass: "light", position: { x: -0.8, y: 0, z: -3.8 }, halfExtents: [0.2, 0.2, 1.4], visual: { size: [0.4, 0.4, 2.8], role: "wreck-branch" }, attachments: [{ id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } }, { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } }], salvageValueUnits: 260, cargoFragilityMultiplier: 0.9 },
    { id: "right-rail", componentType: "rail", massClass: "light", position: { x: 0.8, y: 0, z: -3.8 }, halfExtents: [0.2, 0.2, 1.4], visual: { size: [0.4, 0.4, 2.8], role: "wreck-branch" }, attachments: [{ id: "spine-port", localPosition: { x: 0, y: 0, z: 1.4 } }, { id: "rear-port", localPosition: { x: 0, y: 0, z: -1.4 } }], salvageValueUnits: 260, cargoFragilityMultiplier: 0.9 },
    { id: "rear-node", componentType: "junction", massClass: "medium", position: { x: 0, y: 0, z: -5.9 }, halfExtents: [1.2, 0.5, 0.7], visual: { size: [2.4, 1, 1.4], role: "wreck-branch" }, attachments: [{ id: "left-port", localPosition: { x: -0.8, y: 0, z: 0.7 } }, { id: "right-port", localPosition: { x: 0.8, y: 0, z: 0.7 } }], salvageValueUnits: 520, cargoFragilityMultiplier: 1 },
  ],
  connections: [
    { id: "spine-battery", componentAId: "spine", attachmentAId: "battery-port", componentBId: "battery", attachmentBId: "spine-port", cuttable: true, cutClass: "large-mass", releaseImpulse: 1.8 },
    { id: "spine-sensor", componentAId: "spine", attachmentAId: "sensor-port", componentBId: "sensor-wing", attachmentBId: "spine-port", cuttable: true, cutClass: "low-risk", releaseImpulse: 0.55 },
    { id: "spine-left-rail", componentAId: "spine", attachmentAId: "left-rail-port", componentBId: "left-rail", attachmentBId: "spine-port" },
    { id: "left-rail-rear", componentAId: "left-rail", attachmentAId: "rear-port", componentBId: "rear-node", attachmentBId: "left-port", failureImpulseThreshold: 4.5 },
    { id: "spine-right-rail", componentAId: "spine", attachmentAId: "right-rail-port", componentBId: "right-rail", attachmentBId: "spine-port" },
    { id: "right-rail-rear", componentAId: "right-rail", attachmentAId: "rear-port", componentBId: "rear-node", attachmentBId: "right-port" },
  ], variants: [{ id: "intact", label: "Intact relay frame", missingComponentIds: [] }, { id: "missing-right-rail", label: "Right rear rail missing", missingComponentIds: ["right-rail"] }],
};

const TANK_HAULER: WreckTemplateDefinition = {
  id: "tank-hauler", label: "Tank Hauler",
  description: "A dense industrial hull with a robust tank, a high-value heavy reactor, and fragile tail salvage.",
  components: [
    { id: "spine", componentType: "spine", massClass: "medium", position: { x: 0, y: 0, z: 0 }, halfExtents: [1.6, 0.7, 2.2], visual: { size: [3.2, 1.4, 4.4], role: "wreck-spine" }, attachments: [{ id: "tank-port", localPosition: { x: -1.6, y: 0, z: 0.7 } }, { id: "reactor-port", localPosition: { x: 1.6, y: 0, z: 0.7 } }, { id: "tail-port", localPosition: { x: 0, y: 0, z: -2.2 } }], salvageValueUnits: 850, cargoFragilityMultiplier: 1 },
    { id: "tank", componentType: "tank", massClass: "heavy", position: { x: -3, y: 0, z: 0.7 }, halfExtents: [1.4, 1, 1.2], visual: { size: [2.8, 2, 2.4], role: "wreck-heavy" }, attachments: [{ id: "spine-port", localPosition: { x: 1.4, y: 0, z: 0 } }], salvageValueUnits: 700, cargoFragilityMultiplier: 0.65 },
    { id: "reactor", componentType: "reactor", massClass: "heavy", position: { x: 2.7, y: 0, z: 0.7 }, halfExtents: [1.1, 1, 1.1], visual: { size: [2.2, 2, 2.2], role: "wreck-heavy" }, attachments: [{ id: "spine-port", localPosition: { x: -1.1, y: 0, z: 0 } }], salvageValueUnits: 1800, cargoFragilityMultiplier: 1.5 },
    { id: "tail-node", componentType: "junction", massClass: "medium", position: { x: 0, y: 0, z: -3.5 }, halfExtents: [1, 0.5, 1.3], visual: { size: [2, 1, 2.6], role: "wreck-branch" }, attachments: [{ id: "spine-port", localPosition: { x: 0, y: 0, z: 1.3 } }, { id: "panel-port", localPosition: { x: 1, y: 0, z: 0 } }, { id: "sensor-port", localPosition: { x: -1, y: 0, z: 0 } }], salvageValueUnits: 500, cargoFragilityMultiplier: 1 },
    { id: "tail-panel", componentType: "panel", massClass: "light", position: { x: 2.5, y: 0, z: -3.5 }, halfExtents: [1.5, 0.15, 0.9], visual: { size: [3, 0.3, 1.8], role: "wreck-light" }, attachments: [{ id: "tail-port", localPosition: { x: -1.5, y: 0, z: 0 } }], salvageValueUnits: 250, cargoFragilityMultiplier: 1 },
    { id: "sensor-pod", componentType: "sensor", massClass: "light", position: { x: -2, y: 0, z: -3.5 }, halfExtents: [1, 0.25, 0.7], visual: { size: [2, 0.5, 1.4], role: "wreck-light" }, attachments: [{ id: "tail-port", localPosition: { x: 1, y: 0, z: 0 } }], salvageValueUnits: 900, cargoFragilityMultiplier: 2 },
  ],
  connections: [
    { id: "spine-tank", componentAId: "spine", attachmentAId: "tank-port", componentBId: "tank", attachmentBId: "spine-port", cuttable: true, cutClass: "large-mass", releaseImpulse: 1.8 },
    { id: "spine-reactor", componentAId: "spine", attachmentAId: "reactor-port", componentBId: "reactor", attachmentBId: "spine-port", cuttable: true, cutClass: "large-mass", releaseImpulse: 2.6 },
    { id: "spine-tail", componentAId: "spine", attachmentAId: "tail-port", componentBId: "tail-node", attachmentBId: "spine-port" },
    { id: "tail-panel", componentAId: "tail-node", attachmentAId: "panel-port", componentBId: "tail-panel", attachmentBId: "tail-port", cuttable: true, cutClass: "low-risk", releaseImpulse: 0.5 },
    { id: "tail-sensor", componentAId: "tail-node", attachmentAId: "sensor-port", componentBId: "sensor-pod", attachmentBId: "tail-port", cuttable: true, cutClass: "low-risk", releaseImpulse: 0.45 },
  ], variants: [{ id: "intact", label: "Intact cargo frame", missingComponentIds: [] }, { id: "missing-sensor", label: "Sensor pod already stripped", missingComponentIds: ["sensor-pod"] }],
};

export const WRECK_TEMPLATES: readonly WreckTemplateDefinition[] = Object.freeze([REFERENCE, RELAY_FORK, TANK_HAULER]);
export function getWreckTemplate(templateId: WreckTemplateId): WreckTemplateDefinition {
  const template = WRECK_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Unknown wreck template: ${templateId}`);
  return template;
}
export function getWreckVariant(templateId: WreckTemplateId, variantId = "intact"): WreckVariantDefinition {
  const template = getWreckTemplate(templateId);
  const variant = template.variants.find((candidate) => candidate.id === variantId);
  if (!variant) throw new Error(`Unknown wreck variant: ${templateId}/${variantId}`);
  return variant;
}
