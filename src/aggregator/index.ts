import { IDex } from "../dexes/base";
import { PriceOracle } from "./oracle";

export interface SwapPath {
  path: string[];
  dexes: IDex[];
  totalOutput: number;
  slippage: number;
  effectivePrice: number;
  steps: SwapStep[];
}

export interface SwapStep {
  fromToken: string;
  toToken: string;
  amountIn: number;
  amountOut: number;
  dex: IDex;
  slippage: number;
  priceImpact: number;
}

export class Aggregator {
  private maxPathLength: number = 3; // Maximum number of hops in a path
  private maxSlippageThreshold: number = 0.05; // 5% max slippage

  constructor(public dexes: IDex[], public priceOracle: PriceOracle) {}

  /**
   * Find all possible swap paths between two tokens
   */
  private findAllPaths(
    fromToken: string,
    toToken: string,
    maxLength: number = this.maxPathLength
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (
      current: string,
      target: string,
      path: string[],
      length: number
    ) => {
      if (length > maxLength) return;

      if (current === target && path.length > 1) {
        paths.push([...path]);
        return;
      }

      if (visited.has(current)) return;
      visited.add(current);

      // Find all tokens that can be swapped from current token
      const availableTokens = this.getAvailableTokens(current);

      for (const nextToken of availableTokens) {
        if (!visited.has(nextToken)) {
          dfs(nextToken, target, [...path, nextToken], length + 1);
        }
      }

      visited.delete(current);
    };

    dfs(fromToken, toToken, [fromToken], 1);
    return paths;
  }

  /**
   * Get all tokens that can be swapped from a given token
   */
  private getAvailableTokens(token: string): string[] {
    const availableTokens = new Set<string>();

    for (const dex of this.dexes) {
      if (dex.token0 === token) {
        availableTokens.add(dex.token1);
      } else if (dex.token1 === token) {
        availableTokens.add(dex.token0);
      }
    }

    return Array.from(availableTokens);
  }

  /**
   * Find the best DEX for a direct swap between two tokens
   */
  private findBestDexForDirectSwap(
    fromToken: string,
    toToken: string,
    amountIn: number
  ): { dex: IDex; result: any } | null {
    let bestDex: IDex | null = null;
    let bestResult: any = null;
    let maxOutput = 0;

    for (const dex of this.dexes) {
      if (
        (dex.token0 === fromToken && dex.token1 === toToken) ||
        (dex.token1 === fromToken && dex.token0 === toToken)
      ) {
        try {
          const result = dex.swap(fromToken, amountIn, toToken);
          if (result.toTokenReceived > maxOutput) {
            maxOutput = result.toTokenReceived;
            bestDex = dex;
            bestResult = result;
          }
        } catch (error) {
          // Skip DEXes that can't handle this swap
          continue;
        }
      }
    }

    return bestDex ? { dex: bestDex, result: bestResult } : null;
  }

  /**
   * Calculate slippage for a swap
   */
  private calculateSlippage(
    fromToken: string,
    toToken: string,
    amountIn: number,
    amountOut: number,
    dex: IDex
  ): number {
    try {
      const spotPrice = dex.price(fromToken);
      const effectivePrice = amountOut / amountIn;
      return Math.abs((spotPrice - effectivePrice) / spotPrice);
    } catch (error) {
      // Fallback to oracle-based calculation
      const oraclePrice =
        this.priceOracle.getPrice(toToken) /
        this.priceOracle.getPrice(fromToken);
      const effectivePrice = amountOut / amountIn;
      return Math.abs((oraclePrice - effectivePrice) / oraclePrice);
    }
  }

  /**
   * Calculate price impact for a swap
   */
  private calculatePriceImpact(
    fromToken: string,
    toToken: string,
    amountIn: number,
    dex: IDex
  ): number {
    try {
      const reserves = dex.getReserves();
      const fromReserve =
        dex.token0 === fromToken ? reserves.token0 : reserves.token1;
      const toReserve =
        dex.token0 === toToken ? reserves.token0 : reserves.token1;

      // Price impact = amountIn / fromReserve
      return amountIn / fromReserve;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Execute a swap path and return detailed results
   */
  private executeSwapPath(path: string[], amountIn: number): SwapPath | null {
    const steps: SwapStep[] = [];
    let currentAmount = amountIn;
    let totalSlippage = 0;
    let totalOutput = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const fromToken = path[i];
      const toToken = path[i + 1];

      const bestSwap = this.findBestDexForDirectSwap(
        fromToken,
        toToken,
        currentAmount
      );
      if (!bestSwap) {
        return null; // Path is not executable
      }

      const { dex, result } = bestSwap;
      const slippage = this.calculateSlippage(
        fromToken,
        toToken,
        currentAmount,
        result.toTokenReceived,
        dex
      );
      const priceImpact = this.calculatePriceImpact(
        fromToken,
        toToken,
        currentAmount,
        dex
      );

      steps.push({
        fromToken,
        toToken,
        amountIn: currentAmount,
        amountOut: result.toTokenReceived,
        dex,
        slippage,
        priceImpact,
      });

      totalSlippage += slippage;
      currentAmount = result.toTokenReceived;
    }

    totalOutput = currentAmount;
    const effectivePrice = totalOutput / amountIn;

    return {
      path,
      dexes: steps.map((step) => step.dex),
      totalOutput,
      slippage: totalSlippage,
      effectivePrice,
      steps,
    };
  }

  /**
   * Find the optimal swap path with minimal slippage
   */
  async findOptimalSwapPath(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): Promise<SwapPath | null> {
    // First, try direct swap
    const directSwap = this.findBestDexForDirectSwap(
      fromToken,
      toToken,
      fromTokenAmount
    );
    if (directSwap) {
      const { dex, result } = directSwap;
      const slippage = this.calculateSlippage(
        fromToken,
        toToken,
        fromTokenAmount,
        result.toTokenReceived,
        dex
      );
      const priceImpact = this.calculatePriceImpact(
        fromToken,
        toToken,
        fromTokenAmount,
        dex
      );

      const directPath: SwapPath = {
        path: [fromToken, toToken],
        dexes: [dex],
        totalOutput: result.toTokenReceived,
        slippage,
        effectivePrice: result.toTokenReceived / fromTokenAmount,
        steps: [
          {
            fromToken,
            toToken,
            amountIn: fromTokenAmount,
            amountOut: result.toTokenReceived,
            dex,
            slippage,
            priceImpact,
          },
        ],
      };

      // If direct swap has acceptable slippage, return it
      if (slippage <= this.maxSlippageThreshold) {
        return directPath;
      }
    }

    // Find all possible paths
    const allPaths = this.findAllPaths(fromToken, toToken);
    let bestPath: SwapPath | null = null;
    let bestOutput = 0;

    // Evaluate each path
    for (const path of allPaths) {
      const swapPath = this.executeSwapPath(path, fromTokenAmount);
      if (swapPath && swapPath.slippage <= this.maxSlippageThreshold) {
        if (swapPath.totalOutput > bestOutput) {
          bestOutput = swapPath.totalOutput;
          bestPath = swapPath;
        }
      }
    }

    // If no path meets slippage threshold, return the best direct swap
    if (!bestPath && directSwap) {
      const { dex, result } = directSwap;
      const slippage = this.calculateSlippage(
        fromToken,
        toToken,
        fromTokenAmount,
        result.toTokenReceived,
        dex
      );
      const priceImpact = this.calculatePriceImpact(
        fromToken,
        toToken,
        fromTokenAmount,
        dex
      );

      return {
        path: [fromToken, toToken],
        dexes: [dex],
        totalOutput: result.toTokenReceived,
        slippage,
        effectivePrice: result.toTokenReceived / fromTokenAmount,
        steps: [
          {
            fromToken,
            toToken,
            amountIn: fromTokenAmount,
            amountOut: result.toTokenReceived,
            dex,
            slippage,
            priceImpact,
          },
        ],
      };
    }

    return bestPath;
  }

  /**
   * Execute the optimal swap path
   */
  async executeOptimalSwap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): Promise<SwapPath | null> {
    const optimalPath = await this.findOptimalSwapPath(
      fromToken,
      fromTokenAmount,
      toToken
    );

    if (optimalPath) {
      console.log(`Optimal path found: ${optimalPath.path.join(" -> ")}`);
      console.log(
        `Total output: ${optimalPath.totalOutput.toFixed(6)} ${toToken}`
      );
      console.log(
        `Total slippage: ${(optimalPath.slippage * 100).toFixed(2)}%`
      );
      console.log(`Effective price: ${optimalPath.effectivePrice.toFixed(6)}`);

      optimalPath.steps.forEach((step, index) => {
        console.log(`Step ${index + 1}: ${step.fromToken} -> ${step.toToken}`);
        console.log(`  DEX: ${step.dex.name}`);
        console.log(
          `  Amount: ${step.amountIn.toFixed(6)} -> ${step.amountOut.toFixed(
            6
          )}`
        );
        console.log(`  Slippage: ${(step.slippage * 100).toFixed(2)}%`);
        console.log(`  Price Impact: ${(step.priceImpact * 100).toFixed(2)}%`);
      });
    }

    return optimalPath;
  }

  /**
   * Get all available trading pairs
   */
  getAvailablePairs(): Array<{
    token0: string;
    token1: string;
    dexes: IDex[];
  }> {
    const pairs = new Map<
      string,
      { token0: string; token1: string; dexes: IDex[] }
    >();

    for (const dex of this.dexes) {
      const key = [dex.token0, dex.token1].sort().join("-");
      if (!pairs.has(key)) {
        pairs.set(key, {
          token0: dex.token0,
          token1: dex.token1,
          dexes: [],
        });
      }
      pairs.get(key)!.dexes.push(dex);
    }

    return Array.from(pairs.values());
  }

  /**
   * Get liquidity depth for a token pair
   */
  getLiquidityDepth(token0: string, token1: string): number {
    let totalLiquidity = 0;

    for (const dex of this.dexes) {
      if (
        (dex.token0 === token0 && dex.token1 === token1) ||
        (dex.token0 === token1 && dex.token1 === token0)
      ) {
        const reserves = dex.getReserves();
        // Calculate liquidity as the geometric mean of reserves
        totalLiquidity += Math.sqrt(reserves.token0 * reserves.token1);
      }
    }

    return totalLiquidity;
  }

  // Legacy methods for backward compatibility
  async getRzrPriceFromAllDexes() {
    return await this.dexes.map((dex) => {
      return {
        name: dex.name,
        price: dex.price("RZR"),
      };
    });
  }

  async executeBestSwap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ) {
    const optimalPath = await this.findOptimalSwapPath(
      fromToken,
      fromTokenAmount,
      toToken
    );
    if (optimalPath && optimalPath.steps.length > 0) {
      return optimalPath.steps[optimalPath.steps.length - 1];
    }

    // Fallback to original logic
    const price = await this.dexes.map((dex) =>
      dex.swap(fromToken, fromTokenAmount, toToken)
    );
    return price.reduce((a, b) =>
      a.toTokenReceived > b.toTokenReceived ? a : b
    );
  }

  async getRzrPriceAveraged() {
    const price = await this.dexes.map((dex) => dex.price("RZR"));
    return price.reduce((a, b) => a + b, 0) / price.length;
  }
}
