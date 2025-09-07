export interface PriceOracle {
  getPrice(token: string): number;
  getTokens(): string[];
}

export class SimplePriceOracle implements PriceOracle {
  private prices: Map<string, number>;

  constructor(prices: Record<string, number>) {
    this.prices = new Map(Object.entries(prices));
  }

  getPrice(token: string): number {
    const price = this.prices.get(token);
    if (price === undefined) {
      throw new Error(`Price not found for token: ${token}`);
    }
    return price;
  }

  getTokens(): string[] {
    return Array.from(this.prices.keys());
  }
}

export const mockPriceOracle = new SimplePriceOracle({
  RZR: 1.0,
  USDC: 1.0,
  USDT: 1.0,
  DAI: 1.0,
  WETH: 3000.0,
  ETH: 3000.0,
  wstETH: 3100.0,
  rETH: 3050.0,
  weETH: 3150.0,
  eBTC: 95000.0,
  ETHFI: 4.5,
  frxETH: 3000.0,
  crvUSD: 1.0,
  scUSD: 1.0,
  lstRZR: 1.1,
  stS: 0.95,
  scBTC: 95000.0,
});
