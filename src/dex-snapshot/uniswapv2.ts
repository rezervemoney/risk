import { formatUnits } from "ethers";
import { getEthereumContract } from "./contracts";
import { IDex } from "../dexes/base";
import { POOL_CONFIGS, Source } from "./pools";
import { UniswapV2 } from "../dexes/UniswapV2";
import UniswapV2PoolABI from "./abis/UniswapV2Pool.json";

const pools = POOL_CONFIGS.filter((p) => p.source === Source.UNISWAPV2);
export async function getUniswapV2DexSnapshots(): Promise<IDex[]> {
  const dexes: IDex[] = [];
  for (const pool of pools) {
    const poolC = getEthereumContract(pool.marketAddress, UniswapV2PoolABI);
    const token0 = await poolC.token0();
    const token1 = await poolC.token1();

    const token0C = getEthereumContract(token0, UniswapV2PoolABI);
    const token1C = getEthereumContract(token1, UniswapV2PoolABI);

    const token0Symbol = await token0C.symbol();
    const token0Decimals = await token0C.decimals();
    const token1Symbol = await token1C.symbol();
    const token1Decimals = await token1C.decimals();

    const [token0Reserve, token1Reserve] = await poolC.getReserves();

    dexes.push(
      new UniswapV2(
        "UniswapV2",
        Number(formatUnits(token0Reserve, token0Decimals)),
        Number(formatUnits(token1Reserve, token1Decimals)),
        token0Symbol,
        token1Symbol
      )
    );
  }

  return dexes;
}
