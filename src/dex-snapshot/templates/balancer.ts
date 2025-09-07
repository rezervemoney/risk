import { BalancerV3 } from "../../dexes/BalancerV3";
import { IDex } from "../../dexes/base";
import axios from "axios";

interface PoolDataResponse {
  data: {
    poolGetPools: {
      id: string;
      name: string;
      poolTokens: {
        name: string;
        balance: string;
        address: string;
        symbol: string;
        weight: string;
      }[];
    }[];
  };
}

export async function getBalancerTemplateSnapshot(
  name: string,
  url: string,
  ids: string[],
  chain: "MAINNET" | "SONIC"
): Promise<IDex[]> {
  console.log(`fetching pool info for ${name} on ${chain}`);
  const idsJoined = ids.map((p) => `"${p}"`).join(",");
  const query = `{
    poolGetPools(where: { chainIn: ${chain}, idIn: [${idsJoined}] }) {
      id
      name
      poolTokens {
        name
        address
        balance
        symbol
        weight
      }
    }
  }`;

  const resp = await axios.post<PoolDataResponse>(
    url,
    { query },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );

  return resp.data.data.poolGetPools.map((p) => {
    return new BalancerV3(
      name, // public name: string,
      Number(p.poolTokens[0].balance), // public token0Reserve: number,
      Number(p.poolTokens[1].balance), // public token1Reserve: number,
      p.poolTokens[0].symbol, // public token0: string,
      p.poolTokens[1].symbol, // public token1: string,
      Number(p.poolTokens[0].weight), // public token0Weight: number,
      Number(p.poolTokens[1].weight), // public token1Weight: number,
      0.01 // 1% swap fee
    );
  });
}
