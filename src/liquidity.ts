export class LiquidityPool {
  public k: number;

  constructor(
    public rzrInLiquidityPool: number,
    public ethInLiquidityPool: number
  ) {
    this.k = this.rzrInLiquidityPool * this.ethInLiquidityPool;
  }

  getReserves(): { rzrReserve: number; ethReserve: number } {
    return {
      rzrReserve: this.rzrInLiquidityPool,
      ethReserve: this.ethInLiquidityPool,
    };
  }

  swapEthForRzr(ethSpent: number): {
    rzrReceived: number;
    newRzrPrice: number;
  } {
    // TODO: Implement the swap of RZR for ETH.
    this.ethInLiquidityPool -= ethSpent;
    const newRzrInPool = this.k / this.ethInLiquidityPool;
    const amountOut = newRzrInPool - this.rzrInLiquidityPool;
    return {
      rzrReceived: amountOut,
      newRzrPrice: this.ethInLiquidityPool / this.rzrInLiquidityPool,
    };
  }

  swapRzrForEth(rzrSpent: number): {
    ethReceived: number;
    newRzrPrice: number;
  } {
    this.rzrInLiquidityPool -= rzrSpent;
    const newRzrInPool = this.k / this.ethInLiquidityPool;
    const amountOut = newRzrInPool - this.rzrInLiquidityPool;
    return {
      ethReceived: amountOut,
      newRzrPrice: this.ethInLiquidityPool / this.rzrInLiquidityPool,
    };
  }

  getRzrPrice(): number {
    return this.ethInLiquidityPool / this.rzrInLiquidityPool;
  }

  getRzrPriceInUsd(ethPrice: number): number {
    return this.getRzrPrice() * ethPrice;
  }

  addLiquidity(ethAmount: number, rzrAmount: number) {
    this.ethInLiquidityPool += ethAmount;
    this.rzrInLiquidityPool += rzrAmount;
    this.k = this.ethInLiquidityPool * this.rzrInLiquidityPool;
  }

  removeLiquidity(ethAmount: number, rzrAmount: number) {
    this.ethInLiquidityPool -= ethAmount;
    this.rzrInLiquidityPool -= rzrAmount;
    this.k = this.ethInLiquidityPool * this.rzrInLiquidityPool;
  }

  toString(ethPrice: number): string {
    const price = (
      (this.ethInLiquidityPool / this.rzrInLiquidityPool) *
      ethPrice
    ).toFixed(2);

    const eth = this.ethInLiquidityPool.toFixed(2);
    const rzr = this.rzrInLiquidityPool.toFixed(2);
    return `LiquidityPool (ethReserve=${eth}, rzrReserve=${rzr}, price=${price})`;
  }
}
