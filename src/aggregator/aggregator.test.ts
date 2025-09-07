import { Aggregator } from "./index";
import { mockPriceOracle, SimplePriceOracle } from "./oracle";
import { IDex } from "../dexes/base";
import { BalancerV3 } from "../dexes/BalancerV3";
import { UniswapV2 } from "../dexes/UniswapV2";

// Mock DEX implementations for testing
class MockDex implements IDex {
  constructor(
    public name: string,
    public token0: string,
    public token1: string,
    private token0Reserve: number,
    private token1Reserve: number,
    private swapFee: number = 0.003
  ) {}

  swap(fromToken: string, fromTokenAmount: number, toToken: string) {
    if (fromToken === toToken) {
      throw new Error("Cannot swap to the same token");
    }

    if (fromTokenAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!this.supportsTokenPair(fromToken, toToken)) {
      throw new Error(`Token pair ${fromToken}/${toToken} not supported`);
    }

    // Simple constant product formula for testing
    const fromReserve =
      fromToken === this.token0 ? this.token0Reserve : this.token1Reserve;
    const toReserve =
      toToken === this.token0 ? this.token0Reserve : this.token1Reserve;

    const amountInWithFee = fromTokenAmount * (1 - this.swapFee);
    const amountOut =
      (amountInWithFee * toReserve) / (fromReserve + amountInWithFee);

    // Update reserves
    if (fromToken === this.token0) {
      this.token0Reserve += fromTokenAmount;
      this.token1Reserve -= amountOut;
    } else {
      this.token1Reserve += fromTokenAmount;
      this.token0Reserve -= amountOut;
    }

    return {
      toTokenReceived: amountOut,
      newFromTokenPrice: this.price(fromToken),
      newToTokenPrice: this.price(toToken),
    };
  }

  price(token: string): number {
    if (token === this.token0) {
      return this.token1Reserve / this.token0Reserve;
    } else if (token === this.token1) {
      return this.token0Reserve / this.token1Reserve;
    }
    throw new Error(`Token ${token} not found`);
  }

  getReserves() {
    return {
      token0: this.token0Reserve,
      token1: this.token1Reserve,
    };
  }

  private supportsTokenPair(fromToken: string, toToken: string): boolean {
    return (
      (fromToken === this.token0 && toToken === this.token1) ||
      (fromToken === this.token1 && toToken === this.token0)
    );
  }
}

describe("Aggregator", () => {
  let aggregator: Aggregator;
  let mockDexes: IDex[];
  let priceOracle: SimplePriceOracle;

  beforeEach(() => {
    // Create mock DEXes with different liquidity depths
    mockDexes = [
      new MockDex("DEX1", "RZR", "USDC", 1000000, 1000000, 0.003), // High liquidity
      new MockDex("DEX2", "RZR", "WETH", 500000, 200, 0.003), // Medium liquidity
      new MockDex("DEX3", "USDC", "WETH", 2000000, 600, 0.003), // High liquidity
      new MockDex("DEX4", "RZR", "DAI", 200000, 200000, 0.003), // Low liquidity
      new MockDex("DEX5", "DAI", "WETH", 1000000, 300, 0.003), // Medium liquidity
      new MockDex("DEX6", "USDC", "DAI", 500000, 500000, 0.003), // Medium liquidity
    ];

    priceOracle = new SimplePriceOracle({
      RZR: 1.0,
      USDC: 1.0,
      WETH: 3000.0,
      DAI: 1.0,
      eBTC: 95000.0,
      ETHFI: 4.5,
    });

    aggregator = new Aggregator(mockDexes, priceOracle);
  });

  describe("constructor", () => {
    it("should initialize with default price oracle", () => {
      const defaultAggregator = new Aggregator(mockDexes, mockPriceOracle);
      expect(defaultAggregator).toBeDefined();
    });

    it("should initialize with custom price oracle", () => {
      expect(aggregator).toBeDefined();
    });
  });

  describe("findOptimalSwapPath", () => {
    it("should find direct swap path when available", async () => {
      const result = await aggregator.findOptimalSwapPath("RZR", 1000, "USDC");

      expect(result).toBeDefined();
      expect(result!.path).toEqual(["RZR", "USDC"]);
      expect(result!.steps).toHaveLength(1);
      expect(result!.totalOutput).toBeGreaterThan(0);
    });

    it("should find multi-hop path when direct swap has high slippage", async () => {
      // Create a scenario where direct swap has high slippage
      const highSlippageDex = new MockDex(
        "HighSlippageDEX",
        "RZR",
        "USDC",
        1000,
        1000,
        0.1
      ); // 10% fee
      const testDexes = [highSlippageDex, ...mockDexes];
      const testAggregator = new Aggregator(testDexes, priceOracle);

      const result = await testAggregator.findOptimalSwapPath(
        "RZR",
        10000,
        "USDC"
      );

      expect(result).toBeDefined();
      // Should prefer the path with lower slippage
      expect(result!.slippage).toBeLessThan(0.1);
    });

    it("should return null when no path is available", async () => {
      const isolatedDex = new MockDex(
        "IsolatedDEX",
        "UNKNOWN",
        "TOKEN",
        1000,
        1000
      );
      const testAggregator = new Aggregator([isolatedDex], priceOracle);

      const result = await testAggregator.findOptimalSwapPath(
        "RZR",
        1000,
        "USDC"
      );

      expect(result).toBeNull();
    });

    it("should handle large swap amounts", async () => {
      const result = await aggregator.findOptimalSwapPath(
        "RZR",
        100000,
        "USDC"
      );

      expect(result).toBeDefined();
      expect(result!.totalOutput).toBeGreaterThan(0);
      expect(result!.slippage).toBeGreaterThan(0);
    });
  });

  describe("executeOptimalSwap", () => {
    it("should execute optimal swap and log results", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const result = await aggregator.executeOptimalSwap("RZR", 1000, "USDC");

      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Optimal path found:")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Total output:")
      );

      consoleSpy.mockRestore();
    });

    it("should handle multi-step swaps", async () => {
      const result = await aggregator.executeOptimalSwap("RZR", 1000, "WETH");

      expect(result).toBeDefined();
      expect(result!.path.length).toBeGreaterThanOrEqual(2);
      expect(result!.steps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getAvailablePairs", () => {
    it("should return all available trading pairs", () => {
      const pairs = aggregator.getAvailablePairs();

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toHaveProperty("token0");
      expect(pairs[0]).toHaveProperty("token1");
      expect(pairs[0]).toHaveProperty("dexes");
      expect(Array.isArray(pairs[0].dexes)).toBe(true);
    });

    it("should group DEXes by token pair", () => {
      const pairs = aggregator.getAvailablePairs();
      const rzrUsdcPair = pairs.find(
        (p) =>
          (p.token0 === "RZR" && p.token1 === "USDC") ||
          (p.token0 === "USDC" && p.token1 === "RZR")
      );

      expect(rzrUsdcPair).toBeDefined();
      expect(rzrUsdcPair!.dexes.length).toBeGreaterThan(0);
    });
  });

  describe("getLiquidityDepth", () => {
    it("should calculate liquidity depth for a token pair", () => {
      const depth = aggregator.getLiquidityDepth("RZR", "USDC");

      expect(depth).toBeGreaterThan(0);
      expect(typeof depth).toBe("number");
    });

    it("should return 0 for non-existent pair", () => {
      const depth = aggregator.getLiquidityDepth("NONEXISTENT", "TOKEN");

      expect(depth).toBe(0);
    });

    it("should return same depth regardless of token order", () => {
      const depth1 = aggregator.getLiquidityDepth("RZR", "USDC");
      const depth2 = aggregator.getLiquidityDepth("USDC", "RZR");

      expect(depth1).toBe(depth2);
    });
  });

  describe("legacy methods", () => {
    it("should maintain backward compatibility with getRzrPriceFromAllDexes", async () => {
      // Only test DEXes that support RZR
      const rzrDexes = mockDexes.filter(
        (dex) => dex.token0 === "RZR" || dex.token1 === "RZR"
      );
      const testAggregator = new Aggregator(rzrDexes, priceOracle);

      const prices = await testAggregator.getRzrPriceFromAllDexes();

      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBeGreaterThan(0);
      expect(prices[0]).toHaveProperty("name");
      expect(prices[0]).toHaveProperty("price");
    });

    it("should maintain backward compatibility with executeBestSwap", async () => {
      const result = await aggregator.executeBestSwap("RZR", 1000, "USDC");

      // The result should be a SwapStep object with the expected properties
      expect(result).toHaveProperty("amountOut");
      expect(result).toHaveProperty("fromToken");
      expect(result).toHaveProperty("toToken");
      expect(result).toHaveProperty("dex");
      expect((result as any).amountOut).toBeGreaterThan(0);
    });

    it("should maintain backward compatibility with getRzrPriceAveraged", async () => {
      // Only test DEXes that support RZR
      const rzrDexes = mockDexes.filter(
        (dex) => dex.token0 === "RZR" || dex.token1 === "RZR"
      );
      const testAggregator = new Aggregator(rzrDexes, priceOracle);

      const avgPrice = await testAggregator.getRzrPriceAveraged();

      expect(typeof avgPrice).toBe("number");
      expect(avgPrice).toBeGreaterThan(0);
    });
  });

  describe("path finding edge cases", () => {
    it("should handle circular paths", async () => {
      // Add a circular path: RZR -> USDC -> DAI -> RZR
      const result = await aggregator.findOptimalSwapPath("RZR", 1000, "RZR");

      // Should not find a path (same token)
      expect(result).toBeNull();
    });

    it("should respect maximum path length", async () => {
      // Test with a very long potential path
      const longPathDexes = [
        new MockDex("DEX1", "A", "B", 1000, 1000),
        new MockDex("DEX2", "B", "C", 1000, 1000),
        new MockDex("DEX3", "C", "D", 1000, 1000),
        new MockDex("DEX4", "D", "E", 1000, 1000),
        new MockDex("DEX5", "E", "F", 1000, 1000),
      ];

      const testAggregator = new Aggregator(longPathDexes, priceOracle);
      const result = await testAggregator.findOptimalSwapPath("A", 100, "F");

      // Should find a path but respect max length
      if (result) {
        expect(result.path.length).toBeLessThanOrEqual(4); // maxPathLength + 1
      }
    });

    it("should handle DEX failures gracefully", async () => {
      // Create a DEX that throws errors
      const failingDex = {
        name: "FailingDEX",
        token0: "RZR",
        token1: "USDC",
        swap: () => {
          throw new Error("DEX failure");
        },
        price: () => {
          throw new Error("Price failure");
        },
        getReserves: () => ({ token0: 0, token1: 0 }),
      };

      const testDexes = [failingDex, ...mockDexes];
      const testAggregator = new Aggregator(testDexes, priceOracle);

      const result = await testAggregator.findOptimalSwapPath(
        "RZR",
        1000,
        "USDC"
      );

      // Should still find a path using working DEXes
      expect(result).toBeDefined();
    });
  });

  describe("slippage and price impact calculations", () => {
    it("should calculate slippage correctly", async () => {
      const result = await aggregator.findOptimalSwapPath("RZR", 1000, "USDC");

      expect(result).toBeDefined();
      expect(result!.slippage).toBeGreaterThanOrEqual(0);
      expect(result!.slippage).toBeLessThan(1); // Should be less than 100%
    });

    it("should calculate price impact correctly", async () => {
      const result = await aggregator.findOptimalSwapPath("RZR", 1000, "USDC");

      expect(result).toBeDefined();
      expect(result!.steps[0].priceImpact).toBeGreaterThanOrEqual(0);
    });

    it("should prefer paths with lower slippage", async () => {
      // Create two DEXes with different slippage characteristics
      const lowSlippageDex = new MockDex(
        "LowSlippage",
        "RZR",
        "USDC",
        1000000,
        1000000,
        0.001
      );
      const highSlippageDex = new MockDex(
        "HighSlippage",
        "RZR",
        "USDC",
        1000,
        1000,
        0.05
      );

      const testDexes = [lowSlippageDex, highSlippageDex];
      const testAggregator = new Aggregator(testDexes, priceOracle);

      const result = await testAggregator.findOptimalSwapPath(
        "RZR",
        1000,
        "USDC"
      );

      expect(result).toBeDefined();
      // Should prefer the low slippage DEX
      expect(result!.steps[0].dex.name).toBe("LowSlippage");
    });
  });

  describe("integration with real DEX implementations", () => {
    it("should work with BalancerV3 DEXes", async () => {
      const balancerDex = new BalancerV3(
        "TestBalancer",
        1000000, // 1M USDC
        400, // 400 WETH
        "USDC",
        "WETH",
        0.8, // 80% weight
        0.2, // 20% weight
        0.003 // 0.3% fee
      );

      const testAggregator = new Aggregator([balancerDex], priceOracle);
      const result = await testAggregator.findOptimalSwapPath(
        "USDC",
        1000,
        "WETH"
      );

      expect(result).toBeDefined();
      expect(result!.path).toEqual(["USDC", "WETH"]);
      expect(result!.totalOutput).toBeGreaterThan(0);
    });

    it("should work with UniswapV2 DEXes", async () => {
      const uniswapDex = new UniswapV2(
        "TestUniswap",
        1000000, // 1M USDC
        400, // 400 WETH
        "USDC",
        "WETH"
      );

      const testAggregator = new Aggregator([uniswapDex], priceOracle);
      const result = await testAggregator.findOptimalSwapPath(
        "USDC",
        1000,
        "WETH"
      );

      expect(result).toBeDefined();
      expect(result!.path).toEqual(["USDC", "WETH"]);
      expect(result!.totalOutput).toBeGreaterThan(0);
    });
  });
});

describe("SimplePriceOracle", () => {
  let oracle: SimplePriceOracle;

  beforeEach(() => {
    oracle = new SimplePriceOracle({
      RZR: 1.0,
      USDC: 1.0,
      WETH: 3000.0,
      DAI: 1.0,
    });
  });

  describe("getPrice", () => {
    it("should return correct price for known token", () => {
      expect(oracle.getPrice("RZR")).toBe(1.0);
      expect(oracle.getPrice("WETH")).toBe(3000.0);
    });

    it("should throw error for unknown token", () => {
      expect(() => oracle.getPrice("UNKNOWN")).toThrow(
        "Price not found for token: UNKNOWN"
      );
    });
  });

  describe("getTokens", () => {
    it("should return all available tokens", () => {
      const tokens = oracle.getTokens();

      expect(tokens).toContain("RZR");
      expect(tokens).toContain("USDC");
      expect(tokens).toContain("WETH");
      expect(tokens).toContain("DAI");
      expect(tokens).toHaveLength(4);
    });
  });
});
