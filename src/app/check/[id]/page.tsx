import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { crossCheck } from "@/lib/cross-check";
import { requireCompany } from "@/lib/auth";

export default async function CheckSessionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { idv?: string };
}) {
  const me = await requireCompany();
  if (!me) redirect(`/login?next=/check/${params.id}`);
  const session = await prisma.checkSession.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });
  if (!session) return notFound();

  const xc = await crossCheck({
    licenseId: session.licenseId || undefined,
    fullName: session.fullName || undefined,
    dateOfBirth: session.dateOfBirth?.toISOString().slice(0, 10),
  });

  return (
    <div className="space-y-6 fade-in">
      <Link href="/check" className="btn-link">← New check</Link>

      <Verdict result={xc} session={session} />

      <SourceBreakdown sources={xc.sources} />

      <OfacCard session={session} />

      {xc.hits.length > 0 && <Evidence hits={xc.hits} />}
    </div>
  );
}

function OfacCard({ session }: { session: any }) {
  const status = session.ofacStatus as string;
  const matches = session.ofacMatchesJson ? (JSON.parse(session.ofacMatchesJson) as any[]) : [];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Sanctions watchlist</h2>
        <StatusPillGeneric status={status} variants={{
          clear: ["emerald", "Clear"],
          match: ["red", "MATCH"],
          error: ["amber", "Error"],
          not_run: ["neutral", "Not run"],
        }} />
      </div>
      {status === "clear" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle /> No match against the OFAC SDN list
        </div>
      )}
      {status === "match" && (
        <div className="mt-3 space-y-3">
          <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <strong>OFAC sanctions match found.</strong> This person appears on the US Treasury Specially Designated Nationals list. Renting to them may violate federal law.
          </p>
          <ul className="space-y-2 text-xs">
            {matches.slice(0, 3).map((m: any) => (
              <li key={m.uid} className="rounded border border-ink-700 bg-ink-800/40 p-2">
                <div className="text-sm font-medium text-white">{m.name}</div>
                <div className="text-[11px] text-neutral-400">
                  Programs: {m.programs?.join(", ") || "—"} · Confidence {Math.round(m.score / 10)}%
                </div>
                {m.remarks && <div className="mt-1 text-[11px] text-neutral-500 line-clamp-2">{m.remarks}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {status === "error" && (
        <p className="mt-3 text-xs text-amber-300">
          OFAC list could not be fetched. Will retry on next check. (US Treasury occasionally serves stale data.)
        </p>
      )}
      {status === "not_run" && (
        <p className="mt-3 text-xs text-neutral-500">No name provided to screen against OFAC.</p>
      )}
      <p className="mt-4 text-[10px] text-neutral-500">
        Source: US Treasury OFAC SDN list · public, free, ~daily updates
      </p>
    </div>
  );
}

function StatusPillGeneric({
  status,
  variants,
}: {
  status: string;
  variants: Record<string, [string, string]>;
}) {
  const [color, label] = variants[status] || ["neutral", status];
  const cls: Record<string, string> = {
    neutral: "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    red: "bg-red-500/15 text-red-300 ring-red-500/30",
    blue: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  };
  return <span className={`pill ring-1 ring-inset ${cls[color] || cls.neutral}`}>{label}</span>;
}

function Verdict({ result, session }: { result: any; session: any }) {
  const v = result.verdict as "DECLINE" | "REVIEW" | "APPROVE";
  const verdictCls =
    v === "DECLINE" ? "border-red-500/40 bg-red-500/10 text-red-200"
      : v === "REVIEW" ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  const verdictLabel = v === "DECLINE" ? "Decline" : v === "REVIEW" ? "Manual review" : "Approve";
  const verdictDesc =
    v === "DECLINE" ? "Strong reasons to refuse this rental."
      : v === "REVIEW" ? "At least one match — confirm details before renting."
        : "No matches across any active source.";

  return (
    <div className={`card overflow-hidden border-2 ${verdictCls}`}>
      <div className="grid items-center gap-6 p-6 md:grid-cols-[auto_1fr_auto]">
        <div className="grid size-20 place-items-center rounded-full bg-ink-950/40">
          <VerdictIcon kind={v} />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Verdict</div>
          <div className="text-3xl font-bold">{verdictLabel}</div>
          <div className="mt-1 text-sm opacity-80">{verdictDesc}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] opacity-70">
            <span>{session.fullName || "—"}</span>
            {session.licenseId && <span className="font-mono">· {session.licenseId}</span>}
            {session.dateOfBirth && <span>· DOB {session.dateOfBirth.toISOString().slice(0, 10)}</span>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Hits" value={result.totalHits} />
          <Stat label="Sources" value={`${result.matchedSources}/${result.totalSources}`} />
          <Stat label="Risk" value={`${result.riskScore}`} suffix="/100" />
        </div>
      </div>
    </div>
  );
}

function SourceBreakdown({ sources, className = "" }: { sources: any[]; className?: string }) {
  return (
    <div className={`card ${className}`}>
      <header className="border-b border-ink-800 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Source breakdown</h2>
      </header>
      <ul className="divide-y divide-ink-800">
        {sources.map((s) => (
          <li key={s.sourceId} className="flex items-center gap-3 px-5 py-3">
            <div className={`size-2 shrink-0 rounded-full ${s.hits > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{s.sourceName}</span>
                <span className="pill bg-ink-800 text-neutral-400 ring-1 ring-inset ring-ink-700">{s.sourceKind}</span>
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
  );
}

function Evidence({ hits }: { hits: any[] }) {
  return (
    <div className="card overflow-hidden">
      <header className="border-b border-ink-800 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Evidence — {hits.length} matching record{hits.length === 1 ? "" : "s"}
        </h2>
      </header>
      <ul className="divide-y divide-ink-800">
        {hits.map((h) => (
          <li key={h.id}>
            <Link href={`/entry/${h.id}`} className="flex gap-3 p-4 transition-colors hover:bg-ink-800/40">
              <div className="size-16 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                {h.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{h.fullName}</span>
                  <SeverityBadge sev={h.severity} />
                  {h.matchedOn.map((m: string) => (
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

function Row({ label, children, match }: { label: string; children: React.ReactNode; match?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className={`text-right text-xs ${match === true ? "text-emerald-300" : match === false ? "text-amber-300" : "text-neutral-200"}`}>
        {children}
        {match === true && <span className="ml-1">✓</span>}
        {match === false && <span className="ml-1">⚠</span>}
      </dd>
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

function CheckCircle() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" />
      <path d="m5 8 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

