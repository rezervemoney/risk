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
  const allPositions: IPosition[] = [...positions];
  if (borrowUsdc > 0) {
    // get the price of RZR in USD with the current ETH spot price. This is the case because
    // RZR liquidity is paired with ETH.
    const rzrUsdSpot = pool.getRzrPriceInUsd(ethSpot);

    // Based on the LTV we decide to use (this really does not matter as  we can mint infinite RZR), we
    // decide how much RZR is needed as collateral to borrow the target USDC
    const rzrAddedAsCollateral = borrowUsdc / (ltvForNew * rzrUsdSpot);

    // With RZR in and the USDC borrowed, we sell the USDC for ETH and add into liquidity. When we
    // add into liquidity we again mint fresh new RZR instead of buying off from the market.
    const newEthExposure = borrowUsdc / ethSpot;
    const newRzrMintedForLP = borrowUsdc / rzrUsdSpot; // mint and pair 1:1 in USD terms
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
