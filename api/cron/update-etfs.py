import os
import time
from http.server import BaseHTTPRequestHandler
import json
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
    print("       LAUNCHING LIVE GLOBAL MATRIX PERFORMANCE SYNC ENGINE             ")
    print("=========================================================================")
    
    # Initialize Supabase client using server environment variables
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Bypasses RLS for secure database writes
    
    if not supabase_url or not supabase_key:
        print("Critical Error: Supabase credentials missing in environment configuration.")
        return {"status": "error", "message": "Missing credentials"}

    supabase: Client = create_client(supabase_url, supabase_key)
    results_logged = []

    # Process ETFs in small sequential batches to avoid rate limits
    for ticker, region in ETF_MAP.items():
        try:
            print(f"Fetching data for {ticker} ({region})...")
            # Fetch relevant history spanning 2025 up through 2026
            df = yf.download(ticker, start="2025-01-01", end="2026-12-31", progress=False)
            
            if len(df) >= 2:
                # Safely isolate the Close data and completely flatten any multi-index structures
                if 'Close' in df.columns:
                    close_data = df['Close'].values.flatten()
                else:
                    close_data = df.iloc[:, 0].values.flatten()
                
                # Drop any NaN missing values that might sneak onto the edges
                close_data = close_data[~pd.isna(close_data)]
                
                if len(close_data) >= 2:
                    start_price = float(close_data[0])
                    end_price = float(close_data[-1])
                    
                    # Formula: Total Return % = ((End - Start) / Start) * 100
                    total_return = ((end_price - start_price) / start_price) * 100
                    
                    # Map payload to the Supabase SQL schema fields
                    data_payload = {
                        "ticker": ticker,
                        "country_region": region,
                        "return_2025_2026": round(total_return, 2)
                    }
                    
                    # Overwrite on match or insert if new
                    supabase.table("etf_performance").upsert(data_payload).execute()
                    results_logged.append(ticker)
                
            # Keep network requests separated by 250ms
            time.sleep(0.25)
            
        except Exception as e:
            print(f"Failed handling ticker {ticker}: {str(e)}")
            continue
            
    print(f"🎉 Sync Complete! Successfully updated {len(results_logged)} global macro asset matrix positions.")
    return {"status": "success", "processed_tickers": results_logged}

# Vercel Serverless Function handler contract (remains active for Vercel Cron endpoints)
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Verify the security signature to prevent malicious execution overhead
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

# Critical Execution Hook: Allows GitHub Actions to execute this file directly via terminal command
if __name__ == "__main__":
    calculate_and_sync()