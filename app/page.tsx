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
  const [activeTab, setActiveTab] = useState<'stocks' | 'sectors' | 'etf'>('stocks');
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
        console.error("Database connection error:", err);
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
    
    stocks.filter(s => s.industry).forEach(stock => {
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
  const maxIndustryScore = topIndustries.length > 0 ? topIndustries[0].avg_score : 100;

  const niftyColumn1 = filteredNifty.slice(0, 10);
  const niftyColumn2 = filteredNifty.slice(10, 20);

  const itemsPerEtfColumn = Math.ceil(filteredEtfs.length / 3);
  const etfColumns = [
    filteredEtfs.slice(0, itemsPerEtfColumn),
    filteredEtfs.slice(itemsPerEtfColumn, itemsPerEtfColumn * 2),
    filteredEtfs.slice(itemsPerEtfColumn * 2)
  ];

  const renderTrendBadge = (sixMonth: number, threeMonth: number) => {
    if (threeMonth >= 30 && sixMonth <= threeMonth * 1.3) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-amber-500/10 border border-amber-500/30 text-amber-400">🚀 BREAKOUT</span>;
    }
    if (sixMonth >= 50 && threeMonth <= sixMonth * 0.15) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-rose-500/10 border border-rose-500/30 text-rose-400">⚠️ EXHAUSTED</span>;
    }
    if (sixMonth >= 40 && threeMonth >= sixMonth * 0.35) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">💎 COMPOUNDER</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-gray-800 border border-gray-700 text-gray-400">🔄 CYCLICAL</span>;
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-[#f3f4f6] p-6 lg:p-12 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1500px] mx-auto">
        
        {/* Apple-Style Minimalist Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-10 border-b border-gray-800/60 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent">
              {activeTab === 'stocks' && 'Nifty Momentum Matrix'}
              {activeTab === 'sectors' && 'Macro Sector Rotations'}
              {activeTab === 'etf' && 'GlobalBeta Terminal'}
            </h1>
            <p className="text-sm text-gray-400 mt-2 font-medium">
              {activeTab === 'stocks' && 'High-conviction equity velocity ranking engine.'}
              {activeTab === 'sectors' && 'Institutional group health and capital allocation weighting metrics.'}
              {activeTab === 'etf' && 'Global markets cumulative performance index tracker.'}
            </p>
          </div>
          
          <div className="w-full md:w-80 relative">
            <input 
              type="text"
              placeholder="Search assets, tickers or sectors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.value || e.target.value)}
              className="w-full bg-[#161c2a] text-white placeholder-gray-500 text-sm px-4 py-3 rounded-xl border border-gray-800 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition shadow-inner"
            />
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex p-1 bg-[#121824] rounded-xl border border-gray-800/80 max-w-lg mb-10 shadow-lg">
          <button
            onClick={() => { setActiveTab('stocks'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'stocks' ? 'bg-[#1c2537] text-cyan-400 shadow-md border border-gray-700/50' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🇮🇳 Top 20 Stocks
          </button>
          <button
            onClick={() => { setActiveTab('sectors'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'sectors' ? 'bg-[#1c2537] text-cyan-400 shadow-md border border-gray-700/50' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Industry Strength
          </button>
          <button
            onClick={() => { setActiveTab('etf'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'etf' ? 'bg-[#1c2537] text-cyan-400 shadow-md border border-gray-700/50' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🌐 Global ETFs
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-gray-500 tracking-widest uppercase">Streaming Core Metrics...</div>
          </div>
        ) : activeTab === 'stocks' ? (
          
          /* TAB 1: SPACIOUS DUAL-COLUMN LAYOUT */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Column 1: Ranks 1 - 10 */}
            <div className="bg-[#121824]/40 border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
              <div className="px-6 py-4 bg-[#121824] border-b border-gray-800/60 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tier-1 Leaders (Ranks 1 - 10)</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#0e131d]/50">
                      <th className="py-3 px-6">Asset Specification</th>
                      <th className="py-3 px-4">Sector</th>
                      <th className="py-3 px-4 text-right">3M %</th>
                      <th className="py-3 px-4 text-right">6M %</th>
                      <th className="py-3 px-6 text-right">M-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm">
                    {niftyColumn1.map((stock, idx) => (
                      <tr key={stock.ticker} className="hover:bg-[#161c2a]/40 transition duration-150 group">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-mono text-xs font-bold w-4 group-hover:text-cyan-400 transition">{idx + 1}</span>
                            <div>
                              <div className="font-semibold text-gray-200 tracking-tight text-sm">
                                {stock.company_name.split(' ').slice(0,2).join(' ')}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono text-cyan-500/80 font-bold tracking-wide">{stock.ticker}</span>
                                {renderTrendBadge(stock.return_6m, stock.return_3m)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-gray-400 truncate max-w-[110px]" title={stock.industry}>{stock.industry}</td>
                        <td className="py-4 px-4 text-right font-mono text-xs font-medium text-gray-300">+{stock.return_3m?.toFixed(1)}%</td>
                        <td className="py-4 px-4 text-right font-mono text-xs font-medium text-gray-300">+{stock.return_6m?.toFixed(1)}%</td>
                        <td className="py-4 px-6 text-right font-bold font-mono text-emerald-400 bg-emerald-500/[0.02]">{stock.momentum_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column 2: Ranks 11 - 20 */}
            <div className="bg-[#121824]/40 border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
              <div className="px-6 py-4 bg-[#121824] border-b border-gray-800/60 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tier-2 Growth (Ranks 11 - 20)</h3>
                <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#0e131d]/50">
                      <th className="py-3 px-6">Asset Specification</th>
                      <th className="py-3 px-4">Sector</th>
                      <th className="py-3 px-4 text-right">3M %</th>
                      <th className="py-3 px-4 text-right">6M %</th>
                      <th className="py-3 px-6 text-right">M-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm">
                    {niftyColumn2.map((stock, idx) => (
                      <tr key={stock.ticker} className="hover:bg-[#161c2a]/40 transition duration-150 group">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-mono text-xs font-bold w-4 group-hover:text-cyan-400 transition">{idx + 11}</span>
                            <div>
                              <div className="font-semibold text-gray-200 tracking-tight text-sm">
                                {stock.company_name.split(' ').slice(0,2).join(' ')}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono text-cyan-500/80 font-bold tracking-wide">{stock.ticker}</span>
                                {renderTrendBadge(stock.return_6m, stock.return_3m)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-gray-400 truncate max-w-[110px]" title={stock.industry}>{stock.industry}</td>
                        <td className="py-4 px-4 text-right font-mono text-xs font-medium text-gray-300">+{stock.return_3m?.toFixed(1)}%</td>
                        <td className="py-4 px-4 text-right font-mono text-xs font-medium text-gray-300">+{stock.return_6m?.toFixed(1)}%</td>
                        <td className="py-4 px-6 text-right font-bold font-mono text-emerald-400 bg-emerald-500/[0.02]">{stock.momentum_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : activeTab === 'sectors' ? (
          
          /* TAB 2: EXCLUSIVE PREMIUM SECTOR LEADERBOARD */
          <div className="max-w-4xl mx-auto bg-[#121824]/40 border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="px-8 py-5 bg-[#121824] border-b border-gray-800/60">
              <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400">Institutional Macro Weightings</h3>
            </div>
            <div className="p-8 space-y-6">
              {topIndustries.map((ind, idx) => {
                const percentageOfMax = (ind.avg_score / maxIndustryScore) * 100;
                return (
                  <div key={ind.industry} className="space-y-2 group">
                    <div className="flex justify-between items-end text-sm">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs font-bold text-gray-600 group-hover:text-purple-400 transition">{idx + 1}</span>
                        <span className="font-semibold text-gray-200 tracking-tight">{ind.industry}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wider font-mono bg-[#161c2a] text-purple-400 border border-purple-900/30">
                          {ind.stock_count} {ind.stock_count === 1 ? 'STOCK' : 'STOCKS'}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-purple-300 text-sm">{ind.avg_score.toFixed(2)}</span>
                    </div>
                    {/* Minimalist Apple-Style Progress/Strength Bar */}
                    <div className="w-full h-2.5 bg-[#0e131d] rounded-full overflow-hidden border border-gray-800/50">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percentageOfMax}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          
          /* TAB 3: GLOBAL ETF TRACKER LAYOUT */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {etfColumns.map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#121824]/40 border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121824] border-b border-gray-800 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                      <th className="py-3 px-5">Geographical Region</th>
                      <th className="py-3 px-4 text-center">Ticker</th>
                      <th className="py-3 px-5 text-right">Return %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm">
                    {colData.map((item) => (
                      <tr key={item.ticker} className="hover:bg-[#161c2a]/40 transition duration-150">
                        <td className="py-3.5 px-5 font-semibold text-gray-300">{item.country_region}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-gray-500 text-xs font-bold">{item.ticker}</td>
                        <td className="py-3.5 px-5 text-right font-bold font-mono text-emerald-400 bg-emerald-500/[0.01]">
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

        {/* Premium Subtle Branding Footer */}
        <footer className="mt-20 text-center border-t border-gray-800/40 pt-8 pb-12">
          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
            Designed & Engineered by <span className="text-cyan-400 transition hover:text-cyan-300 font-bold">Sajesh Nair</span>
          </p>
          <p className="text-[10px] text-gray-600 mt-2 tracking-wide font-medium">Automated Quantitative Intelligence Matrix • Next.js, Supabase, Railway & Vercel</p>
        </footer>

      </div>
    </div>
  );
}