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

# Create a robust persistent session mimicking a verified desktop workstation
custom_session = requests.Session()
custom_session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/'
})

NIFTY_500_TICKERS = [
    {"ticker": "RELIANCE.NS", "name": "Reliance Industries Ltd."},
    {"ticker": "TCS.NS", "name": "Tata Consultancy Services Ltd."},
    {"ticker": "HDFCBANK.NS", "name": "HDFC Bank Ltd."},
    {"ticker": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd."},
    {"ticker": "INFY.NS", "name": "Infosys Ltd."},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank Ltd."},
    {"ticker": "ITC.NS", "name": "ITC Ltd."},
    {"ticker": "LTIM.NS", "name": "LTIMindtree Ltd."},
    {"ticker": "HINDUNILVR.NS", "name": "Hindustan Unilever Ltd."},
    {"ticker": "LT.NS", "name": "Larsen & Toubro Ltd."},
    {"ticker": "BAJAJFINSV.NS", "name": "Bajaj Finserv Ltd."},
    {"ticker": "COALINDIA.NS", "name": "Coal India Ltd."},
    {"ticker": "TATASTEEL.NS", "name": "Tata Steel Ltd."},
    {"ticker": "MARUTI.NS", "name": "Maruti Suzuki India Ltd."},
    {"ticker": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries Ltd."},
    {"ticker": "TITAN.NS", "name": "Titan Company Ltd."},
    {"ticker": "ULTRACEMCO.NS", "name": "UltraTech Cement Ltd."},
    {"ticker": "ADANIENT.NS", "name": "Adani Enterprises Ltd."},
    {"ticker": "NTPC.NS", "name": "NTPC Ltd."},
    {"ticker": "JIOFIN.NS", "name": "Jio Financial Services Ltd."},
    {"ticker": "ZOMATO.NS", "name": "Zomato Ltd."},
    {"ticker": "TRENT.NS", "name": "Trent Ltd."},
    {"ticker": "HAL.NS", "name": "Hindustan Aeronautics Ltd."},
    {"ticker": "BEL.NS", "name": "Bharat Electronics Ltd."},
    {"ticker": "BSE.NS", "name": "BSE Ltd."},
    {"ticker": "HUDCO.NS", "name": "Housing & Urban Development Corp."},
    {"ticker": "IRFC.NS", "name": "Indian Railway Finance Corp."},
    {"ticker": "RVNL.NS", "name": "Rail Vikas Nigam Ltd."},
    {"ticker": "MAHABANK.NS", "name": "Bank of Maharashtra"},
    {"ticker": "CENTRALBK.NS", "name": "Central Bank of India"},
    {"ticker": "TATAMOTORS.NS", "name": "Tata Motors Ltd."},
    {"ticker": "HINDALCO.NS", "name": "Hindalco Industries Ltd."},
    {"ticker": "VEDL.NS", "name": "Vedanta Ltd."},
    {"ticker": "MOTILALOFS.NS", "name": "Motilal Oswal Financial Services"},
    {"ticker": "ANGELONE.NS", "name": "Angel One Ltd."},
    {"ticker": "CDSL.NS", "name": "Central Depository Services (India)"},
    {"ticker": "MCX.NS", "name": "Multi Commodity Exchange of India"},
    {"ticker": "POLYCAB.NS", "name": "Polycab India Ltd."},
    {"ticker": "KEI.NS", "name": "KEI Industries Ltd."},
    {"ticker": "DIXON.NS", "name": "Dixon Technologies (India) Ltd."},
    {"ticker": "PFC.NS", "name": "Power Finance Corporation Ltd."},
    {"ticker": "RECLTD.NS", "name": "REC Ltd."},
    {"ticker": "OBEROIRLTY.NS", "name": "Oberoi Realty Ltd."},
    {"ticker": "DLF.NS", "name": "DLF Ltd."},
    {"ticker": "SOBHA.NS", "name": "Sobha Ltd."},
    {"ticker": "PRESTIGE.NS", "name": "Prestige Estates Projects Ltd."},
    {"ticker": "KAYNES.NS", "name": "Kaynes Technology India Ltd."},
    {"ticker": "CYIENT.NS", "name": "Cyient Ltd."},
    {"ticker": "KPITTECH.NS", "name": "KPIT Technologies Ltd."},
    {"ticker": "VBL.NS", "name": "Varun Beverages Ltd."}
]

def run_pipeline():
    print("Initiating Nifty 500 Momentum Engine Screening Pipeline...")
    
    ticker_symbols = [item["ticker"] for item in NIFTY_500_TICKERS]
    ticker_to_name = {item["ticker"]: item["name"] for item in NIFTY_500_TICKERS}
    
    print(f"Downloading 1 Year structural baseline data for {len(ticker_symbols)} assets in a single batch...")
    
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
    
    for ticker_symbol in ticker_symbols:
        company_name = ticker_to_name[ticker_symbol]
        df = pd.DataFrame()
        
        try:
            # 1. Extract sub-dataframe from the batch object mapping
            if len(ticker_symbols) > 1 and ticker_symbol in all_data.columns.levels[0]:
                df = all_data[ticker_symbol].dropna(subset=['Close'])
            
            # 2. TARGETED THROTLED RETRY: If batch dropped the symbol, recover safely
            if df.empty or len(df) < 130:
                # Inject a dynamic human-like delay (3 to 6 seconds) to prevent scraping rate-limits
                sleep_duration = random.uniform(3.1, 5.9)
                print(f"-> Batch entry missing for {ticker_symbol}. Cool-down pause of {round(sleep_duration, 2)}s before fallback fetch...")
                time.sleep(sleep_duration)
                
                retry_session = requests.Session()
                retry_session.headers.update({
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://images.google.com/'
                })
                
                df = yf.download(ticker_symbol, period="1y", interval="1d", progress=False, session=retry_session)
                if not df.empty:
                    df = df.dropna(subset=['Close'])
            
            if df.empty or len(df) < 130:
                continue
                
            closing_prices = df['Close'].values.flatten()
            current_price = float(closing_prices[-1])
            moving_average_200 = float(np.mean(closing_prices[-200:])) if len(closing_prices) >= 200 else float(np.mean(closing_prices))
            
            # Filter 1: 200-DMA Health Check
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
            price_6m_ago = float(target_series[0])
            return_6m_percentage = float(((current_price - price_6m_ago) / price_6m_ago) * 100)
            
            if final_momentum_score > 0:
                screened_candidates.append({
                    "ticker": ticker_symbol.replace(".NS", ""),
                    "company_name": company_name,
                    "momentum_score": round(final_momentum_score, 2),
                    "return_6m": round(return_6m_percentage, 2)
                })
        except Exception as symbol_err:
            print(f"Skipping evaluation metrics for {ticker_symbol}: {symbol_err}")
            continue
                
    top_20_momentum_champions = sorted(
        screened_candidates, 
        key=lambda element: element["momentum_score"], 
        reverse=True
    )[:20]
    
    if not top_20_momentum_champions:
        print("Pipeline execution completed with zero qualified matching results.")
        return
        
    print(f"Mathematical processing complete. Staging {len(top_20_momentum_champions)} leaders to cloud ledger.")
    
    try:
        supabase.table("nifty_momentum_20").delete().neq("id", -1).execute()
        supabase.table("nifty_momentum_20").insert(top_20_momentum_champions).execute()
        print("Successfully synchronized Nifty Momentum table entries inside Supabase.")
    except Exception as db_error:
        print(f"Database network storage update transaction encountered a critical exception: {db_error}")

if __name__ == "__main__":
    run_pipeline()