"use client";
import { useState, useTransition } from "react";

type Status = {
  total: number;
  onBlob: number;
  remaining: number;
};

export function MigrationRunner({
  blobConfigured,
  initialTotal,
  initialOnBlob,
  initialRemaining,
}: {
  blobConfigured: boolean;
  initialTotal: number;
  initialOnBlob: number;
  initialRemaining: number;
}) {
  const [status, setStatus] = useState<Status>({
    total: initialTotal,
    onBlob: initialOnBlob,
    remaining: initialRemaining,
  });
  const [running, setRunning] = useState<"idle" | "batch" | "all">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ id: string; error: string }[]>([]);
  const [pending, start] = useTransition();

  const pct = status.total === 0 ? 100 : Math.round((status.onBlob / status.total) * 100);

  function addLog(line: string) {
    setLog((l) => [...l.slice(-15), `${new Date().toLocaleTimeString()} ${line}`]);
  }

  async function runOnce(batchSize = 20) {
    const r = await fetch("/api/admin/migrate-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize, concurrency: 4 }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    const data = await r.json();
    addLog(`Batch: ${data.succeeded} ok, ${data.failed} fail, ${data.remaining} remaining`);
    if (data.errors?.length) setErrors((prev) => [...prev, ...data.errors]);
    setStatus({ total: status.total, onBlob: status.total - data.remaining, remaining: data.remaining });
    return data;
  }

  function runBatch() {
    setRunning("batch");
    setErrors([]);
    start(async () => {
      try { await runOnce(20); }
      catch (e: any) { addLog(`Error: ${e?.message || e}`); }
      finally { setRunning("idle"); }
    });
  }

  function runAll() {
    setRunning("all");
    setErrors([]);
    addLog("Starting full migration…");
    start(async () => {
      let safety = 100;
      try {
        while (safety-- > 0) {
          const data = await runOnce(20);
          if (data.remaining === 0) {
            addLog("✓ Migration complete.");
            break;
          }
          if (data.processed === 0) {
            addLog("No more progress — stopping.");
            break;
          }
        }
      } catch (e: any) {
        addLog(`Error: ${e?.message || e}`);
      } finally {
        setRunning("idle");
      }
    });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Run migration</h2>
          <p className="mt-1 text-xs text-neutral-400">
            "Run all" loops until every photo is on Vercel Blob.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={!blobConfigured || pending || status.remaining === 0}
            onClick={runBatch}
          >
            {running === "batch" && pending ? "Running…" : "Run one batch"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!blobConfigured || pending || status.remaining === 0}
            onClick={runAll}
          >
            {running === "all" && pending ? "Migrating…" : status.remaining === 0 ? "All migrated ✓" : "Run all"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-neutral-400">
          <span>{status.onBlob.toLocaleString()} / {status.total.toLocaleString()} migrated</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className={`h-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {log.length > 0 && (
        <div className="mt-4 max-h-48 overflow-y-auto rounded border border-ink-800 bg-ink-950/40 p-3 font-mono text-[11px] text-neutral-400">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {errors.length > 0 && (
        <details className="mt-3 text-xs text-amber-300">
          <summary className="cursor-pointer">{errors.length} error{errors.length === 1 ? "" : "s"}</summary>
          <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 font-mono text-[11px]">
            {errors.slice(-50).map((e, i) => (
              <li key={i} className="text-amber-200">{e.id}: {e.error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
