export interface IPosition {
  collateralRzr: number;
  debtUsdc: number;
  lltv: number;
  ethExposure: number;
  ethPrice: number;
}

export interface IPositionWithLiquidation extends IPosition {
  healthScore: number;
  ltv: number;
  rzrLiquidationPrice: number; // Price at which the RZR position gets liquidated
}
