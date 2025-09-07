import { IDex } from "../dexes/base";
import { getBalancerTemplateSnapshot } from "./balancerTemplate";
import { POOL_CONFIGS, Source } from "./pools";

const pools = POOL_CONFIGS.filter((p) => p.source === Source.BALANCERV3);
export async function getBalancerV3DexSnapshots(): Promise<IDex[]> {
  return getBalancerTemplateSnapshot(
    "BalancerV3",
    "https://api-v3.balancer.fi/graphql",
    pools.map((p) => p.marketAddress),
    "MAINNET"
  );
}
