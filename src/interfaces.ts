export interface IPosition {
  collateralRzr: number;
  debtUsdc: number;
  healthScore: number;
  ltv: number;
  lltv: number;
  ethExposure: number;
  ethPrice: number;
}

export interface IPositionWithLiquidation extends IPosition {
  rzrLiquidationPrice: number; // Price at which the RZR position gets liquidated
  ethLiquidationPrice: number; // Price at which the ETH position gets liquidated
}
