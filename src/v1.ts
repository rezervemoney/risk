import { StressScenario } from "./helpers/scenarioChecker";
import { solveMaxBorrow } from "./helpers/solveBorrow";
import { IPosition } from "./interfaces";
import { LiquidityPool } from "./liquidity";

/*************************************************
 * Parameters (same as your snippet, regrouped)
 *************************************************/
const liquidationThreshold = 0.9; // LLTV used for liquidation checks
const availableUsdcSupply = 2000000;

// Collateral state
const rzrSupply = 652_183;
const rzrStaked = 231_693;
const rzrSupplyOwnedByTreasuryUnstaked = 304_153.5;
const rzrInLstRzrLP = 4_000;
const rzrInLiquidityPool = 55_260.24910078;
const stakedRzrInWithdrawalQueue = 2737;

const rzrWithHolders =
  rzrSupply - rzrStaked - rzrSupplyOwnedByTreasuryUnstaked - rzrInLiquidityPool; // 61076.25089922
const estimatedMaximumSellPressure =
  rzrInLstRzrLP + stakedRzrInWithdrawalQueue + rzrWithHolders; // 165076.25089922

// ETH + LP
const ethInLiquidityPool = 182;
const ethSpot = 4200; // current spot
const lp0 = new LiquidityPool(rzrInLiquidityPool, ethInLiquidityPool);

/*************************************************
 * Existing positions (unchanged semantics)
 *************************************************/
const basePositions: IPosition[] = [
  // {
  //   collateralRzr: 12000,
  //   debtUsdc: 10000,
  //   lltv: 0.8,
  //   ethExposure: 11.834401863557658981,
  //   ethPrice: 4224.97060489, // entry price of ETH exposure (not used for liquidation)
  // },
];

// Default scenario set. You can extend/replace this at runtime.
const defaultScenarios: StressScenario[] = [
  { name: "No stress", rzrSold: 0, ethPriceMultiplier: 1.0 },
  { name: "Mild sell (5k)", rzrSold: 5_000, ethPriceMultiplier: 1.0 },
  {
    name: "Moderate sell (30k)",
    rzrSold: 30_000,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  {
    name: "All holders sell",
    rzrSold: rzrWithHolders,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  {
    name: "Max pressure",
    rzrSold: estimatedMaximumSellPressure,
    ethPriceMultiplier: 1.0,
    warningOnly: true,
  },
  { name: "ETH -15%", rzrSold: 0, ethPriceMultiplier: 0.85 },
  { name: "ETH -30%", rzrSold: 0, ethPriceMultiplier: 0.7 },
  { name: "ETH -50%", rzrSold: 0, ethPriceMultiplier: 0.5, warningOnly: false },
  { name: "ETH -80%", rzrSold: 0, ethPriceMultiplier: 0.2, warningOnly: true },
  {
    name: "ETH -30% + 30k RZR sold",
    rzrSold: 30_000,
    ethPriceMultiplier: 0.7,
    warningOnly: true,
  },
  {
    name: "ETH -50% + 30k RZR sold",
    rzrSold: 30_000,
    ethPriceMultiplier: 0.5,
    warningOnly: true,
  },
  {
    name: "ETH -30% + Max pressure",
    rzrSold: estimatedMaximumSellPressure,
    ethPriceMultiplier: 0.7,
    warningOnly: true,
  },
  { name: "ETH +15%", rzrSold: 0, ethPriceMultiplier: 1.15 },
];

/*************************************************
 * Example: run the solver and log a summary
 *************************************************/
function run() {
  // Log base spot and price
  console.log("Base ETH spot:", ethSpot);
  console.log("Base RZR spot (USD):", lp0.getRzrPriceInUsd(ethSpot));

  const { maxSafeBorrowUsdc, optimalLtv, diagnostics } = solveMaxBorrow(
    defaultScenarios,
    {
      tolerance: 1,
      supplyCap: availableUsdcSupply,
      positions: basePositions,
      ethSpot,
      poolAtStart: lp0,
      ltvRange: { min: 0.3, max: 0.8 },
      liquidationThreshold,
    }
  );
  console.log(
    "\n================ Max Safe Borrow (across default scenarios) ================"
  );
  console.log(
    "Max USDC you can borrow while staying above liquidation:",
    maxSafeBorrowUsdc
  );
  console.log("Optimal LTV for the new borrow:", optimalLtv.toFixed(3));

  console.log("\nScenario diagnostics (min health across positions)");
  for (const d of diagnostics) {
    const tag = d.warningOnly ? "[warning]" : "[normal]";
    let colorStart = "";
    let colorEnd = "";

    if (d.minHealth < 1 && !d.warningOnly) {
      colorStart = "\x1b[31m"; // Red for dangerous scenarios (health < 1)
      colorEnd = "\x1b[0m";
    } else if (d.warningOnly && d.minHealth < 1) {
      colorStart = "\x1b[33m"; // Yellow for warnings
      colorEnd = "\x1b[0m";
    }

    console.log(
      `${colorStart}- ${d.scenario} ${tag}: minHealth=${d.minHealth.toFixed(
        3
      )} | ETH(USD)=${d.shockedEth.toFixed(2)} | RZR(USD)=${d.poolAfter
        .getRzrPriceInUsd(d.shockedEth)
        .toFixed(4)}${colorEnd}`
    );
  }
}

run();
