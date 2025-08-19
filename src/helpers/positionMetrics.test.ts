import { computePositionMetrics } from "./positionMetrics";
import { LiquidityPool } from "../liquidity";
import { IPosition } from "../interfaces";

describe("computePositionMetrics", () => {
  let pool: LiquidityPool;
  const ethMktPrice = 2000; // $2000 per ETH

  beforeEach(() => {
    // Create a liquidity pool with 1000 RZR and 100 ETH
    // This gives us an RZR price of 0.1 ETH per RZR
    pool = new LiquidityPool(1000, 100);
  });

  describe("basic calculations", () => {
    it("should calculate correct LTV for a healthy position", () => {
      const position: IPosition = {
        collateralRzr: 100, // 100 RZR collateral
        debtUsdc: 15000, // $15,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 5, // 5 ETH exposure
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(100);
      expect(result.debtUsdc).toBe(15000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(5);
      expect(result.ethPrice).toBe(2000);

      // RZR price = 0.1 ETH * $2000 = $200 per RZR
      // Collateral value = 100 RZR * $200 = $20,000
      // LTV = $15,000 / $20,000 = 0.75 (75%)
      expect(result.ltv).toBeCloseTo(0.75, 4);
      expect(result.healthScore).toBeCloseTo(0.8 / 0.75, 4); // 1.0667
      expect(result.rzrLiquidationPrice).toBeCloseTo(15000 / (0.8 * 100), 2); // $187.50
    });

    it("should calculate correct LTV for a risky position", () => {
      const position: IPosition = {
        collateralRzr: 50, // 50 RZR collateral
        debtUsdc: 9000, // $9,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 2, // 2 ETH exposure
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(50);
      expect(result.debtUsdc).toBe(9000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(2);
      expect(result.ethPrice).toBe(2000);

      // RZR price = 0.1 ETH * $2000 = $200 per RZR
      // Collateral value = 50 RZR * $200 = $10,000
      // LTV = $9,000 / $10,000 = 0.9 (90%)
      expect(result.ltv).toBeCloseTo(0.9, 4);
      expect(result.healthScore).toBeCloseTo(0.8 / 0.9, 4); // 0.8889 (below 1 = risky)
      expect(result.rzrLiquidationPrice).toBeCloseTo(9000 / (0.8 * 50), 2); // $225.00
    });
  });

  describe("edge cases", () => {
    it("should handle zero collateral", () => {
      const position: IPosition = {
        collateralRzr: 0,
        debtUsdc: 1000,
        lltv: 0.8,
        ethExposure: 0,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(0);
      expect(result.debtUsdc).toBe(1000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(0);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics for zero collateral edge case
      expect(result.ltv).toBe(Infinity);
      expect(result.healthScore).toBe(0);
      expect(result.rzrLiquidationPrice).toBe(Infinity);
    });

    it("should handle zero debt", () => {
      const position: IPosition = {
        collateralRzr: 100,
        debtUsdc: 0,
        lltv: 0.8,
        ethExposure: 5,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(100);
      expect(result.debtUsdc).toBe(0);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(5);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics for zero debt edge case
      expect(result.ltv).toBe(0);
      expect(result.healthScore).toBe(Infinity);
      expect(result.rzrLiquidationPrice).toBe(0);
    });

    it("should handle very small collateral values", () => {
      const position: IPosition = {
        collateralRzr: 0.001, // Very small collateral
        debtUsdc: 100,
        lltv: 0.8,
        ethExposure: 0.1,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(0.001);
      expect(result.debtUsdc).toBe(100);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(0.1);
      expect(result.ethPrice).toBe(2000);

      // Collateral value = 0.001 RZR * $200 = $0.20
      // LTV = $100 / $0.20 = 500 (50000%)
      expect(result.ltv).toBeCloseTo(500, 0);
      expect(result.healthScore).toBeCloseTo(0.8 / 500, 6); // 0.0016
      expect(result.rzrLiquidationPrice).toBeCloseTo(100 / (0.8 * 0.001), 0); // 125,000
    });
  });

  describe("liquidation price calculations", () => {
    it("should calculate correct liquidation price for standard position", () => {
      const position: IPosition = {
        collateralRzr: 100,
        debtUsdc: 16000, // $16,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 5,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(100);
      expect(result.debtUsdc).toBe(16000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(5);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics
      expect(result.ltv).toBeCloseTo(16000 / (100 * 200), 4); // 0.8 (80%)
      expect(result.healthScore).toBeCloseTo(0.8 / 0.8, 4); // 1.0 (at threshold)
      // Liquidation price = $16,000 / (0.8 * 100 RZR) = $200 per RZR
      expect(result.rzrLiquidationPrice).toBeCloseTo(200, 2);
    });

    it("should calculate liquidation price for high debt position", () => {
      const position: IPosition = {
        collateralRzr: 50,
        debtUsdc: 12000, // $12,000 debt
        lltv: 0.75, // 75% liquidation threshold
        ethExposure: 3,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(50);
      expect(result.debtUsdc).toBe(12000);
      expect(result.lltv).toBe(0.75);
      expect(result.ethExposure).toBe(3);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics
      expect(result.ltv).toBeCloseTo(12000 / (50 * 200), 4); // 1.2 (120%)
      expect(result.healthScore).toBeCloseTo(0.75 / 1.2, 4); // 0.625 (risky)
      // Liquidation price = $12,000 / (0.75 * 50 RZR) = $320 per RZR
      expect(result.rzrLiquidationPrice).toBeCloseTo(320, 2);
    });
  });

  describe("health score calculations", () => {
    it("should return health score > 1 for safe position", () => {
      const position: IPosition = {
        collateralRzr: 200, // High collateral
        debtUsdc: 20000, // $20,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 10,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(200);
      expect(result.debtUsdc).toBe(20000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(10);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics
      // LTV = $20,000 / (200 RZR * $200) = 0.5 (50%)
      expect(result.ltv).toBeCloseTo(0.5, 4);
      // Health score = 0.8 / 0.5 = 1.6 (safe)
      expect(result.healthScore).toBeCloseTo(1.6, 4);
      expect(result.healthScore).toBeGreaterThan(1);
      expect(result.rzrLiquidationPrice).toBeCloseTo(20000 / (0.8 * 200), 2); // $125.00
    });

    it("should return health score < 1 for risky position", () => {
      const position: IPosition = {
        collateralRzr: 60, // Low collateral
        debtUsdc: 12000, // $12,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 3,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(60);
      expect(result.debtUsdc).toBe(12000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(3);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics
      // LTV = $12,000 / (60 RZR * $200) = 1.0 (100%)
      expect(result.ltv).toBeCloseTo(1.0, 4);
      // Health score = 0.8 / 1.0 = 0.8 (risky)
      expect(result.healthScore).toBeCloseTo(0.8, 4);
      expect(result.healthScore).toBeLessThan(1);
      expect(result.rzrLiquidationPrice).toBeCloseTo(12000 / (0.8 * 60), 2); // $250.00
    });

    it("should return health score = 1 for position at liquidation threshold", () => {
      const position: IPosition = {
        collateralRzr: 75, // Collateral that puts LTV exactly at liquidation threshold
        debtUsdc: 12000, // $12,000 debt
        lltv: 0.8, // 80% liquidation threshold
        ethExposure: 4,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(75);
      expect(result.debtUsdc).toBe(12000);
      expect(result.lltv).toBe(0.8);
      expect(result.ethExposure).toBe(4);
      expect(result.ethPrice).toBe(2000);

      // Test computed metrics
      // LTV = $12,000 / (75 RZR * $200) = 0.8 (80%)
      expect(result.ltv).toBeCloseTo(0.8, 4);
      // Health score = 0.8 / 0.8 = 1.0 (at threshold)
      expect(result.healthScore).toBeCloseTo(1.0, 4);
      expect(result.rzrLiquidationPrice).toBeCloseTo(12000 / (0.8 * 75), 2); // $200.00
    });
  });

  describe("different ETH market prices", () => {
    it("should handle different ETH market prices correctly", () => {
      const position: IPosition = {
        collateralRzr: 100,
        debtUsdc: 15000,
        lltv: 0.8,
        ethExposure: 5,
        ethPrice: 2000,
      };

      // Test with different ETH prices
      const ethPrice1 = 1500; // Lower ETH price
      const ethPrice2 = 2500; // Higher ETH price

      const result1 = computePositionMetrics(pool, ethPrice1, position);
      const result2 = computePositionMetrics(pool, ethPrice2, position);

      // Test original properties are preserved in both results
      expect(result1.collateralRzr).toBe(100);
      expect(result1.debtUsdc).toBe(15000);
      expect(result1.lltv).toBe(0.8);
      expect(result1.ethExposure).toBe(5);
      expect(result1.ethPrice).toBe(2000);

      expect(result2.collateralRzr).toBe(100);
      expect(result2.debtUsdc).toBe(15000);
      expect(result2.lltv).toBe(0.8);
      expect(result2.ethExposure).toBe(5);
      expect(result2.ethPrice).toBe(2000);

      // With ETH at $1500: RZR price = 0.1 ETH * $1500 = $150
      // LTV = $15,000 / (100 RZR * $150) = 1.0 (100%)
      expect(result1.ltv).toBeCloseTo(1.0, 4);
      expect(result1.healthScore).toBeCloseTo(0.8 / 1.0, 4); // 0.8 (risky)
      expect(result1.rzrLiquidationPrice).toBeCloseTo(15000 / (0.8 * 100), 2); // $187.50

      // With ETH at $2500: RZR price = 0.1 ETH * $2500 = $250
      // LTV = $15,000 / (100 RZR * $250) = 0.6 (60%)
      expect(result2.ltv).toBeCloseTo(0.6, 4);
      expect(result2.healthScore).toBeCloseTo(0.8 / 0.6, 4); // 1.3333 (safe)
      expect(result2.rzrLiquidationPrice).toBeCloseTo(15000 / (0.8 * 100), 2); // $187.50
    });
  });

  describe("return value structure", () => {
    it("should return all original position properties plus computed metrics", () => {
      const position: IPosition = {
        collateralRzr: 100,
        debtUsdc: 15000,
        lltv: 0.8,
        ethExposure: 5,
        ethPrice: 2000,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Should include all original properties
      expect(result.collateralRzr).toBe(position.collateralRzr);
      expect(result.debtUsdc).toBe(position.debtUsdc);
      expect(result.lltv).toBe(position.lltv);
      expect(result.ethExposure).toBe(position.ethExposure);
      expect(result.ethPrice).toBe(position.ethPrice);

      // Should include computed properties
      expect(result).toHaveProperty("ltv");
      expect(result).toHaveProperty("healthScore");
      expect(result).toHaveProperty("rzrLiquidationPrice");
    });
  });

  describe("precision and rounding", () => {
    it("should handle decimal precision correctly", () => {
      const position: IPosition = {
        collateralRzr: 100.5, // Decimal collateral
        debtUsdc: 15000.75, // Decimal debt
        lltv: 0.825, // Decimal liquidation threshold
        ethExposure: 5.25,
        ethPrice: 2000.5,
      };

      const result = computePositionMetrics(pool, ethMktPrice, position);

      // Test all original position properties are preserved
      expect(result.collateralRzr).toBe(100.5);
      expect(result.debtUsdc).toBe(15000.75);
      expect(result.lltv).toBe(0.825);
      expect(result.ethExposure).toBe(5.25);
      expect(result.ethPrice).toBe(2000.5);

      // Test computed metrics with decimal precision
      // RZR price = 0.1 ETH * $2000 = $200 per RZR
      // Collateral value = 100.5 RZR * $200 = $20,100
      // LTV = $15,000.75 / $20,100 = 0.7463
      expect(result.ltv).toBeCloseTo(0.7463, 4);
      expect(result.healthScore).toBeCloseTo(0.825 / 0.7463, 4);
      expect(result.rzrLiquidationPrice).toBeCloseTo(
        15000.75 / (0.825 * 100.5),
        2
      );
    });
  });
});
