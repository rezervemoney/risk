import { minHealthUnderScenario, StressScenario } from "./scenarioChecker";
import { IPosition } from "../interfaces";
import { LiquidityPool } from "../liquidity";

// Feasibility check: safe if health >= 1 in *every* non-warning scenario
export function isBorrowSafeAcrossScenarios(
  borrowUsdc: number,
  scenarios: StressScenario[],
  positions: IPosition[],
  ethSpot: number,
  poolAtStart: LiquidityPool,
  ltvForNew: number,
  liquidationThreshold: number
) {
  for (const s of scenarios) {
    if (s.warningOnly) continue; // ignore warnings in gating
    const { minHealth } = minHealthUnderScenario(
      borrowUsdc,
      s,
      positions,
      ethSpot,
      ltvForNew,
      liquidationThreshold,
      poolAtStart
    );
    if (!(minHealth >= 1)) return false;
  }
  return true;
}
