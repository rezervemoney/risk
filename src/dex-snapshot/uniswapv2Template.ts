import { Chain, getContract } from "../helpers/contracts";
import { formatUnits } from "ethers";
import { IDex } from "../dexes/base";
import { PoolConfig } from "./pools";
import { UniswapV2 } from "../dexes/UniswapV2";
import UniswapV2PoolABI from "./abis/UniswapV2Pool.json";

export async function getUniswapV2TemplateDexSnapshots(
  name: string,
  chain: Chain,
  pools: PoolConfig[]
): Promise<IDex[]> {
  console.log(`fetching pool info for ${name} on ${chain}`);
  const dexes: IDex[] = [];
  for (const pool of pools) {
    const poolC = getContract(pool.marketAddress, UniswapV2PoolABI, chain);
    const token0 = await poolC.token0();
    const token1 = await poolC.token1();

    const token0C = getContract(token0, UniswapV2PoolABI, chain);
    const token1C = getContract(token1, UniswapV2PoolABI, chain);

    const token0Symbol = await token0C.symbol();
    const token0Decimals = await token0C.decimals();
    const token1Symbol = await token1C.symbol();
    const token1Decimals = await token1C.decimals();

    const [token0Reserve, token1Reserve] = await poolC.getReserves();

    dexes.push(
      new UniswapV2(
        name,
        Number(formatUnits(token0Reserve, token0Decimals)),
        Number(formatUnits(token1Reserve, token1Decimals)),
        token0Symbol,
        token1Symbol
      )
    );
  }

  return dexes;
}
