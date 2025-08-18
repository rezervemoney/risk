import { IPosition, IPositionWithLiquidation } from "./interfaces";
import { LiquidityPool } from "./liquidity";

console.log("Hello World");

// ================================================
// ===== Lending parameters =====
// ================================================

// Liquidation penalty is the amount of collateral that is taken away from the
// borrower when the collateral ratio is below the liquidation threshold.
const liquidationPenalty = 0.15; // 15% liquidation penalty

// Loan to value is the ratio of the debt to the collateral.
const loanToValue = 0.4; // 40% loan to value

// Liquidation threshold is the ratio of the collateral to the debt at which
// the loan is considered liquidatable.
const liquidationThreshold = 0.6; // 60% liquidation threshold

// How much USDC is available to be borrowed.
const availableUsdcSupply = 200000;

// ================================================
// ===== Collateral parameters =====
// ================================================

// How much RZR is in circulation?
const rzrSupply = 652183;

// How much RZR is staked?
const rzrStaked = 231693;

// How much RZR is owned by the treasury?
const rzrSupplyOwnedByTreasury = 420000;

// How much RZR is in the lstRZR/RZR LP. This is important because it tells
// us how much lstRZR can immediately exit the pool.
const rzrInLstRzrLP = 4000;

// This tells us how much RZR is in the withdrawal queue. ie RZR that
// is about to exit in less than 3 days. Most likely to be sold
const stakedRzrInWithdrawalQueue = 100000;

// ================================================
// ===== ETH parameters =====
// ================================================

// What is the current spot price of ETH?
const ethPrice = 4200;

// What is the price action of ETH over the last 200 days?
const priceActionOverLast200Days = [
  {
    date: "2024-01-01",
    price: 4200,
  },
];

// What is the price action of RZR over the last 200 days?
const priceActionOverLast200DaysRzr = [
  {
    date: "2024-01-01",
    price: 13.5,
  },
];

// ================================================
// ===== Liquidity Pool Parameters =====
// ================================================

// How much ETH is in the liquidity pool?
const ethInLiquidityPool = 182;

// How much RZR is in the liquidity pool?
const rzrInLiquidityPool = 55260.24910078;

// Creates a simple x*y=k liquidity pool.
const liquidityPool = new LiquidityPool(rzrInLiquidityPool, ethInLiquidityPool);

const currentRzrPriceInEth = liquidityPool.getRzrPrice(); // 0.0032935066881092123
const currentRzrPriceInUsd = liquidityPool.getRzrPriceInUsd(ethPrice); // 13.832728090058692
console.log("RZR price in ETH: ", currentRzrPriceInEth);
console.log("RZR price in USD: ", currentRzrPriceInUsd);

// What is the current spot price of RZR?
const rzrSpotPrice = currentRzrPriceInUsd;

// ================================================
// ===== Current Lending Positions =====
// ================================================

// This is the current lending positions of the protocol.
const positions: IPosition[] = [
  {
    collateralRzr: 12000,
    debtUsdc: 50000,
    healthScore: 2.5,
    ltv: 0.3195,
    lltv: 0.8,
    ethExposure: 11.834401863557658981, // how much ETH we got by selling the debt USDC
    ethPrice: 4224.97060489, // the price at which we got the ETH
  },
];

// Calculate the liquidation prices for the positions.
const positionsWithLiquidation: IPositionWithLiquidation[] = positions.map(
  (position) => {
    // TODO: Calculate the liquidation price of the RZR and ETH on this position guessing
    // the price of RZR and ETH.

    // If ETH price goes down, then our ETH exposure loses value.
    // Greater chance of liquidation since we are long ETH.

    // If ETH price goes up, our ETH exposure increases in value.
    // Less chance of liquidation. Safer position.

    // If RZR price goes down, then our collateral RZR will be worth less.
    // Greater chance of liquidation.

    // If RZR price goes up, then our collateral RZR will be worth more.
    // Less chance of liquidation.

    // If we have a position with a lot of debt USDC, then we are more vulnerable to a price drop.

    const rzrLiquidationPrice =
      position.debtUsdc / (position.collateralRzr * liquidationThreshold);

    return {
      ...position,
      rzrLiquidationPrice,
    };
  }
);

console.log(positionsWithLiquidation);

// Estimate the maximum amount of USDC that we can borrow
// and use that for our exposure to ETH.
const estimateMaxBorrowableAndExposure = () => {
  // (ethReserve=182.00, rzrReserve=55260.25, price=13.83)
  console.log("LP Reserves before:", liquidityPool.toString(ethPrice));

  // TODO - What we need to calculate:
  // 1. What is the maximum amount of USDC that we can borrow so that we are
  // pretty much safe? Also considering the fact that we have RZR in the
  // withdrawal queue and that the borrowed USDC will be used to buy ETH which is then
  // added to the liquidity pool for RZR/ETH thereby supporting the price of RZR.
  const maxBorrowableUsdc = 10000; // TODO: Calculate this.
  console.log("Max borrowable USDC: ", maxBorrowableUsdc); // 10000

  // Knowing that this is what we're going to do.
  const newEthExposure = maxBorrowableUsdc / ethPrice;
  const newRzrMinted = maxBorrowableUsdc / rzrSpotPrice;
  liquidityPool.addLiquidity(newEthExposure, newRzrMinted);

  console.log("ETH bought with USDC debt: ", newEthExposure); // 2.3809428104761904
  console.log("RZR minted for liquidity: ", newRzrMinted); // 722.9231959809

  // (ethReserve=184.38, rzrReserve=55983.17, price=13.83)
  console.log("LP Reserves after:", liquidityPool.toString(ethPrice));

  // 2. If our position does gets liquidated, how much price impact will it have on the
  // RZR and ETH price? Ideally we want to make sure that we only liquidate if
  // the price impact is minimal.

  //
  // 3. For the amount of USDC that we can borrow, what LTV should we do it so that we never face
  // liquidation even if all the RZR in the withdrawal queue is sold.
};

estimateMaxBorrowableAndExposure();
