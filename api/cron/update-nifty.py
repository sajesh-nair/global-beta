import os
import math
import time
import random
import numpy as np
import pandas as pd
import requests
import yfinance as yf
from sklearn.linear_model import LinearRegression
from supabase import create_client, Client

# Initialize Supabase Clients
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Persistent session mimicking a verified desktop workstation
custom_session = requests.Session()
custom_session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/'
})

def load_nifty_500_from_csv():
    csv_filename = "nifty500.csv"
    if not os.path.exists(csv_filename):
        raise FileNotFoundError(f"Critical Error: '{csv_filename}' not found.")
    
    print(f"Reading market universe and industry mappings from '{csv_filename}'...")
    df = pd.read_csv(csv_filename)
    
    formatted_tickers = []
    for _, row in df.iterrows():
        symbol = str(row['Symbol']).strip()
        company_name = str(row['Company Name']).strip()
        # Extract industry safely, defaulting to 'Diversified' if missing
        industry = str(row['Industry']).strip() if 'Industry' in df.columns else 'Diversified'
        
        formatted_tickers.append({
            "ticker": f"{symbol}.NS",
            "name": company_name,
            "industry": industry
        })
        
    return formatted_tickers

def run_pipeline():
    print("Initiating Sector-Aware Nifty 500 Momentum Screening Pipeline...")
    
    try:
        NIFTY_500_TICKERS = load_nifty_500_from_csv()
    except Exception as e:
        print(e)
        return

    ticker_symbols = [item["ticker"] for item in NIFTY_500_TICKERS]
    ticker_to_meta = {item["ticker"]: {"name": item["name"], "industry": item["industry"]} for item in NIFTY_500_TICKERS}
    
    print(f"Loaded {len(ticker_symbols)} assets. Executing master historical batch download...")
    
    try:
        all_data = yf.download(
            tickers=" ".join(ticker_symbols), 
            period="1y", 
            interval="1d", 
            group_by="ticker", 
            progress=False, 
            session=custom_session
        )
    except Exception as batch_err:
        print(f"Critical breakdown during batch download: {batch_err}")
        return

    screened_candidates = []
    
    print("Beginning quantitative trend filtering across the asset matrix...")
    for ticker_symbol in ticker_symbols:
        meta = ticker_to_meta[ticker_symbol]
        df = pd.DataFrame()
        
        try:
            if len(ticker_symbols) > 1 and ticker_symbol in all_data.columns.levels[0]:
                df = all_data[ticker_symbol].dropna(subset=['Close'])
            
            # Fallback wrapper to bypass random connection dropping or batch misses safely
            if df.empty or len(df) < 130:
                sleep_duration = random.uniform(1.0, 2.5)
                time.sleep(sleep_duration)
                df = yf.download(ticker_symbol, period="1y", interval="1d", progress=False)
                if not df.empty:
                    df = df.dropna(subset=['Close'])
            
            if df.empty or len(df) < 130:
                continue
                
            closing_prices = df['Close'].values.flatten()
            current_price = float(closing_prices[-1])
            moving_average_200 = float(np.mean(closing_prices[-200:])) if len(closing_prices) >= 200 else float(np.mean(closing_prices))
            
            # Filter 1: 200-Day Moving Average Health Check
            if current_price < moving_average_200:
                continue
                
            lookback_window = min(126, len(closing_prices))
            target_series = closing_prices[-lookback_window:]
            
            x_timeline = np.arange(lookback_window).reshape(-1, 1)
            y_log_prices = np.log(target_series).reshape(-1, 1)
            
            regression_model = LinearRegression()
            regression_model.fit(x_timeline, y_log_prices)
            
            raw_slope = float(regression_model.coef_[0][0])
            annualized_slope = (math.exp(raw_slope) ** 252) - 1
            r2_score = float(regression_model.score(x_timeline, y_log_prices))
            
            final_momentum_score = float(annualized_slope * r2_score * 100)
            
            # --- PRODUCTION-GRADE MULTI-TIMELINE CALCULATIONS ---
            # Calculate 6 Months Ago Absolute Return (approx. 126 trading days)
            lookback_6m = min(126, len(closing_prices))
            price_6m_ago = float(closing_prices[-lookback_6m])
            return_6m_percentage = float(((current_price - price_6m_ago) / price_6m_ago) * 100)
            
            # Calculate 3 Months Ago Absolute Return (approx. 63 trading days)
            lookback_3m = min(63, len(closing_prices))
            price_3m_ago = float(closing_prices[-lookback_3m])
            return_3m_percentage = float(((current_price - price_3m_ago) / price_3m_ago) * 100)
            
            if final_momentum_score > 0:
                screened_candidates.append({
                    "ticker": ticker_symbol.replace(".NS", ""),
                    "company_name": meta["name"],
                    "industry": meta["industry"],
                    "momentum_score": round(final_momentum_score, 2),
                    "return_6m": round(return_6m_percentage, 2),
                    "return_3m": round(return_3m_percentage, 2)  # Syncing values to your new DB column
                })
        except Exception:
            continue
                
    # Take the top 20 champions to populate your side-by-side matrices
    top_20_momentum_champions = sorted(
        screened_candidates, 
        key=lambda element: element["momentum_score"], 
        reverse=True
    )[:20]
    
    if not top_20_momentum_champions:
        print("Pipeline execution completed with zero results.")
        return
        
    print(f"Staging top {len(top_20_momentum_champions)} industry-mapped assets to cloud database...")
    
    try:
        supabase.table("nifty_momentum_20").delete().neq("id", -1).execute()
        supabase.table("nifty_momentum_20").insert(top_20_momentum_champions).execute()
        print("Successfully synchronized Industry-mapped Nifty Momentum entries inside Supabase!")
    except Exception as db_error:
        print(f"Database sync error: {db_error}")

if __name__ == "__main__":
    run_pipeline()