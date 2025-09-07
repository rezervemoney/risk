import { IDex } from "../dexes/base";
import { POOL_CONFIGS, Source } from "./pools";
import { getUniswapV2TemplateDexSnapshots } from "./uniswapv2Template";

const pools = POOL_CONFIGS.filter((p) => p.source === Source.UNISWAPV2);
export async function getUniswapV2DexSnapshots(): Promise<IDex[]> {
  return getUniswapV2TemplateDexSnapshots("UniswapV2", "ethereum", pools);
}
