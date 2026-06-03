import os
import time
from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
import yfinance as yf
import pandas as pd
from supabase import create_client, Client

# Smart fallback: Only load dotenv if it exists (for local VS Code development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # On GitHub Actions, environment variables are handled natively

# Map of Tickers to Country/Region names from your dashboard design
ETF_MAP = {
    "EWY": "South Korea", "EPU": "Peru", "EWT": "Taiwan", "EPOL": "Poland", 
    "EWO": "Austria", "GREK": "Greece", "EWP": "Spain", "COLO": "Colombia",
    "EFNL": "Finland", "EIS": "Israel", "EZA": "South Africa", "EWW": "Mexico",
    "NORW": "Norway", "EWZ": "Brazil", "EWI": "Italy", "ECH": "Chile",
    "IEMG": "Emerging Markets", "VNM": "Vietnam", "EWN": "Netherlands",
    "VXUS": "Total International", "EZU": "Eurozone", "EWK": "Belgium",
    "EWC": "Canada", "EWH": "Hong Kong", "EWD": "Sweden", "VGK": "Europe",
    "EWU": "United Kingdom", "IEFA": "EAFE", "EWJ": "Japan", "EWS": "Singapore",
    "EWG": "Germany", "EWL": "Switzerland", "VT": "Total World", "EIRL": "Ireland",
    "EWQ": "France", "SPY": "US", "KWT": "Kuwait", "EWA": "Australia",
    "THD": "Thailand", "EWM": "Malaysia", "MCHI": "China", "UAE": "UAE",
    "ARGT": "Argentina", "QAT": "Qatar", "TUR": "Turkey", "EDEN": "Denmark",
    "ENZL": "New Zealand", "EPHE": "Philippines", "KSA": "Saudi Arabia",
    "INDA": "India", "EIDO": "Indonesia"
}

def calculate_and_sync():
    print("=========================================================================")
    print("      LAUNCHING LIVE GLOBAL MATRIX PERFORMANCE SYNC ENGINE             ")
    print("=========================================================================")
    
    # Initialize Supabase client using server environment variables
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Bypasses RLS for secure database writes
    
    if not supabase_url or not supabase_key:
        print("Critical Error: Supabase credentials missing in environment configuration.")
        return {"status": "error", "message": "Missing credentials"}

    supabase: Client = create_client(supabase_url, supabase_key)
    results_logged = []

    # Dynamically determine tracking dates based on current system time
    today_str = datetime.today().strftime('%Y-%m-%d')
    current_year = datetime.today().year
    current_ytd_start = f"{current_year}-01-01"
    
    print(f"Targeting Sync Profiles -> 2025 Start: 2025-01-01 | YTD Start: {current_ytd_start} | End Target: {today_str}")
    print("-------------------------------------------------------------------------")

    # Process ETFs in small sequential batches to avoid rate limits
    for ticker, region in ETF_MAP.items():
        try:
            print(f"Processing data for {ticker} ({region})...")
            
            # Fetch full history from 2025 up through today dynamically
            df = yf.download(ticker, start="2025-01-01", end=today_str, progress=False)
            
            if len(df) < 2:
                print(f"Skipping {ticker}: Insufficient historic array lengths.")
                continue

            # Safely flatten multi-index structures from yfinance
            if 'Close' in df.columns:
                close_series = df['Close']
            else:
                close_series = df.iloc[:, 0]
                
            # Drop any NaN fields trailing on trading holiday boundaries
            close_series = close_series.dropna()

            if len(close_series) < 2:
                continue

            # Convert the series explicitly into a flat NumPy array to eliminate Series wrappers
            close_prices = close_series.to_numpy().flatten()

            # -------------------------------------------------------------
            # METRIC 1: 2025 Till Date Cumulative Return
            # -------------------------------------------------------------
            price_2025_start = float(close_prices[0].item())
            price_latest = float(close_prices[-1].item())
            return_2025_cumulative = ((price_latest - price_2025_start) / price_2025_start) * 100

            # -------------------------------------------------------------
            # METRIC 2: Current Year Till Date (YTD) Return
            # -------------------------------------------------------------
            # Filter the series to grab only data inside the current calendar year
            ytd_filtered = close_series[close_series.index >= current_ytd_start]
            
            if len(ytd_filtered) >= 2:
                ytd_prices = ytd_filtered.to_numpy().flatten()
                price_ytd_start = float(ytd_prices[0].item())
                return_ytd = ((price_latest - price_ytd_start) / price_ytd_start) * 100
            else:
                return_ytd = 0.0

            # -------------------------------------------------------------
            # DATABASE SYNCHRONIZATION VIA STRICT OVERWRITE RULES
            # -------------------------------------------------------------
            data_payload = {
                "ticker": ticker,
                "country_region": region,
                "return_2025_till_date": round(return_2025_cumulative, 2),
                "return_ytd": round(return_ytd, 2)
            }
            
            # Use on_conflict="ticker" to cleanly overwrite the 51 fixed matrix positions
            supabase.table("etf_performance").upsert(data_payload, on_conflict="ticker").execute()
            results_logged.append(ticker)
                
            # Keep network requests separated by 250ms
            time.sleep(0.25)
            
        except Exception as e:
            print(f"Failed handling ticker {ticker}: {str(e)}")
            continue
            
    print(f"🎉 Sync Complete! Successfully updated {len(results_logged)} global macro asset matrix positions.")
    return {"status": "success", "processed_tickers": results_logged}

# Vercel Serverless Function handler contract
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        auth_header = self.headers.get('Authorization')
        cron_secret = os.environ.get("CRON_SECRET")
        
        if cron_secret and auth_header != f"Bearer {cron_secret}":
            self.send_response(401)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized cron execution"}).encode())
            return

        sync_summary = calculate_and_sync()
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(sync_summary).encode())
        return

# Critical Execution Hook for GitHub Actions terminal environments
if __name__ == "__main__":
    calculate_and_sync()