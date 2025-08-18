import { IPosition, IPositionWithLiquidation } from "./interfaces";
import { LiquidityPool } from "./liquidity";

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
const rzrSupplyOwnedByTreasuryUnstaked = 304153.5;

// How much RZR is in the lstRZR/RZR LP. This is important because it tells
// us how much lstRZR can immediately exit the pool.
const rzrInLstRzrLP = 4000;

// How much RZR is in the liquidity pool?
const rzrInLiquidityPool = 55260.24910078;

// This is the amount of RZR that is not staked or owned by the treasury. Consider this as the amount of RZR
// that is available to be sold.
const rzrWithHolders =
  rzrSupply - rzrStaked - rzrSupplyOwnedByTreasuryUnstaked - rzrInLiquidityPool;
console.log("RZR with holders: ", rzrWithHolders); // 61076.25089922

// This tells us how much RZR is in the withdrawal queue. ie RZR that
// is about to exit in less than 3 days. Most likely to be sold
const stakedRzrInWithdrawalQueue = 100000;

const estimatedMaximumSellPressure =
  rzrInLstRzrLP + stakedRzrInWithdrawalQueue + rzrWithHolders;
console.log("Estimated maximum sell pressure: ", estimatedMaximumSellPressure); // 165076.25089922

// ================================================
// ===== ETH parameters =====
// ================================================

// What is the current spot price of ETH?
const currentEthPrice = 4200;

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

// Creates a simple x*y=k liquidity pool.
const liquidityPool = new LiquidityPool(rzrInLiquidityPool, ethInLiquidityPool);

const currentRzrPriceInEth = liquidityPool.getRzrPrice(); // 0.0032935066881092123
const currentRzrPriceInUsd = liquidityPool.getRzrPriceInUsd(currentEthPrice); // 13.832728090058692
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
    lltv: 0.8,
    ethExposure: 11.834401863557658981, // how much ETH we got by selling the debt USDC
    ethPrice: 4224.97060489, // the price at which we got the ETH
  },
];

const mapLiquidationPrice = (position: IPosition): IPositionWithLiquidation => {
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

  const rzrPriceInUsd = liquidityPool.getRzrPriceInUsd(position.ethPrice);
  const ltv = position.debtUsdc / (position.collateralRzr * rzrPriceInUsd);
  const healthScore = 1 / (ltv / position.lltv);

  const rzrLiquidationPrice =
    position.debtUsdc / (position.collateralRzr * position.lltv);

  return {
    healthScore,
    ltv,
    ...position,
    rzrLiquidationPrice,
  };
};

// Calculate the liquidation prices for the positions.
const positionsWithLiquidation = positions.map(mapLiquidationPrice);

// [
//   {
//     healthScore: 2.0037555279748855,
//     ltv: 0.29943772662047036,
//     collateralRzr: 12000,
//     debtUsdc: 50000,
//     lltv: 0.8,
//     ethExposure: 11.834401863557659,
//     ethPrice: 4224.97060489,
//     rzrLiquidationPrice: 6.944444444444445
//   }
// ]
console.log(positionsWithLiquidation);

// Helper function to simulate selling RZR and see the impact on the health scores.
const simulateSellRzr = (rzrSold: number, newEthPrice: number) => {
  const backup = liquidityPool.clone();
  console.log("\nRZR sold: ", rzrSold, "with ETH price: ", newEthPrice);

  liquidityPool.swapRzrForEth(rzrSold);
  liquidityPool.log("LP Reserves after selling RZR:", newEthPrice);

  const newPositions = positions.map(mapLiquidationPrice);
  console.log(
    "New positions health scores after selling RZR:",
    newPositions.map((p) => p.healthScore)
  );

  liquidityPool.copy(backup);
};

// Estimate the maximum amount of USDC that we can borrow
// and use that for our exposure to ETH.
const estimateMaxBorrowableAndExposure = (ethPrice: number) => {
  // LP Reserves before: ethReserve 182 rzrReserve 55260.25 price 13.83
  liquidityPool.log("\nLP Reserves before:", ethPrice);

  // TODO - What we need to calculate:
  // 1. What is the maximum amount of USDC that we can borrow so that we are
  // pretty much safe? Also considering the fact that we have RZR in the
  // withdrawal queue and that the borrowed USDC will be used to buy ETH which is then
  // added to the liquidity pool for RZR/ETH thereby supporting the price of RZR.
  const maxBorrowableUsdc = 10000; // TODO: Calculate this.
  const rzrAddedAsCollateral = maxBorrowableUsdc / loanToValue / rzrSpotPrice;
  console.log("Max borrowable USDC: ", maxBorrowableUsdc); // 10000
  console.log("\nRZR added as collateral: ", rzrAddedAsCollateral);

  // Knowing that this is what we're going to do.
  const newEthExposure = maxBorrowableUsdc / ethPrice;
  const newRzrMinted = maxBorrowableUsdc / rzrSpotPrice;
  liquidityPool.addLiquidity(newEthExposure, newRzrMinted);

  positions.push({
    collateralRzr: rzrAddedAsCollateral,
    debtUsdc: maxBorrowableUsdc,
    lltv: liquidationThreshold,
    ethExposure: newEthExposure,
    ethPrice,
  });

  console.log("\nETH bought with USDC debt: ", newEthExposure); // 2.3809428104761904
  console.log("RZR minted for liquidity: ", newRzrMinted); // 722.9231959809

  // LP Reserves after: ethReserve 184.38 rzrReserve 55983.17 price 13.83
  liquidityPool.log("LP Reserves after:", ethPrice);

  // 2. If users do try to sell RZR, how much price impact will it have on the
  // RZR and ETH price? Ideally we want to make sure that we only liquidate if
  // the price impact is minimal.

  // RZR sold:  5000 with ETH price:  4200
  // LP Reserves after selling RZR: ethReserve 184.38 rzrReserve 60983.17 price 12.7
  // New positions health scores after selling RZR: [ 2.4526239340763922, 1.3770152532652298 ]
  simulateSellRzr(5000, ethPrice);

  // RZR sold:  30000 with ETH price:  4200
  // LP Reserves after selling RZR: ethReserve 184.38 rzrReserve 85983.17 price 9.01
  // New positions health scores after selling RZR: [ 1.739512324978205, 0.9766417800370547 ]
  // NOTE selling 30000 RZR will drop the health score of the second position below
  // the threshold and cause a liquidation for.
  simulateSellRzr(30000, ethPrice);

  // RZR sold:  220336.5 with ETH price:  4200
  // LP Reserves after selling RZR: ethReserve 184.38 rzrReserve 276319.67 price 2.8
  // New positions health scores after selling RZR: [ 0.5412889596594005, 0.3039043791096944 ]
  // NOTE if everyone sell then the health score of the both positions will drop below the threshold
  // and cause a liquidation.
  simulateSellRzr(estimatedMaximumSellPressure, ethPrice);

  // RZR sold:  61076.25089922 with ETH price:  4200
  // LP Reserves after selling RZR: ethReserve 184.38 rzrReserve 117059.42 price 6.62
  // New positions health scores after selling RZR: [ 1.2777167686921889, 0.7173686334038293 ]
  // NOTE if all holders sell then the health score of the the second position will drop below the threshold
  // and cause a liquidation.
  simulateSellRzr(rzrWithHolders, ethPrice);

  // TODO the above are some guesses. What we need to do is back calculate either
  // through brute force or by using math or a solver.
};

estimateMaxBorrowableAndExposure(currentEthPrice);
