import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { crossCheck, type CrossCheckResult } from "@/lib/cross-check";
import { logSearch } from "@/lib/audit";
import { CheckForm } from "./CheckForm";

type SP = { license?: string; name?: string; dob?: string };

export default async function CheckPage({ searchParams }: { searchParams: SP }) {
  const license = searchParams.license?.trim() || "";
  const name = searchParams.name?.trim() || "";
  const dob = searchParams.dob?.trim() || "";
  const hasInput = Boolean(license || name);

  const sources = await prisma.source.findMany({ where: { isActive: true }, orderBy: { trustScore: "desc" } });
  let result: CrossCheckResult | null = null;
  if (hasInput) {
    result = await crossCheck({ licenseId: license, fullName: name, dateOfBirth: dob });
    await logSearch(`${name || ""} ${license || ""}`.trim(), license ? "license" : "name", result.totalHits);
  }

  return (
    <div className="space-y-6 fade-in">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
          Cross-source check
        </div>
        <h1 className="text-3xl font-bold text-white">Run a Rent Report</h1>
        <p className="text-sm text-neutral-400">
          Check a renter against {sources.length} integrated source{sources.length === 1 ? "" : "s"}.
          Returns a verdict, risk score, and per-source breakdown.
        </p>
      </header>

      <div className="card p-5">
        <Suspense>
          <CheckForm initial={{ license, name, dob }} />
        </Suspense>
      </div>

      {result && <Verdict result={result} />}

      {!hasInput && (
        <section className="card p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Sources currently checked
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s) => <SourceTile key={s.id} s={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SourceTile({ s }: { s: any }) {
  return (
    <Link href={`/sources/${s.slug}`} className="card-hover block p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{s.name}</div>
        <KindBadge kind={s.kind} />
      </div>
      {s.region && <div className="mt-0.5 text-[11px] text-neutral-500">{s.region}</div>}
      {s.description && <p className="mt-2 line-clamp-2 text-xs text-neutral-400">{s.description}</p>}
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
        <span>Trust {s.trustScore}/100</span>
        {s.lastSyncedAt && <span>Synced {timeAgo(s.lastSyncedAt)}</span>}
      </div>
    </Link>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const cls = {
    scraped: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    partner: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
    network: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    manual: "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
  }[kind] || "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30";
  return <span className={`pill ring-1 ring-inset ${cls}`}>{kind}</span>;
}

function timeAgo(d: Date | string): string {
  const then = new Date(d).getTime();
  const diff = (Date.now() - then) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function Verdict({ result }: { result: CrossCheckResult }) {
  const v = result.verdict;
  const verdictCls =
    v === "DECLINE" ? "border-red-500/40 bg-red-500/10 text-red-200"
      : v === "REVIEW" ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  const verdictLabel = v === "DECLINE" ? "Decline" : v === "REVIEW" ? "Manual review" : "Approve";
  const verdictDesc =
    v === "DECLINE" ? "Strong reasons to refuse this rental."
      : v === "REVIEW" ? "At least one match found — confirm details before renting."
        : "No matches across any active source.";

  return (
    <section className="space-y-4 fade-in">
      <div className={`card overflow-hidden border-2 ${verdictCls}`}>
        <div className="grid items-center gap-6 p-6 md:grid-cols-[auto_1fr_auto]">
          <div className="grid size-20 place-items-center rounded-full bg-ink-950/40">
            <VerdictIcon kind={v} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Verdict</div>
            <div className="text-3xl font-bold">{verdictLabel}</div>
            <div className="mt-1 text-sm opacity-80">{verdictDesc}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Hits" value={result.totalHits} />
            <Stat label="Sources" value={`${result.matchedSources}/${result.totalSources}`} />
            <Stat label="Risk" value={`${result.riskScore}`} suffix="/100" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="card md:col-span-2">
          <header className="border-b border-ink-800 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Source breakdown
            </h2>
          </header>
          <ul className="divide-y divide-ink-800">
            {result.sources.map((s) => (
              <li key={s.sourceId} className="flex items-center gap-3 px-5 py-3">
                <div className={`size-2 shrink-0 rounded-full ${s.hits > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.sourceName}</span>
                    <KindBadge kind={s.sourceKind} />
                  </div>
                  <div className="text-[11px] text-neutral-500">Trust {s.sourceTrustScore}/100</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${s.hits > 0 ? "text-red-300" : "text-emerald-400"}`}>
                    {s.hits === 0 ? "Clear" : `${s.hits} hit${s.hits === 1 ? "" : "s"}`}
                  </div>
                  {s.worstSeverity && (
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">{s.worstSeverity}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Query</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Name">{result.query.fullName || <em className="text-neutral-500 not-italic">—</em>}</Row>
            <Row label="License">
              {result.query.licenseId
                ? <span className="font-mono">{result.query.licenseId}</span>
                : <em className="text-neutral-500 not-italic">—</em>}
            </Row>
            <Row label="DOB">{result.query.dateOfBirth || <em className="text-neutral-500 not-italic">—</em>}</Row>
          </dl>
          <p className="mt-4 border-t border-ink-800 pt-3 text-[11px] leading-relaxed text-neutral-500">
            Verdict heuristic: any CRITICAL hit ⇒ Decline. Any HIGH hit ⇒ Decline.
            2+ corroborating sources ⇒ Decline. Any other hit ⇒ Manual Review.
          </p>
        </div>
      </div>

      {result.hits.length > 0 && (
        <div className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Evidence — {result.hits.length} matching record{result.hits.length === 1 ? "" : "s"}
            </h2>
          </header>
          <ul className="divide-y divide-ink-800">
            {result.hits.map((h) => (
              <li key={h.id}>
                <Link href={`/entry/${h.id}`} className="flex gap-3 p-4 transition-colors hover:bg-ink-800/40">
                  <div className="size-16 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                    {h.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-semibold text-neutral-400">
                        {h.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{h.fullName}</span>
                      <SeverityBadge sev={h.severity} />
                      {h.matchedOn.map((m) => (
                        <span key={m} className="pill bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30">
                          {m === "license" ? "license match" : m === "name" ? "name match" : "DOB match"}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-300">{h.primaryReason}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                      {h.licenseId && <span className="font-mono">{h.licenseState ? `${h.licenseState}·` : ""}{h.licenseId}</span>}
                      {h.damageAmount != null && h.damageAmount > 0 && <span>${h.damageAmount.toLocaleString()} damages</span>}
                      {h.source && <span>via {h.source.name}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-ink-950/40 px-3 py-2">
      <div className="text-2xl font-bold tabular-nums">{value}{suffix}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="truncate text-right text-neutral-200">{children}</dd>
    </div>
  );
}

function SeverityBadge({ sev }: { sev: string }) {
  const cls =
    sev === "CRITICAL" ? "pill-critical" :
    sev === "HIGH" ? "pill-high" :
    sev === "MEDIUM" ? "pill-medium" : "pill-low";
  return <span className={cls}>{sev}</span>;
}

function VerdictIcon({ kind }: { kind: string }) {
  if (kind === "DECLINE") {
    return (
      <svg viewBox="0 0 32 32" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="16" cy="16" r="13" />
        <path d="m10 22 12-12M10 10l12 12" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "REVIEW") {
    return (
      <svg viewBox="0 0 32 32" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M16 3 30 28H2L16 3z" strokeLinejoin="round" />
        <path d="M16 13v7M16 23v.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="16" cy="16" r="13" />
      <path d="m9 17 5 5L24 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
