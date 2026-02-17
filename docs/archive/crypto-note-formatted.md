---
created: 2026-02-13T09:20:50.884Z
source: telegram
processed: true
processed_at: 2026-02-13T09:35:14.705Z
tags: [crypto-trading, time-series-momentum, trading-strategy]
filed_at: 2026-02-13T09:40:27.813Z
filed_by: vault-curator
---

# Crypto-Trader Session Summary - 2026-02-12

## Major Breakthrough

TimeSeriesMomentum turned profitable! By simply disabling exit signals, the strategy went from -19.5% to +11.77% - a 31 percentage point improvement.

## Key Results

| Metric | Before | After | Change |
| --- | --- | --- | --- |
| Total Return | -19.5% | +11.77% | [DONE] |
| Win Rate | 47.5% | 96.3% | [ROCKET] |
| Max Drawdown | 23.65% | 6.26% | Excellent |
| Sharpe Ratio | -2.38 | +0.59 | Positive! |

TimeSeriesMomentum now beats buy-and-hold by 32.77 pts (market was -21% over same period)

## What We Learned

- Exit signals were the problem - Eliminating them removed -$213 in losses
- Trailing stops work perfectly - 100% win rate on exits, captured all profits
- WilliamsAlligator needs -35% stop - Tighter stops made it worse (-10% -> -25%)
- BTC never trades with current entry logic - Only ETH triggered (108 trades)

## Files Modified

- **config/freqtrade-btc-eth.json** - Added use_exit_signal: false
- **strategies/WilliamsAlligator.py** - Reverted stop-loss to -35%

## Next Steps

1. Test on full 3.5 years of data (not just 1.5 years)
2. Add short side capability
3. investigate BTC entry conditions
4. Optimize WilliamsAlligator with exit signals disabled

## Related Notes

[[projects/crypto-trading]] [[resources/trading-techniques]]
