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

interface IndustryRank {
  industry: string;
  avg_score: number;
  stock_count: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'nifty' | 'etf'>('nifty');
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
        console.error("Error connecting to terminal database partitions:", err);
      } finally {
        setLoading(false);
      }
    }

    if (supabaseUrl && supabaseAnonKey) {
      fetchAllMetrics();
    } else {
      setLoading(false);
    }
  }, []);

  const filteredNifty = stocks.filter(stock => 
    stock.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEtfs = etfs.filter(etf => 
    etf.country_region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    etf.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIndustryLeaderboard = (): IndustryRank[] => {
    const industryMap: { [key: string]: { total_score: number; count: number } } = {};
    
    filteredNifty.forEach(stock => {
      if (!industryMap[stock.industry]) {
        industryMap[stock.industry] = { total_score: 0, count: 0 };
      }
      industryMap[stock.industry].total_score += stock.momentum_score;
      industryMap[stock.industry].count += 1;
    });

    return Object.keys(industryMap)
      .map(indName => ({
        industry: indName,
        avg_score: industryMap[indName].total_score / industryMap[indName].count,
        stock_count: industryMap[indName].count
      }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 10);
  };

  const topIndustries = getIndustryLeaderboard();

  const niftyColumn1 = filteredNifty.slice(0, 10);
  const niftyColumn2 = filteredNifty.slice(10, 20);

  const itemsPerEtfColumn = Math.ceil(filteredEtfs.length / 3);
  const etfColumns = [
    filteredEtfs.slice(0, itemsPerEtfColumn),
    filteredEtfs.slice(itemsPerEtfColumn, itemsPerEtfColumn * 2),
    filteredEtfs.slice(itemsPerEtfColumn * 2)
  ];

  // Helper component to calculate and render trend classifications safely
  const renderTrendBadge = (sixMonth: number, threeMonth: number) => {
    // 1. Breakout Phase: Recent 3M velocity constitutes the vast majority of performance
    if (threeMonth >= 30 && sixMonth <= threeMonth * 1.3) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 border border-amber-700 text-amber-400">🚀 BREAKOUT</span>;
    }
    // 2. Exhaustion Phase: 6M is high but 3M velocity has flatlined significantly
    if (sixMonth >= 50 && threeMonth <= sixMonth * 0.15) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 border border-rose-800 text-rose-400">⚠️ EXHAUSTED</span>;
    }
    // 3. Steady Institutional Compounding Phase: Balanced trajectory across both frames
    if (sixMonth >= 40 && threeMonth >= sixMonth * 0.35) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 border border-emerald-800 text-emerald-400">💎 COMPOUNDER</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">🔄 CYCLICAL</span>;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-sans">
      <div className="max-w-[1650px] mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-800 pb-5 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-cyan-400">
              {activeTab === 'nifty' ? 'Nifty Quantitative Leaderboard' : 'GlobalBeta Terminal'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'nifty' 
                ? 'Alpha Generation Engine: Real-time Velocity Structure & Industry Rotations' 
                : 'Global Equity ETFs: 2025-2026 Cumulative Total Returns (US $)'}
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 w-full md:w-80">
            <input 
              type="text"
              placeholder="Search assets, tickers or sectors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex space-x-2 p-1 bg-gray-950/60 rounded-xl border border-gray-800 max-w-md mb-6">
          <button
            onClick={() => { setActiveTab('nifty'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'nifty' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-lg' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🇮🇳 Nifty Sector Engine
          </button>
          <button
            onClick={() => { setActiveTab('etf'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'etf' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-lg' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🌐 Global ETF Tracker
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20 text-lg animate-pulse">Analyzing alpha matrix data streams...</div>
        ) : activeTab === 'nifty' ? (
          /* NIFTY MOMENTUM VIEW - GRADED THREE TABLE MATRIX */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Table 1: Stocks Ranks 1 to 10 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-cyan-950 to-gray-900 px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">🔥 Stock Momentum: Ranks 1 - 10</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="py-3 px-3">Asset Matrix</th>
                    <th className="py-3 px-2">Sector</th>
                    <th className="py-3 px-2 text-right">3M %</th>
                    <th className="py-3 px-2 text-right">6M %</th>
                    <th className="py-3 px-3 text-right">M-Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {niftyColumn1.map((stock, idx) => (
                    <tr key={stock.ticker} className="hover:bg-gray-800/40 transition">
                      <td className="py-2.5 px-3 font-medium text-gray-200">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500 font-mono text-xs w-4">{idx + 1}</span>
                          <span className="truncate max-w-[110px]" title={stock.company_name}>
                            {stock.company_name.split(' ').slice(0,2).join(' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-1 pl-5">
                          <span className="text-[10px] font-mono text-cyan-400 font-bold">{stock.ticker}</span>
                          {renderTrendBadge(stock.return_6m, stock.return_3m)}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-400 max-w-[90px] truncate" title={stock.industry}>{stock.industry}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-300 font-medium">+{stock.return_3m?.toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-300 font-medium">+{stock.return_6m?.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-green-400 bg-green-950/10">{stock.momentum_score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table 2: Stocks Ranks 11 to 20 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-cyan-950 to-gray-900 px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">⚡ Stock Momentum: Ranks 11 - 20</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="py-3 px-3">Asset Matrix</th>
                    <th className="py-3 px-2">Sector</th>
                    <th className="py-3 px-2 text-right">3M %</th>
                    <th className="py-3 px-2 text-right">6M %</th>
                    <th className="py-3 px-3 text-right">M-Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {niftyColumn2.map((stock, idx) => (
                    <tr key={stock.ticker} className="hover:bg-gray-800/40 transition">
                      <td className="py-2.5 px-3 font-medium text-gray-200">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500 font-mono text-xs w-4">{idx + 11}</span>
                          <span className="truncate max-w-[110px]" title={stock.company_name}>
                            {stock.company_name.split(' ').slice(0,2).join(' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-1 pl-5">
                          <span className="text-[10px] font-mono text-cyan-400 font-bold">{stock.ticker}</span>
                          {renderTrendBadge(stock.return_6m, stock.return_3m)}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-400 max-w-[90px] truncate" title={stock.industry}>{stock.industry}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-300 font-medium">+{stock.return_3m?.toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-300 font-medium">+{stock.return_6m?.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-green-400 bg-green-950/10">{stock.momentum_score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table 3: TOP 10 INDUSTRY MOMENTUM ROTATIONS */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-purple-950 to-gray-900 px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">📊 Top 10 Macro Industry Strengths</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-950/60 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                    <th className="py-3 px-4">Industry Sector Group</th>
                    <th className="py-3 px-4 text-center">Leaders Inside Matrix</th>
                    <th className="py-3 px-4 text-right">Avg Group Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {topIndustries.map((ind, idx) => (
                    <tr key={ind.industry} className="hover:bg-gray-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-gray-300">
                        <span className="text-purple-500 mr-2 font-mono">{idx + 1}</span>
                        {ind.industry}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-purple-400">
                        <span className="bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded text-xs">
                          {ind.stock_count} {ind.stock_count === 1 ? 'Stock' : 'Stocks'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-purple-300 bg-purple-950/10">
                        {ind.avg_score.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          /* GLOBAL ETF VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {etfColumns.map((colData, colIdx) => (
              <div key={colIdx} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-cyan-950 text-cyan-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-800">
                      <th className="py-3 px-4">Country/Region</th>
                      <th className="py-3 px-4 text-center">Ticker</th>
                      <th className="py-3 px-4 text-right">2025-26 %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {colData.map((item) => (
                      <tr key={item.ticker} className="hover:bg-gray-800/50 transition">
                        <td className="py-2.5 px-4 font-medium text-gray-300">{item.country_region}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-gray-400 text-xs font-bold">{item.ticker}</td>
                        <td className="py-2.5 px-4 text-right font-bold font-mono text-green-400 bg-green-950/20">
                          +{item.return_2025_2026}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-slate-500 border-t border-slate-800/60 pt-6 pb-8 w-full">
          <p>Built and Maintained by <span className="text-cyan-400 font-medium">Sajesh Nair</span></p>
          <p className="text-xs text-slate-600 mt-1">Automated Quantitative Intelligence Matrix • Next.js, Supabase & Vercel</p>
        </footer>

      </div>
    </div>
  );
}