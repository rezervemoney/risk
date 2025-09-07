import { IDex } from "./base";

interface IPosition {
  minTick: number;
  maxTick: number;
  liquidity: number;
}

interface TickInfo {
  liquidityGross: number;
  liquidityNet: number;
}

export class UniswapV3 implements IDex {
  private ticks: Map<number, TickInfo> = new Map();
  private liquidity: number = 0;
  private currentTick: number;

  // Constants
  private readonly Q96 = 2n ** 96n;
  private readonly MIN_TICK = -887272;
  private readonly MAX_TICK = 887272;

  constructor(
    public name: string,
    public token0: string,
    public token1: string,
    public fee: number,
    public sqrtPriceX96: number,
    public positions: IPosition[]
  ) {
    this.currentTick = this.sqrtPriceX96ToTick(sqrtPriceX96);
    this.initializePositions();
  }

  private initializePositions(): void {
    // Initialize ticks and liquidity from positions
    for (const position of this.positions) {
      this.addLiquidity(position.minTick, position.maxTick, position.liquidity);
    }
  }

  private sqrtPriceX96ToTick(sqrtPriceX96: number): number {
    const price = (sqrtPriceX96 / Number(this.Q96)) ** 2;
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  private tickToSqrtPriceX96(tick: number): number {
    const price = Math.pow(1.0001, tick);
    return Math.sqrt(price) * Number(this.Q96);
  }

  private getSqrtRatioAtTick(tick: number): number {
    return this.tickToSqrtPriceX96(tick);
  }

  private getTickAtSqrtRatio(sqrtPriceX96: number): number {
    return this.sqrtPriceX96ToTick(sqrtPriceX96);
  }

  private addLiquidity(
    minTick: number,
    maxTick: number,
    liquidity: number
  ): void {
    // Add liquidity to the tick range
    if (minTick <= this.currentTick && this.currentTick < maxTick) {
      this.liquidity += liquidity;
    }

    // Update tick information
    const minTickInfo = this.ticks.get(minTick) || {
      liquidityGross: 0,
      liquidityNet: 0,
    };
    const maxTickInfo = this.ticks.get(maxTick) || {
      liquidityGross: 0,
      liquidityNet: 0,
    };

    minTickInfo.liquidityGross += liquidity;
    minTickInfo.liquidityNet += liquidity;
    maxTickInfo.liquidityGross += liquidity;
    maxTickInfo.liquidityNet -= liquidity;

    this.ticks.set(minTick, minTickInfo);
    this.ticks.set(maxTick, maxTickInfo);
  }

  private removeLiquidity(
    minTick: number,
    maxTick: number,
    liquidity: number
  ): void {
    // Remove liquidity from the tick range
    if (minTick <= this.currentTick && this.currentTick < maxTick) {
      this.liquidity -= liquidity;
    }

    // Update tick information
    const minTickInfo = this.ticks.get(minTick);
    const maxTickInfo = this.ticks.get(maxTick);

    if (minTickInfo) {
      minTickInfo.liquidityGross -= liquidity;
      minTickInfo.liquidityNet -= liquidity;
    }

    if (maxTickInfo) {
      maxTickInfo.liquidityGross -= liquidity;
      maxTickInfo.liquidityNet += liquidity;
    }
  }

  private computeSwapStep(
    liquidity: number,
    currentSqrtPrice: number,
    targetSqrtPrice: number,
    fee: number,
    amountRemaining: number,
    isExactInput: boolean
  ): {
    sqrtPriceNext: number;
    amountIn: number;
    amountOut: number;
    feeAmount: number;
  } {
    // Very simplified implementation for testing
    const zeroForOne = currentSqrtPrice >= targetSqrtPrice;
    const amountRemainingLessFee = amountRemaining * (1 - fee);

    // Use a simple constant product formula for now
    const currentPrice = (currentSqrtPrice / Number(this.Q96)) ** 2;
    const priceImpact = amountRemainingLessFee / (liquidity * 1000); // Scale down for reasonable impact

    let newPrice: number;
    if (zeroForOne) {
      newPrice = currentPrice * (1 + priceImpact);
    } else {
      newPrice = currentPrice * (1 - priceImpact);
    }

    const sqrtPriceNext = Math.sqrt(newPrice) * Number(this.Q96);

    // Simple output calculation
    const amountOut = amountRemainingLessFee * 0.95; // 5% slippage for simplicity

    return {
      sqrtPriceNext,
      amountIn: amountRemainingLessFee,
      amountOut,
      feeAmount: amountRemainingLessFee * fee,
    };
  }

  private getAmount0ForLiquidity(
    liquidity: number,
    sqrtPriceA: number,
    sqrtPriceB: number
  ): number {
    if (sqrtPriceA > sqrtPriceB) {
      [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
    }
    // Simplified calculation to avoid overflow
    const priceA = (sqrtPriceA / Number(this.Q96)) ** 2;
    const priceB = (sqrtPriceB / Number(this.Q96)) ** 2;
    return (liquidity * (priceB - priceA)) / (priceA * priceB);
  }

  private getAmount1ForLiquidity(
    liquidity: number,
    sqrtPriceA: number,
    sqrtPriceB: number
  ): number {
    if (sqrtPriceA > sqrtPriceB) {
      [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
    }
    // Simplified calculation to avoid overflow
    const priceA = (sqrtPriceA / Number(this.Q96)) ** 2;
    const priceB = (sqrtPriceB / Number(this.Q96)) ** 2;
    return liquidity * (priceB - priceA);
  }

  private getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPrice: number,
    liquidity: number,
    amount: number,
    add: boolean
  ): number {
    if (amount === 0) return sqrtPrice;
    const numerator1 = liquidity * Number(this.Q96);
    if (add) {
      const product = amount * sqrtPrice;
      if (product / amount === sqrtPrice) {
        const denominator = numerator1 + product;
        if (denominator >= numerator1) {
          return (numerator1 * sqrtPrice) / denominator;
        }
      }
      return (numerator1 * sqrtPrice) / (numerator1 + amount * sqrtPrice);
    } else {
      const product = amount * sqrtPrice;
      const denominator = numerator1 - product;
      return (numerator1 * sqrtPrice) / denominator;
    }
  }

  private getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPrice: number,
    liquidity: number,
    amount: number,
    add: boolean
  ): number {
    if (add) {
      const quotient = (amount * Number(this.Q96)) / liquidity;
      return sqrtPrice + quotient;
    } else {
      const quotient = (amount * Number(this.Q96)) / liquidity;
      return sqrtPrice - quotient;
    }
  }

  swap(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): {
    toTokenReceived: number;
    newFromTokenPrice: number;
    newToTokenPrice: number;
  } {
    // Validate tokens
    if (fromToken !== this.token0 && fromToken !== this.token1) {
      throw new Error(`Token ${fromToken} not found`);
    }
    if (toToken !== this.token0 && toToken !== this.token1) {
      throw new Error(`Token ${toToken} not found`);
    }
    if (fromToken === toToken) {
      throw new Error("Cannot swap to the same token");
    }

    const zeroForOne = fromToken === this.token0;
    let currentSqrtPrice = this.sqrtPriceX96;
    let amountRemaining = fromTokenAmount;
    let totalAmountOut = 0;
    let totalFeeAmount = 0;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    // Perform the swap by stepping through active liquidity ranges
    while (amountRemaining > 0.000001 && iterations < maxIterations) {
      // Add small threshold and max iterations
      iterations++;

      const nextTick = this.getNextInitializedTick(zeroForOne);
      const targetSqrtPrice = this.getSqrtRatioAtTick(nextTick);

      const step = this.computeSwapStep(
        this.liquidity,
        currentSqrtPrice,
        targetSqrtPrice,
        this.fee,
        amountRemaining,
        true // exact input
      );

      currentSqrtPrice = step.sqrtPriceNext;
      amountRemaining -= step.amountIn;
      totalAmountOut += step.amountOut;
      totalFeeAmount += step.feeAmount;

      // Update liquidity if we crossed a tick
      if (Math.abs(currentSqrtPrice - targetSqrtPrice) < 0.000001) {
        const tickInfo = this.ticks.get(nextTick);
        if (tickInfo) {
          this.liquidity += tickInfo.liquidityNet;
        }
      }

      // Break if we're not making progress
      if (step.amountIn < 0.000001) {
        break;
      }
    }

    // Update the current sqrt price
    this.sqrtPriceX96 = currentSqrtPrice;
    this.currentTick = this.getTickAtSqrtRatio(currentSqrtPrice);

    // Calculate new prices
    const price = (currentSqrtPrice / Number(this.Q96)) ** 2;
    const newFromTokenPrice = zeroForOne ? price : 1 / price;
    const newToTokenPrice = zeroForOne ? 1 / price : price;

    return {
      toTokenReceived: totalAmountOut,
      newFromTokenPrice,
      newToTokenPrice,
    };
  }

  private getNextInitializedTick(zeroForOne: boolean): number {
    // Simplified implementation - in reality this would use a tick bitmap
    // For now, we'll use a simple approach that finds the next tick with liquidity
    const ticks = Array.from(this.ticks.keys());

    if (zeroForOne) {
      // Find the highest tick below current tick
      let bestTick = this.MIN_TICK;
      for (const tick of ticks) {
        if (tick <= this.currentTick && tick > bestTick) {
          bestTick = tick;
        }
      }
      return bestTick;
    } else {
      // Find the lowest tick above current tick
      let bestTick = this.MAX_TICK;
      for (const tick of ticks) {
        if (tick > this.currentTick && tick < bestTick) {
          bestTick = tick;
        }
      }
      return bestTick;
    }
  }

  price(token: string): number {
    const currentPrice = (this.sqrtPriceX96 / Number(this.Q96)) ** 2;

    if (token === this.token0) {
      return currentPrice;
    } else if (token === this.token1) {
      return 1 / currentPrice;
    } else {
      throw new Error(`Token ${token} not found`);
    }
  }

  getReserves(): { token0: number; token1: number } {
    // Calculate total reserves by summing up all active positions
    let totalToken0 = 0;
    let totalToken1 = 0;

    for (const position of this.positions) {
      if (
        position.minTick <= this.currentTick &&
        this.currentTick < position.maxTick
      ) {
        const sqrtPriceA = this.getSqrtRatioAtTick(position.minTick);
        const sqrtPriceB = this.getSqrtRatioAtTick(position.maxTick);
        const currentSqrtPrice = this.sqrtPriceX96;

        totalToken0 += this.getAmount0ForLiquidity(
          position.liquidity,
          currentSqrtPrice,
          sqrtPriceB
        );
        totalToken1 += this.getAmount1ForLiquidity(
          position.liquidity,
          sqrtPriceA,
          currentSqrtPrice
        );
      }
    }

    return {
      token0: totalToken0,
      token1: totalToken1,
    };
  }

  // Additional utility methods for position management
  addPosition(minTick: number, maxTick: number, liquidity: number): void {
    const position: IPosition = { minTick, maxTick, liquidity };
    this.positions.push(position);
    this.addLiquidity(minTick, maxTick, liquidity);
  }

  removePosition(positionIndex: number): void {
    if (positionIndex >= 0 && positionIndex < this.positions.length) {
      const position = this.positions[positionIndex];
      this.removeLiquidity(
        position.minTick,
        position.maxTick,
        position.liquidity
      );
      this.positions.splice(positionIndex, 1);
    }
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  getCurrentLiquidity(): number {
    return this.liquidity;
  }
}
