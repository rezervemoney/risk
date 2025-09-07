export enum Chain {
  ETHEREUM = "ethereum",
  POLYGON = "polygon",
  ARBITRUM = "arbitrum",
  OPTIMISM = "optimism",
  BASE = "base",
  SONIC = "sonic",
}

export enum Source {
  BALANCERV3 = "BalancerV3",
  EQUALIZER = "Equalizer",
  BEETS = "Beets",
  SHADOW = "Shadow",
  CURVE = "Curve",
  UNISWAPV2 = "UniswapV2",
  UNISWAPV3 = "UniswapV3",
}

export interface PoolConfig {
  name: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  source: Source;
  chain: Chain;
  marketAddress: string;
}

export const POOL_CONFIGS: PoolConfig[] = [
  {
    name: "RZR/scUSD",
    source: Source.EQUALIZER,
    chain: Chain.SONIC,
    marketAddress: "0xFF3a2650C5ffd0745FB93261671E6d3E95f2C082",
  },
  {
    name: "RZR/lstRZR",
    source: Source.EQUALIZER,
    chain: Chain.SONIC,
    marketAddress: "0xD9925FB0f88D087FfEdFCD88b032e55c82d171Df",
  },
  {
    name: "RZR/stS",
    source: Source.BEETS,
    chain: Chain.SONIC,
    marketAddress: "0x36e6765907dd61b50ad33f79574dd1b63339b59c",
  },
  {
    name: "lstRZR/stS",
    source: Source.BEETS,
    chain: Chain.SONIC,
    marketAddress: "0x307cc0ab64dc0496cc113357ee14c53d4db4b966",
  },
  {
    name: "RZR/scUSD",
    source: Source.SHADOW,
    chain: Chain.SONIC,
    marketAddress: "0x08c5e3b7533ee819a4d1f66e839d0e8f04ae3d0c",
  },
  {
    name: "Shadow RZR/scBTC",
    source: Source.SHADOW,
    chain: Chain.SONIC,
    marketAddress: "0x2b72f47cc98dbab6233aa56822acf28d1a2b087b",
  },
  {
    name: "RZR/USDC",
    source: Source.SHADOW,
    chain: Chain.SONIC,
    marketAddress: "0x3eab8439805b5fa0a2ddfe01d7f4ac30f9cf7907",
  },
  {
    name: "RZR/ETH",
    source: Source.BEETS,
    chain: Chain.SONIC,
    marketAddress: "0xf0b29acebb577c52a7afbecdcdd9dbfd3b82cf12",
  },
  {
    name: "RZR/wstETH",
    source: Source.BALANCERV3,
    chain: Chain.ETHEREUM,
    marketAddress: "0xf2d8ad2984aa8050dd1ca1e74b862b165f7a622a",
  },
  {
    name: "RZR/rETH",
    source: Source.BALANCERV3,
    chain: Chain.ETHEREUM,
    marketAddress: "0x3c2d67e73150dcc80f8fd17227c50989ac9fb570",
  },
  {
    name: "RZR/weETH",
    source: Source.BALANCERV3,
    chain: Chain.ETHEREUM,
    marketAddress: "0x3f89f8c0e0ffdfae0b97959303831fa893f1cfe0",
  },
  {
    name: "RZR/eBTC",
    source: Source.BALANCERV3,
    chain: Chain.ETHEREUM,
    marketAddress: "0x91fae2cbfacc492e668f9259190b3b098175d304",
  },
  {
    name: "RZR/ETHFI",
    source: Source.BALANCERV3,
    chain: Chain.ETHEREUM,
    marketAddress: "0x8115054a485d7775e13a8a420dd986ff595824fa",
  },
  {
    name: "RZR/frxETH/crvUSD",
    source: Source.CURVE,
    chain: Chain.ETHEREUM,
    marketAddress: "0xc2FcdD48209DD383B1f2AC120b84b2A75EE18BD3",
  },
];
