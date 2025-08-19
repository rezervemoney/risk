import { isBorrowSafeAcrossScenarios } from "./checkBorrow";
import { minHealthUnderScenario, StressScenario } from "./scenarioChecker";
import { LiquidityPool } from "../liquidity";
import { IPosition } from "../interfaces";

// Mock the minHealthUnderScenario function to control test scenarios
jest.mock("./scenarioChecker", () => ({
  minHealthUnderScenario: jest.fn(),
  StressScenario: jest.requireActual("./scenarioChecker").StressScenario,
}));

const mockMinHealthUnderScenario = jest.mocked(
  require("./scenarioChecker").minHealthUnderScenario
);

describe("isBorrowSafeAcrossScenarios", () => {
  let pool: LiquidityPool;
  let basePositions: IPosition[];
  const ethSpot = 2000; // $2000 per ETH
  const ltvForNew = 0.4; // 40% LTV for new borrow
  const liquidationThreshold = 0.6; // 60% liquidation threshold

  beforeEach(() => {
    // Create a liquidity pool with 1000 RZR and 100 ETH
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

    // Reset mock before each test
    jest.clearAllMocks();
    mockMinHealthUnderScenario.mockReset();
  });

  describe("basic scenarios", () => {
    it("should return true when borrow is safe across all scenarios", () => {
      const scenarios: StressScenario[] = [
        {
          name: "No stress",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Mild stress",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
        },
        {
          name: "Moderate stress",
          rzrSold: 20,
          ethPriceMultiplier: 0.8,
        },
      ];

      // Mock all scenarios to return safe health scores
      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.5,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 1.2,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1800,
        })
        .mockReturnValueOnce({
          minHealth: 1.1,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1600,
        });

      const result = isBorrowSafeAcrossScenarios(
        5000, // $5,000 borrow
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(3);
    });

    it("should return false when borrow is unsafe in any scenario", () => {
      const scenarios: StressScenario[] = [
        {
          name: "No stress",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Severe stress",
          rzrSold: 50,
          ethPriceMultiplier: 0.7,
        },
      ];

      // Mock first scenario safe, second scenario unsafe
      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.3,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 0.8,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1400,
        });

      const result = isBorrowSafeAcrossScenarios(
        10000, // $10,000 borrow
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(2);
    });

    it("should return true when borrow is exactly at the threshold", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Threshold test",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      // Mock scenario to return exactly 1.0 health score
      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.0,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true); // 1.0 >= 1.0 is true
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(1);
    });
  });

  describe("warning scenarios", () => {
    it("should ignore warning scenarios in safety check", () => {
      const scenarios: StressScenario[] = [
        {
          name: "No stress",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Warning scenario",
          rzrSold: 100,
          ethPriceMultiplier: 0.5,
          warningOnly: true, // This should be ignored
        },
        {
          name: "Moderate stress",
          rzrSold: 20,
          ethPriceMultiplier: 0.8,
        },
      ];

      // Mock scenarios - warning scenario should not be called
      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.2,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 1.1,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1600,
        });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(2); // Warning scenario ignored
    });

    it("should fail if non-warning scenario is unsafe even if warning scenarios are safe", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Safe warning",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
          warningOnly: true,
        },
        {
          name: "Unsafe non-warning",
          rzrSold: 30,
          ethPriceMultiplier: 0.7,
        },
        {
          name: "Another safe warning",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
          warningOnly: true,
        },
      ];

      // Mock only the non-warning scenario (should be called)
      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 0.9,
        metrics: [],
        poolAfter: pool,
        shockedEth: 1400,
      });

      const result = isBorrowSafeAcrossScenarios(
        8000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(1); // Only non-warning scenario
    });
  });

  describe("edge cases", () => {
    it("should handle zero borrow amount", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Test scenario",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.5,
        metrics: [],
        poolAfter: pool,
        shockedEth: 1800,
      });

      const result = isBorrowSafeAcrossScenarios(
        0, // Zero borrow
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledWith(
        0,
        scenarios[0],
        basePositions,
        ethSpot,
        ltvForNew,
        liquidationThreshold,
        pool
      );
    });

    it("should handle empty scenarios array", () => {
      const scenarios: StressScenario[] = [];

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true); // No scenarios to check = safe
      expect(mockMinHealthUnderScenario).not.toHaveBeenCalled();
    });

    it("should handle scenarios with only warning scenarios", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Warning 1",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
          warningOnly: true,
        },
        {
          name: "Warning 2",
          rzrSold: 20,
          ethPriceMultiplier: 0.8,
          warningOnly: true,
        },
      ];

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true); // All scenarios are warnings = safe
      expect(mockMinHealthUnderScenario).not.toHaveBeenCalled();
    });

    it("should handle empty positions array", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Test scenario",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.2,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        [],
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledWith(
        5000,
        scenarios[0],
        [],
        ethSpot,
        ltvForNew,
        liquidationThreshold,
        pool
      );
    });

    it("should handle very large borrow amounts", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Large borrow test",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 0.5, // Very unsafe
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        1000000, // Very large borrow
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledWith(
        1000000,
        scenarios[0],
        basePositions,
        ethSpot,
        ltvForNew,
        liquidationThreshold,
        pool
      );
    });
  });

  describe("scenario ordering and early termination", () => {
    it("should stop checking after first unsafe scenario", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Safe scenario 1",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Unsafe scenario",
          rzrSold: 50,
          ethPriceMultiplier: 0.7,
        },
        {
          name: "Safe scenario 2",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
        },
      ];

      // Mock first scenario safe, second unsafe
      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.3,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 0.8,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1400,
        });

      const result = isBorrowSafeAcrossScenarios(
        8000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(2); // Should stop after second scenario
    });

    it("should check all scenarios when all are safe", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Safe scenario 1",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Safe scenario 2",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
        },
        {
          name: "Safe scenario 3",
          rzrSold: 20,
          ethPriceMultiplier: 0.8,
        },
      ];

      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.4,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 1.2,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1800,
        })
        .mockReturnValueOnce({
          minHealth: 1.1,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1600,
        });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(3); // All scenarios checked
    });
  });

  describe("parameter validation", () => {
    it("should handle different LTV and liquidation threshold values", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Test scenario",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.1,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const customLtv = 0.5; // 50% LTV
      const customLiquidationThreshold = 0.7; // 70% liquidation threshold

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        customLtv,
        customLiquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledWith(
        5000,
        scenarios[0],
        basePositions,
        ethSpot,
        customLtv,
        customLiquidationThreshold,
        pool
      );
    });

    it("should handle different ETH spot prices", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Test scenario",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.2,
        metrics: [],
        poolAfter: pool,
        shockedEth: 3000,
      });

      const customEthSpot = 3000; // $3000 per ETH

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        customEthSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledWith(
        5000,
        scenarios[0],
        basePositions,
        customEthSpot,
        ltvForNew,
        liquidationThreshold,
        pool
      );
    });
  });

  describe("complex scenarios", () => {
    it("should handle mixed warning and non-warning scenarios", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Safe non-warning 1",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Warning scenario 1",
          rzrSold: 100,
          ethPriceMultiplier: 0.5,
          warningOnly: true,
        },
        {
          name: "Safe non-warning 2",
          rzrSold: 10,
          ethPriceMultiplier: 0.9,
        },
        {
          name: "Warning scenario 2",
          rzrSold: 200,
          ethPriceMultiplier: 0.3,
          warningOnly: true,
        },
        {
          name: "Unsafe non-warning",
          rzrSold: 50,
          ethPriceMultiplier: 0.6,
        },
      ];

      // Mock only the non-warning scenarios (3 calls expected)
      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.3,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 1.1,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1800,
        })
        .mockReturnValueOnce({
          minHealth: 0.9,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1200,
        });

      const result = isBorrowSafeAcrossScenarios(
        8000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(3); // Only non-warning scenarios
    });

    it("should handle scenarios with extreme market conditions", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Normal market",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
        {
          name: "ETH crash",
          rzrSold: 0,
          ethPriceMultiplier: 0.3, // 70% ETH drop
        },
        {
          name: "RZR dump",
          rzrSold: 500, // Large RZR sell
          ethPriceMultiplier: 1.0,
        },
        {
          name: "Combined crisis",
          rzrSold: 300,
          ethPriceMultiplier: 0.5, // 50% ETH drop
        },
      ];

      mockMinHealthUnderScenario
        .mockReturnValueOnce({
          minHealth: 1.4,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 0.6,
          metrics: [],
          poolAfter: pool,
          shockedEth: 600,
        })
        .mockReturnValueOnce({
          minHealth: 0.4,
          metrics: [],
          poolAfter: pool,
          shockedEth: 2000,
        })
        .mockReturnValueOnce({
          minHealth: 0.2,
          metrics: [],
          poolAfter: pool,
          shockedEth: 1000,
        });

      const result = isBorrowSafeAcrossScenarios(
        15000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(2); // Should stop after second scenario
    });
  });

  describe("return value verification", () => {
    it("should return boolean values only", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Test scenario",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.1,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(1);
    });

    it("should handle edge case where health score is exactly 1.0", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Exact threshold",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 1.0,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(true); // 1.0 >= 1.0 is true
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(1);
    });

    it("should handle edge case where health score is just below 1.0", () => {
      const scenarios: StressScenario[] = [
        {
          name: "Just below threshold",
          rzrSold: 0,
          ethPriceMultiplier: 1.0,
        },
      ];

      mockMinHealthUnderScenario.mockReturnValueOnce({
        minHealth: 0.999999,
        metrics: [],
        poolAfter: pool,
        shockedEth: 2000,
      });

      const result = isBorrowSafeAcrossScenarios(
        5000,
        scenarios,
        basePositions,
        ethSpot,
        pool,
        ltvForNew,
        liquidationThreshold
      );

      expect(result).toBe(false); // 0.999999 >= 1.0 is false
      expect(mockMinHealthUnderScenario).toHaveBeenCalledTimes(1);
    });
  });
});
