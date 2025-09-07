# DEX Aggregator - Optimal Path Finding

A sophisticated DEX aggregator that finds optimal swap paths across multiple decentralized exchanges with minimal slippage and maximum output.

## 🚀 Features

### Core Functionality

- **Optimal Path Finding**: Brute force algorithm to find the best swap routes
- **Multi-hop Swaps**: Support for complex paths through multiple DEXes
- **Slippage Minimization**: Automatically selects paths with lowest slippage
- **Liquidity Depth Analysis**: Considers pool depth for better execution
- **Price Impact Calculation**: Measures market impact of large trades

### Advanced Features

- **Price Oracle Integration**: Uses public price feeds for accurate calculations
- **DEX Failure Handling**: Gracefully handles DEX failures and errors
- **Configurable Thresholds**: Customizable slippage and path length limits
- **Detailed Execution Reports**: Comprehensive swap execution information
- **Backward Compatibility**: Maintains compatibility with existing code

## 📊 Supported DEXes

The aggregator works with any DEX that implements the `IDex` interface:

- **BalancerV3**: Weighted pools with custom fee structures
- **UniswapV2**: Constant product AMM
- **UniswapV3**: Concentrated liquidity (when implemented)
- **Custom DEXes**: Any DEX implementing the `IDex` interface

## 🎯 Algorithm Details

### Path Finding Algorithm

1. **Direct Swap Check**: First attempts direct swap between tokens
2. **Slippage Evaluation**: If direct swap has acceptable slippage, returns it
3. **Multi-hop Search**: Uses depth-first search to find all possible paths
4. **Path Evaluation**: Calculates slippage and output for each path
5. **Optimal Selection**: Chooses path with highest output within slippage threshold

### Slippage Calculation

```typescript
slippage = |spotPrice - effectivePrice| / spotPrice
```

Where:

- `spotPrice`: Current market price from DEX
- `effectivePrice`: Actual exchange rate achieved

### Price Impact Calculation

```typescript
priceImpact = amountIn / fromReserve;
```

Where:

- `amountIn`: Input amount
- `fromReserve`: Reserve of input token in pool
