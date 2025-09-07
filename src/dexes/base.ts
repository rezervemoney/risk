export interface IDex {
  name: string;

  swap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): {
    toTokenReceived: number;
    newFromTokenPrice: number;
    newToTokenPrice: number;
  };

  price(token: string): number;

  getReserves(): { token0: number; token1: number };

  token0: string;
  token1: string;
}
