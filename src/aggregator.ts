import { IDex } from "./dexes/base";

export class Aggregator {
  constructor(public dexes: IDex[]) {}

  async getRzrPriceFromAllDexes() {
    return await this.dexes.map((dex) => {
      return {
        name: dex.name,
        price: dex.price("RZR"),
      };
    });
  }

  async executeBestSwap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ) {
    const price = await this.dexes.map((dex) =>
      dex.swap(fromToken, fromTokenAmount, toToken)
    );
    return price.reduce((a, b) =>
      a.toTokenReceived > b.toTokenReceived ? a : b
    );
  }

  async getRzrPriceAveraged() {
    const price = await this.dexes.map((dex) => dex.price("RZR"));
    return price.reduce((a, b) => a + b, 0) / price.length;
  }
}
