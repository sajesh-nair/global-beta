import os
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LinearRegression
from supabase import create_client

# Smart fallback: Only load dotenv if it exists (for local VS Code development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # On GitHub Actions, environment variables are handled natively

def sync_live_momentum_portfolio():
    print("=========================================================================")
    print("     LAUNCHING LIVE RELATIVE MOMENTUM ENGINE (NIFTY 200 TOP 20)          ")
    print("=========================================================================")
    
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") 

    if not sb_url or not sb_key:
        print("Critical Error: Supabase master keys missing in environment configuration.")
        return
    supabase = create_client(sb_url, sb_key)

    csv_filename = "nifty200.csv"
    if not os.path.exists(csv_filename):
        print(f"Error: {csv_filename} universe file missing.")
        return
    
    universe_df = pd.read_csv(csv_filename)
    tickers = [f"{str(sym).strip()}.NS" for sym in universe_df['Symbol']]
    
    print("Fetching live market price matrices from Yahoo Finance cloud...")
    master_data = yf.download(tickers, period="15mo", interval="1d", progress=False)['Close']
    stock_data = master_data.dropna(how='all')
    
    all_ranks = []
    
    print("Evaluating cross-sectional momentum weights...")
    for ticker in stock_data.columns:
        series = stock_data[ticker].dropna()
        if len(series) < 252:
            continue
            
        series_6m = series.iloc[-126:].values
        series_12m = series.iloc[-252:].values
            
        # 6-Month Normalized Linear Regression Slope
        x6 = np.arange(len(series_6m)).reshape(-1, 1)
        y6 = np.log(series_6m).reshape(-1, 1)
        model6 = LinearRegression().fit(x6, y6)
        slope_6m = (np.exp(model6.coef_[0][0]) ** 252) - 1
        r2_6m = model6.score(x6, y6)
        vol_6m = np.std(np.diff(np.log(series_6m))) * np.sqrt(252)
        score_6m = (slope_6m * r2_6m) / vol_6m if vol_6m > 0 else 0
        
        # 12-Month Normalized Linear Regression Slope
        x12 = np.arange(len(series_12m)).reshape(-1, 1)
        y12 = np.log(series_12m).reshape(-1, 1)
        model12 = LinearRegression().fit(x12, y12)
        slope_12m = (np.exp(model12.coef_[0][0]) ** 252) - 1
        r2_12m = model12.score(x12, y12)
        vol_12m = np.std(np.diff(np.log(series_12m))) * np.sqrt(252)
        score_12m = (slope_12m * r2_12m) / vol_12m if vol_12m > 0 else 0
        
        blended_score = score_6m + score_12m
        
        # Capture raw trailing timeline returns for display table
        ret_3m = ((series.iloc[-1] / series.iloc[-63]) - 1) * 100 if len(series) >= 63 else 0.0
        ret_6m = ((series.iloc[-1] / series.iloc[-126]) - 1) * 100 if len(series) >= 126 else 0.0
        
        matched_row = universe_df[universe_df['Symbol'] == ticker.replace(".NS", "")]
        company_name = matched_row['Company Name'].values[0] if not matched_row.empty else ticker.replace(".NS", "")
        industry = matched_row['Industry'].values[0] if not matched_row.empty else "Equity Stock"
        
        all_ranks.append({
            "ticker": ticker.replace(".NS", ""),
            "company_name": company_name,
            "industry": industry,
            "score": blended_score,
            "return_3m": round(ret_3m, 1),
            "return_6m": round(ret_6m, 1)
        })

    # Sort and strictly extract the absolute top 20 leaders
    sorted_leaders = sorted(all_ranks, key=lambda x: x['score'], reverse=True)[:20]
    
    payload_rows = []
    for idx, item in enumerate(sorted_leaders):
        payload_rows.append({
            "ticker": item["ticker"],
            "company_name": item["company_name"],
            "industry": item["industry"],
            "momentum_score": round(item["score"], 1),
            "return_3m": item["return_3m"],
            "return_6m": item["return_6m"]
        })

    print("Purging stale cache from live momentum database tracking layer...")
    supabase.table("nifty_momentum_20").delete().neq("ticker", "NULL").execute()
    
    print(f"Writing {len(payload_rows)} clean relative momentum assets directly to Supabase cloud...")
    supabase.table("nifty_momentum_20").insert(payload_rows).execute()
    print("🎉 Live Portfolio successfully updated! Refresh your dashboard panel.")

if __name__ == "__main__":
    sync_live_momentum_portfolio()