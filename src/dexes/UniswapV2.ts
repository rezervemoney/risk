import { IDex } from "./base";

export class UniswapV2 implements IDex {
  public k: number;

  constructor(
    public token0Reserve: number,
    public token1Reserve: number,
    public token0: string,
    public token1: string
  ) {
    this.k = this.token0Reserve * this.token1Reserve;
  }

  getReserves() {
    return {
      token0: this.token0Reserve,
      token1: this.token1Reserve,
    };
  }

  swap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): {
    toTokenReceived: number;
    newFromTokenPrice: number;
    newToTokenPrice: number;
  } {
    // Validate fromToken
    if (fromToken !== this.token0 && fromToken !== this.token1) {
      throw new Error(`Token ${fromToken} not found`);
    }

    // Validate toToken
    if (toToken !== this.token0 && toToken !== this.token1) {
      throw new Error(`Token ${toToken} not found`);
    }

    // Cannot swap to the same token
    if (fromToken === toToken) {
      throw new Error("Cannot swap to the same token");
    }

    let newToken0Reserve: number;
    let newToken1Reserve: number;
    let amountOut: number;

    if (fromToken === this.token0 && toToken === this.token1) {
      // Swapping token0 for token1
      newToken0Reserve = this.token0Reserve + fromTokenAmount;
      newToken1Reserve = this.k / newToken0Reserve;
      amountOut = this.token1Reserve - newToken1Reserve;
    } else {
      // Swapping token1 for token0
      newToken1Reserve = this.token1Reserve + fromTokenAmount;
      newToken0Reserve = this.k / newToken1Reserve;
      amountOut = this.token0Reserve - newToken0Reserve;
    }

    // Update reserves
    this.token0Reserve = newToken0Reserve;
    this.token1Reserve = newToken1Reserve;

    return {
      toTokenReceived: amountOut,
      newFromTokenPrice: newToken0Reserve / newToken1Reserve,
      newToTokenPrice: newToken1Reserve / newToken0Reserve,
    };
  }

  price(token: string): number {
    if (token === this.token0) return this.token0Reserve / this.token1Reserve;
    if (token === this.token1) return this.token1Reserve / this.token0Reserve;
    throw new Error(`Token ${token} not found`);
  }
}
