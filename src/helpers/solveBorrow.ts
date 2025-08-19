import { isBorrowSafeAcrossScenarios } from "./checkBorrow";
import { minHealthUnderScenario, StressScenario } from "./scenarioChecker";
import { IPosition } from "../interfaces";
import { LiquidityPool } from "../liquidity";

/*************************************************
 * Solver (binary search for both amount and LTV)
 *************************************************/
export function solveMaxBorrow(
  scenarios: StressScenario[],
  options: {
    tolerance: number; // USDC tolerance for the search
    supplyCap: number; // max borrow cap (defaults to availableUsdcSupply)
    positions: IPosition[];
    ethSpot: number;
    poolAtStart: LiquidityPool;
    ltvRange: { min: number; max: number }; // LTV range to search
    liquidationThreshold: number;
  }
) {
  const tolerance = options.tolerance; // $1 resolution
  const cap = options.supplyCap;
  const positions = options.positions;
  const ethSpot = options.ethSpot;
  const poolAtStart = options.poolAtStart;
  const ltvRange = options.ltvRange; // Default LTV range
  const liquidationThreshold = options.liquidationThreshold;

  let bestAmount = 0;
  let bestLtv = ltvRange.min;

  // Try different LTV values and find the best combination
  for (let ltv = ltvRange.min; ltv <= ltvRange.max; ltv += 0.05) {
    let lo = 0;
    let hi = cap;
    let bestForThisLtv = 0;

    // Quick check: if even $0 is unsafe with this LTV, skip to next LTV
    if (
      !isBorrowSafeAcrossScenarios(
        0,
        scenarios,
        positions,
        ethSpot,
        poolAtStart,
        ltv,
        liquidationThreshold
      )
    ) {
      continue;
    }

    while (hi - lo > tolerance) {
      const mid = (lo + hi) / 2;
      const ok = isBorrowSafeAcrossScenarios(
        mid,
        scenarios,
        positions,
        ethSpot,
        poolAtStart,
        ltv,
        liquidationThreshold
      );
      if (ok) {
        bestForThisLtv = mid;
        lo = mid; // try more
      } else {
        hi = mid; // try less
      }
    }

    // Update global best if this LTV gives a better result
    if (bestForThisLtv > bestAmount) {
      bestAmount = bestForThisLtv;
      bestLtv = ltv;
    }
  }

  // Also return a diagnostic breakdown at the found solution
  const diag = scenarios.map((s) => ({
    scenario: s.name,
    warningOnly: !!s.warningOnly,
    ...minHealthUnderScenario(
      bestAmount,
      s,
      positions,
      ethSpot,
      bestLtv, // Use the optimal LTV
      liquidationThreshold,
      poolAtStart
    ),
  }));

  return {
    maxSafeBorrowUsdc: Math.floor(bestAmount),
    optimalLtv: bestLtv,
    diagnostics: diag,
  };
}
