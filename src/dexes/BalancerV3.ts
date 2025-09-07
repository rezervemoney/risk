import assert from "assert";
import { IDex } from "./base";

export class BalancerV3 implements IDex {
  public totalWeight: number;
  public invariant: number;
  public name: string;

  constructor(
    public source: string,
    public token0Reserve: number,
    public token1Reserve: number,
    public token0: string,
    public token1: string,
    public token0Weight: number,
    public token1Weight: number,
    public swapFee: number = 0.003 // 0.3% default swap fee
  ) {
    this.totalWeight = this.token0Weight + this.token1Weight;
    this.invariant = this.calculateInvariant();

    this.name = `${source}:${this.token0}/${this.token1}-${
      this.token0Weight * 100
    }:${this.token1Weight * 100}`;

    assert(token0Weight + token1Weight === 1, "Token weights must sum to 1");
  }

  /**
   * Calculate the weighted geometric mean invariant
   * V = (B0^w0 * B1^w1)^(1/W) where W = w0 + w1
   */
  private calculateInvariant(): number {
    const weight0Ratio = this.token0Weight / this.totalWeight;
    const weight1Ratio = this.token1Weight / this.totalWeight;

    return Math.pow(
      Math.pow(this.token0Reserve, weight0Ratio) *
        Math.pow(this.token1Reserve, weight1Ratio),
      1
    );
  }

  /**
   * Calculate the amount out for a given amount in using Balancer's weighted pool formula
   * amountOut = balanceOut * (1 - (balanceIn / (balanceIn + amountIn))^(weightIn / weightOut))
   */
  private calculateAmountOut(
    balanceIn: number,
    balanceOut: number,
    amountIn: number,
    weightIn: number,
    weightOut: number
  ): number {
    // Apply swap fee
    const amountInAfterFee = amountIn * (1 - this.swapFee);

    // Calculate the ratio of weights
    const weightRatio = weightIn / weightOut;

    // Calculate the amount out using the weighted pool formula
    const ratio = balanceIn / (balanceIn + amountInAfterFee);
    const amountOut = balanceOut * (1 - Math.pow(ratio, weightRatio));

    return amountOut;
  }

  getReserves() {
    return {
      token0: this.token0Reserve,
      token1: this.token1Reserve,
    };
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
    // Validate inputs
    if (fromTokenAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    // Validate fromToken
    if (fromToken !== this.token0 && fromToken !== this.token1) {
      throw new Error(`Token ${fromToken} not found`);
    }

    // Validate toToken
    if (toToken !== this.token0 && toToken !== this.token1) {
      throw new Error(`Token ${toToken} not found`);
    }

    // Cannot swap to the same token
    if (fromToken === toToken) {
      throw new Error("Cannot swap to the same token");
    }

    let newToken0Reserve: number;
    let newToken1Reserve: number;
    let amountOut: number;

    if (fromToken === this.token0 && toToken === this.token1) {
      // Swapping token0 for token1
      amountOut = this.calculateAmountOut(
        this.token0Reserve,
        this.token1Reserve,
        fromTokenAmount,
        this.token0Weight,
        this.token1Weight
      );

      newToken0Reserve = this.token0Reserve + fromTokenAmount;
      newToken1Reserve = this.token1Reserve - amountOut;
    } else {
      // Swapping token1 for token0
      amountOut = this.calculateAmountOut(
        this.token1Reserve,
        this.token0Reserve,
        fromTokenAmount,
        this.token1Weight,
        this.token0Weight
      );

      newToken1Reserve = this.token1Reserve + fromTokenAmount;
      newToken0Reserve = this.token0Reserve - amountOut;
    }

    // Validate that we don't drain the pool
    if (newToken0Reserve <= 0 || newToken1Reserve <= 0) {
      throw new Error("Insufficient liquidity for this trade");
    }

    // Update reserves
    this.token0Reserve = newToken0Reserve;
    this.token1Reserve = newToken1Reserve;

    // Recalculate invariant
    this.invariant = this.calculateInvariant();

    return {
      toTokenReceived: amountOut,
      newFromTokenPrice: newToken0Reserve / newToken1Reserve,
      newToTokenPrice: newToken1Reserve / newToken0Reserve,
    };
  }

  price(token: string): number {
    if (token === this.token0) {
      // Price of token0 in terms of token1
      // In weighted pools, price is influenced by the weight ratio
      const weightRatio = this.token1Weight / this.token0Weight;
      return (this.token1Reserve / this.token0Reserve) * weightRatio;
    }
    if (token === this.token1) {
      // Price of token1 in terms of token0
      const weightRatio = this.token0Weight / this.token1Weight;
      return (this.token0Reserve / this.token1Reserve) * weightRatio;
    }
    throw new Error(`Token ${token} not found`);
  }

  /**
   * Get the current invariant value
   */
  getInvariant(): number {
    return this.invariant;
  }

  /**
   * Get the total weight of the pool
   */
  getTotalWeight(): number {
    return this.totalWeight;
  }

  /**
   * Get the swap fee
   */
  getSwapFee(): number {
    return this.swapFee;
  }

  /**
   * Calculate the spot price (price without slippage) for a token
   */
  getSpotPrice(token: string): number {
    if (token === this.token0) {
      const weightRatio = this.token1Weight / this.token0Weight;
      return (this.token1Reserve / this.token0Reserve) * weightRatio;
    }
    if (token === this.token1) {
      const weightRatio = this.token0Weight / this.token1Weight;
      return (this.token0Reserve / this.token1Reserve) * weightRatio;
    }
    throw new Error(`Token ${token} not found`);
  }

  /**
   * Calculate the effective price (including slippage) for a swap
   */
  getEffectivePrice(
    fromToken: string,
    fromTokenAmount: number,
    toToken: string
  ): number {
    const swapResult = this.swap(fromToken, fromTokenAmount, toToken);
    return fromTokenAmount / swapResult.toTokenReceived;
  }
}
