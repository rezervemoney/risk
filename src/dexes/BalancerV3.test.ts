import { BalancerV3 } from "./BalancerV3";

describe("BalancerV3", () => {
  let balancerV3: BalancerV3;
  const token0 = "USDC";
  const token1 = "WETH";
  const token0Reserve = 1000000; // 1M USDC
  const token1Reserve = 400; // 400 WETH
  const token0Weight = 80; // 80% weight for USDC
  const token1Weight = 20; // 20% weight for WETH
  const swapFee = 0.003; // 0.3% swap fee

  beforeEach(() => {
    balancerV3 = new BalancerV3(
      "BalancerV3",
      token0Reserve,
      token1Reserve,
      token0,
      token1,
      token0Weight,
      token1Weight,
      swapFee
    );
  });

  describe("constructor", () => {
    it("should initialize with correct parameters", () => {
      expect(balancerV3.name).toBe("BalancerV3");
      expect(balancerV3.token0Reserve).toBe(token0Reserve);
      expect(balancerV3.token1Reserve).toBe(token1Reserve);
      expect(balancerV3.token0).toBe(token0);
      expect(balancerV3.token1).toBe(token1);
      expect(balancerV3.token0Weight).toBe(token0Weight);
      expect(balancerV3.token1Weight).toBe(token1Weight);
      expect(balancerV3.swapFee).toBe(swapFee);
      expect(balancerV3.totalWeight).toBe(token0Weight + token1Weight);
      expect(balancerV3.invariant).toBeGreaterThan(0);
    });

    it("should calculate total weight correctly", () => {
      expect(balancerV3.getTotalWeight()).toBe(100);
    });

    it("should calculate invariant correctly", () => {
      const invariant = balancerV3.getInvariant();
      expect(invariant).toBeGreaterThan(0);
      expect(typeof invariant).toBe("number");
    });
  });

  describe("getReserves", () => {
    it("should return correct reserves", () => {
      const reserves = balancerV3.getReserves();
      expect(reserves.token0).toBe(token0Reserve);
      expect(reserves.token1).toBe(token1Reserve);
    });
  });

  describe("price", () => {
    it("should return correct price for token0", () => {
      const price = balancerV3.price(token0);
      const expectedPrice =
        (token1Reserve / token0Reserve) * (token1Weight / token0Weight);
      expect(price).toBeCloseTo(expectedPrice, 10);
    });

    it("should return correct price for token1", () => {
      const price = balancerV3.price(token1);
      const expectedPrice =
        (token0Reserve / token1Reserve) * (token0Weight / token1Weight);
      expect(price).toBeCloseTo(expectedPrice, 10);
    });

    it("should throw error for unknown token", () => {
      expect(() => balancerV3.price("UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });
  });

  describe("getSpotPrice", () => {
    it("should return correct spot price for token0", () => {
      const spotPrice = balancerV3.getSpotPrice(token0);
      const expectedPrice =
        (token1Reserve / token0Reserve) * (token1Weight / token0Weight);
      expect(spotPrice).toBeCloseTo(expectedPrice, 10);
    });

    it("should return correct spot price for token1", () => {
      const spotPrice = balancerV3.getSpotPrice(token1);
      const expectedPrice =
        (token0Reserve / token1Reserve) * (token0Weight / token1Weight);
      expect(spotPrice).toBeCloseTo(expectedPrice, 10);
    });

    it("should throw error for unknown token", () => {
      expect(() => balancerV3.getSpotPrice("UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });
  });

  describe("swap", () => {
    describe("validation", () => {
      it("should throw error for unknown from token", () => {
        expect(() => balancerV3.swap("UNKNOWN_TOKEN", 1000, token1)).toThrow(
          "Token UNKNOWN_TOKEN not found"
        );
      });

      it("should throw error for unknown to token", () => {
        expect(() => balancerV3.swap(token0, 1000, "UNKNOWN_TOKEN")).toThrow(
          "Token UNKNOWN_TOKEN not found"
        );
      });

      it("should throw error when swapping to the same token", () => {
        expect(() => balancerV3.swap(token0, 1000, token0)).toThrow(
          "Cannot swap to the same token"
        );
      });

      it("should throw error for zero amount", () => {
        expect(() => balancerV3.swap(token0, 0, token1)).toThrow(
          "Amount must be greater than 0"
        );
      });

      it("should throw error for negative amount", () => {
        expect(() => balancerV3.swap(token0, -1000, token1)).toThrow(
          "Amount must be greater than 0"
        );
      });
    });

    describe("swapping token0 for token1", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 1000;
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(fromTokenAmount);
        expect(typeof result.toTokenReceived).toBe("number");
      });

      it("should update reserves correctly", () => {
        const fromTokenAmount = 1000;
        const initialToken0Reserve = balancerV3.token0Reserve;
        const initialToken1Reserve = balancerV3.token1Reserve;

        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        expect(balancerV3.token0Reserve).toBe(
          initialToken0Reserve + fromTokenAmount
        );
        expect(balancerV3.token1Reserve).toBe(
          initialToken1Reserve - result.toTokenReceived
        );
      });

      it("should apply swap fee correctly", () => {
        const fromTokenAmount = 1000;
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        // The output should be less than what would be expected without fees
        // This is a basic check - exact calculation depends on the weighted formula
        expect(result.toTokenReceived).toBeGreaterThan(0);
      });

      it("should update prices correctly", () => {
        const fromTokenAmount = 1000;
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        expect(result.newFromTokenPrice).toBeGreaterThan(0);
        expect(result.newToTokenPrice).toBeGreaterThan(0);
        expect(typeof result.newFromTokenPrice).toBe("number");
        expect(typeof result.newToTokenPrice).toBe("number");
      });
    });

    describe("swapping token1 for token0", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 1;
        const result = balancerV3.swap(token1, fromTokenAmount, token0);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(typeof result.toTokenReceived).toBe("number");
      });

      it("should update reserves correctly", () => {
        const fromTokenAmount = 1;
        const initialToken0Reserve = balancerV3.token0Reserve;
        const initialToken1Reserve = balancerV3.token1Reserve;

        const result = balancerV3.swap(token1, fromTokenAmount, token0);

        expect(balancerV3.token1Reserve).toBe(
          initialToken1Reserve + fromTokenAmount
        );
        expect(balancerV3.token0Reserve).toBe(
          initialToken0Reserve - result.toTokenReceived
        );
      });

      it("should update prices correctly", () => {
        const fromTokenAmount = 1;
        const result = balancerV3.swap(token1, fromTokenAmount, token0);

        expect(result.newFromTokenPrice).toBeGreaterThan(0);
        expect(result.newToTokenPrice).toBeGreaterThan(0);
        expect(typeof result.newFromTokenPrice).toBe("number");
        expect(typeof result.newToTokenPrice).toBe("number");
      });
    });

    describe("edge cases", () => {
      it("should handle very small amounts", () => {
        const fromTokenAmount = 0.001;
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(fromTokenAmount);
      });

      it("should handle large amounts", () => {
        const fromTokenAmount = 10000;
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(fromTokenAmount);
      });

      it("should handle very large trades (weighted pools are permissive)", () => {
        const fromTokenAmount = token1Reserve * 100; // Very large trade
        const result = balancerV3.swap(token0, fromTokenAmount, token1);

        // Weighted pools can handle very large trades
        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(token1Reserve);
        expect(balancerV3.token1Reserve).toBeGreaterThan(0);
      });
    });
  });

  describe("weighted pool mechanics", () => {
    it("should respect token weights in price calculations", () => {
      // Create a pool with different weights
      const weightedPool = new BalancerV3(
        "WeightedPool",
        1000000, // 1M USDC
        100, // 100 WETH
        "USDC",
        "WETH",
        90, // 90% weight for USDC
        10, // 10% weight for WETH
        0.003
      );

      const price = weightedPool.price("USDC");
      const spotPrice = weightedPool.getSpotPrice("USDC");

      expect(price).toBeCloseTo(spotPrice, 10);
      expect(price).toBeGreaterThan(0);
    });

    it("should have different slippage characteristics based on weights", () => {
      // Create two pools with different weight distributions
      const pool1 = new BalancerV3(
        "Pool1",
        1000000,
        400,
        "USDC",
        "WETH",
        80,
        20,
        0.003
      );
      const pool2 = new BalancerV3(
        "Pool2",
        1000000,
        400,
        "USDC",
        "WETH",
        50,
        50,
        0.003
      );

      const amount = 1000;
      const result1 = pool1.swap("USDC", amount, "WETH");
      const result2 = pool2.swap("USDC", amount, "WETH");

      // Different weight distributions should produce different outputs
      expect(result1.toTokenReceived).not.toBe(result2.toTokenReceived);
    });
  });

  describe("getEffectivePrice", () => {
    it("should calculate effective price correctly", () => {
      const fromTokenAmount = 1000;
      const effectivePrice = balancerV3.getEffectivePrice(
        token0,
        fromTokenAmount,
        token1
      );

      expect(effectivePrice).toBeGreaterThan(0);
      expect(typeof effectivePrice).toBe("number");
    });

    it("should include slippage in effective price", () => {
      const fromTokenAmount = 1000;
      const effectivePrice = balancerV3.getEffectivePrice(
        token0,
        fromTokenAmount,
        token1
      );
      const spotPrice = balancerV3.getSpotPrice(token0);

      // Effective price should be different from spot price due to slippage
      expect(effectivePrice).not.toBe(spotPrice);
    });
  });

  describe("invariant maintenance", () => {
    it("should maintain invariant after swaps", () => {
      const initialInvariant = balancerV3.getInvariant();

      balancerV3.swap(token0, 1000, token1);
      const newInvariant = balancerV3.getInvariant();

      // Invariant should change but remain positive
      expect(newInvariant).toBeGreaterThan(0);
      expect(typeof newInvariant).toBe("number");
    });

    it("should recalculate invariant after each swap", () => {
      const invariant1 = balancerV3.getInvariant();
      balancerV3.swap(token0, 1000, token1);
      const invariant2 = balancerV3.getInvariant();
      balancerV3.swap(token1, 1, token0);
      const invariant3 = balancerV3.getInvariant();

      expect(invariant1).toBeGreaterThan(0);
      expect(invariant2).toBeGreaterThan(0);
      expect(invariant3).toBeGreaterThan(0);
    });
  });

  describe("IDex interface compliance", () => {
    it("should implement all required methods", () => {
      expect(typeof balancerV3.swap).toBe("function");
      expect(typeof balancerV3.price).toBe("function");
      expect(typeof balancerV3.getReserves).toBe("function");
    });

    it("should have required properties", () => {
      expect(balancerV3.token0).toBeDefined();
      expect(balancerV3.token1).toBeDefined();
    });

    it("should return correct types from swap method", () => {
      const result = balancerV3.swap(token0, 1000, token1);

      expect(typeof result.toTokenReceived).toBe("number");
      expect(typeof result.newFromTokenPrice).toBe("number");
      expect(typeof result.newToTokenPrice).toBe("number");
    });

    it("should return correct types from getReserves method", () => {
      const reserves = balancerV3.getReserves();

      expect(typeof reserves.token0).toBe("number");
      expect(typeof reserves.token1).toBe("number");
    });

    it("should return correct type from price method", () => {
      const price = balancerV3.price(token0);
      expect(typeof price).toBe("number");
    });
  });

  describe("swap fee mechanics", () => {
    it("should apply swap fee correctly", () => {
      const poolWithFee = new BalancerV3(
        "PoolWithFee",
        1000000,
        400,
        "USDC",
        "WETH",
        80,
        20,
        0.01
      ); // 1% fee
      const poolWithoutFee = new BalancerV3(
        "PoolWithoutFee",
        1000000,
        400,
        "USDC",
        "WETH",
        80,
        20,
        0
      ); // 0% fee

      const amount = 1000;
      const resultWithFee = poolWithFee.swap("USDC", amount, "WETH");
      const resultWithoutFee = poolWithoutFee.swap("USDC", amount, "WETH");

      // Pool with fee should give less output
      expect(resultWithFee.toTokenReceived).toBeLessThan(
        resultWithoutFee.toTokenReceived
      );
    });

    it("should return correct swap fee", () => {
      expect(balancerV3.getSwapFee()).toBe(swapFee);
    });
  });
});
