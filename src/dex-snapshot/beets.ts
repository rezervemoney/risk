import { IDex } from "../dexes/base";
import { getBalancerTemplateSnapshot } from "./balancerTemplate";
import { POOL_CONFIGS, Source } from "./pools";

const pools = POOL_CONFIGS.filter((p) => p.source === Source.BEETS);
export async function getBeetsDexSnapshots(): Promise<IDex[]> {
  return getBalancerTemplateSnapshot(
    "Beets",
    "https://backend-v3.beets-ftm-node.com/graphql",
    pools.map((p) => p.marketAddress),
    "SONIC"
  );
}
