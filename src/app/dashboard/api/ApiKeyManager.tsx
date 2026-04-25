"use client";
import { useState, useTransition } from "react";

export function ApiKeyManager({
  plan,
  apiKeyHint,
  rotateAction,
  revokeAction,
}: {
  plan: string;
  apiKeyHint: string | null;
  rotateAction: () => Promise<string>;
  revokeAction: () => Promise<void>;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(apiKeyHint);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function rotate() {
    setError(null);
    start(async () => {
      try {
        const plaintext = await rotateAction();
        setRevealed(plaintext);
        setHint(plaintext.slice(-4));
      } catch (e: any) {
        setError(e?.message || "Failed");
      }
    });
  }

  function revoke() {
    if (!confirm("Revoke this API key? Existing integrations will stop working.")) return;
    setError(null);
    start(async () => {
      try {
        await revokeAction();
        setRevealed(null);
        setHint(null);
      } catch (e: any) {
        setError(e?.message || "Failed");
      }
    });
  }

  async function copyKey() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Your API key</h2>
          <p className="mt-1 text-xs text-neutral-400">Plan: {plan} · Use this with the <code className="font-mono">Authorization: Bearer</code> header.</p>
        </div>
        <div className="flex items-center gap-2">
          {hint ? (
            <button onClick={revoke} disabled={pending} className="btn-ghost text-red-300 border-red-500/30 hover:border-red-500/50">
              Revoke
            </button>
          ) : null}
          <button onClick={rotate} disabled={pending} className="btn-primary">
            {pending ? "Working…" : hint ? "Regenerate" : "Generate API key"}
          </button>
        </div>
      </div>

      {revealed ? (
        <div className="mt-4 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <CheckIcon /> Save this key now — it's shown only once.
          </div>
          <div className="mt-3 flex items-center gap-2 rounded border border-ink-700 bg-ink-950 p-2">
            <code className="flex-1 truncate font-mono text-sm text-white">{revealed}</code>
            <button onClick={copyKey} className="btn-ghost shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-200/70">
            Treat this like a password. If lost, click "Regenerate" to issue a new key (the old one stops working).
          </p>
        </div>
      ) : hint ? (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950/40 p-4">
          <div className="flex items-center justify-between">
            <code className="font-mono text-sm text-neutral-300">dnr_live_••••••••••••{hint}</code>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Active</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Full key is hidden. Click <strong>Regenerate</strong> if you've lost it.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">
          No API key generated yet. Click <strong>Generate API key</strong> to issue one.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
