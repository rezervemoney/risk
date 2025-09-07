import { getUniswapV2TemplateDexSnapshots } from "./templates/uniswapv2";
import { IDex } from "../dexes/base";
import { POOL_CONFIGS, Source } from "./pools";

export async function getShadowDexSnapshots(): Promise<IDex[]> {
  const pools = POOL_CONFIGS.filter((p) => p.source === Source.SHADOW);
  return getUniswapV2TemplateDexSnapshots("Shadow", "sonic", pools);
}

export async function getUniswapV2DexSnapshots(): Promise<IDex[]> {
  const pools = POOL_CONFIGS.filter((p) => p.source === Source.UNISWAPV2);
  return getUniswapV2TemplateDexSnapshots("UniswapV2", "ethereum", pools);
}

export async function getEqualizerDexSnapshots(): Promise<IDex[]> {
  const pools = POOL_CONFIGS.filter((p) => p.source === Source.EQUALIZER);
  return getUniswapV2TemplateDexSnapshots("Equalizer", "sonic", pools);
}
