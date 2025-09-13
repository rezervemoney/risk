import * as fs from "fs";
import * as path from "path";

interface ProcessedOHLCData {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap?: number;
}

interface HoldingPeriodResult {
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  profitLoss: number;
  profitLossPercent: number;
  daysHeld: number;
  maxPrice: number;
  minPrice: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  volatility: number;
}

interface AnalysisSummary {
  totalPeriods: number;
  profitablePeriods: number;
  unprofitablePeriods: number;
  profitablePercent: number;
  averageProfit: number;
  averageLoss: number;
  worstPeriod: HoldingPeriodResult;
  bestPeriod: HoldingPeriodResult;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  averageVolatility: number;
}

class ETH365DayAnalyzer {
  private data: ProcessedOHLCData[] = [];

  /**
   * Loads data from the JSON file
   */
  async loadData(
    filename: string = "eth-usd-simple-daily-data.json"
  ): Promise<void> {
    try {
      const filePath = path.join(__dirname, "..", filename);
      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      this.data = JSON.parse(fileContent);

      console.log(`Loaded ${this.data.length} records from ${filename}`);

      if (this.data.length === 0) {
        throw new Error("No data loaded from file");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  /**
   * Analyzes all possible 365-day holding periods
   */
  analyze365DayPeriods(): HoldingPeriodResult[] {
    if (this.data.length < 366) {
      throw new Error(
        "Not enough data for 365-day analysis. Need at least 366 days."
      );
    }

    console.log("Analyzing 365-day holding periods...\n");

    const results: HoldingPeriodResult[] = [];
    const totalPossiblePeriods = this.data.length - 365;

    for (let i = 0; i < totalPossiblePeriods; i++) {
      const startData = this.data[i];
      const endData = this.data[i + 365];

      // Get price data for the entire holding period
      const periodData = this.data.slice(i, i + 366);
      const prices = periodData.map((d) => d.close);

      const startPrice = startData.close;
      const endPrice = endData.close;
      const profitLoss = endPrice - startPrice;
      const profitLossPercent = (profitLoss / startPrice) * 100;

      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      // Calculate maximum drawdown during the period
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;
      let peak = startPrice;

      for (const price of prices) {
        if (price > peak) {
          peak = price;
        }
        const drawdown = peak - price;
        const drawdownPercent = (drawdown / peak) * 100;

        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }
      }

      // Calculate volatility (standard deviation of daily returns)
      const dailyReturns = [];
      for (let j = 1; j < prices.length; j++) {
        const dailyReturn = (prices[j] - prices[j - 1]) / prices[j - 1];
        dailyReturns.push(dailyReturn);
      }

      const avgReturn =
        dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce(
          (sum, ret) => sum + Math.pow(ret - avgReturn, 2),
          0
        ) / dailyReturns.length;
      const volatility = Math.sqrt(variance) * 100; // Convert to percentage

      const result: HoldingPeriodResult = {
        startDate: startData.date,
        endDate: endData.date,
        startPrice,
        endPrice,
        profitLoss,
        profitLossPercent,
        daysHeld: 365,
        maxPrice,
        minPrice,
        maxDrawdown,
        maxDrawdownPercent,
        volatility,
      };

      results.push(result);

      // Progress indicator
      if ((i + 1) % 100 === 0 || i === totalPossiblePeriods - 1) {
        console.log(
          `Processed ${i + 1}/${totalPossiblePeriods} periods (${(
            ((i + 1) / totalPossiblePeriods) *
            100
          ).toFixed(1)}%)`
        );
      }
    }

    console.log(`\nCompleted analysis of ${results.length} 365-day periods\n`);
    return results;
  }

  /**
   * Analyzes the results and provides comprehensive statistics
   */
  analyzeResults(results: HoldingPeriodResult[]): AnalysisSummary {
    const profitablePeriods = results.filter((r) => r.profitLoss > 0);
    const unprofitablePeriods = results.filter((r) => r.profitLoss <= 0);

    const profitablePercent = (profitablePeriods.length / results.length) * 100;

    const averageProfit =
      profitablePeriods.length > 0
        ? profitablePeriods.reduce((sum, r) => sum + r.profitLossPercent, 0) /
          profitablePeriods.length
        : 0;

    const averageLoss =
      unprofitablePeriods.length > 0
        ? unprofitablePeriods.reduce((sum, r) => sum + r.profitLossPercent, 0) /
          unprofitablePeriods.length
        : 0;

    const worstPeriod = results.reduce((worst, current) =>
      current.profitLossPercent < worst.profitLossPercent ? current : worst
    );

    const bestPeriod = results.reduce((best, current) =>
      current.profitLossPercent > best.profitLossPercent ? current : best
    );

    // Calculate consecutive losses
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;

    for (const result of results) {
      if (result.profitLoss <= 0) {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(
          maxConsecutiveLosses,
          consecutiveLosses
        );
      } else {
        consecutiveLosses = 0;
      }
    }

    const averageVolatility =
      results.reduce((sum, r) => sum + r.volatility, 0) / results.length;

    return {
      totalPeriods: results.length,
      profitablePeriods: profitablePeriods.length,
      unprofitablePeriods: unprofitablePeriods.length,
      profitablePercent,
      averageProfit,
      averageLoss,
      worstPeriod,
      bestPeriod,
      consecutiveLosses: maxConsecutiveLosses,
      maxConsecutiveLosses,
      averageVolatility,
    };
  }

  /**
   * Finds periods with significant losses (more than 20% loss)
   */
  findSignificantLosses(
    results: HoldingPeriodResult[],
    threshold: number = -20
  ): HoldingPeriodResult[] {
    return results
      .filter((r) => r.profitLossPercent <= threshold)
      .sort((a, b) => a.profitLossPercent - b.profitLossPercent);
  }

  /**
   * Finds periods with significant gains (more than 100% gain)
   */
  findSignificantGains(
    results: HoldingPeriodResult[],
    threshold: number = 100
  ): HoldingPeriodResult[] {
    return results
      .filter((r) => r.profitLossPercent >= threshold)
      .sort((a, b) => b.profitLossPercent - a.profitLossPercent);
  }

  /**
   * Analyzes periods by year to see trends
   */
  analyzeByYear(results: HoldingPeriodResult[]): Map<string, AnalysisSummary> {
    const yearAnalysis = new Map<string, AnalysisSummary>();

    // Group results by start year
    const resultsByYear = new Map<string, HoldingPeriodResult[]>();

    for (const result of results) {
      const year = result.startDate.split("-")[0];
      if (!resultsByYear.has(year)) {
        resultsByYear.set(year, []);
      }
      resultsByYear.get(year)!.push(result);
    }

    // Analyze each year
    for (const [year, yearResults] of resultsByYear) {
      yearAnalysis.set(year, this.analyzeResults(yearResults));
    }

    return yearAnalysis;
  }

  /**
   * Prints comprehensive analysis report
   */
  printAnalysisReport(results: HoldingPeriodResult[]): void {
    const summary = this.analyzeResults(results);

    console.log("=".repeat(80));
    console.log("ETH 365-DAY HOLDING PERIOD ANALYSIS");
    console.log("=".repeat(80));

    console.log(`\n📊 OVERALL STATISTICS:`);
    console.log(`  Total 365-day periods analyzed: ${summary.totalPeriods}`);
    console.log(
      `  Profitable periods: ${
        summary.profitablePeriods
      } (${summary.profitablePercent.toFixed(1)}%)`
    );
    console.log(
      `  Unprofitable periods: ${summary.unprofitablePeriods} (${(
        100 - summary.profitablePercent
      ).toFixed(1)}%)`
    );
    console.log(
      `  Average profit when profitable: ${summary.averageProfit.toFixed(2)}%`
    );
    console.log(
      `  Average loss when unprofitable: ${summary.averageLoss.toFixed(2)}%`
    );
    console.log(
      `  Maximum consecutive losses: ${summary.maxConsecutiveLosses} periods`
    );
    console.log(
      `  Average volatility: ${summary.averageVolatility.toFixed(2)}%`
    );

    console.log(`\n📈 BEST PERFORMING PERIOD:`);
    console.log(
      `  Start: ${
        summary.bestPeriod.startDate
      } ($${summary.bestPeriod.startPrice.toFixed(2)})`
    );
    console.log(
      `  End: ${
        summary.bestPeriod.endDate
      } ($${summary.bestPeriod.endPrice.toFixed(2)})`
    );
    console.log(
      `  Profit: $${summary.bestPeriod.profitLoss.toFixed(
        2
      )} (${summary.bestPeriod.profitLossPercent.toFixed(2)}%)`
    );
    console.log(
      `  Max drawdown: ${summary.bestPeriod.maxDrawdownPercent.toFixed(2)}%`
    );

    console.log(`\n📉 WORST PERFORMING PERIOD:`);
    console.log(
      `  Start: ${
        summary.worstPeriod.startDate
      } ($${summary.worstPeriod.startPrice.toFixed(2)})`
    );
    console.log(
      `  End: ${
        summary.worstPeriod.endDate
      } ($${summary.worstPeriod.endPrice.toFixed(2)})`
    );
    console.log(
      `  Loss: $${summary.worstPeriod.profitLoss.toFixed(
        2
      )} (${summary.worstPeriod.profitLossPercent.toFixed(2)}%)`
    );
    console.log(
      `  Max drawdown: ${summary.worstPeriod.maxDrawdownPercent.toFixed(2)}%`
    );

    // Significant losses
    const significantLosses = this.findSignificantLosses(results, -20);
    console.log(
      `\n🚨 PERIODS WITH >20% LOSSES (${significantLosses.length} periods):`
    );
    if (significantLosses.length > 0) {
      console.log(`  Top 10 worst periods:`);
      significantLosses.slice(0, 10).forEach((period, index) => {
        console.log(
          `    ${index + 1}. ${period.startDate} to ${
            period.endDate
          }: ${period.profitLossPercent.toFixed(2)}% loss`
        );
      });
    } else {
      console.log(`  No periods with >20% losses found.`);
    }

    // Significant gains
    const significantGains = this.findSignificantGains(results, 100);
    console.log(
      `\n🚀 PERIODS WITH >100% GAINS (${significantGains.length} periods):`
    );
    if (significantGains.length > 0) {
      console.log(`  Top 10 best periods:`);
      significantGains.slice(0, 10).forEach((period, index) => {
        console.log(
          `    ${index + 1}. ${period.startDate} to ${
            period.endDate
          }: ${period.profitLossPercent.toFixed(2)}% gain`
        );
      });
    } else {
      console.log(`  No periods with >100% gains found.`);
    }

    // Year-by-year analysis
    console.log(`\n📅 YEAR-BY-YEAR ANALYSIS:`);
    const yearAnalysis = this.analyzeByYear(results);
    const sortedYears = Array.from(yearAnalysis.keys()).sort();

    for (const year of sortedYears) {
      const yearData = yearAnalysis.get(year)!;
      console.log(
        `  ${year}: ${yearData.profitablePeriods}/${
          yearData.totalPeriods
        } profitable (${yearData.profitablePercent.toFixed(1)}%)`
      );
    }
  }

  /**
   * Saves detailed results to CSV file
   */
  async saveResultsToCSV(
    results: HoldingPeriodResult[],
    filename: string = "eth-365-day-analysis.csv"
  ): Promise<void> {
    const csvPath = path.join(__dirname, "..", filename);

    const csvHeader =
      "Start Date,End Date,Start Price,End Price,Profit/Loss,Profit/Loss %,Days Held,Max Price,Min Price,Max Drawdown,Max Drawdown %,Volatility %\n";

    const csvRows = results
      .map(
        (r) =>
          `${r.startDate},${r.endDate},${r.startPrice.toFixed(
            2
          )},${r.endPrice.toFixed(2)},${r.profitLoss.toFixed(
            2
          )},${r.profitLossPercent.toFixed(2)},${
            r.daysHeld
          },${r.maxPrice.toFixed(2)},${r.minPrice.toFixed(
            2
          )},${r.maxDrawdown.toFixed(2)},${r.maxDrawdownPercent.toFixed(
            2
          )},${r.volatility.toFixed(2)}\n`
      )
      .join("");

    const csvContent = csvHeader + csvRows;

    try {
      await fs.promises.writeFile(csvPath, csvContent);
      console.log(`\nDetailed results saved to: ${csvPath}`);
    } catch (error) {
      console.error("Error saving CSV file:", error);
    }
  }

  /**
   * Saves results to JSON file
   */
  async saveResultsToJSON(
    results: HoldingPeriodResult[],
    filename: string = "eth-365-day-analysis.json"
  ): Promise<void> {
    const jsonPath = path.join(__dirname, "..", filename);

    try {
      await fs.promises.writeFile(jsonPath, JSON.stringify(results, null, 2));
      console.log(`Detailed results saved to: ${jsonPath}`);
    } catch (error) {
      console.error("Error saving JSON file:", error);
    }
  }
}

// Main execution function
async function main() {
  const analyzer = new ETH365DayAnalyzer();

  try {
    console.log("Starting ETH 365-day holding period analysis...\n");

    // Load data
    await analyzer.loadData();

    // Analyze 365-day periods
    const results = analyzer.analyze365DayPeriods();

    // Print comprehensive report
    analyzer.printAnalysisReport(results);

    // Save results
    await analyzer.saveResultsToCSV(results);
    await analyzer.saveResultsToJSON(results);

    console.log("\n" + "=".repeat(80));
    console.log(
      "Analysis complete! Check the generated files for detailed results."
    );
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  main();
}

export { ETH365DayAnalyzer, HoldingPeriodResult, AnalysisSummary };
