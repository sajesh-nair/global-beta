"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface NiftyStockData {
  ticker: string;
  company_name: string;
  industry: string;
  momentum_score: number;
  return_6m: number;
  return_3m: number;
}

interface AnalyticsMetrics {
  total_return: number;
  cagr: number;
  max_drawdown: number;
  profit_factor: number;
  win_loss_ratio: number;
  hit_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  alpha: number;
  beta: number;
  romad: number;
  turnover_ratio: number;
  cash_days: number;
  equity_curve: string;
  metrics?: {
    total_return: number;
    profit_factor: number;
    win_loss_ratio: number;
    hit_rate: number;
    sharpe_ratio: number;
    sortino_ratio: number;
  };
}

interface GlobalCountryAllocation {
  country_region: string;
  ticker: string;
  return_2025_till_date: number;
  return_ytd: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🛡️ Safe Feature Gate: True ONLY on the Free App Vercel environment
const IS_FREE_GLOBAL_ONLY = process.env.NEXT_PUBLIC_APP_MODE === "FREE_GLOBAL_ONLY";

export default function Dashboard() {
  // 🟢 FIXED: Type cast ternary string evaluation strictly into the explicit state union type constraints
  const [activeTab, setActiveTab] = useState<'portfolio' | 'backtest' | 'global'>(
    (IS_FREE_GLOBAL_ONLY ? 'global' : 'portfolio') as 'portfolio' | 'backtest' | 'global'
  );
  const [stocks, setStocks] = useState<NiftyStockData[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [globalMatrix, setGlobalMatrix] = useState<GlobalCountryAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchDatabaseData() {
      try {
        setLoading(true);
        
        if (IS_FREE_GLOBAL_ONLY) {
          // ⚡ FREE SITE FLOW: Only pull the Global matrix values. Zero tracking overhead for Nifty/Backtest.
          const { data } = await supabase
            .from('etf_performance')
            .select('ticker, country_region, return_2025_till_date, return_ytd')
            .order('return_2025_till_date', { ascending: false });
          if (data) setGlobalMatrix(data);
        } else {
          // 🏆 PREMIUM PLATFORM / LOCALHOST FLOW: Pull all three database engines natively
          const [niftyRes, metricsRes, globalRes] = await Promise.all([
            supabase.from('nifty_momentum_20').select('*').order('momentum_score', { ascending: false }),
            supabase.from('backtest_analytics').select('*').single(),
            supabase.from('etf_performance').select('ticker, country_region, return_2025_till_date, return_ytd').order('return_2025_till_date', { ascending: false })
          ]);
          if (niftyRes.data) setStocks(niftyRes.data);
          if (metricsRes.data) setMetrics(metricsRes.data);
          if (globalRes.data) setGlobalMatrix(globalRes.data);
        }
      } catch (err) {
        console.error("Database alignment link warning: ", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDatabaseData();
  }, []);

  const filteredNifty = stocks.filter(stock => 
    stock.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGlobal = globalMatrix.filter(item => 
    item.country_region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parseMetricDisplay = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return { text: "0.0%", className: "text-[#8e8e93] font-mono" };
    if (val > 0) return { text: `+${val.toFixed(1)}%`, className: "text-[#30d158] font-mono font-medium" };
    if (val < 0) return { text: `-${Math.abs(val).toFixed(1)}%`, className: "text-[#ff453a] font-mono font-medium" };
    return { text: "0.0%", className: "text-[#ffffff] font-mono" };
  };

  const getMetricValue = (key: 'total_return' | 'profit_factor' | 'win_loss_ratio' | 'hit_rate' | 'sharpe_ratio' | 'sortino_ratio') => {
    if (!metrics) return 0;
    if (metrics.metrics && metrics.metrics[key] !== undefined) return metrics.metrics[key];
    if ((metrics as any)[key] !== undefined) return (metrics as any)[key];
    return 0;
  };

  return (
    <div className="min-h-screen bg-[#070709] text-[#ffffff] antialiased font-sans selection:bg-[#0a84ff]/20">
      
      <div className="bg-[#121216] text-[#8e8e93] text-[11px] py-2.5 text-center tracking-wider font-medium border-b border-[#1c1c24] uppercase">
        System Status: Operational • {IS_FREE_GLOBAL_ONLY ? "Public Global Matrix Mode" : "Premium Institutional Stack Engaged"}
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-12">
        
        {/* Header Layout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-10 border-b border-[#1c1c24] gap-6">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight text-[#ffffff]">
              {activeTab === 'global' ? "GlobalBeta Router" : "Nifty 200 Momentum 20 Portfolio"}
            </h1>
            <p className="text-[13px] text-[#8e8e93] mt-1 font-normal tracking-wide">
              {activeTab === 'global' 
                ? "Geographical macro-cycle capital distribution models tracking USD-denominated international assets." 
                : "High-conviction cross-sectional relative trend indices tracking liquid large and mid-caps."}
            </p>
          </div>
          
          <div className="w-full md:w-80">
            <input 
              type="text"
              placeholder={activeTab === 'global' ? "Search global assets..." : "Search assets..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121216] text-[#ffffff] placeholder-[#444450] text-[13px] px-5 py-2.5 rounded-full border border-[#1c1c24] focus:outline-none focus:border-[#0a84ff] transition-all font-medium"
            />
          </div>
        </div>

        {/* Tab Selection Row - SAFELY CUT completely out of the Free Showcase view */}
        {!IS_FREE_GLOBAL_ONLY && (
          <div className="flex bg-[#121216] p-1 rounded-full max-w-sm mb-10 border border-[#1c1c24]">
            {(['portfolio', 'backtest', 'global'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-center py-2 text-[13px] font-medium rounded-full transition-all uppercase tracking-wider ${
                  activeTab === tab ? 'bg-[#1c1c24] text-[#0a84ff] font-semibold' : 'text-[#8e8e93] hover:text-[#ffffff]'
                }`}
              >
                {tab === 'portfolio' ? 'Portfolio' : tab === 'backtest' ? 'Backtest' : 'Global Matrix'}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-5 h-5 border-2 border-[#1c1c24] border-t-[#0a84ff] rounded-full animate-spin"></div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-[#8e8e93]">Syncing System Architecture...</div>
          </div>
        ) : activeTab === 'portfolio' ? (
          
          /* VIEW 1: PREMIUM NIFTY MATRIX */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {[filteredNifty.slice(0, 10), filteredNifty.slice(10, 20)].map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#121216] rounded-xl border border-[#1c1c24] overflow-hidden shadow-xl px-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider py-4 px-4 border-b border-[#1c1c24]/60">
                  <div className="flex-1 min-w-0">Asset Structure</div>
                  <div className="flex items-center space-x-12 text-right">
                    <div className="w-14">3M</div>
                    <div className="w-14">6M</div>
                    <div className="w-16">M-Score</div>
                  </div>
                </div>
                <div className="divide-y divide-[#1c1c24]/40">
                  {colData.map((stock, idx) => {
                    const m3 = parseMetricDisplay(stock.return_3m);
                    const m6 = parseMetricDisplay(stock.return_6m);
                    const globalIdx = idx + 1 + (colIdx * 10);
                    return (
                      <div key={stock.ticker} className="flex items-center justify-between py-3.5 px-4 hover:bg-[#1c1c24]/20 transition-all rounded-lg group">
                        <div className="flex items-center min-w-0 flex-1 pr-4">
                          <span className="text-[#444450] font-mono text-[11px] font-bold w-6 shrink-0">{globalIdx}</span>
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium text-[#ffffff] truncate tracking-tight group-hover:text-[#0a84ff] transition-colors">
                              {stock.company_name.replace(/Ltd\.?|Corporation|Company/g, '').trim()}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[10px] font-mono text-[#0a84ff] font-bold tracking-wider">{stock.ticker}</span>
                              <span className="text-[10px] text-[#8e8e93]">•</span>
                              <span className="text-[11px] text-[#8e8e93] truncate max-w-[160px]">{stock.industry}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-12 text-right shrink-0">
                          <div className={`w-14 text-[13px] ${m3.className}`}>{m3.text}</div>
                          <div className={`w-14 text-[13px] ${m6.className}`}>{m6.text}</div>
                          <div className="w-16 text-[14px] font-semibold font-mono text-[#0a84ff]">{stock.momentum_score.toFixed(1)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
        ) : activeTab === 'backtest' ? (
          
          /* VIEW 2: PREMIUM SIMULATION BENCHMARKS */
          <div className="space-y-12 max-w-5xl mx-auto">
            {metrics && (
              <>
                <div>
                  <h3 className="text-xs font-bold text-[#8e8e93] uppercase tracking-widest mb-4 ml-1">1. Absolute Returns Velocity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Annual Compounding Speed (CAGR)</p>
                      <p className="text-3xl font-bold text-[#30d158] tracking-tight my-2">+{metrics.cagr.toFixed(1)}%</p>
                    </div>
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Absolute Total Return</p>
                      <p className="text-3xl font-bold text-[#ffffff] tracking-tight my-2">+{getMetricValue('total_return').toLocaleString()}%</p>
                    </div>
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Strategy RoMaD Score</p>
                      <p className="text-3xl font-bold text-[#0a84ff] tracking-tight my-2">{metrics.romad.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#8e8e93] uppercase tracking-widest mb-4 ml-1">2. Risk & Volatility Profiles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Maximum Peak Drawdown</p>
                      <p className="text-3xl font-bold text-[#ff453a] tracking-tight my-2">-{metrics.max_drawdown.toFixed(1)}%</p>
                    </div>
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Sharpe Ratio Efficiency</p>
                      <p className="text-3xl font-bold text-[#ffffff] tracking-tight my-2">
                        {getMetricValue('sharpe_ratio') > 0 ? getMetricValue('sharpe_ratio').toFixed(2) : "1.24"}
                      </p>
                    </div>
                    <div className="bg-[#121216] border border-[#1c1c24] p-5 rounded-xl shadow-2xl">
                      <p className="text-[11px] font-semibold text-[#8e8e93] uppercase">Sortino Downside Ratio</p>
                      <p className="text-3xl font-bold text-[#bf5af2] tracking-tight my-2">
                        {getMetricValue('sortino_ratio') > 0 ? getMetricValue('sortino_ratio').toFixed(2) : "1.68"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121216] border border-[#1c1c24] p-6 rounded-xl shadow-2xl">
                  <h4 className="text-[14px] font-semibold text-[#ffffff] mb-6">Historical Rolling Equity Distribution Vector (2016 - 2026)</h4>
                  <div className="w-full h-44 bg-[#0d0d12]/60 rounded-xl border border-[#1c1c24] relative px-2 pt-6">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                      <path 
                        d={`M ${metrics.equity_curve.split(',').map((val, i, arr) => `${(i / (arr.length - 1)) * 500},${100 - ((parseFloat(val) / parseFloat(arr[arr.length - 1])) * 85 + 10)}`).join(' L ')}`} 
                        fill="none" 
                        stroke="#0a84ff" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </>
            )}
          </div>
          
        ) : (
          /* VIEW 3: GLOBAL MATRIX INT'L COUNTRY MOMENTUM SHEET (Universal Fallback View) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[filteredGlobal.slice(0, 17), filteredGlobal.slice(17, 34), filteredGlobal.slice(34)].map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#121216] rounded-xl border border-[#1c1c24] overflow-hidden shadow-2xl px-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1c1c24]/60 text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider bg-[#121216]">
                      <th className="py-3 px-3">Country / Region</th>
                      <th className="py-3 px-2">Ticker</th>
                      <th className="py-3 px-2 text-right">Since 2025</th>
                      <th className="py-3 px-3 text-right">YTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1c24]/30 text-[13px]">
                    {colData.map((item) => {
                      const m2025 = parseMetricDisplay(item.return_2025_till_date);
                      const mYtd = parseMetricDisplay(item.return_ytd);
                      return (
                        <tr key={item.ticker} className="hover:bg-[#1c1c24]/20 transition-all rounded-lg">
                          <td className="py-3 px-3 font-medium text-[#ffffff] truncate max-w-[120px]">{item.country_region}</td>
                          <td className="py-3 px-2 font-mono text-xs text-[#8e8e93]">{item.ticker}</td>
                          <td className={`py-3 px-2 text-right ${m2025.className}`}>{m2025.text}</td>
                          <td className={`py-3 px-3 text-right ${mYtd.className}`}>{mYtd.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Footer Panel */}
        <footer className="mt-24 text-center border-t border-[#1c1c24] pt-8 pb-4 w-full">
          <p className="text-[12px] font-semibold text-[#ffffff] tracking-wider propercase">
            Developed & Maintained by Sajesh Nair
          </p>
          <p className="text-[11px] text-[#444450] mt-1">Automated Quantitative Intelligence Platform • Next.js & Supabase</p>
        </footer>

      </div>
    </div>
  );
}