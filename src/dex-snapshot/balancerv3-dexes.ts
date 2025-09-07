import { IDex } from "../dexes/base";
import { getBalancerTemplateSnapshot } from "./templates/balancer";
import { POOL_CONFIGS, Source } from "./pools";

export async function getBalancerV3DexSnapshots(): Promise<IDex[]> {
  const pools = POOL_CONFIGS.filter((p) => p.source === Source.BALANCERV3);
  return getBalancerTemplateSnapshot(
    "BalancerV3",
    "https://api-v3.balancer.fi/graphql",
    pools.map((p) => p.marketAddress),
    "MAINNET"
  );
}

export async function getBeetsDexSnapshots(): Promise<IDex[]> {
  const pools = POOL_CONFIGS.filter((p) => p.source === Source.BEETS);
  return getBalancerTemplateSnapshot(
    "Beets",
    "https://backend-v3.beets-ftm-node.com/graphql",
    pools.map((p) => p.marketAddress),
    "SONIC"
  );
}
