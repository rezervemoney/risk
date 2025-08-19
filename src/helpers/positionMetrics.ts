import { IPosition, IPositionWithLiquidation } from "../interfaces";
import { LiquidityPool } from "../liquidity";

// NOTE: Liquidation is purely a function of collateral value vs. debt.
// ETH exposure is NOT counted as collateral here (kept separate for treasury PnL).
export const computePositionMetrics = (
  pool: LiquidityPool,
  ethMktPrice: number,
  p: IPosition
): IPositionWithLiquidation => {
  const rzrUsd = pool.getRzrPriceInUsd(ethMktPrice);
  const collateralUsd = p.collateralRzr * rzrUsd;
  const ltv = p.debtUsdc / collateralUsd;
  const healthScore = p.lltv / ltv; // >= 1 is safe
  const rzrLiquidationPrice = p.debtUsdc / (p.lltv * p.collateralRzr);
  return { ...p, ltv, healthScore, rzrLiquidationPrice };
};
