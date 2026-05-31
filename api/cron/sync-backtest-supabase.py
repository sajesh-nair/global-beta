import os
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LinearRegression
from supabase import create_client
from dotenv import load_dotenv

def run_relative_momentum_backtest():
    print("=========================================================================")
    print("     LAUNCHING RELATIVE MOMENTUM BACKTEST ENGINE (NIFTY 200 TOP 20)      ")
    print("=========================================================================")
    
    load_dotenv() 
    
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_KEY")
    if not sb_url or not sb_key:
        print("Critical Error: Supabase environment variables are missing.")
        return
    supabase = create_client(sb_url, sb_key)

    csv_filename = "nifty200.csv"
    if not os.path.exists(csv_filename):
        print(f"Error: {csv_filename} universe file missing.")
        return
    
    universe_df = pd.read_csv(csv_filename)
    tickers = [f"{str(sym).strip()}.NS" for sym in universe_df['Symbol']]
    benchmark_ticker = "^NSEI" 
    
    print("Downloading 12-year price matrices from Yahoo Finance cloud...")
    master_data = yf.download(tickers + [benchmark_ticker], period="12y", interval="1d", progress=False)['Close']
    
    nifty_index = master_data[benchmark_ticker].dropna()
    stock_data = master_data.drop(columns=[benchmark_ticker]).dropna(how='all')
    
    stock_data = stock_data.loc['2016-01-01':'2026-05-25']
    trading_days = stock_data.index
    
    portfolio_size = 20
    exit_rank_buffer = 25
    capital_initial = 1000000
    portfolio_value = capital_initial
    
    current_holdings = [] 
    peak_value = capital_initial
    max_drawdown = 0.0
    gross_profits = 0.0
    gross_losses = 0.0
    
    all_trades_pnl = []
    portfolio_history = []
    benchmark_history = []
    total_trades_executed = 0

    rebalance_intervals = range(0, len(trading_days) - 21, 21)
    
    for step in rebalance_intervals:
        current_date = trading_days[step]
        next_step = step + 21
        
        portfolio_history.append(portfolio_value)
        benchmark_history.append(nifty_index.loc[:current_date].iloc[-1])
        
        lookback_data_6m = stock_data.iloc[max(0, step-126):step]
        lookback_data_12m = stock_data.iloc[max(0, step-252):step]
        if len(lookback_data_12m) < 252: continue
        
        all_ranks = []
        for ticker in stock_data.columns:
            series_6m = lookback_data_6m[ticker].dropna().values
            series_12m = lookback_data_12m[ticker].dropna().values
            if len(series_6m) < 126 or len(series_12m) < 252: continue
            
            # 6-Month Momentum Core Math
            x6 = np.arange(len(series_6m)).reshape(-1, 1)
            y6 = np.log(series_6m).reshape(-1, 1)
            model6 = LinearRegression().fit(x6, y6)
            slope_6m = (np.exp(model6.coef_[0][0]) ** 252) - 1
            r2_6m = model6.score(x6, y6)
            vol_6m = np.std(np.diff(np.log(series_6m))) * np.sqrt(252)
            score_6m = (slope_6m * r2_6m) / vol_6m if vol_6m > 0 else 0
            
            # 12-Month Momentum Core Math
            x12 = np.arange(len(series_12m)).reshape(-1, 1)
            y12 = np.log(series_12m).reshape(-1, 1)
            model12 = LinearRegression().fit(x12, y12)
            slope_12m = (np.exp(model12.coef_[0][0]) ** 252) - 1
            r2_12m = model12.score(x12, y12)
            vol_12m = np.std(np.diff(np.log(series_12m))) * np.sqrt(252)
            score_12m = (slope_12m * r2_12m) / vol_12m if vol_12m > 0 else 0
            
            blended_score = score_6m + score_12m
            if blended_score > 0:
                all_ranks.append({"ticker": ticker, "score": blended_score})

        sorted_universe = [x['ticker'] for x in sorted(all_ranks, key=lambda x: x['score'], reverse=True)]
        top_buffer_zone = sorted_universe[:exit_rank_buffer]

        # Apply Relative Momentum Turnover Triggers
        new_holdings = [t for t in current_holdings if t in top_buffer_zone]
        for candidate in sorted_universe:
            if len(new_holdings) >= portfolio_size: break
            if candidate not in new_holdings:
                if candidate not in current_holdings:
                    total_trades_executed += 1
                new_holdings.append(candidate)
        
        # Enforce exactly 20 slots
        if len(new_holdings) > 0:
            alloc_per_slot = portfolio_value / len(new_holdings)
            period_value = 0
            
            for ticker in new_holdings:
                p_start = stock_data[ticker].iloc[step]
                p_end = stock_data[ticker].iloc[next_step]
                fee = 0.002 if ticker not in current_holdings else 0 
                
                if pd.isna(p_start) or pd.isna(p_end):
                    period_value += alloc_per_slot
                else:
                    trade_return = (p_end / p_start) * (1 - fee)
                    slot_pnl = (alloc_per_slot * trade_return) - alloc_per_slot
                    all_trades_pnl.append(trade_return - 1)
                    if slot_pnl > 0: gross_profits += slot_pnl
                    else: gross_losses += abs(slot_pnl)
                    period_value += alloc_per_slot * trade_return
                    
            portfolio_value = period_value
        
        if portfolio_value > peak_value: peak_value = portfolio_value
        current_dd = ((peak_value - portfolio_value) / peak_value) * 100
        if current_dd > max_drawdown: max_drawdown = current_dd
        current_holdings = new_holdings

    # Advanced Strategy Analytics Calculation
    total_years = len(trading_days) / 252
    total_net_return = ((portfolio_value - capital_initial) / capital_initial) * 100
    cagr = (((portfolio_value / capital_initial) ** (1 / total_years)) - 1) * 100
    
    p_returns = np.diff(portfolio_history) / portfolio_history[:-1] if len(portfolio_history) > 1 else np.array([0])
    b_returns = np.diff(benchmark_history) / benchmark_history[:-1] if len(benchmark_history) > 1 else np.array([0])
    
    rf_monthly = 0.05 / 12
    excess_returns = p_returns - rf_monthly
    p_std = np.std(p_returns)
    sharpe = (np.mean(excess_returns) / p_std) * np.sqrt(12) if p_std > 0 else 0
    
    downside_returns = p_returns[p_returns < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0
    sortino = (np.mean(excess_returns) / downside_std) * np.sqrt(12) if downside_std > 0 else 0
    
    winning_trades = [t for t in all_trades_pnl if t > 0]
    losing_trades = [t for t in all_trades_pnl if t < 0]
    hit_rate = (len(winning_trades) / len(all_trades_pnl) * 100) if all_trades_pnl else 0
    
    avg_win = np.mean(winning_trades) if winning_trades else 0
    avg_loss = abs(np.mean(losing_trades)) if losing_trades else 1
    win_loss_ratio = avg_win / avg_loss
    profit_factor = gross_profits / gross_losses if gross_losses > 0 else 1.0
    
    b_var = np.var(b_returns)
    beta = np.cov(p_returns, b_returns)[0][1] / b_var if b_var > 0 and len(p_returns) > 1 else 1.0
    benchmark_cagr = (((benchmark_history[-1] / benchmark_history[0]) ** (1 / total_years)) - 1) * 100 if benchmark_history else 0
    alpha = cagr - (5.0 + beta * (benchmark_cagr - 5.0))
    
    estimated_annual_turnover = (total_trades_executed / total_years) * 5 
    romad = cagr / max_drawdown if max_drawdown > 0 else 0

    sample_step = max(1, len(portfolio_history) // 60)
    eq_str = ",".join([str(round(v)) for v in portfolio_history[::sample_step]] + [str(round(portfolio_value))])

    payload = {
        "romad": round(romad, 2),
        "turnover_ratio": round(estimated_annual_turnover, 1),
        "cash_days": 0,  # Pure unconstrained equity allocation
        "equity_curve": eq_str,
        "alpha": round(alpha, 1),
        "beta": round(beta, 2),
        "cagr": round(cagr, 1),
        "max_drawdown": round(max_drawdown, 1),
        "metrics": {
            "total_return": round(total_net_return, 1),
            "profit_factor": round(profit_factor, 2),
            "win_loss_ratio": round(win_loss_ratio, 2),
            "hit_rate": round(hit_rate, 1),
            "sharpe_ratio": round(sharpe, 2),
            "sortino_ratio": round(sortino, 2)
        }
    }
    
    supabase.table("backtest_analytics").delete().neq("id", 0).execute()
    supabase.table("backtest_analytics").insert(payload).execute()
    print("🎉 Pure Equity-Momentum Matrix written successfully to Supabase.")

if __name__ == "__main__":
    run_relative_momentum_backtest()