import { IPosition, IPositionWithLiquidation } from "./interfaces";
import { LiquidityPool } from "./liquidity";

/*************************************************
 * Parameters (same as your snippet, regrouped)
 *************************************************/
const liquidationPenalty = 0.15; // kept for reference if you later want to model post-liquidation losses
const loanToValue = 0.4; // base LTV for new borrows
const liquidationThreshold = 0.6; // LLTV used for liquidation checks
const availableUsdcSupply = 2000000;

// Collateral state
const rzrSupply = 652_183;
const rzrStaked = 231_693;
const rzrSupplyOwnedByTreasuryUnstaked = 304_153.5;
const rzrInLstRzrLP = 4_000;
const rzrInLiquidityPool = 55_260.24910078;
const stakedRzrInWithdrawalQueue = 2737;

const rzrWithHolders =
  rzrSupply - rzrStaked - rzrSupplyOwnedByTreasuryUnstaked - rzrInLiquidityPool; // 61076.25089922
const estimatedMaximumSellPressure =
  rzrInLstRzrLP + stakedRzrInWithdrawalQueue + rzrWithHolders; // 165076.25089922

// ETH + LP
const ethInLiquidityPool = 182;
const baseEthPrice = 4200; // current spot
const lp0 = new LiquidityPool(rzrInLiquidityPool, ethInLiquidityPool);

/*************************************************
 * Helpers
 *************************************************/
const currentRzrPriceInUsd = (pool: LiquidityPool, ethPrice: number) =>
  pool.getRzrPriceInUsd(ethPrice);

// NOTE: Liquidation is purely a function of collateral value vs. debt.
// ETH exposure is NOT counted as collateral here (kept separate for treasury PnL).
const computePositionMetrics = (
  pool: LiquidityPool,
  ethMktPrice: number,
  p: IPosition
): IPositionWithLiquidation => {
  const rzrUsd = currentRzrPriceInUsd(pool, ethMktPrice);
  const collateralUsd = p.collateralRzr * rzrUsd;
  const ltv = p.debtUsdc / collateralUsd;
  const healthScore = (p.lltv ?? liquidationThreshold) / ltv; // >= 1 is safe
  const rzrLiquidationPrice =
    p.debtUsdc / ((p.lltv ?? liquidationThreshold) * p.collateralRzr);
  return { ...p, ltv, healthScore, rzrLiquidationPrice };
};

/*************************************************
 * Existing positions (unchanged semantics)
 *************************************************/
const basePositions: IPosition[] = [
  // {
  //   collateralRzr: 12000,
  //   debtUsdc: 10000,
  //   lltv: 0.8,
  //   ethExposure: 11.834401863557658981,
  //   ethPrice: 4224.97060489, // entry price of ETH exposure (not used for liquidation)
  // },
];

/*************************************************
 * Scenario engine
 *************************************************/
export type StressScenario = {
  name: string;
  rzrSold: number; // amount of RZR market-sold into the AMM
  ethPriceMultiplier: number; // ETH shock relative to base spot price
  warningOnly?: boolean; // if true, failing this scenario does not block borrowing (reported as warning)
};

// Default scenario set. You can extend/replace this at runtime.
const defaultScenarios: StressScenario[] = [
  { name: "No stress", rzrSold: 0, ethPriceMultiplier: 1.0 },
  { name: "Mild sell (5k)", rzrSold: 5_000, ethPriceMultiplier: 1.0 },
  {
    name: "Moderate sell (30k)",
    rzrSold: 30_000,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  {
    name: "All holders sell",
    rzrSold: rzrWithHolders,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  {
    name: "Max pressure",
    rzrSold: estimatedMaximumSellPressure,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  { name: "ETH -15%", rzrSold: 0, ethPriceMultiplier: 0.85 },
  { name: "ETH -30%", rzrSold: 0, ethPriceMultiplier: 0.7 },
  { name: "ETH -50%", rzrSold: 0, ethPriceMultiplier: 0.5, warningOnly: false },
  { name: "ETH -80%", rzrSold: 0, ethPriceMultiplier: 0.2, warningOnly: true },
  {
    name: "ETH -30% + 30k RZR sold",
    rzrSold: 30_000,
    ethPriceMultiplier: 0.7,
    warningOnly: true,
  },
  {
    name: "ETH -50% + 30k RZR sold",
    rzrSold: 30_000,
    ethPriceMultiplier: 0.5,
    warningOnly: true,
  },
  {
    name: "ETH -30% + Max pressure",
    rzrSold: estimatedMaximumSellPressure,
    ethPriceMultiplier: 0.7,
    warningOnly: true,
  },
  { name: "ETH +15%", rzrSold: 0, ethPriceMultiplier: 1.15 },
];

/*************************************************
 * Core simulation primitives
 *************************************************/

// Add a *new* borrow position of size B, deepen the pool with paired liquidity
// (does not move price), then apply a stress scenario (RZR sells and ETH shock),
// and return the min health across all positions (existing + new).
function minHealthUnderScenario(
  borrowUsdc: number,
  scenario: StressScenario,
  positions: IPosition[] = basePositions,
  ethSpot: number = baseEthPrice,
  ltvForNew: number = loanToValue,
  lltvForNew: number = liquidationThreshold,
  poolAtStart: LiquidityPool = lp0
) {
  // 1) Start from the live pool state
  const pool = poolAtStart.clone();

  // 2) Add new borrow + liquidity add at current spot (price-neutral, deepens liquidity)
  let allPositions: IPosition[] = [...positions];
  if (borrowUsdc > 0) {
    const rzrUsdSpot = currentRzrPriceInUsd(pool, ethSpot);
    const rzrAddedAsCollateral = borrowUsdc / (ltvForNew * rzrUsdSpot);
    const newEthExposure = borrowUsdc / ethSpot;
    const newRzrMintedForLP = borrowUsdc / rzrUsdSpot; // pair 1:1 in USD terms
    pool.addLiquidity(newEthExposure, newRzrMintedForLP);

    allPositions.push({
      collateralRzr: rzrAddedAsCollateral,
      debtUsdc: borrowUsdc,
      lltv: lltvForNew,
      ethExposure: newEthExposure,
      ethPrice: ethSpot, // tracking only
    });
  }

  // 3) Apply stress: market sells into RZR/ETH AMM, then ETH USD shock
  if (scenario.rzrSold > 0) pool.swapRzrForEth(scenario.rzrSold);
  const shockedEth = ethSpot * scenario.ethPriceMultiplier;

  // 4) Compute health of all positions at shocked state
  const metrics = allPositions.map((p) =>
    computePositionMetrics(pool, shockedEth, p)
  );
  const minHealth = metrics.reduce(
    (m, p) => Math.min(m, p.healthScore),
    +Infinity
  );

  return { minHealth, metrics, poolAfter: pool, shockedEth };
}

// Feasibility check: safe if health >= 1 in *every* non-warning scenario
function isBorrowSafeAcrossScenarios(
  borrowUsdc: number,
  scenarios: StressScenario[] = defaultScenarios,
  positions: IPosition[] = basePositions,
  ethSpot: number = baseEthPrice,
  poolAtStart: LiquidityPool = lp0,
  ltvForNew: number = loanToValue
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
    if (!(minHealth >= 1)) {
      console.log(`minHealth: ${minHealth}, scenario: ${s.name}`);
      return false;
    }
  }
  return true;
}

/*************************************************
 * Solver (binary search for both amount and LTV)
 *************************************************/
export function solveMaxBorrow(
  scenarios: StressScenario[] = defaultScenarios,
  options?: {
    tolerance?: number; // USDC tolerance for the search
    supplyCap?: number; // max borrow cap (defaults to availableUsdcSupply)
    positions?: IPosition[];
    ethSpot?: number;
    poolAtStart?: LiquidityPool;
    ltvRange?: { min: number; max: number }; // LTV range to search
  }
) {
  const tolerance = options?.tolerance ?? 1; // $1 resolution
  const cap = options?.supplyCap ?? availableUsdcSupply;
  const positions = options?.positions ?? basePositions;
  const ethSpot = options?.ethSpot ?? baseEthPrice;
  const poolAtStart = options?.poolAtStart ?? lp0;
  const ltvRange = options?.ltvRange ?? { min: 0.1, max: 0.8 }; // Default LTV range

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
        ltv
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
        ltv
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

/*************************************************
 * Example: run the solver and log a summary
 *************************************************/
function run() {
  // Log base spot and price
  console.log("Base ETH spot:", baseEthPrice);
  console.log("Base RZR spot (USD):", currentRzrPriceInUsd(lp0, baseEthPrice));

  const { maxSafeBorrowUsdc, optimalLtv, diagnostics } = solveMaxBorrow();
  console.log(
    "\n================ Max Safe Borrow (across default scenarios) ================"
  );
  console.log(
    "Max USDC you can borrow while staying above liquidation:",
    maxSafeBorrowUsdc
  );
  console.log("Optimal LTV for the new borrow:", optimalLtv.toFixed(3));

  console.log("\nScenario diagnostics (min health across positions)");
  for (const d of diagnostics) {
    const tag = d.warningOnly ? "[warning]" : "[normal]";
    let colorStart = "";
    let colorEnd = "";

    if (d.minHealth < 1 && !d.warningOnly) {
      colorStart = "\x1b[31m"; // Red for dangerous scenarios (health < 1)
      colorEnd = "\x1b[0m";
    } else if (d.warningOnly && d.minHealth < 1) {
      colorStart = "\x1b[33m"; // Yellow for warnings
      colorEnd = "\x1b[0m";
    }

    console.log(
      `${colorStart}- ${d.scenario} ${tag}: minHealth=${d.minHealth.toFixed(
        3
      )} | ETH(USD)=${d.shockedEth.toFixed(2)} | RZR(USD)=${d.poolAfter
        .getRzrPriceInUsd(d.shockedEth)
        .toFixed(4)}${colorEnd}`
    );
  }
}

/*************************************************
 * Notes / Extensions:
 * 1) If you want ETH exposure to *count* toward collateral, change computePositionMetrics()
 *    to include + p.ethExposure * ethMktPrice in collateralUsd (but that materially
 *    changes liquidation semantics vs. typical onchain lending).
 * 2) You can add path-dependent stress (multi-step sells + ETH drift) by applying
 *    swapRzrForEth() in increments and iterating ethPriceMultiplier over time.
 * 3) liquidationPenalty is kept for treasury loss modeling after a breach; it’s
 *    not used in the pre-breach feasibility check.
 * 4) To model slippage fees, embed them in LiquidityPool.swapRzrForEth().
 *************************************************/
run();
