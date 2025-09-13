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

class SimpleETHAnalyzer {
  /**
   * Fetches data from multiple free sources and combines them
   * @returns Promise<ProcessedOHLCData[]>
   */
  async fetchAllHistoricalData(): Promise<ProcessedOHLCData[]> {
    console.log("Fetching ETH/USD data from multiple sources...\n");

    // Try different approaches
    const dataSources = [
      () => this.fetchFromCryptoCompare(),
      () => this.fetchFromBinance(),
      () => this.fetchFromCoinGeckoSimple(),
    ];

    let allData: ProcessedOHLCData[] = [];

    for (const source of dataSources) {
      try {
        console.log(`Trying data source...`);
        const data = await source();
        if (data && data.length > 0) {
          console.log(`✓ Successfully fetched ${data.length} records`);
          allData = [...allData, ...data];
          break; // Use the first successful source
        }
      } catch (error) {
        console.log(
          `✗ Source failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        continue;
      }
    }

    if (allData.length === 0) {
      throw new Error(
        "All data sources failed. Please check your internet connection and try again."
      );
    }

    // Remove duplicates and sort by timestamp
    const uniqueData = this.removeDuplicates(allData);
    uniqueData.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`\nCompleted! Total unique records: ${uniqueData.length}`);
    return uniqueData;
  }

  /**
   * Fetches data from CryptoCompare API (free tier)
   */
  private async fetchFromCryptoCompare(): Promise<ProcessedOHLCData[]> {
    console.log("Trying CryptoCompare API...");

    const response = await axios.get(
      "https://min-api.cryptocompare.com/data/v2/histoday",
      {
        params: {
          fsym: "ETH",
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
    return rawData.map((item: any) => ({
      timestamp: item.time,
      date: new Date(item.time * 1000).toISOString().split("T")[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volumeto, // Volume in USD
    }));
  }

  /**
   * Fetches data from Binance API (free)
   */
  private async fetchFromBinance(): Promise<ProcessedOHLCData[]> {
    console.log("Trying Binance API...");

    const response = await axios.get("https://api.binance.com/api/v3/klines", {
      params: {
        symbol: "ETHUSDT",
        interval: "1d",
        limit: 1000,
      },
    });

    return response.data.map((item: any[]) => ({
      timestamp: Math.floor(item[0] / 1000),
      date: new Date(item[0]).toISOString().split("T")[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  }

  /**
   * Fetches data from CoinGecko using a different endpoint
   */
  private async fetchFromCoinGeckoSimple(): Promise<ProcessedOHLCData[]> {
    console.log("Trying CoinGecko simple API...");

    // Try the simple price endpoint first
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "ethereum",
          vs_currencies: "usd",
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
        },
      }
    );

    const ethData = response.data.ethereum;
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split("T")[0];

    // This only gives us current data, so we'll create a single record
    return [
      {
        timestamp: now,
        date: today,
        open: ethData.usd,
        high: ethData.usd,
        low: ethData.usd,
        close: ethData.usd,
        volume: ethData.usd_24h_vol || 0,
        market_cap: ethData.usd_market_cap || 0,
      },
    ];
  }

  /**
   * Fetches historical data by making multiple API calls to get more data
   */
  async fetchExtendedHistoricalData(): Promise<ProcessedOHLCData[]> {
    console.log("Fetching extended historical data...\n");

    const allData: ProcessedOHLCData[] = [];
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - 365 * 24 * 60 * 60; // 1 year ago

    try {
      // Fetch data in chunks from CryptoCompare
      const chunkSize = 2000; // Max per request
      let currentEndTime = endTime;
      let hasMoreData = true;
      let callCount = 0;
      const maxCalls = 10; // Safety limit

      while (
        hasMoreData &&
        callCount < maxCalls &&
        currentEndTime > startTime
      ) {
        try {
          console.log(`Fetching chunk ${callCount + 1}...`);

          const response = await axios.get(
            "https://min-api.cryptocompare.com/data/v2/histoday",
            {
              params: {
                fsym: "ETH",
                tsym: "USD",
                limit: chunkSize,
                toTs: currentEndTime,
              },
            }
          );

          if (response.data.Response === "Error") {
            throw new Error(response.data.Message);
          }

          const rawData = response.data.Data.Data;
          if (rawData.length === 0) {
            hasMoreData = false;
            break;
          }

          const processedData = rawData.map((item: any) => ({
            timestamp: item.time,
            date: new Date(item.time * 1000).toISOString().split("T")[0],
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volumeto,
          }));

          allData.push(...processedData);

          // Update end time to the earliest timestamp from this batch
          currentEndTime =
            Math.min(...rawData.map((item: any) => item.time)) - 1;
          callCount++;

          console.log(
            `  Fetched ${processedData.length} records. Total: ${allData.length}`
          );

          // Add delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(
            `  Error in chunk ${callCount + 1}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          hasMoreData = false;
        }
      }
    } catch (error) {
      console.log(
        `CryptoCompare failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Remove duplicates and sort
    const uniqueData = this.removeDuplicates(allData);
    uniqueData.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`\nCompleted! Total unique records: ${uniqueData.length}`);
    return uniqueData;
  }

  /**
   * Removes duplicate entries based on timestamp
   */
  private removeDuplicates(data: ProcessedOHLCData[]): ProcessedOHLCData[] {
    const seen = new Set<number>();
    return data.filter((item) => {
      if (seen.has(item.timestamp)) {
        return false;
      }
      seen.add(item.timestamp);
      return true;
    });
  }

  /**
   * Analyzes the fetched data and provides summary statistics
   */
  analyzeData(data: ProcessedOHLCData[]): void {
    if (data.length === 0) {
      console.log("No data to analyze");
      return;
    }

    const prices = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;

    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const avgVolume = totalVolume / volumes.length;

    const firstDate = data[0].date;
    const lastDate = data[data.length - 1].date;

    console.log("\n=== ETH/USD Analysis Summary ===");
    console.log(`Date Range: ${firstDate} to ${lastDate}`);
    console.log(`Total Days: ${data.length}`);
    console.log(`\nPrice Statistics:`);
    console.log(`  Minimum Price: $${minPrice.toFixed(2)}`);
    console.log(`  Maximum Price: $${maxPrice.toFixed(2)}`);
    console.log(`  Average Price: $${avgPrice.toFixed(2)}`);
    console.log(`  Price Range: $${(maxPrice - minPrice).toFixed(2)}`);
    console.log(`\nVolume Statistics:`);
    console.log(`  Total Volume: $${totalVolume.toFixed(2)}`);
    console.log(`  Average Daily Volume: $${avgVolume.toFixed(2)}`);
    console.log(`  Maximum Daily Volume: $${Math.max(...volumes).toFixed(2)}`);
    console.log(`  Minimum Daily Volume: $${Math.min(...volumes).toFixed(2)}`);
  }

  /**
   * Saves data to a JSON file
   */
  async saveToFile(
    data: ProcessedOHLCData[],
    filename: string = "eth-usd-simple-daily-data.json"
  ): Promise<void> {
    const outputPath = path.join(__dirname, "..", filename);

    try {
      await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));
      console.log(`\nData saved to: ${outputPath}`);
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }
}

// Main execution function
async function main() {
  const analyzer = new SimpleETHAnalyzer();

  try {
    console.log("Starting ETH/USD price analysis with multiple sources...\n");

    // Try to get extended historical data first
    let historicalData: ProcessedOHLCData[];

    try {
      historicalData = await analyzer.fetchExtendedHistoricalData();
    } catch (error) {
      console.log(
        `Extended fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      console.log("Falling back to basic fetch...");
      historicalData = await analyzer.fetchAllHistoricalData();
    }

    // Analyze the data
    analyzer.analyzeData(historicalData);

    // Save to file
    await analyzer.saveToFile(historicalData);

    // Show sample of recent data
    console.log("\n=== Recent Data Sample (Last 10 days) ===");
    const recentData = historicalData.slice(-10);
    recentData.forEach((day) => {
      console.log(
        `${day.date}: $${day.close.toFixed(2)} (Vol: $${day.volume.toFixed(2)})`
      );
    });
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  main();
}

export { SimpleETHAnalyzer, ProcessedOHLCData };
