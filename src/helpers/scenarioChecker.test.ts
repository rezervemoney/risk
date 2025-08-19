import { minHealthUnderScenario, StressScenario } from "./scenarioChecker";
import { LiquidityPool } from "../liquidity";
import { IPosition } from "../interfaces";
import { computePositionMetrics } from "./positionMetrics";

describe("minHealthUnderScenario", () => {
  let pool: LiquidityPool;
  let basePositions: IPosition[];
  const ethSpot = 2000; // $2000 per ETH
  const ltvForNew = 0.4; // 40% LTV for new borrow
  const lltvForNew = 0.6; // 60% liquidation threshold for new borrow

  beforeEach(() => {
    // Create a liquidity pool with 1000 RZR and 100 ETH
    // This gives us an RZR price of 0.1 ETH per RZR = $200 per RZR
    pool = new LiquidityPool(1000, 100);

    // Create some base positions
    basePositions = [
      {
        collateralRzr: 100, // 100 RZR collateral
        debtUsdc: 15000, // $15,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 5, // 5 ETH exposure
        ethPrice: 2000,
      },
      {
        collateralRzr: 50, // 50 RZR collateral
        debtUsdc: 8000, // $8,000 debt
        lltv: 0.75, // 75% liquidation threshold
        ethExposure: 3, // 3 ETH exposure
        ethPrice: 2000,
      },
    ];
  });

  describe("basic scenarios without new borrow", () => {
    it("should handle no stress scenario", () => {
      const scenario: StressScenario = {
        name: "No stress",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        0, // no new borrow
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.shockedEth).toBe(2000);
      expect(result.metrics).toHaveLength(2);
      expect(result.minHealth).toBeGreaterThan(0);
      expect(result.poolAfter.getReserves()).toEqual(pool.getReserves());
    });

    it("should handle RZR sell scenario", () => {
      const scenario: StressScenario = {
        name: "RZR sell",
        rzrSold: 50, // Sell 50 RZR
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.shockedEth).toBe(2000);
      expect(result.metrics).toHaveLength(2);
      // Pool should have more RZR after the swap
      const poolAfter = result.poolAfter.getReserves();
      expect(poolAfter.rzrReserve).toBeGreaterThan(1000); // More RZR
      // Note: ETH reserve calculation may need to be implemented in swapRzrForEth
    });

    it("should handle ETH price shock scenario", () => {
      const scenario: StressScenario = {
        name: "ETH crash",
        rzrSold: 0,
        ethPriceMultiplier: 0.7, // 30% ETH price drop
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.shockedEth).toBe(1400); // 2000 * 0.7
      expect(result.metrics).toHaveLength(2);
      // Health scores should be lower due to ETH price drop
      result.metrics.forEach((metric) => {
        expect(metric.healthScore).toBeLessThan(
          computePositionMetrics(pool, ethSpot, metric).healthScore
        );
      });
    });

    it("should handle combined stress scenario", () => {
      const scenario: StressScenario = {
        name: "Combined stress",
        rzrSold: 30, // Sell 30 RZR
        ethPriceMultiplier: 0.8, // 20% ETH price drop
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.shockedEth).toBe(1600); // 2000 * 0.8
      expect(result.metrics).toHaveLength(2);
      // Pool should be affected by the RZR sell
      const poolAfter = result.poolAfter.getReserves();
      expect(poolAfter.rzrReserve).toBeGreaterThan(1000);
      // Note: ETH reserve calculation may need to be implemented in swapRzrForEth
    });
  });

  describe("scenarios with new borrow", () => {
    it("should add new borrow position correctly", () => {
      const scenario: StressScenario = {
        name: "New borrow test",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const borrowUsdc = 10000; // $10,000 new borrow

      const result = minHealthUnderScenario(
        borrowUsdc,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(3); // 2 base + 1 new

      // Check the new position
      const newPosition = result.metrics[2];
      expect(newPosition.debtUsdc).toBe(borrowUsdc);
      expect(newPosition.lltv).toBe(lltvForNew);

      // Verify collateral calculation: borrowUsdc / (ltvForNew * rzrUsdSpot)
      // RZR price = 0.1 ETH * $2000 = $200
      // Collateral = $10,000 / (0.4 * $200) = 125 RZR
      expect(newPosition.collateralRzr).toBeCloseTo(125, 2);

      // Verify ETH exposure: borrowUsdc / ethSpot
      expect(newPosition.ethExposure).toBe(5); // $10,000 / $2000
    });

    it("should add liquidity to pool when new borrow is created", () => {
      const scenario: StressScenario = {
        name: "Liquidity test",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const borrowUsdc = 8000;
      const initialReserves = pool.getReserves();

      const result = minHealthUnderScenario(
        borrowUsdc,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      const finalReserves = result.poolAfter.getReserves();

      // Pool should have more liquidity (ETH and RZR added)
      expect(finalReserves.ethReserve).toBeGreaterThan(
        initialReserves.ethReserve
      );
      expect(finalReserves.rzrReserve).toBeGreaterThan(
        initialReserves.rzrReserve
      );

      // Verify the amounts added match the borrow
      const ethAdded = finalReserves.ethReserve - initialReserves.ethReserve;
      const rzrAdded = finalReserves.rzrReserve - initialReserves.rzrReserve;

      expect(ethAdded).toBe(4); // $8000 / $2000
      expect(rzrAdded).toBe(40); // $8000 / $200
    });

    it("should handle new borrow with stress scenario", () => {
      const scenario: StressScenario = {
        name: "New borrow with stress",
        rzrSold: 20,
        ethPriceMultiplier: 0.9,
      };

      const borrowUsdc = 12000;

      const result = minHealthUnderScenario(
        borrowUsdc,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(3);
      expect(result.shockedEth).toBe(1800); // 2000 * 0.9

      // All positions should have health scores calculated
      result.metrics.forEach((metric) => {
        expect(metric).toHaveProperty("healthScore");
        expect(metric).toHaveProperty("ltv");
        expect(metric).toHaveProperty("rzrLiquidationPrice");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle zero borrow amount", () => {
      const scenario: StressScenario = {
        name: "Zero borrow",
        rzrSold: 10,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(2); // Only base positions
      expect(result.minHealth).toBeGreaterThan(0);
    });

    it("should handle empty positions array", () => {
      const scenario: StressScenario = {
        name: "Empty positions",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        5000,
        scenario,
        [], // Empty positions
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(1); // Only the new position
      expect(result.minHealth).toBeGreaterThan(0);
    });

    it("should handle very large RZR sell", () => {
      const scenario: StressScenario = {
        name: "Large sell",
        rzrSold: 500, // Very large sell
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(2);
      // Health scores should be significantly impacted
      result.metrics.forEach((metric) => {
        expect(metric.healthScore).toBeLessThan(
          computePositionMetrics(pool, ethSpot, metric).healthScore
        );
      });
    });

    it("should handle extreme ETH price movements", () => {
      const scenario: StressScenario = {
        name: "Extreme ETH movement",
        rzrSold: 0,
        ethPriceMultiplier: 0.5, // 50% ETH drop
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.shockedEth).toBe(1000); // 2000 * 0.5
      expect(result.metrics).toHaveLength(2);
      // Health scores should be very low
      result.metrics.forEach((metric) => {
        expect(metric.healthScore).toBeLessThan(1.0);
      });
    });
  });

  describe("minHealth calculation", () => {
    it("should return the minimum health score across all positions", () => {
      const scenario: StressScenario = {
        name: "Min health test",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        0,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      const healthScores = result.metrics.map((m) => m.healthScore);
      const expectedMinHealth = Math.min(...healthScores);

      expect(result.minHealth).toBe(expectedMinHealth);
    });

    it("should handle single position correctly", () => {
      const scenario: StressScenario = {
        name: "Single position",
        rzrSold: 0,
        ethPriceMultiplier: 1.0,
      };

      const singlePosition = [basePositions[0]];

      const result = minHealthUnderScenario(
        0,
        scenario,
        singlePosition,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result.metrics).toHaveLength(1);
      expect(result.minHealth).toBe(result.metrics[0].healthScore);
    });
  });

  describe("pool state preservation", () => {
    it("should not modify the original pool", () => {
      const scenario: StressScenario = {
        name: "Pool preservation",
        rzrSold: 10,
        ethPriceMultiplier: 1.0,
      };

      const originalReserves = pool.getReserves();
      const originalK = pool.k;

      minHealthUnderScenario(
        5000,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      const finalReserves = pool.getReserves();
      const finalK = pool.k;

      // Original pool should be unchanged
      expect(finalReserves.ethReserve).toBe(originalReserves.ethReserve);
      expect(finalReserves.rzrReserve).toBe(originalReserves.rzrReserve);
      expect(finalK).toBe(originalK);
    });

    it("should return modified pool state in result", () => {
      const scenario: StressScenario = {
        name: "Pool modification",
        rzrSold: 15,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        6000,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      const originalReserves = pool.getReserves();
      const resultReserves = result.poolAfter.getReserves();

      // Result pool should be different from original
      expect(resultReserves.ethReserve).not.toBe(originalReserves.ethReserve);
      expect(resultReserves.rzrReserve).not.toBe(originalReserves.rzrReserve);
    });
  });

  describe("return value structure", () => {
    it("should return correct structure with all required properties", () => {
      const scenario: StressScenario = {
        name: "Structure test",
        rzrSold: 5,
        ethPriceMultiplier: 1.0,
      };

      const result = minHealthUnderScenario(
        3000,
        scenario,
        basePositions,
        ethSpot,
        ltvForNew,
        lltvForNew,
        pool
      );

      expect(result).toHaveProperty("minHealth");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("poolAfter");
      expect(result).toHaveProperty("shockedEth");

      expect(typeof result.minHealth).toBe("number");
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(result.poolAfter).toBeInstanceOf(LiquidityPool);
      expect(typeof result.shockedEth).toBe("number");
    });
  });
});
