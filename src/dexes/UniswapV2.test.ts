import { UniswapV2 } from "./UniswapV2";

describe("UniswapV2", () => {
  let uniswapV2: UniswapV2;
  const token0 = "TOKEN0";
  const token1 = "TOKEN1";
  const initialToken0Reserve = 1000;
  const initialToken1Reserve = 2000;

  beforeEach(() => {
    uniswapV2 = new UniswapV2(
      initialToken0Reserve,
      initialToken1Reserve,
      token0,
      token1
    );
  });

  describe("constructor", () => {
    it("should initialize with correct reserves and tokens", () => {
      expect(uniswapV2.token0Reserve).toBe(initialToken0Reserve);
      expect(uniswapV2.token1Reserve).toBe(initialToken1Reserve);
      expect(uniswapV2.token0).toBe(token0);
      expect(uniswapV2.token1).toBe(token1);
    });

    it("should calculate k correctly", () => {
      const expectedK = initialToken0Reserve * initialToken1Reserve;
      expect(uniswapV2.k).toBe(expectedK);
    });
  });

  describe("getReserves", () => {
    it("should return current reserves", () => {
      const reserves = uniswapV2.getReserves();
      expect(reserves.token0).toBe(initialToken0Reserve);
      expect(reserves.token1).toBe(initialToken1Reserve);
    });
  });

  describe("price", () => {
    it("should return correct price for token0", () => {
      const price = uniswapV2.price(token0);
      const expectedPrice = initialToken0Reserve / initialToken1Reserve;
      expect(price).toBe(expectedPrice);
    });

    it("should return correct price for token1", () => {
      const price = uniswapV2.price(token1);
      const expectedPrice = initialToken1Reserve / initialToken0Reserve;
      expect(price).toBe(expectedPrice);
    });

    it("should throw error for unknown token", () => {
      expect(() => uniswapV2.price("UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });
  });

  describe("swap", () => {
    describe("swapping token0 for token1", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 100;
        const result = uniswapV2.swap(token0, fromTokenAmount, token1);

        // Calculate expected output using constant product formula
        const newToken0Reserve = initialToken0Reserve + fromTokenAmount;
        const newToken1Reserve = uniswapV2.k / newToken0Reserve;
        const expectedOutput = initialToken1Reserve - newToken1Reserve;

        expect(result.toTokenReceived).toBeCloseTo(expectedOutput, 10);
      });

      it("should return correct new prices", () => {
        const fromTokenAmount = 100;
        const result = uniswapV2.swap(token0, fromTokenAmount, token1);

        const newToken0Reserve = initialToken0Reserve + fromTokenAmount;
        const newToken1Reserve = uniswapV2.k / newToken0Reserve;

        expect(result.newFromTokenPrice).toBeCloseTo(
          newToken0Reserve / newToken1Reserve,
          10
        );
        expect(result.newToTokenPrice).toBeCloseTo(
          newToken1Reserve / newToken0Reserve,
          10
        );
      });

      it("should maintain constant product invariant", () => {
        const fromTokenAmount = 100;
        uniswapV2.swap(token0, fromTokenAmount, token1);

        const newToken0Reserve = initialToken0Reserve + fromTokenAmount;
        const newToken1Reserve = uniswapV2.k / newToken0Reserve;
        const newK = newToken0Reserve * newToken1Reserve;

        expect(newK).toBeCloseTo(uniswapV2.k, 10);
      });
    });

    describe("swapping token1 for token0", () => {
      it("should calculate correct output amount", () => {
        const fromTokenAmount = 200;
        const result = uniswapV2.swap(token1, fromTokenAmount, token0);

        // Calculate expected output using constant product formula
        const newToken1Reserve = initialToken1Reserve + fromTokenAmount;
        const newToken0Reserve = uniswapV2.k / newToken1Reserve;
        const expectedOutput = initialToken0Reserve - newToken0Reserve;

        expect(result.toTokenReceived).toBeCloseTo(expectedOutput, 10);
      });

      it("should return correct new prices", () => {
        const fromTokenAmount = 200;
        const result = uniswapV2.swap(token1, fromTokenAmount, token0);

        const newToken1Reserve = initialToken1Reserve + fromTokenAmount;
        const newToken0Reserve = uniswapV2.k / newToken1Reserve;

        expect(result.newFromTokenPrice).toBeCloseTo(
          newToken0Reserve / newToken1Reserve,
          10
        );
        expect(result.newToTokenPrice).toBeCloseTo(
          newToken1Reserve / newToken0Reserve,
          10
        );
      });
    });

    it("should throw error for unknown from token", () => {
      expect(() => uniswapV2.swap("UNKNOWN_TOKEN", 100, token1)).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });

    it("should throw error for unknown to token", () => {
      expect(() => uniswapV2.swap(token0, 100, "UNKNOWN_TOKEN")).toThrow(
        "Token UNKNOWN_TOKEN not found"
      );
    });

    it("should handle zero amount swap", () => {
      const result = uniswapV2.swap(token0, 0, token1);
      expect(result.toTokenReceived).toBe(0);
      expect(result.newFromTokenPrice).toBe(
        initialToken0Reserve / initialToken1Reserve
      );
      expect(result.newToTokenPrice).toBe(
        initialToken1Reserve / initialToken0Reserve
      );
    });

    it("should handle very small amount swap", () => {
      const smallAmount = 0.001;
      const result = uniswapV2.swap(token0, smallAmount, token1);

      expect(result.toTokenReceived).toBeGreaterThan(0);
      expect(result.toTokenReceived).toBeLessThan(initialToken1Reserve);
    });
  });

  describe("edge cases", () => {
    it("should handle equal reserves", () => {
      const equalReserveUniswap = new UniswapV2(1000, 1000, token0, token1);
      const result = equalReserveUniswap.swap(token0, 100, token1);

      expect(result.toTokenReceived).toBeGreaterThan(0);
      expect(result.newFromTokenPrice).toBeCloseTo(1.1, 1);
      expect(result.newToTokenPrice).toBeCloseTo(0.909, 2);
    });

    it("should handle very large swap amount", () => {
      const largeAmount = initialToken0Reserve * 0.5; // 50% of reserves
      const result = uniswapV2.swap(token0, largeAmount, token1);

      expect(result.toTokenReceived).toBeGreaterThan(0);
      expect(result.toTokenReceived).toBeLessThan(initialToken1Reserve);
    });

    it("should maintain price relationship after multiple swaps", () => {
      // First swap
      const result1 = uniswapV2.swap(token0, 100, token1);

      // Second swap in opposite direction
      const result2 = uniswapV2.swap(token1, result1.toTokenReceived, token0);

      // Prices should be consistent
      expect(result2.newFromTokenPrice).toBeCloseTo(
        1 / result2.newToTokenPrice,
        10
      );
    });
  });

  describe("IDex interface compliance", () => {
    it("should implement all required methods", () => {
      expect(typeof uniswapV2.swap).toBe("function");
      expect(typeof uniswapV2.price).toBe("function");
      expect(typeof uniswapV2.getReserves).toBe("function");
    });

    it("should have required properties", () => {
      expect(uniswapV2.token0).toBeDefined();
      expect(uniswapV2.token1).toBeDefined();
    });

    it("should return correct types from swap method", () => {
      const result = uniswapV2.swap(token0, 100, token1);

      expect(typeof result.toTokenReceived).toBe("number");
      expect(typeof result.newFromTokenPrice).toBe("number");
      expect(typeof result.newToTokenPrice).toBe("number");
    });

    it("should return correct types from getReserves method", () => {
      const reserves = uniswapV2.getReserves();

      expect(typeof reserves.token0).toBe("number");
      expect(typeof reserves.token1).toBe("number");
    });

    it("should return correct type from price method", () => {
      const price = uniswapV2.price(token0);
      expect(typeof price).toBe("number");
    });
  });
});
