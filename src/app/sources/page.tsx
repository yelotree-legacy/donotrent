import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { trustScore: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-3xl font-bold text-white">Data sources</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Every Rent Report queries each of these sources in parallel.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {sources.map((s) => <SourceCard key={s.id} s={s} />)}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Add a source</h2>
        <p className="mt-2 text-sm text-neutral-400">
          We can ingest from any public partner DNR list (e.g. another exotic-rental
          operator) or accept private uploads via API. Reach out if you'd like to
          contribute a feed — sources improve everyone's coverage.
        </p>
      </div>
    </div>
  );
}

function SourceCard({ s }: { s: any }) {
  const KIND_COLORS: Record<string, string> = {
    scraped: "border-blue-500/30 bg-blue-500/5",
    partner: "border-purple-500/30 bg-purple-500/5",
    network: "border-emerald-500/30 bg-emerald-500/5",
    manual: "border-neutral-500/30 bg-neutral-500/5",
  };
  const kindCls = KIND_COLORS[s.kind] || KIND_COLORS.manual;

  return (
    <div className={`card overflow-hidden border-2 ${kindCls}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">{s.name}</div>
            {s.region && <div className="mt-0.5 text-xs text-neutral-500">{s.region}</div>}
          </div>
          <span className="pill bg-ink-800 text-neutral-300 ring-1 ring-inset ring-ink-700">
            {s.kind}
          </span>
        </div>
        {s.description && <p className="mt-3 text-sm text-neutral-300">{s.description}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <Stat label="Entries" value={s._count.entries.toLocaleString()} />
          <Stat label="Trust" value={`${s.trustScore}/100`} />
          <Stat label="Sync" value={s.syncFrequency || "manual"} />
        </div>
      </div>
      {s.url && (
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between border-t border-ink-800 bg-ink-950/40 px-5 py-2 text-xs text-neutral-400 hover:text-white"
        >
          <span className="truncate">{s.url}</span>
          <span>↗</span>
        </a>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-ink-950/50 px-2 py-1.5">
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}
