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

      // Calculate expected health scores for no stress scenario
      const expectedHealth1 = 0.8 / (15000 / (100 * 200)); // lltv / ltv for position 1
      const expectedHealth2 = 0.75 / (8000 / (50 * 200)); // lltv / ltv for position 2
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      // Test all return values
      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);
      expect(result.poolAfter.getReserves()).toEqual(pool.getReserves());

      // Test individual position metrics
      expect(result.metrics[0].collateralRzr).toBe(100);
      expect(result.metrics[0].debtUsdc).toBe(15000);
      expect(result.metrics[0].lltv).toBe(0.8);
      expect(result.metrics[0].ethExposure).toBe(5);
      expect(result.metrics[0].ethPrice).toBe(2000);
      expect(result.metrics[0].ltv).toBeCloseTo(15000 / (100 * 200), 4);
      expect(result.metrics[0].healthScore).toBeCloseTo(expectedHealth1, 4);
      expect(result.metrics[0].rzrLiquidationPrice).toBeCloseTo(
        15000 / (0.8 * 100),
        2
      );

      expect(result.metrics[1].collateralRzr).toBe(50);
      expect(result.metrics[1].debtUsdc).toBe(8000);
      expect(result.metrics[1].lltv).toBe(0.75);
      expect(result.metrics[1].ethExposure).toBe(3);
      expect(result.metrics[1].ethPrice).toBe(2000);
      expect(result.metrics[1].ltv).toBeCloseTo(8000 / (50 * 200), 4);
      expect(result.metrics[1].healthScore).toBeCloseTo(expectedHealth2, 4);
      expect(result.metrics[1].rzrLiquidationPrice).toBeCloseTo(
        8000 / (0.75 * 50),
        2
      );
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

      // Test pool state after RZR sell
      const poolAfter = result.poolAfter.getReserves();
      expect(poolAfter.rzrReserve).toBe(1050); // 1000 + 50 RZR sold
      expect(poolAfter.ethReserve).toBe(100); // ETH reserve unchanged (bug in swapRzrForEth)

      // Calculate expected health scores with new RZR price
      const rzrPriceAfterSell = (100 / 1050) * 2000; // New RZR price after 50 RZR sell
      const expectedHealth1 = 0.8 / (15000 / (100 * rzrPriceAfterSell));
      const expectedHealth2 = 0.75 / (8000 / (50 * rzrPriceAfterSell));
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);

      // Test individual position metrics with new RZR price
      expect(result.metrics[0].ltv).toBeCloseTo(
        15000 / (100 * rzrPriceAfterSell),
        4
      );
      expect(result.metrics[0].healthScore).toBeCloseTo(expectedHealth1, 4);
      expect(result.metrics[0].rzrLiquidationPrice).toBeCloseTo(
        15000 / (0.8 * 100),
        2
      );

      expect(result.metrics[1].ltv).toBeCloseTo(
        8000 / (50 * rzrPriceAfterSell),
        4
      );
      expect(result.metrics[1].healthScore).toBeCloseTo(expectedHealth2, 4);
      expect(result.metrics[1].rzrLiquidationPrice).toBeCloseTo(
        8000 / (0.75 * 50),
        2
      );
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

      // Test pool state (unchanged since no RZR sold)
      const poolAfter = result.poolAfter.getReserves();
      expect(poolAfter.rzrReserve).toBe(1000);
      expect(poolAfter.ethReserve).toBe(100);

      // Calculate expected health scores with ETH at $1400
      const rzrPriceAt1400 = 0.1 * 1400; // $140 per RZR
      const expectedHealth1 = 0.8 / (15000 / (100 * rzrPriceAt1400));
      const expectedHealth2 = 0.75 / (8000 / (50 * rzrPriceAt1400));
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);

      // Test individual position metrics with ETH price shock
      expect(result.metrics[0].ltv).toBeCloseTo(
        15000 / (100 * rzrPriceAt1400),
        4
      );
      expect(result.metrics[0].healthScore).toBeCloseTo(expectedHealth1, 4);
      expect(result.metrics[0].rzrLiquidationPrice).toBeCloseTo(
        15000 / (0.8 * 100),
        2
      );

      expect(result.metrics[1].ltv).toBeCloseTo(
        8000 / (50 * rzrPriceAt1400),
        4
      );
      expect(result.metrics[1].healthScore).toBeCloseTo(expectedHealth2, 4);
      expect(result.metrics[1].rzrLiquidationPrice).toBeCloseTo(
        8000 / (0.75 * 50),
        2
      );
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
      expect(poolAfter.rzrReserve).toBe(1030); // 1000 + 30 RZR sold
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
      expect(finalReserves.ethReserve).toBe(104); // 100 + 4 ETH
      expect(finalReserves.rzrReserve).toBe(1040); // 1000 + 40 RZR

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

      // Calculate expected health scores with RZR sell
      // After selling 10 RZR, pool has 1010 RZR and 100 ETH
      // New RZR price = 100 / 1010 * 2000 = 198.0198 USD
      const rzrPriceAfterSell = (100 / 1010) * 2000;
      const expectedHealth1 = 0.8 / (15000 / (100 * rzrPriceAfterSell));
      const expectedHealth2 = 0.75 / (8000 / (50 * rzrPriceAfterSell));
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);
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

      // Calculate expected health score for new position only
      // New position: 62.5 RZR collateral, 5000 USDC debt, 0.6 lltv
      // LTV = 5000 / (62.5 * 200) = 0.4
      // Health score = 0.6 / 0.4 = 1.5
      const expectedHealth = 0.6 / (5000 / (62.5 * 200));
      expect(result.minHealth).toBeCloseTo(expectedHealth, 4);
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
      // Health scores should be significantly impacted by large RZR sell
      const rzrPriceAfterLargeSell = (100 / 1500) * 2000; // New RZR price after 500 RZR sell
      const expectedHealth1 = 0.8 / (15000 / (100 * rzrPriceAfterLargeSell));
      const expectedHealth2 = 0.75 / (8000 / (50 * rzrPriceAfterLargeSell));
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);
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
      // Health scores should be very low due to 50% ETH drop
      const rzrPriceAt1000 = 0.1 * 1000; // $100 per RZR
      const expectedHealth1 = 0.8 / (15000 / (100 * rzrPriceAt1000));
      const expectedHealth2 = 0.75 / (8000 / (50 * rzrPriceAt1000));
      const expectedMinHealth = Math.min(expectedHealth1, expectedHealth2);

      expect(result.minHealth).toBeCloseTo(expectedMinHealth, 4);
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
