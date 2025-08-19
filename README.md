# Risk models for Rezerve lending

This repo contains a small, self‑contained simulator that stress‑tests borrow positions against market scenarios and solves for a maximum safe borrow. It is designed to be easy to tweak and extend.

### What it does

- Simulates an RZR/ETH constant‑product AMM (XYK) with reserves defined in `src/liquidity.ts`.
- Models existing borrow positions and optionally adds a new borrow, pairing it with liquidity (price‑neutral deepen of the pool) in `src/v1.ts`.
- Applies stress scenarios that:
  - Market‑sell a given amount of RZR into the AMM, and/or
  - Shock the ETH/USD price by a multiplier.
- Computes position health using liquidation loan‑to‑value (LLTV). A position is safe if health ≥ 1.
- Runs a binary search to find the maximum USDC that can be newly borrowed while remaining safe across all non‑warning scenarios.
- Prints scenario diagnostics with colors:
  - Red: min health < 1 (liquidation risk at that scenario)
  - Yellow: scenario is marked as a warning (informational; not used to gate the solution)
  - Default: safe scenario

### Key concepts

- Health score: `(LLTV / actual LTV)`. Health ≥ 1 means the position is above liquidation.
- LLTV (liquidation threshold): defined in `src/v1.ts` (`liquidationThreshold`).
- New borrow: When testing a candidate borrow, the model mints RZR and pairs it with ETH 1:1 by USD to deepen AMM liquidity at the current spot. This makes stress tests path‑aware: adding size changes how future sells impact price.
- Scenarios: Each has a `name`, `rzrSold` amount, `ethPriceMultiplier`, and optional `warningOnly` flag. Warnings are included in the report but do not block borrowing.

### Project layout

- `src/liquidity.ts`: Minimal XYK AMM for RZR/ETH, with helpers to add/remove liquidity and execute swaps.
- `src/interfaces.ts`: Type definitions for positions and computed metrics.
- `src/v1.ts`: Main model, scenarios, solver, and CLI output.
- `src/v0.ts`: Earlier iteration kept for reference.

### Configure the model (edit `src/v1.ts`)

- Risk knobs:
  - `loanToValue` (default 0.4): target LTV for the new borrow.
  - `liquidationThreshold` (default 0.6): LLTV used for health checks.
  - `availableUsdcSupply` (default 200,000): upper bound for the solver.
- Market state:
  - Pool reserves: `rzrInLiquidityPool`, `ethInLiquidityPool` and `baseEthPrice`.
  - Supply/holders heuristics (used to size stress sells): `rzrSupply`, `rzrStaked`, etc.
- Positions:
  - `basePositions`: array of existing positions to test alongside any new borrow.
- Scenarios:
  - `defaultScenarios`: edit or extend. Set `warningOnly: true` to include a scenario in diagnostics without using it to gate the borrow limit.

### Run it

Requirements: Node 18+.

```bash
npm install
npm run build
node dist/v1.js
```

### Testing

The project includes comprehensive unit tests for the position metrics calculations:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

The tests cover:

**Position Metrics (`positionMetrics.ts`):**

- Basic LTV and health score calculations
- Edge cases (zero collateral/debt, very small values)
- Liquidation price calculations
- Different ETH market price scenarios
- Precision and rounding behavior
- Return value structure validation

**Scenario Checker (`scenarioChecker.ts`):**

- Basic stress scenarios without new borrows
- Scenarios with new borrow positions
- RZR sell and ETH price shock combinations
- Pool liquidity management and state preservation
- Edge cases (zero borrow, empty positions, extreme movements)
- Minimum health score calculations across multiple positions

### Interpreting the output

- "Max USDC you can borrow while staying above liquidation" is the integer floor of the solver result that keeps health ≥ 1 for all non‑warning scenarios.
- Scenario diagnostics show:
  - `minHealth`: the minimum health across all positions at the shocked state.
  - `shockedEth`: ETH price after applying the scenario multiplier.
  - `RZR(USD)`: the implied RZR/USD after any market sells + ETH shock.
  - `[warning]` tag (and yellow color) for scenarios that are informational only.

### Sample output

Below is an example run with the default configuration and some scenarios marked as warnings. ANSI colors are removed here for readability.

```
Base ETH spot: 4200
Base RZR spot (USD): 13.832728090058692

================ Max Safe Borrow (across default scenarios) ================
Max USDC you can borrow while staying above liquidation: 199999

Scenario diagnostics (min health across positions)
- No stress: minHealth=1.500 | shockedEth=4200.00 | RZR(USD)=13.8327
- Mild sell (5k): minHealth=1.400 | shockedEth=4200.00 | RZR(USD)=12.9071
- Moderate sell (30k) [warning]: minHealth=1.049 | shockedEth=4200.00 | RZR(USD)=9.6712
- All holders sell [warning]: minHealth=0.800 | shockedEth=4200.00 | RZR(USD)=7.3734
- Max pressure [warning]: minHealth=0.445 | shockedEth=4200.00 | RZR(USD)=4.1074
- ETH -15%: minHealth=1.275 | shockedEth=3570.00 | RZR(USD)=11.7578
- ETH -30%: minHealth=1.050 | shockedEth=2940.00 | RZR(USD)=9.6829
- ETH -30% + 30k RZR sold [warning]: minHealth=0.734 | shockedEth=2940.00 | RZR(USD)=6.7698
- ETH -30% + Max pressure [warning]: minHealth=0.312 | shockedEth=2940.00 | RZR(USD)=2.8752
- ETH +15%: minHealth=1.725 | shockedEth=4830.00 | RZR(USD)=15.9076
```

### Assumptions and limitations

- ETH exposure on positions does not count toward collateral in liquidation checks (common for on‑chain lending). You can change this in `computePositionMetrics` if desired.
- No fees/slippage beyond the constant‑product curve; you can add fees in `swapRzrForEth`.
- Scenarios are single‑step shocks. You can model multi‑step paths by applying sequential swaps + ETH drifts.
- This is a simplified model intended for relative risk analysis, not a production risk engine.

### Extending

- Add scenarios (or load them from JSON) and tag severe ones with `warningOnly: true`.
- Change the solver’s `tolerance` or `supplyCap` via `solveMaxBorrow` options.
- Count ETH exposure in collateral by adding `+ p.ethExposure * ethMktPrice` in `computePositionMetrics`.
- Plug in alternative AMM or oracle models in `liquidity.ts`.

### License

See `LICENSE`.
