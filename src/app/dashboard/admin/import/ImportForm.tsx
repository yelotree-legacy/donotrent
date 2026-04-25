"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseCsv } from "@/lib/csv";

type Source = { id: string; slug: string; name: string; kind: string; _count: { entries: number } };

export function ImportForm({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [validated, setValidated] = useState<any | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Source selection
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [sourceId, setSourceId] = useState(sources[0]?.id || "");
  const [newSource, setNewSource] = useState({
    name: "",
    kind: "manual" as "manual" | "partner" | "scraped" | "network",
    region: "",
    trustScore: 70,
  });

  function handleFile(file: File) {
    file.text().then(setText).catch((e) => setError(e?.message || "Failed to read file"));
  }

  async function preview() {
    setError(null);
    setValidated(null);
    setCommitted(null);
    const parsed = parseCsv(text);
    if (parsed.error) { setError(parsed.error); return; }
    if (parsed.rows.length === 0) { setError("CSV has no data rows"); return; }

    start(async () => {
      try {
        const r = await fetch("/api/admin/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "validate", headers: parsed.headers, rows: parsed.rows }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        setValidated(data);
      } catch (e: any) {
        setError(e?.message || "Validation failed");
      }
    });
  }

  async function commit() {
    if (!validated) return;
    if (mode === "existing" && !sourceId) { setError("Pick a source"); return; }
    if (mode === "new" && !newSource.name.trim()) { setError("Enter a name for the new source"); return; }

    const parsed = parseCsv(text);
    if (parsed.error) { setError(parsed.error); return; }

    setCommitting(true);
    setError(null);
    try {
      const body: any = {
        mode: "commit",
        headers: parsed.headers,
        rows: parsed.rows,
      };
      if (mode === "existing") body.sourceId = sourceId;
      else body.newSource = { ...newSource };

      const r = await fetch("/api/admin/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setCommitted(data);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setText("");
    setValidated(null);
    setCommitted(null);
    setError(null);
  }

  return (
    <div className="space-y-5">
      {/* Step 1: paste/upload */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">1. Paste CSV or upload file</h2>
          {text && <button onClick={reset} className="btn-link">Clear</button>}
        </div>
        <textarea
          className="input mt-3 min-h-[160px] font-mono text-xs"
          placeholder={`full_name,license_id,severity,primary_reason\n"John Doe","F1234567","HIGH","Crashed Lambo"`}
          value={text}
          onChange={(e) => { setText(e.target.value); setValidated(null); setCommitted(null); }}
          spellCheck={false}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="text-xs file:mr-3 file:rounded file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-200 hover:file:bg-ink-700"
          />
          <button onClick={preview} disabled={!text.trim() || pending} className="btn-primary">
            {pending ? "Validating…" : "Preview rows"}
          </button>
        </div>
      </div>

      {/* Step 2: review preview */}
      {validated && (
        <div className="card p-5 fade-in">
          <h2 className="text-sm font-semibold text-white">2. Review</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Total rows" value={validated.summary.total} />
            <Stat label="Valid" value={validated.summary.valid} accent="emerald" />
            <Stat label="Invalid" value={validated.summary.invalid} accent={validated.summary.invalid > 0 ? "red" : undefined} />
          </div>

          {validated.unknown_headers?.length > 0 && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Unknown columns will be ignored: {validated.unknown_headers.join(", ")}
            </div>
          )}

          <div className="mt-4 max-h-80 overflow-y-auto rounded border border-ink-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ink-900 text-left">
                <tr>
                  <th className="px-2 py-1.5 text-neutral-400">Row</th>
                  <th className="px-2 py-1.5 text-neutral-400">Name</th>
                  <th className="px-2 py-1.5 text-neutral-400">License</th>
                  <th className="px-2 py-1.5 text-neutral-400">Sev</th>
                  <th className="px-2 py-1.5 text-neutral-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {validated.rows.slice(0, 200).map((row: any) => (
                  <tr key={row.rowIndex} className={row.ok ? "" : "bg-red-500/5"}>
                    <td className="px-2 py-1 font-mono text-neutral-500">{row.rowIndex}</td>
                    <td className="px-2 py-1 text-white">{row.preview?.fullName || "—"}</td>
                    <td className="px-2 py-1 font-mono text-neutral-400">
                      {row.preview?.licenseState ? `${row.preview.licenseState}·` : ""}
                      {row.preview?.licenseId || "—"}
                    </td>
                    <td className="px-2 py-1 text-neutral-400">{row.preview?.severity || "—"}</td>
                    <td className="px-2 py-1">
                      {row.ok
                        ? <span className="text-emerald-400">✓</span>
                        : <span className="text-red-300">{row.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validated.rows.length > 200 && (
              <div className="border-t border-ink-800 bg-ink-950/40 px-3 py-2 text-center text-xs text-neutral-500">
                Showing first 200 of {validated.rows.length} rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: source + commit */}
      {validated && validated.summary.valid > 0 && !committed && (
        <div className="card p-5 fade-in">
          <h2 className="text-sm font-semibold text-white">3. Import to source</h2>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setMode("existing")} className={mode === "existing" ? "btn-primary" : "btn-ghost"}>Existing source</button>
            <button onClick={() => setMode("new")} className={mode === "new" ? "btn-primary" : "btn-ghost"}>+ New source</button>
          </div>

          {mode === "existing" ? (
            <div className="mt-3">
              <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.kind}) · {s._count.entries} entries
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} placeholder="e.g. Miami DNR Instagram" />
              </div>
              <div>
                <label className="label">Kind</label>
                <select className="input" value={newSource.kind} onChange={(e) => setNewSource({ ...newSource, kind: e.target.value as any })}>
                  <option value="manual">Manual</option>
                  <option value="partner">Partner</option>
                  <option value="scraped">Scraped</option>
                  <option value="network">Network</option>
                </select>
              </div>
              <div>
                <label className="label">Region</label>
                <input className="input" value={newSource.region} onChange={(e) => setNewSource({ ...newSource, region: e.target.value })} placeholder="South Florida" />
              </div>
              <div>
                <label className="label">Trust score (0–100)</label>
                <input type="number" min={0} max={100} className="input" value={newSource.trustScore} onChange={(e) => setNewSource({ ...newSource, trustScore: Number(e.target.value) })} />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="text-xs text-neutral-500">
              Will import {validated.summary.valid} row{validated.summary.valid === 1 ? "" : "s"}
              {validated.summary.invalid > 0 ? ` · skip ${validated.summary.invalid} invalid` : ""}
            </span>
            <button onClick={commit} disabled={committing} className="btn-primary">
              {committing ? "Importing…" : `Import ${validated.summary.valid} entries →`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: result */}
      {committed && (
        <div className="card border-2 border-emerald-500/40 bg-emerald-500/5 p-5 fade-in">
          <h2 className="text-base font-semibold text-emerald-200">Import complete</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <Stat label="Created" value={committed.created} accent="emerald" />
            <Stat label="Updated" value={committed.updated} />
            <Stat label="Failed" value={committed.failed} accent={committed.failed > 0 ? "red" : undefined} />
          </div>
          {committed.errors?.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-amber-200">{committed.errors.length} errors</summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                {committed.errors.slice(0, 100).map((e: string, i: number) => (
                  <li key={i} className="text-amber-200/80">{e}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={reset} className="btn-ghost">Import another batch</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "red" }) {
  const cls = accent === "emerald" ? "text-emerald-300" : accent === "red" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/40 p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}
