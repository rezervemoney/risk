import axios from "axios";
import * as fs from "fs";
import * as path from "path";

interface CMCQuote {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap: number;
  timestamp_utc: string;
}

interface CMCResponse {
  data: {
    quotes: CMCQuote[];
  };
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
  };
}

interface ProcessedCMCData {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap: number;
}

class CoinMarketCapETHAnalyzer {
  private baseUrl =
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical";
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CMC_API_KEY || null;
  }

  /**
   * Fetches historical OHLC data from CoinMarketCap API
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format (defaults to today)
   * @returns Promise<ProcessedCMCData[]>
   */
  async fetchHistoricalData(
    startDate: string = "2016-01-01",
    endDate?: string
  ): Promise<ProcessedCMCData[]> {
    if (!this.apiKey) {
      throw new Error(
        "CoinMarketCap API key is required. Please set CMC_API_KEY environment variable or pass it to constructor."
      );
    }

    const endDateStr = endDate || new Date().toISOString().split("T")[0];

    try {
      console.log(`Fetching ETH/USD data from CoinMarketCap API...`);
      console.log(`Date range: ${startDate} to ${endDateStr}`);

      const response = await axios.get<CMCResponse>(this.baseUrl, {
        headers: {
          "X-CMC_PRO_API_KEY": this.apiKey,
          Accept: "application/json",
        },
        params: {
          symbol: "ETH",
          convert: "USD",
          time_start: startDate,
          time_end: endDateStr,
          interval: "daily",
          count: 10000, // Maximum allowed
        },
      });

      if (response.data.status.error_code !== 0) {
        throw new Error(
          `CoinMarketCap API Error: ${response.data.status.error_message}`
        );
      }

      const quotes = response.data.data.quotes;
      console.log(`Fetched ${quotes.length} data points`);

      return this.processCMCData(quotes);
    } catch (error) {
      console.error("Error fetching data from CoinMarketCap API:", error);
      throw error;
    }
  }

  /**
   * Processes raw data from CoinMarketCap API
   * @param quotes - Raw quotes data from CMC API
   * @returns ProcessedCMCData[]
   */
  private processCMCData(quotes: CMCQuote[]): ProcessedCMCData[] {
    return quotes
      .map((quote) => {
        const timestamp = new Date(quote.timestamp).getTime() / 1000;
        return {
          timestamp,
          date: quote.timestamp.split("T")[0],
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume,
          market_cap: quote.market_cap,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Fetches all available historical data by making multiple API calls
   * @returns Promise<ProcessedCMCData[]>
   */
  async fetchAllHistoricalData(): Promise<ProcessedCMCData[]> {
    const allData: ProcessedCMCData[] = [];
    const startDate = "2016-01-01";
    const endDate = new Date().toISOString().split("T")[0];

    // Split the date range into chunks to avoid API limits
    const chunks = this.createDateChunks(startDate, endDate, 365); // 1 year chunks

    console.log(`Fetching data in ${chunks.length} chunks...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        console.log(
          `Fetching chunk ${i + 1}/${chunks.length}: ${chunk.start} to ${
            chunk.end
          }`
        );

        const chunkData = await this.fetchHistoricalData(
          chunk.start,
          chunk.end
        );
        allData.push(...chunkData);

        // Add delay to respect rate limits
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error fetching chunk ${i + 1}:`, error);
        // Continue with next chunk instead of failing completely
      }
    }

    // Remove duplicates and sort by timestamp
    const uniqueData = this.removeDuplicates(allData);
    uniqueData.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`\nCompleted! Total unique records: ${uniqueData.length}`);
    return uniqueData;
  }

  /**
   * Creates date chunks for API calls
   * @param startDate - Start date
   * @param endDate - End date
   * @param chunkSizeDays - Size of each chunk in days
   * @returns Array of date chunks
   */
  private createDateChunks(
    startDate: string,
    endDate: string,
    chunkSizeDays: number
  ): { start: string; end: string }[] {
    const chunks: { start: string; end: string }[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let current = new Date(start);

    while (current < end) {
      const chunkEnd = new Date(current);
      chunkEnd.setDate(chunkEnd.getDate() + chunkSizeDays - 1);

      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime());
      }

      chunks.push({
        start: current.toISOString().split("T")[0],
        end: chunkEnd.toISOString().split("T")[0],
      });

      current.setDate(current.getDate() + chunkSizeDays);
    }

    return chunks;
  }

  /**
   * Removes duplicate entries based on timestamp
   * @param data - Array of OHLC data
   * @returns Deduplicated array
   */
  private removeDuplicates(data: ProcessedCMCData[]): ProcessedCMCData[] {
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
   * @param data - Processed OHLC data
   */
  analyzeData(data: ProcessedCMCData[]): void {
    if (data.length === 0) {
      console.log("No data to analyze");
      return;
    }

    const prices = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);
    const marketCaps = data.map((d) => d.market_cap);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;

    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const avgVolume = totalVolume / volumes.length;

    const minMarketCap = Math.min(...marketCaps);
    const maxMarketCap = Math.max(...marketCaps);
    const avgMarketCap =
      marketCaps.reduce((sum, cap) => sum + cap, 0) / marketCaps.length;

    const firstDate = data[0].date;
    const lastDate = data[data.length - 1].date;

    console.log("\n=== ETH/USD Analysis Summary (CoinMarketCap) ===");
    console.log(`Date Range: ${firstDate} to ${lastDate}`);
    console.log(`Total Days: ${data.length}`);
    console.log(`\nPrice Statistics:`);
    console.log(`  Minimum Price: $${minPrice.toFixed(2)}`);
    console.log(`  Maximum Price: $${maxPrice.toFixed(2)}`);
    console.log(`  Average Price: $${avgPrice.toFixed(2)}`);
    console.log(`  Price Range: $${(maxPrice - minPrice).toFixed(2)}`);
    console.log(`\nVolume Statistics:`);
    console.log(`  Total Volume: ${totalVolume.toFixed(2)} ETH`);
    console.log(`  Average Daily Volume: ${avgVolume.toFixed(2)} ETH`);
    console.log(
      `  Maximum Daily Volume: ${Math.max(...volumes).toFixed(2)} ETH`
    );
    console.log(
      `  Minimum Daily Volume: ${Math.min(...volumes).toFixed(2)} ETH`
    );
    console.log(`\nMarket Cap Statistics:`);
    console.log(`  Minimum Market Cap: $${(minMarketCap / 1e9).toFixed(2)}B`);
    console.log(`  Maximum Market Cap: $${(maxMarketCap / 1e9).toFixed(2)}B`);
    console.log(`  Average Market Cap: $${(avgMarketCap / 1e9).toFixed(2)}B`);
  }

  /**
   * Saves data to a JSON file
   * @param data - Processed OHLC data
   * @param filename - Output filename
   */
  async saveToFile(
    data: ProcessedCMCData[],
    filename: string = "eth-usd-cmc-daily-data.json"
  ): Promise<void> {
    const outputPath = path.join(__dirname, "..", filename);

    try {
      await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));
      console.log(`\nData saved to: ${outputPath}`);
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }

  /**
   * Fetches data using a free alternative (CoinGecko) if CMC API key is not available
   * @returns Promise<ProcessedCMCData[]>
   */
  async fetchFromCoinGecko(): Promise<ProcessedCMCData[]> {
    console.log("Falling back to CoinGecko API (free alternative)...");

    try {
      // CoinGecko free API - get historical data using the correct endpoint
      const response = await axios.get(
        "https://api.coingecko.com/api/v3/coins/ethereum/market_chart",
        {
          params: {
            vs_currency: "usd",
            days: "max", // Get all available data
            interval: "daily",
          },
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; ETH-Price-Analyzer/1.0)",
          },
        }
      );

      const prices = response.data.prices;
      const volumes = response.data.total_volumes;
      const marketCaps = response.data.market_caps;

      const processedData: ProcessedCMCData[] = [];

      for (let i = 0; i < prices.length; i++) {
        const timestamp = Math.floor(prices[i][0] / 1000); // Convert to seconds
        const date = new Date(prices[i][0]).toISOString().split("T")[0];

        processedData.push({
          timestamp,
          date,
          open: prices[i][1], // CoinGecko only provides close prices
          high: prices[i][1],
          low: prices[i][1],
          close: prices[i][1],
          volume: volumes[i] ? volumes[i][1] : 0,
          market_cap: marketCaps[i] ? marketCaps[i][1] : 0,
        });
      }

      console.log(`Fetched ${processedData.length} data points from CoinGecko`);
      return processedData.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("Error fetching from CoinGecko:", error);
      throw error;
    }
  }
}

// Main execution function
async function main() {
  const analyzer = new CoinMarketCapETHAnalyzer();

  try {
    console.log("Starting ETH/USD price analysis with CoinMarketCap...\n");

    let historicalData: ProcessedCMCData[];

    // Try CoinMarketCap first if API key is available
    if (analyzer["apiKey"]) {
      historicalData = await analyzer.fetchAllHistoricalData();
    } else {
      console.log(
        "No CoinMarketCap API key found. Using CoinGecko as fallback..."
      );
      historicalData = await analyzer.fetchFromCoinGecko();
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
        `${day.date}: $${day.close.toFixed(2)} (Vol: ${day.volume.toFixed(
          2
        )} ETH, MC: $${(day.market_cap / 1e9).toFixed(2)}B)`
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

export { CoinMarketCapETHAnalyzer, ProcessedCMCData };
