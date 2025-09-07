import { IDex } from "./base";

interface IPosition {
  minTick: number;
  maxTick: number;
  liquidity: number;
}

export class UniswapV3 implements IDex {
  constructor(
    public token0: string,
    public token1: string,
    public fee: number,
    public sqrtPriceX96: number,
    public positions: IPosition[]
  ) {
    // todo
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
    throw new Error("Method not implemented.");
  }

  price(token: string): number {
    throw new Error("Method not implemented.");
  }

  getReserves(): { token0: number; token1: number } {
    throw new Error("Method not implemented.");
  }
}
