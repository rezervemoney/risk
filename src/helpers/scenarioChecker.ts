import { computePositionMetrics } from "./positionMetrics";
import { IPosition } from "../interfaces";
import { LiquidityPool } from "../liquidity";

export type StressScenario = {
  name: string;
  rzrSold: number; // amount of RZR market-sold into the AMM
  ethPriceMultiplier: number; // ETH shock relative to base spot price
  warningOnly?: boolean; // if true, failing this scenario does not block borrowing (reported as warning)
};

/*************************************************
 * Core simulation primitives
 *************************************************/

// Add a *new* borrow position of size B, deepen the pool with paired liquidity
// (does not move price), then apply a stress scenario (RZR sells and ETH shock),
// and return the min health across all positions (existing + new).
export function minHealthUnderScenario(
  borrowUsdc: number,
  scenario: StressScenario,
  positions: IPosition[],
  ethSpot: number,
  ltvForNew: number,
  lltvForNew: number,
  poolAtStart: LiquidityPool
) {
  // 1) Start from the live pool state
  const pool = poolAtStart.clone();

  // 2) Add new borrow + liquidity add at current spot (price-neutral, deepens liquidity)
  let allPositions: IPosition[] = [...positions];
  if (borrowUsdc > 0) {
    const rzrUsdSpot = pool.getRzrPriceInUsd(ethSpot);
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
