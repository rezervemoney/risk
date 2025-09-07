import { Aggregator } from "./index";
import { SimplePriceOracle } from "./oracle";
import { getDexSnapshots } from "../dex-snapshot";

async function demonstrateAggregator() {
  console.log("🚀 DEX Aggregator Demonstration");
  console.log("================================\n");

  try {
    // Load DEX snapshots from the dex-snapshot module
    console.log("📊 Loading DEX snapshots...");
    const dexes = await getDexSnapshots();
    console.log(`✅ Loaded ${dexes.length} DEX instances\n`);

    // Create price oracle with current market prices
    const priceOracle = new SimplePriceOracle({
      crvUSD: 1.0,
      DAI: 1.0,
      eBTC: 95000.0,
      ETH: 3000.0,
      ETHFI: 4.5,
      frxETH: 3000.0,
      lstRZR: 1.1,
      rETH: 3050.0,
      RZR: 1.0,
      scBTC: 95000.0,
      scUSD: 1.0,
      stS: 0.95,
      USDC: 1.0,
      USDT: 1.0,
      weETH: 3150.0,
      WETH: 3000.0,
      wstETH: 3100.0,
    });

    // Initialize aggregator
    const aggregator = new Aggregator(dexes, priceOracle);

    // Show available trading pairs
    console.log("🔗 Available Trading Pairs:");
    const pairs = aggregator.getAvailablePairs();
    pairs.forEach((pair, index) => {
      console.log(
        `  ${index + 1}. ${pair.token0}/${pair.token1} (${
          pair.dexes.length
        } DEXes)`
      );
    });
    console.log();

    // Demonstrate optimal swap path finding
    console.log("🎯 Optimal Swap Path Examples:");
    console.log("==============================\n");

    // Example 1: RZR to USDC
    console.log("1️⃣ RZR → USDC (1000 RZR)");
    console.log("------------------------");
    const rzrToUsdc = await aggregator.executeOptimalSwap("RZR", 1000, "USDC");
    if (rzrToUsdc) {
      console.log(`💰 Final output: ${rzrToUsdc.totalOutput.toFixed(2)} USDC`);
      console.log(
        `📉 Total slippage: ${(rzrToUsdc.slippage * 100).toFixed(2)}%`
      );
      console.log(
        `💱 Effective price: ${rzrToUsdc.effectivePrice.toFixed(6)} USDC/RZR\n`
      );
    } else {
      console.log("❌ No path found\n");
    }

    // Example 2: RZR to WETH
    console.log("2️⃣ RZR → WETH (1000 RZR)");
    console.log("------------------------");
    const rzrToWeth = await aggregator.executeOptimalSwap("RZR", 1000, "WETH");
    if (rzrToWeth) {
      console.log(`💰 Final output: ${rzrToWeth.totalOutput.toFixed(6)} WETH`);
      console.log(
        `📉 Total slippage: ${(rzrToWeth.slippage * 100).toFixed(2)}%`
      );
      console.log(
        `💱 Effective price: ${rzrToWeth.effectivePrice.toFixed(6)} WETH/RZR\n`
      );
    } else {
      console.log("❌ No path found\n");
    }

    // Example 3: USDC to WETH
    console.log("3️⃣ USDC → WETH (10000 USDC)");
    console.log("----------------------------");
    const usdcToWeth = await aggregator.executeOptimalSwap(
      "USDC",
      10000,
      "WETH"
    );
    if (usdcToWeth) {
      console.log(`💰 Final output: ${usdcToWeth.totalOutput.toFixed(6)} WETH`);
      console.log(
        `📉 Total slippage: ${(usdcToWeth.slippage * 100).toFixed(2)}%`
      );
      console.log(
        `💱 Effective price: ${usdcToWeth.effectivePrice.toFixed(
          6
        )} WETH/USDC\n`
      );
    } else {
      console.log("❌ No path found\n");
    }

    // Example 4: Large trade with potential multi-hop
    console.log("4️⃣ RZR → eBTC (100000 RZR) - Large Trade");
    console.log("----------------------------------------");
    const rzrToEbtc = await aggregator.executeOptimalSwap(
      "RZR",
      100000,
      "eBTC"
    );
    if (rzrToEbtc) {
      console.log(`💰 Final output: ${rzrToEbtc.totalOutput.toFixed(6)} eBTC`);
      console.log(
        `📉 Total slippage: ${(rzrToEbtc.slippage * 100).toFixed(2)}%`
      );
      console.log(
        `💱 Effective price: ${rzrToEbtc.effectivePrice.toFixed(6)} eBTC/RZR\n`
      );
    } else {
      console.log("❌ No path found\n");
    }

    // Show liquidity depth analysis
    console.log("💧 Liquidity Depth Analysis:");
    console.log("============================\n");

    const commonPairs = [
      ["RZR", "USDC"],
      ["RZR", "WETH"],
      ["USDC", "WETH"],
      ["RZR", "eBTC"],
    ];

    commonPairs.forEach(([token0, token1]) => {
      const depth = aggregator.getLiquidityDepth(token0, token1);
      console.log(`${token0}/${token1}: ${depth.toFixed(2)} liquidity units`);
    });
    console.log();

    // Demonstrate path finding for complex routes
    console.log("🛤️  Complex Path Finding:");
    console.log("========================\n");

    // Try to find a path that might require multiple hops
    console.log("5️⃣ RZR → ETHFI (5000 RZR) - Potential Multi-hop");
    console.log("-----------------------------------------------");
    const rzrToEthfi = await aggregator.executeOptimalSwap(
      "RZR",
      5000,
      "ETHFI"
    );
    if (rzrToEthfi) {
      console.log(
        `💰 Final output: ${rzrToEthfi.totalOutput.toFixed(2)} ETHFI`
      );
      console.log(
        `📉 Total slippage: ${(rzrToEthfi.slippage * 100).toFixed(2)}%`
      );
      console.log(
        `💱 Effective price: ${rzrToEthfi.effectivePrice.toFixed(
          6
        )} ETHFI/RZR\n`
      );
    } else {
      console.log("❌ No path found\n");
    }

    // Show price comparison across DEXes
    console.log("📊 Price Comparison Across DEXes:");
    console.log("=================================\n");

    const rzrPrices = await aggregator.getRzrPriceFromAllDexes();
    console.log("RZR prices across all DEXes:");
    rzrPrices.forEach((price) => {
      console.log(`  ${price.name}: ${price.price.toFixed(6)}`);
    });
    console.log();

    const avgRzrPrice = await aggregator.getRzrPriceAveraged();
    console.log(`📈 Average RZR price: ${avgRzrPrice.toFixed(6)}\n`);

    console.log("✅ Demonstration completed successfully!");
    console.log("\n🎉 The aggregator successfully:");
    console.log("   • Found optimal swap paths across multiple DEXes");
    console.log("   • Calculated slippage and price impact");
    console.log("   • Analyzed liquidity depth");
    console.log("   • Handled both direct and multi-hop swaps");
    console.log("   • Provided detailed execution information");
  } catch (error) {
    console.error("❌ Error during demonstration:", error);
  }
}

// Run the demonstration
if (require.main === module) demonstrateAggregator().catch(console.error);
export { demonstrateAggregator };
