import os
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LinearRegression

def run_diagnostic_10year_backtest(capital=1000000, portfolio_size=10, exit_rank=25, fee_pct=0.002):
    print("\n=========================================================================")
    print("      LAUNCHING INSTITUTIONAL 10-YEAR QUANTITATIVE PERFORMANCE RADAR     ")
    print("=========================================================================")
    print(f"Initial Seed Capital: ₹{capital:,} | Strategy Buffer Zone: Rank {exit_rank}")
    
    csv_filename = "nifty500.csv"
    if not os.path.exists(csv_filename):
        print("Critical Error: 'nifty500.csv' target universe missing.")
        return
    
    universe_df = pd.read_csv(csv_filename)
    tickers = [f"{str(sym).strip()}.NS" for sym in universe_df['Symbol']]
    
    benchmark_ticker = "^NSEI" # High-fidelity index validation anchor
    print(f"Retrieving 10-Year Historical Data Vector Matrix (2016 - 2026)...")
    
    # Downloading 12y period to ensure 2016 dates have a fully formed 200-MA history baseline array
    master_data = yf.download(tickers + [benchmark_ticker], period="12y", interval="1d", progress=False)['Close']
    
    nifty_index = master_data[benchmark_ticker].dropna()
    stock_data = master_data.drop(columns=[benchmark_ticker]).dropna(how='all')
    
    # Filter time matrix array to exactly cover the requested 10-year window
    stock_data = stock_data.loc['2016-01-01':'2026-05-25']
    trading_days = stock_data.index
    
    if len(trading_days) == 0:
        print("Error: Historical boundaries data slice empty.")
        return
        
    print(f"Successfully compiled {len(trading_days)} market horizons for processing.")
    
    # Engine Tracking Metrics State
    portfolio_value = capital
    current_holdings = [] 
    peak_value = capital
    max_drawdown = 0.0
    
    # Performance Analytics Logs
    all_trades_pnl = [] # Tracking percentage returns for individual trade slots
    gross_profits = 0.0
    gross_losses = 0.0
    
    # 21-day steps simulating the monthly execution cycle over 10 full years
    rebalance_intervals = range(0, len(trading_days) - 21, 21)
    
    for step in rebalance_intervals:
        current_date = trading_days[step]
        next_step = step + 21
        
        # 1. Benchmark Risk Regime Check
        nifty_slice = nifty_index.loc[:current_date]
        if len(nifty_slice) >= 200:
            if nifty_slice.iloc[-1] < np.mean(nifty_slice.iloc[-200:]):
                if current_holdings:
                    current_holdings = []
                if portfolio_value > peak_value: peak_value = portfolio_value
                continue

        # 2. Score Generation Loop
        lookback_data = stock_data.iloc[max(0, step-126):step]
        if len(lookback_data) < 126: continue
        
        all_ranks = []
        for ticker in stock_data.columns:
            series = lookback_data[ticker].dropna().values
            if len(series) < 126: continue
            
            # Asset Baseline safety check
            current_price = series[-1]
            asset_ma_slice = stock_data[ticker].iloc[max(0, step-200):step].dropna().values
            if len(asset_ma_slice) > 0 and current_price < np.mean(asset_ma_slice):
                continue
            
            # Log Linear Regression Model
            x = np.arange(len(series)).reshape(-1, 1)
            y = np.log(series).reshape(-1, 1)
            model = LinearRegression().fit(x, y)
            annual_slope = (np.exp(model.coef_[0][0]) ** 252) - 1
            r2 = model.score(x, y)
            raw_m_score = annual_slope * r2 * 100
            
            if raw_m_score > 0:
                vol = np.std(np.diff(np.log(series))) * np.sqrt(252)
                if vol > 0:
                    all_ranks.append({"ticker": ticker, "score": raw_m_score / vol})

        sorted_universe = [x['ticker'] for x in sorted(all_ranks, key=lambda x: x['score'], reverse=True)]
        top_buffer_zone = sorted_universe[:exit_rank]

        # 3. Asymmetric Buffer Allocations Execution
        new_holdings = [t for t in current_holdings if t in top_buffer_zone]
        for candidate in sorted_universe:
            if len(new_holdings) >= portfolio_size: break
            if candidate not in new_holdings:
                new_holdings.append(candidate)
        
        # 4. Period Return Computation
        if new_holdings:
            alloc = portfolio_value / len(new_holdings)
            period_value = 0
            for ticker in new_holdings:
                p_start = stock_data[ticker].iloc[step]
                p_end = stock_data[ticker].iloc[next_step]
                
                fee = fee_pct if ticker not in current_holdings else 0
                
                if pd.isna(p_start) or pd.isna(p_end):
                    period_value += alloc
                else:
                    trade_return = (p_end / p_start) * (1 - fee)
                    slot_pnl_rupees = (alloc * trade_return) - alloc
                    
                    # Accumulate for analytics metrics calculations
                    all_trades_pnl.append(trade_return - 1)
                    if slot_pnl_rupees > 0:
                        gross_profits += slot_pnl_rupees
                    else:
                        gross_losses += abs(slot_pnl_rupees)
                        
                    period_value += alloc * trade_return
            
            portfolio_value = period_value
        
        if portfolio_value > peak_value:
            peak_value = portfolio_value
        current_dd = ((peak_value - portfolio_value) / peak_value) * 100
        if current_dd > max_drawdown:
            max_drawdown = current_dd
            
        current_holdings = new_holdings

    # 5. DIAGNOSTIC CALCULATION BLOCK
    total_net_return = ((portfolio_value - capital) / capital) * 100
    
    winning_trades = [t for t in all_trades_pnl if t > 0]
    win_rate = (len(winning_trades) / len(all_trades_pnl) * 100) if all_trades_pnl else 0.0
    profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else float('inf')
    romad = (total_net_return / max_drawdown) if max_drawdown > 0 else 0.0

    print("\n=========================================================================")
    print("                 STRATEGY DIAGNOSTIC METRICS REPORT                      ")
    print("=========================================================================")
    print(f"Final Compiled Portfolio Balance  : ₹{portfolio_value:,.2f}")
    print(f"Total Cumulative 10-Year Return   : {'+' if total_net_return >= 0 else ''}{total_net_return:.1f}%")
    print(f"Maximum Historical Peak Drawdown  : {max_drawdown:.1f}%")
    print(f"Strategy RoMaD Ratio Score        : {romad:.2f}")
    print(f"Algorithmic Trade Win Rate        : {win_rate:.1f}%")
    print(f"Systemic Profit Factor            : {profit_factor:.2f}")
    print("-------------------------------------------------------------------------")
    
    if profit_factor < 1.0:
        print("🔴 DIAGNOSIS: The strategy has a sub-1.0 profit factor. It is bleeding capital\n              due to transaction fees and selling asset dips prematurely.")
    else:
        print("🟢 DIAGNOSIS: Strategy structure generated gross positive equity distribution.")
    print("=========================================================================\n")

if __name__ == "__main__":
    run_diagnostic_10year_backtest()