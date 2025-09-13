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

class ETH730DayAnalyzer {
  private data: ProcessedOHLCData[] = [];
  private holdingDays: number = 730; // 2 years

  constructor(holdingDays: number = 730) {
    this.holdingDays = holdingDays;
  }

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
   * Analyzes all possible 730-day (2-year) holding periods
   */
  analyze730DayPeriods(): HoldingPeriodResult[] {
    if (this.data.length < this.holdingDays + 1) {
      throw new Error(
        `Not enough data for ${this.holdingDays}-day analysis. Need at least ${
          this.holdingDays + 1
        } days.`
      );
    }

    console.log(`Analyzing ${this.holdingDays}-day holding periods...\n`);

    const results: HoldingPeriodResult[] = [];
    const totalPossiblePeriods = this.data.length - this.holdingDays;

    for (let i = 0; i < totalPossiblePeriods; i++) {
      const startData = this.data[i];
      const endData = this.data[i + this.holdingDays];

      // Get price data for the entire holding period
      const periodData = this.data.slice(i, i + this.holdingDays + 1);
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
        daysHeld: this.holdingDays,
        maxPrice,
        minPrice,
        maxDrawdown,
        maxDrawdownPercent,
        volatility,
      };

      results.push(result);

      // Progress indicator
      if ((i + 1) % 50 === 0 || i === totalPossiblePeriods - 1) {
        console.log(
          `Processed ${i + 1}/${totalPossiblePeriods} periods (${(
            ((i + 1) / totalPossiblePeriods) *
            100
          ).toFixed(1)}%)`
        );
      }
    }

    console.log(
      `\nCompleted analysis of ${results.length} ${this.holdingDays}-day periods\n`
    );
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
    console.log(`ETH ${this.holdingDays}-DAY HOLDING PERIOD ANALYSIS`);
    console.log("=".repeat(80));

    console.log(`\n📊 OVERALL STATISTICS:`);
    console.log(
      `  Total ${this.holdingDays}-day periods analyzed: ${summary.totalPeriods}`
    );
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
    filename: string = "eth-730-day-analysis.csv"
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
    filename: string = "eth-730-day-analysis.json"
  ): Promise<void> {
    const jsonPath = path.join(__dirname, "..", filename);

    try {
      await fs.promises.writeFile(jsonPath, JSON.stringify(results, null, 2));
      console.log(`Detailed results saved to: ${jsonPath}`);
    } catch (error) {
      console.error("Error saving JSON file:", error);
    }
  }

  /**
   * Analyzes different holding periods for comparison
   */
  async analyzeMultiplePeriods(): Promise<void> {
    const periods = [365, 730, 1095, 1460]; // 1, 2, 3, 4 years
    const results: { period: number; summary: AnalysisSummary }[] = [];

    console.log("Analyzing multiple holding periods for comparison...\n");

    for (const period of periods) {
      if (this.data.length < period + 1) {
        console.log(`Skipping ${period}-day analysis: insufficient data`);
        continue;
      }

      console.log(`\n--- Analyzing ${period}-day periods ---`);
      this.holdingDays = period;
      const periodResults = this.analyze730DayPeriods();
      const summary = this.analyzeResults(periodResults);
      results.push({ period, summary });

      console.log(`  Profitable: ${summary.profitablePercent.toFixed(1)}%`);
      console.log(`  Average profit: ${summary.averageProfit.toFixed(2)}%`);
      console.log(`  Average loss: ${summary.averageLoss.toFixed(2)}%`);
    }

    // Print comparison table
    console.log("\n" + "=".repeat(80));
    console.log("HOLDING PERIOD COMPARISON");
    console.log("=".repeat(80));
    console.log(
      "Period (days) | Profitable % | Avg Profit % | Avg Loss % | Total Periods"
    );
    console.log("-".repeat(80));

    for (const result of results) {
      console.log(
        `${result.period
          .toString()
          .padEnd(12)} | ${result.summary.profitablePercent
          .toFixed(1)
          .padStart(11)}% | ${result.summary.averageProfit
          .toFixed(2)
          .padStart(12)}% | ${result.summary.averageLoss
          .toFixed(2)
          .padStart(10)}% | ${result.summary.totalPeriods
          .toString()
          .padStart(13)}`
      );
    }
  }
}

// Main execution function
async function main() {
  const analyzer = new ETH730DayAnalyzer(730); // 2 years

  try {
    console.log("Starting ETH 2-year (730-day) holding period analysis...\n");

    // Load data
    await analyzer.loadData();

    // Analyze 730-day periods
    const results = analyzer.analyze730DayPeriods();

    // Print comprehensive report
    analyzer.printAnalysisReport(results);

    // Save results
    await analyzer.saveResultsToCSV(results);
    await analyzer.saveResultsToJSON(results);

    // Analyze multiple periods for comparison
    await analyzer.analyzeMultiplePeriods();

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

export { ETH730DayAnalyzer, HoldingPeriodResult, AnalysisSummary };
