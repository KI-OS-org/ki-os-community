/**
 * KI-OS Supervisor Cockpit
 * 
 * Agent-Übersicht, Live-Monitoring, Performance-Metriken.
 * 
 * @module pages/supervisor
 * @license AGPL-3.0
 */

'use client';

import { useState, useEffect } from 'react';
import { Activity, Users, Cpu, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

export default function SupervisorPage() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState([]);

  useEffect(() => {
    loadData();
    
    // Live-Updates alle 5s
    const interval = setInterval(loadLiveMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch('/api/agentmesh/agents').then(r => r.json()),
        fetch('/api/agentmesh/stats').then(r => r.json()),
      ]);

      setAgents(agentsRes.agents || []);
      setStats(statsRes.stats || {});
    } catch (error) {
      console.error('Failed to load supervisor data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLiveMetrics() {
    try {
      const res = await fetch('/api/analytics/latency?hours=1');
      const data = await res.json();
      setLiveMetrics(data.stats || []);
    } catch (error) {
      console.error('Failed to load live metrics:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Supervisor Cockpit</h1>
          </div>
          <div className="text-white/60">Loading agent data...</div>
        </div>
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const busyAgents = agents.filter(a => a.status === 'busy').length;
  const errorAgents = agents.filter(a => a.status === 'error').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Supervisor Cockpit</h1>
              <p className="text-white/60 text-sm">Live Agent Monitoring & Performance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/50">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-blue-400 font-semibold text-sm">Live</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Agenten Gesamt"
            value={agents.length}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            label="Aktiv"
            value={activeAgents}
            color="green"
          />
          <StatCard
            icon={Cpu}
            label="Beschäftigt"
            value={busyAgents}
            color="yellow"
          />
          <StatCard
            icon={AlertTriangle}
            label="Fehler"
            value={errorAgents}
            color="red"
          />
          <StatCard
            icon={Clock}
            label="Ø Latency"
            value={`${stats?.avgLatency || 0}ms`}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Agenten-Übersicht
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/40 text-xs border-b border-white/10">
                    <th className="pb-3 font-medium">Agent</th>
                    <th className="pb-3 font-medium">Rolle</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Tasks</th>
                    <th className="pb-3 font-medium">Ø Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            agent.status === 'active' ? 'bg-green-400' :
                            agent.status === 'busy' ? 'bg-yellow-400' :
                            'bg-red-400'
                          }`} />
                          <span className="text-white font-medium">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-white/60 text-sm">{agent.role}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                          agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          agent.status === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="py-3 text-white/60 text-sm">{agent.tasksCompleted || 0}</td>
                      <td className="py-3 text-white/60 text-sm font-mono">
                        {agent.avgLatency || 0}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Metrics */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Live-Metriken
            </h2>
            <div className="space-y-4">
              {liveMetrics.slice(0, 10).map((metric, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">{metric.operation_name}</span>
                    <span className="text-blue-400 font-mono text-xs">{metric.request_count} Requests</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex-1">
                      <div className="text-white/40 mb-1">p50</div>
                      <div className="text-white font-mono">{metric.p50_ms}ms</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-white/40 mb-1">p90</div>
                      <div className="text-white font-mono">{metric.p90_ms}ms</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-white/40 mb-1">p99</div>
                      <div className="text-white font-mono">{metric.p99_ms}ms</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Performance-Trend (24h)
          </h2>
          <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
            <div className="text-white/40 text-sm">
              Chart-Integration (Recharts/Chart.js) hier einfügen
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
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
