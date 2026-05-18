/**
 * KI-OS Privacy UI Page
 * 
 * PII-Übersicht, Masking-Einstellungen, DSGVO-Compliance.
 * 
 * @module pages/privacy
 * @license AGPL-3.0
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Unlock, Database, User, Mail, Phone } from 'lucide-react';

export default function PrivacyPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [piiTypes, setPiiTypes] = useState([]);
  const [maskingEnabled, setMaskingEnabled] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, piiRes, logsRes] = await Promise.all([
        fetch('/api/privacy/stats').then(r => r.json()),
        fetch('/api/privacy/pii-types').then(r => r.json()),
        fetch('/api/privacy/audit-logs?limit=50').then(r => r.json()),
      ]);

      setStats(statsRes.stats || {});
      setPiiTypes(piiRes.types || []);
      setAuditLogs(logsRes.logs || []);
    } catch (error) {
      console.error('Failed to load privacy data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleMasking() {
    try {
      const res = await fetch('/api/privacy/masking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !maskingEnabled }),
      });

      if (res.ok) {
        setMaskingEnabled(!maskingEnabled);
      }
    } catch (error) {
      console.error('Failed to toggle masking:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Privacy Center</h1>
          </div>
          <div className="text-white/60">Loading privacy data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Privacy Center</h1>
              <p className="text-white/60 text-sm">DSGVO-Compliance & PII-Masking</p>
            </div>
          </div>
          
          <button
            onClick={toggleMasking}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${
              maskingEnabled
                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                : 'bg-red-500/20 border border-red-500/50 text-red-400'
            }`}
          >
            {maskingEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {maskingEnabled ? 'Masking aktiv' : 'Masking inaktiv'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Database}
            label="Geschützte Felder"
            value={stats?.maskedFields || 0}
            color="purple"
          />
          <StatCard
            icon={User}
            label="Betroffene Nutzer"
            value={stats?.affectedUsers || 0}
            color="blue"
          />
          <StatCard
            icon={Lock}
            label="Verschlüsselte Einträge"
            value={stats?.encryptedEntries || 0}
            color="green"
          />
          <StatCard
            icon={Shield}
            label="Compliance Score"
            value={`${stats?.complianceScore || 100}%`}
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PII Types */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-400" />
              PII-Typen
            </h2>
            <div className="space-y-3">
              {piiTypes.map((type) => (
                <div
                  key={type.type}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <PIIIcon type={type.type} />
                    <div>
                      <div className="text-white font-medium">{type.label}</div>
                      <div className="text-white/40 text-xs">{type.count} Felder</div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    type.masked
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {type.masked ? 'Maskiert' : 'Klartext'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Audit-Logs
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditLogs.slice(0, 20).map((log, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      log.action === 'mask' ? 'bg-green-400' :
                      log.action === 'unmask' ? 'bg-yellow-400' :
                      'bg-blue-400'
                    }`} />
                    <div>
                      <div className="text-white text-sm">{log.action}</div>
                      <div className="text-white/40 text-xs">{log.user}</div>
                    </div>
                  </div>
                  <div className="text-white/40 text-xs font-mono">
                    {new Date(log.timestamp).toLocaleString('de-DE')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DSGVO Info */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            DSGVO-Compliance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComplianceItem
              title="Recht auf Vergessenwerden"
              description="Nutzer können Löschung ihrer Daten anfordern"
              status="implemented"
            />
            <ComplianceItem
              title="Datenminimierung"
              description="Nur notwendige PII-Daten werden gespeichert"
              status="implemented"
            />
            <ComplianceItem
              title="Verschlüsselung"
              description="AES-256-Verschlüsselung für sensible Daten"
              status="implemented"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    emerald: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  };

  return (
    <div className={`glass-card rounded-2xl p-4 border ${colorClasses[color]}`}>
      <Icon className="w-6 h-6 mb-2 opacity-60" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-60">{label}</div>
    </div>
  );
}

function PIIIcon({ type }) {
  const icons = {
    email: Mail,
    phone: Phone,
    name: User,
    address: Database,
    default: Lock,
  };
  const Icon = icons[type] || icons.default;
  return <Icon className="w-5 h-5 text-purple-400" />;
}

function ComplianceItem({ title, description, status }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className={`w-3 h-3 rounded-full mt-1 ${
        status === 'implemented' ? 'bg-green-400' : 'bg-yellow-400'
      }`} />
      <div>
        <div className="text-white font-medium text-sm">{title}</div>
        <div className="text-white/40 text-xs mt-1">{description}</div>
      </div>
    </div>
  );
}
