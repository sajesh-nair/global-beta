"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Define the shape of our ETF database rows
interface ETFData {
  ticker: string;
  country_region: string;
  return_2025_2026: number;
}

// Initialize the Supabase client using client-safe environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const [etfs, setEtfs] = useState<ETFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchLatestMetrics() {
      try {
        setLoading(true);
        
        // Pull directly from our public table and sort by highest return
        const { data, error } = await supabase
          .from('etf_performance')
          .select('ticker, country_region, return_2025_2026')
          .order('return_2025_2026', { ascending: false });

        if (error) throw error;

        if (data) {
          setEtfs(data);
        }
      } catch (err) {
        console.error("Error connecting to terminal database:", err);
      } finally {
        setLoading(false);
      }
    }

    // Only attempt the network request if our environment strings are configured
    if (supabaseUrl && supabaseAnonKey) {
      fetchLatestMetrics();
    } else {
      setLoading(false);
    }
  }, []);

  // Filter logic runs instantly on the client as the user types
  const filteredEtfs = etfs.filter(etf => 
    etf.country_region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    etf.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Split results cleanly across 3 distinct viewport matrix columns
  const itemsPerColumn = Math.ceil(filteredEtfs.length / 3);
  const columns = [
    filteredEtfs.slice(0, itemsPerColumn),
    filteredEtfs.slice(itemsPerColumn, itemsPerColumn * 2),
    filteredEtfs.slice(itemsPerColumn * 2)
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Terminal Block */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-800 pb-5 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-cyan-400">GlobalBeta Terminal</h1>
            <p className="text-sm text-gray-400 mt-1">Global Equity ETFs: 2025-2026 Cumulative Total Returns (US $)</p>
          </div>
          
          {/* Instant Client Filter Input Box */}
          <div className="mt-4 md:mt-0 w-full md:w-80">
            <input 
              type="text"
              placeholder="Filter by Country or Ticker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>
        </div>

        {/* Configuration Warning Alert Banner */}
        {!supabaseUrl && (
          <div className="bg-amber-950/40 border border-amber-800/60 text-amber-300 px-4 py-3 rounded-xl mb-6 text-sm">
            <strong>Database configuration missing:</strong> Dashboard is currently disconnected. Please link your Supabase environment variables in Vercel to unlock real-time live polling.
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-20 text-lg animate-pulse">Querying cloud ledger data...</div>
        ) : etfs.length === 0 ? (
          <div className="text-center text-gray-500 py-20 text-md border border-dashed border-gray-800 rounded-xl">
            No data records currently inside the cloud matrix. Trigger the backend sync script to populate tables.
          </div>
        ) : (
          /* Responsive Multi-Column Layout Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {columns.map((colData, colIdx) => (
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
                    {colData.map((etf) => {
                      const isPositive = etf.return_2025_2026 >= 0;
                      return (
                        <tr key={etf.ticker} className="hover:bg-gray-800/50 transition">
                          <td className="py-2.5 px-4 font-medium text-gray-300">{etf.country_region}</td>
                          <td className="py-2.5 px-4 text-center font-mono text-gray-400 text-xs font-bold">{etf.ticker}</td>
                          <td className={`py-2.5 px-4 text-right font-bold font-mono ${
                            isPositive ? 'text-green-400 bg-green-950/20' : 'text-rose-400 bg-rose-950/20'
                          }`}>
                            {isPositive ? `+${etf.return_2025_2026}%` : `${etf.return_2025_2026}%`}
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

        {/* Professional Developer Attribution Footer */}
        <footer className="mt-12 text-center text-sm text-slate-500 border-t border-slate-800/60 pt-6 pb-8 w-full">
          <p>
            Built and Maintained by <span className="text-cyan-400 font-medium">Sajesh Nair</span>
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Automated Macro Dashboard Pipeline • Powered by Next.js, Supabase & Vercel
          </p>
        </footer>

      </div>
    </div>
  );
}