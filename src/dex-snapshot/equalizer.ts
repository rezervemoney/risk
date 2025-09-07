import { IDex } from "../dexes/base";
import { POOL_CONFIGS, Source } from "./pools";
import { getUniswapV2TemplateDexSnapshots } from "./uniswapv2Template";

const pools = POOL_CONFIGS.filter((p) => p.source === Source.EQUALIZER);
export async function getEqualizerDexSnapshots(): Promise<IDex[]> {
  return getUniswapV2TemplateDexSnapshots("Equalizer", "sonic", pools);
}
