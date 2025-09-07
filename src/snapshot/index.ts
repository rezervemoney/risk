import assert from "assert";
import { IDex } from "../dexes/base";
import { getBalancerV3DexSnapshots } from "./balancerv3";
import { getBeetsDexSnapshots } from "./beets";

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
    const balancerv3 = await getBalancerV3DexSnapshots();
    const beets = await getBeetsDexSnapshots();
    this.dexes = [...balancerv3, ...beets];
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

main();
