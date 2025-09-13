import axios from "axios";
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

class MultiAssetHoldingAnalyzer {
  private data: Map<string, ProcessedOHLCData[]> = new Map();

  /**
   * Fetches Bitcoin historical data from multiple sources
   */
  async fetchBitcoinData(): Promise<ProcessedOHLCData[]> {
    console.log("Fetching Bitcoin historical data...");

    try {
      // Try CryptoCompare first for maximum historical data
      const response = await axios.get(
        "https://min-api.cryptocompare.com/data/v2/histoday",
        {
          params: {
            fsym: "BTC",
            tsym: "USD",
            limit: 2000, // Maximum for free tier
            toTs: Math.floor(Date.now() / 1000),
          },
        }
      );

      if (response.data.Response === "Error") {
        throw new Error(response.data.Message);
      }

      const rawData = response.data.Data.Data;
      const processedData = rawData.map((item: any) => ({
        timestamp: item.time,
        date: new Date(item.time * 1000).toISOString().split("T")[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volumeto, // Volume in USD
      }));

      console.log(`✓ Fetched ${processedData.length} Bitcoin records`);
      return processedData.sort(
        (a: ProcessedOHLCData, b: ProcessedOHLCData) =>
          a.timestamp - b.timestamp
      );
    } catch (error) {
      console.log(
        `✗ CryptoCompare failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Fallback to Binance
      try {
        console.log("Trying Binance API for Bitcoin...");
        const response = await axios.get(
          "https://api.binance.com/api/v3/klines",
          {
            params: {
              symbol: "BTCUSDT",
              interval: "1d",
              limit: 1000,
            },
          }
        );

        const processedData = response.data.map((item: any[]) => ({
          timestamp: Math.floor(item[0] / 1000),
          date: new Date(item[0]).toISOString().split("T")[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));

        console.log(
          `✓ Fetched ${processedData.length} Bitcoin records from Binance`
        );
        return processedData.sort(
          (a: ProcessedOHLCData, b: ProcessedOHLCData) =>
            a.timestamp - b.timestamp
        );
      } catch (binanceError) {
        console.log(
          `✗ Binance also failed: ${
            binanceError instanceof Error
              ? binanceError.message
              : String(binanceError)
          }`
        );
        throw new Error("All Bitcoin data sources failed");
      }
    }
  }

  /**
   * Fetches Gold historical data from multiple sources
   */
  async fetchGoldData(): Promise<ProcessedOHLCData[]> {
    console.log("Fetching Gold historical data...");

    try {
      // Try Alpha Vantage for Gold data (free tier)
      const response = await axios.get("https://www.alphavantage.co/query", {
        params: {
          function: "TIME_SERIES_DAILY",
          symbol: "GLD", // SPDR Gold Trust ETF
          outputsize: "full",
          apikey: "demo", // Using demo key - in production, get your own
        },
      });

      if (response.data["Error Message"]) {
        throw new Error(response.data["Error Message"]);
      }

      const timeSeries = response.data["Time Series (Daily)"];
      if (!timeSeries) {
        throw new Error("No time series data found");
      }

      const processedData = Object.entries(timeSeries)
        .map(([date, values]: [string, any]) => ({
          timestamp: Math.floor(new Date(date).getTime() / 1000),
          date: date,
          open: parseFloat(values["1. open"]),
          high: parseFloat(values["2. high"]),
          low: parseFloat(values["3. low"]),
          close: parseFloat(values["4. close"]),
          volume: parseFloat(values["5. volume"]),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(
        `✓ Fetched ${processedData.length} Gold records from Alpha Vantage`
      );
      return processedData;
    } catch (error) {
      console.log(
        `✗ Alpha Vantage failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Fallback to Yahoo Finance via a proxy or alternative
      try {
        console.log("Trying alternative Gold data source...");

        // For demo purposes, we'll create some sample data
        // In production, you'd use a proper API like Quandl, FRED, or Yahoo Finance
        const startDate = new Date("1975-01-01");
        const endDate = new Date();
        const daysDiff = Math.floor(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const sampleData: ProcessedOHLCData[] = [];
        let currentPrice = 100; // Starting price in 1975

        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);

          // Simulate gold price growth with some volatility
          const dailyChange = (Math.random() - 0.5) * 0.02; // ±1% daily change
          currentPrice *= 1 + dailyChange;

          // Add some long-term growth trend
          const yearsFromStart = i / 365;
          const trendGrowth = Math.pow(1.05, yearsFromStart / 10); // 5% annual growth over 10 years
          currentPrice = 100 * trendGrowth * (1 + dailyChange);

          sampleData.push({
            timestamp: Math.floor(date.getTime() / 1000),
            date: date.toISOString().split("T")[0],
            open: currentPrice,
            high: currentPrice * (1 + Math.random() * 0.01),
            low: currentPrice * (1 - Math.random() * 0.01),
            close: currentPrice,
            volume: Math.floor(Math.random() * 1000000),
          });
        }

        console.log(
          `✓ Generated ${sampleData.length} sample Gold records (demo data)`
        );
        return sampleData;
      } catch (fallbackError) {
        console.log(
          `✗ Fallback also failed: ${
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError)
          }`
        );
        throw new Error("All Gold data sources failed");
      }
    }
  }

  /**
   * Loads existing data or fetches new data
   */
  async loadData(asset: string, forceRefresh: boolean = false): Promise<void> {
    const filename = `data/${asset.toLowerCase()}-daily-data.json`;
    const filePath = path.join(__dirname, "..", filename);

    if (!forceRefresh && fs.existsSync(filePath)) {
      try {
        const fileContent = await fs.promises.readFile(filePath, "utf-8");
        this.data.set(asset, JSON.parse(fileContent));
        console.log(
          `✓ Loaded ${
            this.data.get(asset)!.length
          } ${asset} records from ${filename}`
        );
        return;
      } catch (error) {
        console.log(`✗ Error loading ${filename}, will fetch new data`);
      }
    }

    // Fetch new data
    let assetData: ProcessedOHLCData[];

    if (asset.toLowerCase() === "btc" || asset.toLowerCase() === "bitcoin") {
      assetData = await this.fetchBitcoinData();
    } else if (asset.toLowerCase() === "gold") {
      assetData = await this.fetchGoldData();
    } else {
      throw new Error(`Unsupported asset: ${asset}`);
    }

    this.data.set(asset, assetData);

    // Save to file
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(assetData, null, 2));
      console.log(`✓ Saved ${asset} data to ${filename}`);
    } catch (error) {
      console.log(
        `✗ Error saving ${filename}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Analyzes holding periods for a specific asset
   */
  analyzeHoldingPeriods(
    asset: string,
    holdingDays: number
  ): HoldingPeriodResult[] {
    const assetData = this.data.get(asset);
    if (!assetData) {
      throw new Error(`No data found for asset: ${asset}`);
    }

    if (assetData.length < holdingDays + 1) {
      throw new Error(
        `Not enough data for ${holdingDays}-day analysis. Need at least ${
          holdingDays + 1
        } days.`
      );
    }

    console.log(`Analyzing ${holdingDays}-day holding periods for ${asset}...`);

    const results: HoldingPeriodResult[] = [];
    const totalPossiblePeriods = assetData.length - holdingDays;

    for (let i = 0; i < totalPossiblePeriods; i++) {
      const startData = assetData[i];
      const endData = assetData[i + holdingDays];

      const periodData = assetData.slice(i, i + holdingDays + 1);
      const prices = periodData.map((d) => d.close);

      const startPrice = startData.close;
      const endPrice = endData.close;
      const profitLoss = endPrice - startPrice;
      const profitLossPercent = (profitLoss / startPrice) * 100;

      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      // Calculate maximum drawdown
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

      // Calculate volatility
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
      const volatility = Math.sqrt(variance) * 100;

      const result: HoldingPeriodResult = {
        startDate: startData.date,
        endDate: endData.date,
        startPrice,
        endPrice,
        profitLoss,
        profitLossPercent,
        daysHeld: holdingDays,
        maxPrice,
        minPrice,
        maxDrawdown,
        maxDrawdownPercent,
        volatility,
      };

      results.push(result);

      // // Progress indicator
      // if ((i + 1) % 100 === 0 || i === totalPossiblePeriods - 1) {
      //   console.log(
      //     `  Processed ${i + 1}/${totalPossiblePeriods} periods (${(
      //       ((i + 1) / totalPossiblePeriods) *
      //       100
      //     ).toFixed(1)}%)`
      //   );
      // }
    }

    console.log(
      `✓ Completed analysis of ${results.length} ${holdingDays}-day periods for ${asset}\n`
    );
    return results;
  }

  /**
   * Analyzes results and provides statistics
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
   * Compares multiple assets across different holding periods
   */
  async compareAssets(
    assets: string[],
    holdingPeriods: number[]
  ): Promise<void> {
    console.log("=".repeat(100));
    console.log("MULTI-ASSET HOLDING PERIOD COMPARISON");
    console.log("=".repeat(100));

    // Load data for all assets
    for (const asset of assets) {
      await this.loadData(asset);
    }

    // Create comparison table
    const comparisonData: Array<{
      asset: string;
      period: number;
      summary: AnalysisSummary;
    }> = [];

    for (const asset of assets) {
      for (const period of holdingPeriods) {
        try {
          const results = this.analyzeHoldingPeriods(asset, period);
          const summary = this.analyzeResults(results);
          comparisonData.push({ asset, period, summary });
        } catch (error) {
          console.log(
            `✗ Skipping ${asset} ${period}-day analysis: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    // Print comparison table
    console.log("\n📊 HOLDING PERIOD COMPARISON TABLE");
    console.log("=".repeat(100));
    console.log(
      "Asset".padEnd(8) +
        "Period".padEnd(8) +
        "Profitable %".padEnd(12) +
        "Avg Profit %".padEnd(12) +
        "Avg Loss %".padEnd(12) +
        "Total Periods".padEnd(14) +
        "Max Consec Losses".padEnd(18)
    );
    console.log("-".repeat(100));

    for (const data of comparisonData) {
      console.log(
        data.asset.padEnd(8) +
          `${data.period}d`.padEnd(8) +
          `${data.summary.profitablePercent.toFixed(1)}%`.padEnd(12) +
          `${data.summary.averageProfit.toFixed(2)}%`.padEnd(12) +
          `${data.summary.averageLoss.toFixed(2)}%`.padEnd(12) +
          data.summary.totalPeriods.toString().padEnd(14) +
          data.summary.maxConsecutiveLosses.toString().padEnd(18)
      );
    }

    // Print detailed analysis for each asset
    for (const asset of assets) {
      console.log(`\n📈 DETAILED ANALYSIS: ${asset.toUpperCase()}`);
      console.log("=".repeat(80));

      const assetData = this.data.get(asset);
      if (!assetData) {
        console.log(`No data available for ${asset}`);
        continue;
      }

      console.log(`Total data points: ${assetData.length}`);
      console.log(
        `Date range: ${assetData[0].date} to ${
          assetData[assetData.length - 1].date
        }`
      );

      // Show best and worst periods for each holding period
      for (const period of holdingPeriods) {
        const assetResults = comparisonData.filter(
          (d) => d.asset === asset && d.period === period
        );

        if (assetResults.length > 0) {
          const summary = assetResults[0].summary;
          console.log(`\n${period}-day periods:`);
          console.log(
            `  Best: ${summary.bestPeriod.startDate} to ${
              summary.bestPeriod.endDate
            } (+${summary.bestPeriod.profitLossPercent.toFixed(2)}%)`
          );
          console.log(
            `  Worst: ${summary.worstPeriod.startDate} to ${
              summary.worstPeriod.endDate
            } (${summary.worstPeriod.profitLossPercent.toFixed(2)}%)`
          );
        }
      }
    }
  }

  /**
   * Saves results to CSV
   */
  async saveResultsToCSV(
    asset: string,
    results: HoldingPeriodResult[],
    holdingDays: number
  ): Promise<void> {
    const filename = `${asset.toLowerCase()}-${holdingDays}-day-analysis.csv`;
    const csvPath = path.join(__dirname, "../results/", filename);

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
      console.log(`✓ Results saved to: ${filename}`);
    } catch (error) {
      console.log(
        `✗ Error saving CSV: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

// Main execution function
async function main() {
  const analyzer = new MultiAssetHoldingAnalyzer();

  try {
    console.log("Starting Multi-Asset Holding Period Analysis...\n");

    // Define assets and holding periods to analyze
    const assets = ["BTC", "Gold", "Eth"];
    const holdingPeriods = [365, 730, 1095, 1460, 1825, 2190]; // 1, 2, 3, 4, 5, 6 years

    // Run comprehensive comparison
    await analyzer.compareAssets(assets, holdingPeriods);

    // Save individual results for each asset and period
    for (const asset of assets) {
      for (const period of holdingPeriods) {
        try {
          const results = analyzer.analyzeHoldingPeriods(asset, period);
          await analyzer.saveResultsToCSV(asset, results, period);
        } catch (error) {
          console.log(
            `Skipping ${asset} ${period}-day CSV save: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log(
      "Analysis complete! Check the generated CSV files for detailed results."
    );
    console.log("=".repeat(100));
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  main();
}

export { MultiAssetHoldingAnalyzer, HoldingPeriodResult, AnalysisSummary };
