"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function OfacSyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go() {
    setResult(null);
    setError(null);
    start(async () => {
      try {
        const r = await fetch("/api/admin/sync-ofac", { method: "POST" });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        setResult(`✓ ${data.rows.toLocaleString()} entries · ${data.aliases.toLocaleString()} aliases`);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Failed");
      }
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={go} disabled={pending} className="btn-ghost">
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {result && <p className="mt-1 text-[11px] text-emerald-300">{result}</p>}
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
