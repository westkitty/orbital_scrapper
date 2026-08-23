import {
  CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND,
  type CargoSystem,
} from "../cargo/CargoSystem.js";
import {
  CUTTER_RANGE_METERS,
  type CuttingSystem,
} from "../cutting/CuttingSystem.js";
import type { ProgressionSystem } from "../progression/ProgressionSystem.js";
import {
  TETHER_MAX_TENSION_NEWTONS,
  type TetherSystem,
} from "../tether/TetherSystem.js";

export type RunCapabilities = {
  captureSpeedLimit: number;
  cutterRangeMeters: number;
  tetherMaxTensionNewtons: number;
};

export function resolveRunCapabilities(progression: ProgressionSystem): RunCapabilities {
  return {
    captureSpeedLimit: progression.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND),
    cutterRangeMeters: progression.getCutterRange(CUTTER_RANGE_METERS),
    tetherMaxTensionNewtons: progression.getTetherMaxTension(TETHER_MAX_TENSION_NEWTONS),
  };
}

export function applyRunCapabilities(
  capabilities: RunCapabilities,
  cargo: Pick<CargoSystem, "setMaxCaptureRelativeSpeed">,
  cutter: Pick<CuttingSystem, "setRangeMeters">,
  tether: Pick<TetherSystem, "setMaxTensionNewtons">,
): void {
  cargo.setMaxCaptureRelativeSpeed(capabilities.captureSpeedLimit);
  cutter.setRangeMeters(capabilities.cutterRangeMeters);
  tether.setMaxTensionNewtons(capabilities.tetherMaxTensionNewtons);
}
