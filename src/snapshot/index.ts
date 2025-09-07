import { IDex } from "../dexes/base";
import { getBalancerV3DexSnapshots } from "./balancerv3";

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
    const balancerv3 = await getBalancerV3DexSnapshots();
    this.dexes = [...this.dexes, ...balancerv3];
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
