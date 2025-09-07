import { IDex } from "./base";

export class UniswapV3 implements IDex {
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
    this.token0Reserve -= fromTokenAmount;
    const newtoken1InPool = this.k / this.token0Reserve;
    const amountOut = newtoken1InPool - this.token1Reserve;

    if (toToken === this.token1 && fromToken === this.token0) {
      return {
        toTokenReceived: amountOut,
        newFromTokenPrice: this.token0Reserve / this.token1Reserve,
        newToTokenPrice: this.token1Reserve / this.token0Reserve,
      };
    }

    if (toToken === this.token0 && fromToken === this.token1) {
      return {
        toTokenReceived: amountOut,
        newFromTokenPrice: this.token0Reserve / this.token1Reserve,
        newToTokenPrice: this.token1Reserve / this.token0Reserve,
      };
    }

    throw new Error(`invalid swap`);
  }

  price(token: string): number {
    if (token === this.token0) return this.token0Reserve / this.token1Reserve;
    if (token === this.token1) return this.token1Reserve / this.token0Reserve;
    throw new Error(`invalid price`);
  }
}
