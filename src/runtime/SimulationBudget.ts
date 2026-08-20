import type { CargoSystem } from "../cargo/CargoSystem.js";
import type { WreckSandbox } from "../physics/WreckSandbox.js";

export const RELEASE_ACTIVE_RIGID_BODY_BUDGET = 24;
export const RELEASE_PRODUCTION_SPARK_BUDGET = 14;

export type SimulationBudgetDiagnostics = {
  bodyRecords: number;
  enabledBodies: number;
  awakeBodies: number;
  sleepingBodies: number;
  disabledBodies: number;
  securedCargoBodies: number;
  activeBodyBudget: number;
  withinActiveBodyBudget: boolean;
};

export function getSimulationBudgetDiagnostics(
  sandbox: WreckSandbox,
  cargo: CargoSystem | null = null,
): SimulationBudgetDiagnostics {
  const records = sandbox.getBodyRecords();
  let enabledBodies = 0;
  let awakeBodies = 0;
  let sleepingBodies = 0;
  let disabledBodies = 0;

  for (const record of records) {
    if (!record.body.isEnabled()) {
      disabledBodies += 1;
      continue;
    }
    enabledBodies += 1;
    if (record.body.isSleeping()) sleepingBodies += 1;
    else awakeBodies += 1;
  }

  return {
    bodyRecords: records.length,
    enabledBodies,
    awakeBodies,
    sleepingBodies,
    disabledBodies,
    securedCargoBodies: cargo?.getSecuredCargo().length ?? 0,
    activeBodyBudget: RELEASE_ACTIVE_RIGID_BODY_BUDGET,
    withinActiveBodyBudget: enabledBodies <= RELEASE_ACTIVE_RIGID_BODY_BUDGET,
  };
}

export function assertReleaseBodyBudget(sandbox: WreckSandbox): void {
  const diagnostics = getSimulationBudgetDiagnostics(sandbox);
  if (!diagnostics.withinActiveBodyBudget) {
    throw new Error(
      `Release active rigid-body budget exceeded: ${diagnostics.enabledBodies}/${diagnostics.activeBodyBudget}`,
    );
  }
}
