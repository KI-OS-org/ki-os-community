"use client";

import { useState } from "react";
import { Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react";

interface Secret {
  name: string;
  preview: string;
}

interface Props {
  secrets?: Secret[];
}

const DEFAULT_SECRETS: Secret[] = [
  { name: "OPENAI_API_KEY", preview: "sk-proj-••••" },
  { name: "STRIPE_SECRET_KEY", preview: "sk_live-••••" },
  { name: "SLACK_WEBHOOK_URL", preview: "https://hooks.s••••" },
];

export function SecretHandlingPanel({ secrets: initialSecrets }: Props) {
  const [secrets, setSecrets] = useState<Secret[]>(
    initialSecrets && initialSecrets.length > 0 ? initialSecrets : DEFAULT_SECRETS
  );
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());

  function handleAdd() {
    if (!newName.trim() || !newValue.trim()) return;
    const preview = newValue.slice(0, 6) + "••••";
    setSecrets((prev) => [...prev, { name: newName.trim().toUpperCase(), preview }]);
    setNewName("");
    setNewValue("");
  }

  function handleRemove(name: string) {
    setSecrets((prev) => prev.filter((s) => s.name !== name));
  }

  function toggleReveal(name: string) {
    setRevealedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-white">Secret Manager</h2>
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">{secrets.length} secrets</span>
      </div>

      {/* Add new secret */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">Add New Secret</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="SECRET_NAME"
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showValue ? "text" : "password"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="secret value"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 pr-8 text-xs font-mono text-white placeholder-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              onClick={() => setShowValue((v) => !v)}
              className="absolute right-2 top-2 text-[var(--muted-foreground)] hover:text-white"
            >
              {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newValue.trim()}
            className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#050816] hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Secrets list */}
      <div className="space-y-2">
        {secrets.length === 0 && (
          <p className="text-center text-xs text-[var(--muted-foreground)] py-4">
            No secrets stored. Add one above.
          </p>
        )}
        {secrets.map((secret) => (
          <div
            key={secret.name}
            className="glass-card flex items-center gap-3 p-3"
          >
            <Key className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-semibold text-white">{secret.name}</p>
              <p className="text-[10px] font-mono text-[var(--muted-foreground)] mt-0.5">
                {revealedNames.has(secret.name) ? secret.preview : "*****"}
              </p>
            </div>
            <button
              onClick={() => toggleReveal(secret.name)}
              className="text-[var(--muted-foreground)] hover:text-white transition-colors"
            >
              {revealedNames.has(secret.name) ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => handleRemove(secret.name)}
              className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
