/**
 * KI-OS Memory Graph Page
 * 
 * Visualisierung der Memories (LanceDB/Swarm Memory).
 * 
 * @module pages/memory-graph
 * @license AGPL-3.0
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Search, Filter, Zap, Brain, Network } from 'lucide-react';

export default function MemoryGraphPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        fetch('/api/swarm/entries?limit=100').then(r => r.json()),
        fetch('/api/memory/stats').then(r => r.json()),
      ]);

      setEntries(entriesRes.entries || []);
      setStats(statsRes.stats || {});
    } catch (error) {
      console.error('Failed to load memory data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }

    try {
      const res = await fetch('/api/swarm/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, k: 50 }),
      });
      const data = await res.json();
      setEntries(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }

  const filteredEntries = selectedType === 'all'
    ? entries
    : entries.filter(e => e.metadata?.type === selectedType);

  const types = ['all', ...new Set(entries.map(e => e.metadata?.type).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Network className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold text-white">Memory Graph</h1>
          </div>
          <div className="text-white/60">Loading memory graph...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Network className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Memory Graph</h1>
              <p className="text-white/60 text-sm">Swarm Memory Visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{stats?.total || 0}</div>
              <div className="text-white/40 text-xs">Memories</div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Database}
            label="Gesamt"
            value={stats?.total || 0}
            color="emerald"
          />
          <StatCard
            icon={Brain}
            label="Ø Confidence"
            value={(stats?.avgConfidence || 0).toFixed(2)}
            color="blue"
          />
          <StatCard
            icon={Zap}
            label="Ø Usage"
            value={Math.round(stats?.avgUsage || 0)}
            color="yellow"
          />
          <StatCard
            icon={Filter}
            label="Typen"
            value={types.length - 1}
            color="purple"
          />
        </div>

        {/* Search & Filter */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Memory durchsuchen..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-emerald-500/50"
              />
            </div>
            
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition"
            >
              Suche
            </button>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-emerald-500/50"
            >
              {types.map(type => (
                <option key={type} value={type} className="bg-slate-900">
                  {type === 'all' ? 'Alle Typen' : type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Memory List */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Memories ({filteredEntries.length})
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    selectedEntry?.id === entry.id
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                          {entry.metadata?.type || 'unknown'}
                        </span>
                        <span className="text-white/40 text-xs font-mono">{entry.id.slice(0, 8)}</span>
                      </div>
                      <div className="text-white text-sm line-clamp-2">{entry.text}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold text-sm">
                        {(entry.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-white/40 text-xs">Confidence</div>
                      <div className="text-white/40 text-xs mt-2">
                        {entry.usageCount || 0}x verwendet
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Entry Details */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-400" />
              Details
            </h2>
            
            {selectedEntry ? (
              <div className="space-y-4">
                <div>
                  <div className="text-white/40 text-xs mb-1">ID</div>
                  <div className="text-white font-mono text-sm">{selectedEntry.id}</div>
                </div>
                
                <div>
                  <div className="text-white/40 text-xs mb-1">Typ</div>
                  <div className="text-white">{selectedEntry.metadata?.type || 'unknown'}</div>
                </div>
                
                <div>
                  <div className="text-white/40 text-xs mb-1">Content</div>
                  <div className="text-white text-sm p-3 rounded-xl bg-white/5 border border-white/10">
                    {selectedEntry.text}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/40 text-xs mb-1">Confidence</div>
                    <div className="text-emerald-400 font-bold">
                      {(selectedEntry.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-white/40 text-xs mb-1">Usage</div>
                    <div className="text-blue-400 font-bold">{selectedEntry.usageCount || 0}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-white/40 text-xs mb-1">Metadata</div>
                  <pre className="text-white/60 text-xs p-3 rounded-xl bg-white/5 border border-white/10 overflow-auto">
                    {JSON.stringify(selectedEntry.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-white/40">
                <div className="text-center">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <div className="text-sm">Wähle ein Memory aus</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    emerald: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  };

  return (
    <div className={`glass-card rounded-2xl p-4 border ${colorClasses[color]}`}>
      <Icon className="w-6 h-6 mb-2 opacity-60" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-60">{label}</div>
    </div>
  );
}
