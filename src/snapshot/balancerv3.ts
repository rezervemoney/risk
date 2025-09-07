import { BalancerV3 } from "../dexes/BalancerV3";
import { IDex } from "../dexes/base";
import { POOL_CONFIGS, Source } from "./pools";
import axios from "axios";

interface PoolDataResponse {
  data: {
    poolGetPools: {
      id: string;
      name: string;
      poolTokens: {
        name: string;
        balanceUSD: string;
        address: string;
        symbol: string;
        weight: string;
      }[];
    }[];
  };
}

const balancerPools = POOL_CONFIGS.filter(
  (p) => p.source === Source.BALANCERV3
);

export async function getBalancerV3DexSnapshots(): Promise<IDex[]> {
  const ids = balancerPools.map((p) => `"${p.marketAddress}"`).join(",");
  const query = `{
    poolGetPools(where: { chainIn: MAINNET, idIn: [${ids}] }) {
      id
      name
      poolTokens {
        name
        address
        balanceUSD
        symbol
        weight
      }
    }
  }`;

  const resp = await axios.post<PoolDataResponse>(
    "https://api-v3.balancer.fi/graphql",
    { query },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );

  return resp.data.data.poolGetPools.map((p) => {
    return new BalancerV3(
      p.name, // public name: string,
      Number(p.poolTokens[0].balanceUSD), // public token0Reserve: number,
      Number(p.poolTokens[1].balanceUSD), // public token1Reserve: number,
      p.poolTokens[0].symbol, // public token0: string,
      p.poolTokens[1].symbol, // public token1: string,
      Number(p.poolTokens[0].weight), // public token0Weight: number,
      Number(p.poolTokens[1].weight), // public token1Weight: number,
      0.01 // 1% swap fee
    );
  });
}
