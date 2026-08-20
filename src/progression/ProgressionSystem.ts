export interface ProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESSION_SAVE_VERSION = 1 as const;
export const PROGRESSION_SAVE_KEY = "orbital-scrapper-progression-v1";
export const CLAMP_DAMPERS_COST_UNITS = 150;
export const CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND = 2;

export type ProgressionLoadState = "new" | "loaded" | "recovered";

export type ProgressionSaveV1 = {
  version: typeof PROGRESSION_SAVE_VERSION;
  credits: number;
  upgrades: {
    clampDampers: boolean;
  };
  nextRunId: number;
  completedRuns: number;
  failedRuns: number;
  lastSettledRunId: number | null;
  lastFailedRunId: number | null;
};

export type ProgressionDiagnostics = ProgressionSaveV1 & {
  loadState: ProgressionLoadState;
};

export type UpgradePurchaseResult = {
  purchased: boolean;
  reason: "purchased" | "already-owned" | "insufficient-credits";
  credits: number;
};

function defaultState(): ProgressionSaveV1 {
  return {
    version: PROGRESSION_SAVE_VERSION,
    credits: 0,
    upgrades: { clampDampers: false },
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

function parseState(raw: string | null): { state: ProgressionSaveV1; loadState: ProgressionLoadState } {
  if (raw === null) return { state: defaultState(), loadState: "new" };

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressionSaveV1> | null;
    if (!parsed || parsed.version !== PROGRESSION_SAVE_VERSION) {
      return { state: defaultState(), loadState: "recovered" };
    }
    if (!isNonNegativeInteger(parsed.credits)
      || !isNonNegativeInteger(parsed.completedRuns)
      || !isNonNegativeInteger(parsed.failedRuns)
      || !isNonNegativeInteger(parsed.nextRunId)
      || parsed.nextRunId < 1
      || !isNullablePositiveInteger(parsed.lastSettledRunId)
      || !isNullablePositiveInteger(parsed.lastFailedRunId)
      || typeof parsed.upgrades?.clampDampers !== "boolean") {
      return { state: defaultState(), loadState: "recovered" };
    }

    return {
      state: {
        version: PROGRESSION_SAVE_VERSION,
        credits: parsed.credits,
        upgrades: { clampDampers: parsed.upgrades.clampDampers },
        nextRunId: parsed.nextRunId,
        completedRuns: parsed.completedRuns,
        failedRuns: parsed.failedRuns,
        lastSettledRunId: parsed.lastSettledRunId,
        lastFailedRunId: parsed.lastFailedRunId,
      },
      loadState: "loaded",
    };
  } catch {
    return { state: defaultState(), loadState: "recovered" };
  }
}

export class ProgressionSystem {
  private state: ProgressionSaveV1;
  private loadState: ProgressionLoadState;

  constructor(
    private readonly storage: ProgressionStorage,
    private readonly storageKey = PROGRESSION_SAVE_KEY,
  ) {
    const loaded = parseState(storage.getItem(storageKey));
    this.state = loaded.state;
    this.loadState = loaded.loadState;
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
    if (this.state.upgrades.clampDampers) {
      return { purchased: false, reason: "already-owned", credits: this.state.credits };
    }
    if (this.state.credits < CLAMP_DAMPERS_COST_UNITS) {
      return { purchased: false, reason: "insufficient-credits", credits: this.state.credits };
    }

    this.state.credits -= CLAMP_DAMPERS_COST_UNITS;
    this.state.upgrades.clampDampers = true;
    this.persist();
    return { purchased: true, reason: "purchased", credits: this.state.credits };
  }

  getCaptureSpeedLimit(baseLimit: number): number {
    return this.state.upgrades.clampDampers
      ? CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND
      : baseLimit;
  }

  hasClampDampers(): boolean {
    return this.state.upgrades.clampDampers;
  }

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

  private isCurrentRun(runId: number): boolean {
    return Number.isInteger(runId) && runId > 0 && runId === this.state.nextRunId - 1;
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state));
    this.loadState = "loaded";
  }
}
