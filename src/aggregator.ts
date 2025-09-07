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

  async getRzrPriceAveraged() {
    const price = await this.dexes.map((dex) => dex.price("RZR"));
    return price.reduce((a, b) => a + b, 0) / price.length;
  }
}
