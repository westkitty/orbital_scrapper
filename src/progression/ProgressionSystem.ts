export interface ProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESSION_SAVE_VERSION = 2 as const;
// Keep the proven storage key stable so existing Phase 9 browser saves migrate in place.
export const PROGRESSION_SAVE_KEY = "orbital-scrapper-progression-v1";
export const PROGRESSION_BACKUP_KEY = "orbital-scrapper-progression-v1-backup";
export const CLAMP_DAMPERS_COST_UNITS = 150;
export const CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND = 2;
export const TETHER_REINFORCEMENT_COST_UNITS = 140;
export const TETHER_REINFORCEMENT_MAX_TENSION_NEWTONS = 105;
export const CUTTER_OPTICS_COST_UNITS = 160;
export const CUTTER_OPTICS_RANGE_METERS = 12;

export type ProgressionLoadState = "new" | "loaded" | "migrated" | "recovered" | "recovered-backup";

export type ProgressionUpgradeState = {
  clampDampers: boolean;
  tetherReinforcement: boolean;
  cutterOptics: boolean;
};

export type ProgressionSaveV2 = {
  version: typeof PROGRESSION_SAVE_VERSION;
  credits: number;
  upgrades: ProgressionUpgradeState;
  nextRunId: number;
  completedRuns: number;
  failedRuns: number;
  lastSettledRunId: number | null;
  lastFailedRunId: number | null;
};

type ProgressionSaveV1 = {
  version: 1;
  credits: number;
  upgrades: { clampDampers: boolean };
  nextRunId: number;
  completedRuns: number;
  failedRuns: number;
  lastSettledRunId: number | null;
  lastFailedRunId: number | null;
};

export type ProgressionDiagnostics = ProgressionSaveV2 & {
  loadState: ProgressionLoadState;
};

export type UpgradePurchaseResult = {
  purchased: boolean;
  reason: "purchased" | "already-owned" | "insufficient-credits";
  credits: number;
};

function defaultState(): ProgressionSaveV2 {
  return {
    version: PROGRESSION_SAVE_VERSION,
    credits: 0,
    upgrades: {
      clampDampers: false,
      tetherReinforcement: false,
      cutterOptics: false,
    },
    nextRunId: 1,
    completedRuns: 0,
    failedRuns: 0,
    lastSettledRunId: null,
    lastFailedRunId: null,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value > 0);
}

function validCommonState(parsed: Partial<ProgressionSaveV2 | ProgressionSaveV1>): boolean {
  return isNonNegativeInteger(parsed.credits)
    && isNonNegativeInteger(parsed.completedRuns)
    && isNonNegativeInteger(parsed.failedRuns)
    && isNonNegativeInteger(parsed.nextRunId)
    && parsed.nextRunId >= 1
    && isNullablePositiveInteger(parsed.lastSettledRunId)
    && isNullablePositiveInteger(parsed.lastFailedRunId);
}

function migrateV1(legacy: ProgressionSaveV1): ProgressionSaveV2 {
  return {
    version: PROGRESSION_SAVE_VERSION,
    credits: legacy.credits,
    upgrades: {
      clampDampers: legacy.upgrades.clampDampers,
      tetherReinforcement: false,
      cutterOptics: false,
    },
    nextRunId: legacy.nextRunId,
    completedRuns: legacy.completedRuns,
    failedRuns: legacy.failedRuns,
    lastSettledRunId: legacy.lastSettledRunId,
    lastFailedRunId: legacy.lastFailedRunId,
  };
}

function parseState(raw: string | null): {
  state: ProgressionSaveV2;
  loadState: Exclude<ProgressionLoadState, "recovered-backup">;
  shouldPersist: boolean;
} {
  if (raw === null) return { state: defaultState(), loadState: "new", shouldPersist: false };

  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || !validCommonState(parsed)) {
      return { state: defaultState(), loadState: "recovered", shouldPersist: false };
    }

    if (parsed.version === PROGRESSION_SAVE_VERSION) {
      if (typeof parsed.upgrades?.clampDampers !== "boolean"
        || typeof parsed.upgrades?.tetherReinforcement !== "boolean"
        || typeof parsed.upgrades?.cutterOptics !== "boolean") {
        return { state: defaultState(), loadState: "recovered", shouldPersist: false };
      }
      return {
        state: {
          version: PROGRESSION_SAVE_VERSION,
          credits: parsed.credits!,
          upgrades: {
            clampDampers: parsed.upgrades.clampDampers,
            tetherReinforcement: parsed.upgrades.tetherReinforcement,
            cutterOptics: parsed.upgrades.cutterOptics,
          },
          nextRunId: parsed.nextRunId!,
          completedRuns: parsed.completedRuns!,
          failedRuns: parsed.failedRuns!,
          lastSettledRunId: parsed.lastSettledRunId!,
          lastFailedRunId: parsed.lastFailedRunId!,
        },
        loadState: "loaded",
        shouldPersist: false,
      };
    }

    if (parsed.version === 1 && typeof parsed.upgrades?.clampDampers === "boolean") {
      return {
        state: migrateV1(parsed as ProgressionSaveV1),
        loadState: "migrated",
        shouldPersist: true,
      };
    }

    return { state: defaultState(), loadState: "recovered", shouldPersist: false };
  } catch {
    return { state: defaultState(), loadState: "recovered", shouldPersist: false };
  }
}

export class ProgressionSystem {
  private state: ProgressionSaveV2;
  private loadState: ProgressionLoadState;

  constructor(
    private readonly storage: ProgressionStorage,
    private readonly storageKey = PROGRESSION_SAVE_KEY,
    private readonly backupKey = PROGRESSION_BACKUP_KEY,
  ) {
    const primary = parseState(storage.getItem(storageKey));
    if (primary.loadState === "recovered") {
      const backup = parseState(storage.getItem(backupKey));
      if (backup.loadState === "loaded" || backup.loadState === "migrated") {
        this.state = backup.state;
        this.loadState = "recovered-backup";
        this.writeState();
        return;
      }
    }

    this.state = primary.state;
    this.loadState = primary.loadState;
    if (primary.shouldPersist) this.writeState();
  }

  beginRun(): number {
    const runId = this.state.nextRunId;
    this.state.nextRunId += 1;
    this.persist();
    return runId;
  }

  recordSettlement(runId: number, payoutUnits: number): boolean {
    if (!this.isCurrentRun(runId) || !Number.isFinite(payoutUnits) || payoutUnits < 0) return false;
    if (this.state.lastSettledRunId === runId || this.state.lastFailedRunId === runId) return false;

    this.state.credits += Math.round(payoutUnits);
    this.state.completedRuns += 1;
    this.state.lastSettledRunId = runId;
    this.persist();
    return true;
  }

  recordFailure(runId: number): boolean {
    if (!this.isCurrentRun(runId)) return false;
    if (this.state.lastFailedRunId === runId || this.state.lastSettledRunId === runId) return false;

    this.state.failedRuns += 1;
    this.state.lastFailedRunId = runId;
    this.persist();
    return true;
  }

  purchaseClampDampers(): UpgradePurchaseResult {
    return this.purchaseUpgrade("clampDampers", CLAMP_DAMPERS_COST_UNITS);
  }

  purchaseTetherReinforcement(): UpgradePurchaseResult {
    return this.purchaseUpgrade("tetherReinforcement", TETHER_REINFORCEMENT_COST_UNITS);
  }

  purchaseCutterOptics(): UpgradePurchaseResult {
    return this.purchaseUpgrade("cutterOptics", CUTTER_OPTICS_COST_UNITS);
  }

  getCaptureSpeedLimit(baseLimit: number): number {
    return this.state.upgrades.clampDampers
      ? CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND
      : baseLimit;
  }

  getTetherMaxTension(baseLimit: number): number {
    return this.state.upgrades.tetherReinforcement
      ? TETHER_REINFORCEMENT_MAX_TENSION_NEWTONS
      : baseLimit;
  }

  getCutterRange(baseRange: number): number {
    return this.state.upgrades.cutterOptics
      ? CUTTER_OPTICS_RANGE_METERS
      : baseRange;
  }

  hasClampDampers(): boolean { return this.state.upgrades.clampDampers; }
  hasTetherReinforcement(): boolean { return this.state.upgrades.tetherReinforcement; }
  hasCutterOptics(): boolean { return this.state.upgrades.cutterOptics; }

  getDiagnostics(): ProgressionDiagnostics {
    return {
      version: this.state.version,
      credits: this.state.credits,
      upgrades: { ...this.state.upgrades },
      nextRunId: this.state.nextRunId,
      completedRuns: this.state.completedRuns,
      failedRuns: this.state.failedRuns,
      lastSettledRunId: this.state.lastSettledRunId,
      lastFailedRunId: this.state.lastFailedRunId,
      loadState: this.loadState,
    };
  }

  private purchaseUpgrade(upgrade: keyof ProgressionUpgradeState, costUnits: number): UpgradePurchaseResult {
    if (this.state.upgrades[upgrade]) {
      return { purchased: false, reason: "already-owned", credits: this.state.credits };
    }
    if (this.state.credits < costUnits) {
      return { purchased: false, reason: "insufficient-credits", credits: this.state.credits };
    }

    this.state.credits -= costUnits;
    this.state.upgrades[upgrade] = true;
    this.persist();
    return { purchased: true, reason: "purchased", credits: this.state.credits };
  }

  private isCurrentRun(runId: number): boolean {
    return Number.isInteger(runId) && runId > 0 && runId === this.state.nextRunId - 1;
  }

  private writeState(): void {
    const serialized = JSON.stringify(this.state);
    this.storage.setItem(this.backupKey, serialized);
    this.storage.setItem(this.storageKey, serialized);
  }

  private persist(): void {
    this.writeState();
    if (this.loadState !== "migrated" && this.loadState !== "recovered-backup") this.loadState = "loaded";
  }
}
