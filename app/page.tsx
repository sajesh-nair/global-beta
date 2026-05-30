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

interface ETFData {
  ticker: string;
  country_region: string;
  return_2025_2026: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'nifty' | 'backtest' | 'etf'>('nifty');
  const [stocks, setStocks] = useState<NiftyStockData[]>([]);
  const [etfs, setEtfs] = useState<ETFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchAllMetrics() {
      try {
        setLoading(true);
        const [niftyRes, etfRes] = await Promise.all([
          supabase.from('nifty_momentum_20').select('ticker, company_name, industry, momentum_score, return_6m, return_3m').order('momentum_score', { ascending: false }),
          supabase.from('etf_performance').select('ticker, country_region, return_2025_2026').order('return_2025_2026', { ascending: false })
        ]);

        if (niftyRes.error) throw niftyRes.error;
        if (etfRes.error) throw etfRes.error;

        if (niftyRes.data) setStocks(niftyRes.data);
        if (etfRes.data) setEtfs(etfRes.data);
      } catch (err) {
        print("Terminal Sync Interruption: ", err);
      } finally {
        setLoading(false);
      }
    }
    if (supabaseUrl && supabaseAnonKey) fetchAllMetrics();
  }, []);

  const filteredNifty = stocks.filter(stock => 
    stock.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parseMetricDisplay = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return { text: "0.0%", className: "text-[#86868b] font-mono" };
    if (val > 0) return { text: `+${val.toFixed(1)}%`, className: "text-[#008060] font-mono font-semibold" };
    if (val < 0) return { text: `-${Math.abs(val).toFixed(1)}%`, className: "text-[#d93f3f] font-mono font-semibold" };
    return { text: "0.0%", className: "text-[#1d1d1f] font-mono" };
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] antialiased selection:bg-[#0071e3]/10 font-sans">
      
      {/* Apple Styled Subtle Global Banner */}
      <div className="bg-[#1d1d1f] text-[#f5f5f7] text-[12px] py-3 text-center tracking-wide font-medium">
        Strategy Mandate: Rebalanced Monthly on the first execution day block. Portfolio metrics remain locked.
      </div>

      <div className="max-w-[1340px] mx-auto px-6 py-12">
        
        {/* Apple Style Clean Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-12 border-b border-[#d2d2d7] gap-6">
          <div>
            <h1 className="text-[40px] font-semibold tracking-tight text-[#1d1d1f] font-sans">
              {activeTab === 'nifty' && 'Nifty 500 Momentum 20 Portfolio'}
              {activeTab === 'backtest' && 'Performance & Backtest'}
              {activeTab === 'etf' && 'GlobalBeta Router'}
            </h1>
            <p className="text-[14px] text-[#86868b] mt-1 font-normal">
              {activeTab === 'nifty' && 'High-conviction risk-adjusted equity trend index.'}
              {activeTab === 'backtest' && 'Historical validation audit report matrix (2016 - 2026).'}
              {activeTab === 'etf' && 'Geographical macro-cycle capital distribution.'}
            </p>
          </div>
          
          <div className="w-full md:w-72">
            <input 
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#ffffff] text-[#1d1d1f] placeholder-[#86868b] text-[13px] px-4 py-2.5 rounded-full border border-[#d2d2d7] focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-all"
            />
          </div>
        </div>

        {/* Clean Apple Tab Control Pill */}
        <div className="flex bg-[#e8e8ed] p-1 rounded-full max-w-md mb-12 ml-1 shadow-inner">
          {(['nifty', 'backtest', 'etf'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
              className={`flex-1 text-center py-2 text-[13px] font-medium tracking-normal rounded-full transition-all duration-200 ${
                activeTab === tab ? 'bg-[#ffffff] text-[#1d1d1f] shadow-md font-semibold' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              {tab === 'nifty' && 'Portfolio'}
              {tab === 'backtest' && 'Backtest'}
              {tab === 'etf' && 'Global Matrix'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-6 h-6 border-2 border-[#d2d2d7] border-t-[#0071e3] rounded-full animate-spin"></div>
            <div className="text-[12px] font-medium text-[#6e6e73] tracking-normal">Syncing Alpha Architecture...</div>
          </div>
        ) : activeTab === 'nifty' ? (
          
          /* VIEW 1: WHITE MINIMALIST ASSET SHEETS */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {[filteredNifty.slice(0, 10), filteredNifty.slice(10, 20)].map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#ffffff] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e8e8ed] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#e8e8ed] text-[11px] font-semibold text-[#86868b] uppercase tracking-wider bg-[#f5f5f7]/60">
                      <th className="py-3.5 px-6">Asset Name</th>
                      <th className="py-3.5 px-4">Sector</th>
                      <th className="py-3.5 px-4 text-right">3M</th>
                      <th className="py-3.5 px-4 text-right">6M</th>
                      <th className="py-3.5 px-6 text-right">M-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f7] text-[13px] text-[#1d1d1f]">
                    {colData.map((stock, idx) => {
                      const m3 = parseMetricDisplay(stock.return_3m);
                      const m6 = parseMetricDisplay(stock.return_6m);
                      return (
                        <tr key={stock.ticker} className="hover:bg-[#f5f5f7]/40 transition duration-100">
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <span className="text-[#86868b] font-mono text-xs font-medium w-4">{idx + 1 + (colIdx * 10)}</span>
                              <div>
                                <div className="font-semibold text-[#1d1d1f] tracking-tight text-[14px]">{stock.company_name}</div>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <span className="text-[10px] font-mono text-[#0071e3] bg-[#0071e3]/5 px-1.5 py-0.5 rounded font-bold">{stock.ticker}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-[#6e6e73] font-normal">{stock.industry}</td>
                          <td className={`py-4 px-4 text-right ${m3.className}`}>{m3.text}</td>
                          <td className={`py-4 px-4 text-right ${m6.className}`}>{m6.text}</td>
                          <td className="py-4 px-6 text-right font-semibold font-mono text-[#1d1d1f]">{stock.momentum_score.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          
        ) : activeTab === 'backtest' ? (
          
          /* VIEW 2: APPLE EXECUTIVE PERFORMANCE RADAR SHEET */
          <div className="space-y-12 max-w-5xl mx-auto">
            {/* Elegant Risk Summary Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { title: "10Y Cumulative PnL", value: "+1,945.8%", desc: "Initial ₹10L to ₹2.04Cr", color: "text-[#008060]" },
                { title: "Peak Drawdown", value: "27.1%", desc: "Controlled floor protection", color: "text-[#1d1d1f]" },
                { title: "Profit Factor", value: "1.54", desc: "Gain ratio per rupee lost", color: "text-[#0071e3]" },
                { title: "Win/Loss Ratio", value: "1.13", desc: "Avg win size vs avg loss size", color: "text-[#4c1d95]" },
                { title: "Strategy RoMaD", value: "71.7", desc: "Return over historical drawdown", color: "text-[#1d1d1f]" }
              ].map((card, i) => (
                <div key={i} className="bg-[#ffffff] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e8e8ed] p-5 rounded-2xl">
                  <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-normal">{card.title}</p>
                  <p className={`text-2xl font-bold tracking-tight my-2 ${card.color}`}>{card.value}</p>
                  <p className="text-[11px] text-[#86868b] leading-snug">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* Apple Website Styled Minimal Graphic Vectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#ffffff] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e8e8ed] p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Historical Capital Growth (10Y)</h4>
                  <span className="text-[11px] font-semibold text-[#008060] bg-[#008060]/5 px-2 py-0.5 rounded-full">CAGR: +35.2%</span>
                </div>
                <div className="w-full h-44 bg-[#f5f5f7]/50 rounded-xl border border-[#e8e8ed] relative px-2 pt-6">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                    <path d="M0,95 Q50,90 100,82 T200,68 T300,45 T400,22 T500,5" fill="none" stroke="#0071e3" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] font-medium text-[#86868b]">
                    <span>2016</span><span>2019</span><span>2022</span><span>2026 (Live)</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#ffffff] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e8e8ed] p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Historical Drawdown Profile</h4>
                  <span className="text-[11px] font-semibold text-[#d93f3f] bg-[#d93f3f]/5 px-2 py-0.5 rounded-full">Max Peak: -27.1%</span>
                </div>
                <div className="w-full h-44 bg-[#f5f5f7]/50 rounded-xl border border-[#e8e8ed] relative px-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                    <path d="M0,0 L50,0 L70,12 L100,0 L180,5 L200,27 L220,5 L300,0 L350,18 L400,2 L450,21 L500,0" fill="none" stroke="#d93f3f" strokeWidth="1.5" />
                    <path d="M0,0 L50,0 L70,12 L100,0 L180,5 L200,27 L220,5 L300,0 L350,18 L400,2 L450,21 L500,0 L500,0 Z" fill="#d93f3f" opacity="0.03" />
                  </svg>
                  <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] font-medium text-[#86868b]">
                    <span>2016</span><span>Covid (2020)</span><span>Regime Floor</span><span>2026</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-[#ffffff] border border-[#e8e8ed] p-5 rounded-2xl text-[13px] text-[#6e6e73] leading-relaxed shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
              <span className="font-semibold text-[#1d1d1f]">Strategy Implementation Protocol:</span> Systematic trend factors generate alpha over full economic expansion cycles by bypassing emotional trading noise. Manually altering allocations or shifting constraints mid-month invalidates the quantitative performance baseline and incurs elevated trading friction costs. Constituents remain fixed until the next scheduled rebalance date loop.
            </div>
          </div>
          
        ) : (
          
          /* VIEW 3: GLOBAL GEOGRAPHICAL SHEET MATRIX */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[etfs.slice(0, Math.ceil(etfs.length/3)), etfs.slice(Math.ceil(etfs.length/3), Math.ceil(etfs.length/3)*2), etfs.slice(Math.ceil(etfs.length/3)*2)].map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#ffffff] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e8e8ed] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7]/60 border-b border-[#e8e8ed] text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                      <th className="py-3.5 px-5">Country / Region</th>
                      <th className="py-3.5 px-4 text-center">Ticker</th>
                      <th className="py-3.5 px-5 text-right">Cumulative Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f7] text-[13px]">
                    {colData.map((item) => {
                      const perf = parseMetricDisplay(item.return_2025_2026);
                      return (
                        <tr key={item.ticker} className="hover:bg-[#f5f5f7]/40 transition duration-100">
                          <td className="py-4 px-5 font-semibold text-[#1d1d1f]">{item.country_region}</td>
                          <td className="py-4 px-4 text-center font-mono text-[#86868b] font-medium">{item.ticker}</td>
                          <td className={`py-4 px-5 text-right ${perf.className}`}>
                            {perf.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Minimal Apple Footer */}
        <footer className="mt-24 text-center border-t border-[#d2d2d7] pt-8 pb-4 w-full">
          <p className="text-[11px] font-semibold text-[#86868b] tracking-normal uppercase">
            Nifty 500 Momentum 20 Portfolio
          </p>
          <p className="text-[11px] text-[#a1a1a6] mt-1">Automated Quantitative Intelligence Platform • Next.js, Supabase & Vercel</p>
        </footer>

      </div>
    </div>
  );
}