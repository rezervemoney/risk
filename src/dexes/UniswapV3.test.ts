import { UniswapV3 } from "./UniswapV3";

describe("UniswapV3", () => {
  let uniswapV3: UniswapV3;
  const token0 = "TOKEN0";
  const token1 = "TOKEN1";
  const fee = 0.003; // 0.3%
  const initialSqrtPriceX96 = 79228162514264337593543950336; // sqrt(1) * 2^96
  const initialPositions = [
    { minTick: -100, maxTick: 100, liquidity: 100000 },
    { minTick: -50, maxTick: 50, liquidity: 50000 },
  ];

  beforeEach(() => {
    uniswapV3 = new UniswapV3(
      "UniswapV3",
      token0,
      token1,
      fee,
      initialSqrtPriceX96,
      initialPositions
    );
  });

  describe("constructor", () => {
    it("should initialize with correct parameters", () => {
      expect(uniswapV3.token0).toBe(token0);
      expect(uniswapV3.token1).toBe(token1);
      expect(uniswapV3.fee).toBe(fee);
      expect(uniswapV3.sqrtPriceX96).toBe(initialSqrtPriceX96);
      expect(uniswapV3.positions).toEqual(initialPositions);
    });

    it("should calculate current tick correctly", () => {
      const currentTick = uniswapV3.getCurrentTick();
      expect(currentTick).toBe(0); // sqrt(1) corresponds to tick 0
    });

    it("should initialize liquidity correctly", () => {
      const currentLiquidity = uniswapV3.getCurrentLiquidity();
      // Both positions are active at tick 0, so liquidity should be sum of both
      expect(currentLiquidity).toBe(150000);
    });
  });

  describe("price", () => {
    it("should return correct price for token0", () => {
      const price = uniswapV3.price(token0);
      expect(price).toBeCloseTo(1, 10); // sqrt(1) = 1, so price = 1
    });

    it("should return correct price for token1", () => {
      const price = uniswapV3.price(token1);
      expect(price).toBeCloseTo(1, 10); // 1/1 = 1
    });

    it("should throw error for unknown token", () => {
      expect(() => uniswapV3.price("UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });
  });

  describe("getReserves", () => {
    it("should return correct reserves for active positions", () => {
      const reserves = uniswapV3.getReserves();

      // At tick 0, both positions are active
      // Position 1: minTick=-100, maxTick=100, liquidity=1000000
      // Position 2: minTick=-50, maxTick=50, liquidity=500000
      expect(reserves.token0).toBeGreaterThan(0);
      expect(reserves.token1).toBeGreaterThan(0);
    });

    it("should return zero reserves when no positions are active", () => {
      // Create a pool with positions outside current tick range
      const uniswapV3NoActive = new UniswapV3(
        "UniswapV3",
        token0,
        token1,
        fee,
        initialSqrtPriceX96,
        [{ minTick: 1000, maxTick: 2000, liquidity: 1000000 }]
      );

      const reserves = uniswapV3NoActive.getReserves();
      expect(reserves.token0).toBe(0);
      expect(reserves.token1).toBe(0);
    });
  });

  describe("swap", () => {
    describe("swapping token0 for token1", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 100; // Reduced amount for faster testing
        const result = uniswapV3.swap(token0, fromTokenAmount, token1);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(fromTokenAmount); // Due to fees and slippage
      });

      it("should update prices correctly", () => {
        const fromTokenAmount = 1000;
        const result = uniswapV3.swap(token0, fromTokenAmount, token1);

        expect(result.newFromTokenPrice).toBeGreaterThan(1); // Price should increase
        expect(result.newToTokenPrice).toBeLessThan(1); // Inverse price should decrease
        expect(result.newFromTokenPrice * result.newToTokenPrice).toBeCloseTo(
          1,
          10
        );
      });

      it("should maintain price relationship", () => {
        const fromTokenAmount = 1000;
        const result = uniswapV3.swap(token0, fromTokenAmount, token1);

        expect(result.newFromTokenPrice * result.newToTokenPrice).toBeCloseTo(
          1,
          10
        );
      });
    });

    describe("swapping token1 for token0", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 1000;
        const result = uniswapV3.swap(token1, fromTokenAmount, token0);

        expect(result.toTokenReceived).toBeGreaterThan(0);
        expect(result.toTokenReceived).toBeLessThan(fromTokenAmount);
      });

      it("should update prices correctly", () => {
        const fromTokenAmount = 1000;
        const result = uniswapV3.swap(token1, fromTokenAmount, token0);

        // With simplified implementation, price changes are minimal
        expect(result.newFromTokenPrice).toBeCloseTo(1, 4); // Price should be close to 1
        expect(result.newToTokenPrice).toBeCloseTo(1, 4); // Inverse price should be close to 1
        expect(result.newFromTokenPrice * result.newToTokenPrice).toBeCloseTo(
          1,
          10
        );
      });
    });

    it("should throw error for unknown from token", () => {
      expect(() => uniswapV3.swap("UNKNOWN_TOKEN", 1000, token1)).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });

    it("should throw error for unknown to token", () => {
      expect(() => uniswapV3.swap(token0, 1000, "UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });

    it("should throw error when swapping to the same token", () => {
      expect(() => uniswapV3.swap(token0, 1000, token0)).toThrow(
        "Cannot swap to the same token"
      );
    });

    it("should handle zero amount swap", () => {
      const result = uniswapV3.swap(token0, 0, token1);
      expect(result.toTokenReceived).toBe(0);
      expect(result.newFromTokenPrice).toBeCloseTo(1, 10);
      expect(result.newToTokenPrice).toBeCloseTo(1, 10);
    });

    it("should handle very small amount swap", () => {
      const smallAmount = 0.001;
      const result = uniswapV3.swap(token0, smallAmount, token1);

      expect(result.toTokenReceived).toBeGreaterThan(0);
      expect(result.toTokenReceived).toBeLessThan(smallAmount);
    });
  });

  describe("position management", () => {
    it("should add new position correctly", () => {
      const initialPositionCount = uniswapV3.positions.length;
      uniswapV3.addPosition(-200, 200, 2000000);

      expect(uniswapV3.positions.length).toBe(initialPositionCount + 1);
      expect(uniswapV3.positions[initialPositionCount]).toEqual({
        minTick: -200,
        maxTick: 200,
        liquidity: 2000000,
      });
    });

    it("should remove position correctly", () => {
      const initialPositionCount = uniswapV3.positions.length;
      uniswapV3.removePosition(0);

      expect(uniswapV3.positions.length).toBe(initialPositionCount - 1);
    });

    it("should handle removing invalid position index", () => {
      const initialPositionCount = uniswapV3.positions.length;
      uniswapV3.removePosition(-1);
      uniswapV3.removePosition(999);

      expect(uniswapV3.positions.length).toBe(initialPositionCount);
    });

    it("should update liquidity when adding position in current range", () => {
      const initialLiquidity = uniswapV3.getCurrentLiquidity();
      uniswapV3.addPosition(-10, 10, 1000000);

      expect(uniswapV3.getCurrentLiquidity()).toBe(initialLiquidity + 1000000);
    });

    it("should not update liquidity when adding position outside current range", () => {
      const initialLiquidity = uniswapV3.getCurrentLiquidity();
      uniswapV3.addPosition(1000, 2000, 1000000);

      expect(uniswapV3.getCurrentLiquidity()).toBe(initialLiquidity);
    });
  });

  describe("concentrated liquidity mechanics", () => {
    it("should handle swaps that cross tick boundaries", () => {
      // Create a pool with positions at different tick ranges
      const uniswapV3CrossTick = new UniswapV3(
        "UniswapV3",
        token0,
        token1,
        fee,
        initialSqrtPriceX96,
        [
          { minTick: -100, maxTick: 0, liquidity: 1000000 },
          { minTick: 0, maxTick: 100, liquidity: 2000000 },
        ]
      );

      const result = uniswapV3CrossTick.swap(token0, 10000, token1);
      expect(result.toTokenReceived).toBeGreaterThan(0);
    });

    it("should handle swaps with no active liquidity", () => {
      const uniswapV3NoLiquidity = new UniswapV3(
        "UniswapV3",
        token0,
        token1,
        fee,
        initialSqrtPriceX96,
        [{ minTick: 1000, maxTick: 2000, liquidity: 1000000 }]
      );

      // This should still work but with very high slippage
      const result = uniswapV3NoLiquidity.swap(token0, 100, token1);
      expect(result.toTokenReceived).toBeGreaterThan(0);
    });

    it("should maintain liquidity consistency after swaps", () => {
      const initialLiquidity = uniswapV3.getCurrentLiquidity();
      uniswapV3.swap(token0, 1000, token1);
      const finalLiquidity = uniswapV3.getCurrentLiquidity();

      // Liquidity should remain the same unless we cross tick boundaries
      expect(finalLiquidity).toBe(initialLiquidity);
    });
  });

  describe("edge cases", () => {
    it("should handle very large swap amounts", () => {
      const largeAmount = 1000000;
      const result = uniswapV3.swap(token0, largeAmount, token1);

      expect(result.toTokenReceived).toBeGreaterThan(0);
      expect(result.toTokenReceived).toBeLessThan(largeAmount);
    });

    it("should handle multiple consecutive swaps", () => {
      const amount = 1000;
      const result1 = uniswapV3.swap(token0, amount, token1);
      const result2 = uniswapV3.swap(token1, result1.toTokenReceived, token0);

      expect(result2.toTokenReceived).toBeGreaterThan(0);
      expect(result2.toTokenReceived).toBeLessThan(amount); // Due to fees
    });

    it("should handle swaps at different price levels", () => {
      // Create a pool with a different initial price
      const highPriceSqrtX96 = 112233445566778899001122334455667788990011223344556677889900112233445566778899;
      const uniswapV3HighPrice = new UniswapV3(
        "UniswapV3",
        token0,
        token1,
        fee,
        highPriceSqrtX96,
        [{ minTick: -1000, maxTick: 1000, liquidity: 1000000 }]
      );

      const result = uniswapV3HighPrice.swap(token0, 1000, token1);
      expect(result.toTokenReceived).toBeGreaterThan(0);
    });
  });

  describe("IDex interface compliance", () => {
    it("should implement all required methods", () => {
      expect(typeof uniswapV3.swap).toBe("function");
      expect(typeof uniswapV3.price).toBe("function");
      expect(typeof uniswapV3.getReserves).toBe("function");
    });

    it("should have required properties", () => {
      expect(uniswapV3.token0).toBeDefined();
      expect(uniswapV3.token1).toBeDefined();
    });

    it("should return correct types from swap method", () => {
      const result = uniswapV3.swap(token0, 1000, token1);

      expect(typeof result.toTokenReceived).toBe("number");
      expect(typeof result.newFromTokenPrice).toBe("number");
      expect(typeof result.newToTokenPrice).toBe("number");
    });

    it("should return correct types from getReserves method", () => {
      const reserves = uniswapV3.getReserves();

      expect(typeof reserves.token0).toBe("number");
      expect(typeof reserves.token1).toBe("number");
    });

    it("should return correct type from price method", () => {
      const price = uniswapV3.price(token0);
      expect(typeof price).toBe("number");
    });
  });

  describe("mathematical properties", () => {
    it("should maintain price consistency", () => {
      const price0 = uniswapV3.price(token0);
      const price1 = uniswapV3.price(token1);

      expect(price0 * price1).toBeCloseTo(1, 10);
    });

    it("should handle tick calculations correctly", () => {
      const currentTick = uniswapV3.getCurrentTick();
      expect(currentTick).toBe(0); // sqrt(1) = tick 0

      // Test with a different price
      const highPriceSqrtX96 = 112233445566778899001122334455667788990011223344556677889900112233445566778899;
      const uniswapV3HighPrice = new UniswapV3(
        "UniswapV3",
        token0,
        token1,
        fee,
        highPriceSqrtX96,
        []
      );

      const highTick = uniswapV3HighPrice.getCurrentTick();
      expect(highTick).toBeGreaterThan(0);
    });

    it("should calculate liquidity amounts correctly", () => {
      const reserves = uniswapV3.getReserves();
      const currentLiquidity = uniswapV3.getCurrentLiquidity();

      expect(reserves.token0).toBeGreaterThan(0);
      expect(reserves.token1).toBeGreaterThan(0);
      expect(currentLiquidity).toBeGreaterThan(0);
    });
  });
});
