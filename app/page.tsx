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
  const [activeTab, setActiveTab] = useState<'nifty' | 'sectors' | 'etf'>('nifty');
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
        console.error("Critical Terminal Sync Error:", err);
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
      if (!stock.industry) return;
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

  // DEFENSIVE DATA CONTEXT FORMATTER (Resolves Polarity & Fixes Decimal Precision)
  const parseMetricDisplay = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) {
      return { text: "0.0%", className: "text-gray-500 font-mono" };
    }
    const cleanNum = floatValueHandler(val);
    if (cleanNum > 0) {
      return { text: `+${cleanNum.toFixed(1)}%`, className: "text-emerald-400 font-mono" };
    }
    if (cleanNum < 0) {
      // Math.abs ensures we handle the negative sign cleanly without duplicate characters
      return { text: `-${Math.abs(cleanNum).toFixed(1)}%`, className: "text-rose-500 font-mono" };
    }
    return { text: "0.0%", className: "text-gray-400 font-mono" };
  };

  const floatValueHandler = (input: any): number => {
    if (typeof input === 'number') return input;
    const parsed = parseFloat(input);
    return isNaN(parsed) ? 0 : parsed;
  };

  const renderTrendBadge = (sixMonth: number, threeMonth: number) => {
    const sM = floatValueHandler(sixMonth);
    const tM = floatValueHandler(threeMonth);

    if (tM >= 30 && sM <= tM * 1.3) {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400">🚀 BREAKOUT</span>;
    }
    if (sM >= 50 && tM <= sM * 0.15) {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400">⚠️ EXHAUSTED</span>;
    }
    if (sM >= 40 && tM >= sM * 0.35) {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">💎 COMPOUNDER</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-gray-800/60 border border-gray-700/40 text-gray-400">🔄 CYCLICAL</span>;
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-[#f3f4f6] p-6 lg:p-12 font-sans selection:bg-cyan-500/20 antialiased">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Minimalist Tech Header Frame */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-10 border-b border-gray-800/40 gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              {activeTab === 'nifty' && 'Nifty Momentum Leaders'}
              {activeTab === 'sectors' && 'Macro Sector Rotations'}
              {activeTab === 'etf' && 'GlobalBeta Terminal'}
            </h1>
            <p className="text-xs text-gray-400 tracking-wide font-medium uppercase mt-1.5">
              {activeTab === 'nifty' && 'High-conviction quantitative trend matrices'}
              {activeTab === 'sectors' && 'Institutional industry rotational strengths'}
              {activeTab === 'etf' && 'Global geographical capital allocation returns'}
            </p>
          </div>
          
          <div className="w-full md:w-80">
            <input 
              type="text"
              placeholder="Search assets, symbols or sectors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d1321] text-white placeholder-gray-600 text-xs tracking-wide px-4 py-3 rounded-xl border border-gray-800 focus:outline-none focus:border-cyan-500/40 transition shadow-inner"
            />
          </div>
        </div>

        {/* Premium Navigation Tabs */}
        <div className="flex p-1 bg-[#0d1321] rounded-xl border border-gray-800/60 max-w-lg mb-10">
          <button
            onClick={() => { setActiveTab('nifty'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'nifty' ? 'bg-[#182235] text-cyan-400 border border-gray-700/30 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🇮🇳 Top 20 Stocks
          </button>
          <button
            onClick={() => { setActiveTab('sectors'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'sectors' ? 'bg-[#182235] text-cyan-400 border border-gray-700/30 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Industry Strength
          </button>
          <button
            onClick={() => { setActiveTab('etf'); setSearchTerm(""); }}
            className={`flex-1 text-center py-2.5 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === 'etf' ? 'bg-[#182235] text-cyan-400 border border-gray-700/30 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🌐 Global ETFs
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-5 h-5 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
            <div className="text-[9px] font-bold text-gray-500 tracking-widest uppercase animate-pulse">Syncing Core Core Metrics...</div>
          </div>
        ) : activeTab === 'nifty' ? (
          
          /* VIEW 1: STOCKS MATRIX ONLY - CLEAN SPACIOUS TABLES */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Table 1: Ranks 1 - 10 */}
            <div className="bg-[#0b101d]/60 border border-gray-800/50 rounded-xl overflow-hidden backdrop-blur-md">
              <div className="px-6 py-4 bg-[#0d1321] border-b border-gray-800/40">
                <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tier 1 Leaders (Ranks 1 - 10)</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800/60 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#090d16]/40">
                    <th className="py-3 px-6">Asset Specification</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">3M %</th>
                    <th className="py-3 px-4 text-right">6M %</th>
                    <th className="py-3 px-6 text-right">M-Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30 text-xs">
                  {niftyColumn1.map((stock, idx) => {
                    const m3 = parseMetricDisplay(stock.return_3m);
                    const m6 = parseMetricDisplay(stock.return_6m);
                    return (
                      <tr key={stock.ticker} className="hover:bg-[#121929]/40 transition duration-150">
                        <td className="py-3.5 px-6 font-medium text-gray-200">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-mono text-xs font-bold w-4">{idx + 1}</span>
                            <div>
                              <div className="font-semibold text-gray-100 tracking-tight text-sm">
                                {stock.company_name.split(' ').slice(0,2).join(' ')}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono text-cyan-400 font-bold">{stock.ticker}</span>
                                {renderTrendBadge(stock.return_6m, stock.return_3m)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 truncate max-w-[120px]" title={stock.industry}>{stock.industry}</td>
                        <td className={`py-3.5 px-4 text-right ${m3.className}`}>{m3.text}</td>
                        <td className={`py-3.5 px-4 text-right ${m6.className}`}>{m6.text}</td>
                        <td className="py-3.5 px-6 text-right font-bold font-mono text-emerald-400 bg-emerald-500/[0.02]">{floatValueHandler(stock.momentum_score).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table 2: Ranks 11 - 20 */}
            <div className="bg-[#0b101d]/60 border border-gray-800/50 rounded-xl overflow-hidden backdrop-blur-md">
              <div className="px-6 py-4 bg-[#0d1321] border-b border-gray-800/40">
                <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tier 2 Growth (Ranks 11 - 20)</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800/60 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#090d16]/40">
                    <th className="py-3 px-6">Asset Specification</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">3M %</th>
                    <th className="py-3 px-4 text-right">6M %</th>
                    <th className="py-3 px-6 text-right">M-Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30 text-xs">
                  {niftyColumn2.map((stock, idx) => {
                    const m3 = parseMetricDisplay(stock.return_3m);
                    const m6 = parseMetricDisplay(stock.return_6m);
                    return (
                      <tr key={stock.ticker} className="hover:bg-[#121929]/40 transition duration-150">
                        <td className="py-3.5 px-6 font-medium text-gray-200">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-mono text-xs font-bold w-4">{idx + 11}</span>
                            <div>
                              <div className="font-semibold text-gray-100 tracking-tight text-sm">
                                {stock.company_name.split(' ').slice(0,2).join(' ')}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono text-cyan-400 font-bold">{stock.ticker}</span>
                                {renderTrendBadge(stock.return_6m, stock.return_3m)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 truncate max-w-[120px]" title={stock.industry}>{stock.industry}</td>
                        <td className={`py-3.5 px-4 text-right ${m3.className}`}>{m3.text}</td>
                        <td className={`py-3.5 px-4 text-right ${m6.className}`}>{m6.text}</td>
                        <td className="py-3.5 px-6 text-right font-bold font-mono text-emerald-400 bg-emerald-500/[0.02]">{floatValueHandler(stock.momentum_score).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
        ) : activeTab === 'sectors' ? (
          
          /* VIEW 2: EXCLUSIVE INDUSTRY ROTATIONS WITH SLIDERS */
          <div className="max-w-3xl mx-auto bg-[#0b101d]/60 border border-gray-800/50 rounded-xl overflow-hidden backdrop-blur-md">
            <div className="px-6 py-4 bg-[#0d1321] border-b border-gray-800/40">
              <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400">Macro Rotational Strengths</h3>
            </div>
            <div className="p-6 space-y-5">
              {topIndustries.map((ind, idx) => {
                const widthPercent = (ind.avg_score / maxIndustryScore) * 100;
                return (
                  <div key={ind.industry} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-gray-600 font-mono font-bold w-4">{idx + 1}</span>
                        <span className="font-semibold text-gray-200">{ind.industry}</span>
                        <span className="text-[9px] bg-[#0d1321] text-purple-400 border border-purple-900/40 px-2 py-0.5 rounded font-bold font-mono">
                          {ind.stock_count} {ind.stock_count === 1 ? 'STOCK' : 'STOCKS'}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-purple-300">{floatValueHandler(ind.avg_score).toFixed(1)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#090d16] rounded-full overflow-hidden border border-gray-800/40">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${widthPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        ) : (
          
          /* VIEW 3: GLOBAL ETF TRACKER (DYNAMIC SIGNAGE MATCHES DATABASE POLARITY) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {etfColumns.map((colData, colIdx) => (
              <div key={colIdx} className="bg-[#0b101d]/60 border border-gray-800/50 rounded-xl overflow-hidden backdrop-blur-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0d1321] border-b border-gray-800/50 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Country/Region</th>
                      <th className="py-3 px-4 text-center">Ticker</th>
                      <th className="py-3 px-5 text-right">2025-26 %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/30 text-xs">
                    {colData.map((item) => {
                      const perf = parseMetricDisplay(item.return_2025_2026);
                      const rawVal = floatValueHandler(item.return_2025_2026);
                      return (
                        <tr key={item.ticker} className="hover:bg-[#121929]/40 transition duration-150">
                          <td className="py-3.5 px-4 font-semibold text-gray-300">{item.country_region}</td>
                          <td className="py-3.5 px-4 text-center font-mono text-gray-500 font-bold">{item.ticker}</td>
                          {/* Dynamically colors background box based on positive vs negative returns */}
                          <td className={`py-3.5 px-5 text-right font-bold font-mono text-xs ${perf.className} ${
                            rawVal >= 0 ? 'bg-emerald-500/[0.01]' : 'bg-rose-500/[0.01]'
                          }`}>
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

        {/* Minimal Subtle Footer */}
        <footer className="mt-20 text-center border-t border-gray-800/30 pt-6 pb-8 w-full">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Designed & Engineered by <span className="text-cyan-400 font-bold">Sajesh Nair</span>
          </p>
          <p className="text-[9px] text-gray-600 mt-1.5 tracking-wide">Automated Quantitative Intelligence Terminal • Next.js, Supabase & Vercel</p>
        </footer>

      </div>
    </div>
  );
}