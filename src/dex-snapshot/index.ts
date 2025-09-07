import assert from "assert";
import { IDex } from "../dexes/base";
import {
  getBalancerV3DexSnapshots,
  getBeetsDexSnapshots,
} from "./balancerv3-dexes";
import {
  getUniswapV2DexSnapshots,
  getShadowDexSnapshots,
  getEqualizerDexSnapshots,
} from "./uniswapv2-dexes";

export const getDexSnapshots = async () => {
  const balancerv3 = await getBalancerV3DexSnapshots();
  return [...balancerv3];
};

export class DexSnapshot {
  private dexes: IDex[];

  constructor() {
    this.dexes = [];
  }

  async loadSnapshots() {
    assert(this.dexes.length === 0, "Snapshots already loaded");
    this.dexes.push(...(await getBalancerV3DexSnapshots()));
    this.dexes.push(...(await getBeetsDexSnapshots()));
    this.dexes.push(...(await getUniswapV2DexSnapshots()));
    this.dexes.push(...(await getShadowDexSnapshots()));
    this.dexes.push(...(await getEqualizerDexSnapshots()));
  }

  async printSnapshotReserves() {
    const reserves = this.dexes.map((dex) => {
      const reserves = dex.getReserves();
      const token0 = dex.token0;
      const token1 = dex.token1;
      return {
        name: dex.name,
        reserves: {
          [token0]: reserves.token0,
          [token1]: reserves.token1,
        },
      };
    });

    console.log(reserves);
  }
}

const main = async () => {
  const dexSnapshot = new DexSnapshot();
  await dexSnapshot.loadSnapshots();
  await dexSnapshot.printSnapshotReserves();
};

if (require.main === module) main().catch(console.error);
