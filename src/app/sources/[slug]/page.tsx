import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SeverityPill } from "@/components/Pill";
import { requireCompany } from "@/lib/auth";

export default async function SourceDetailPage({ params }: { params: { slug: string } }) {
  const me = await requireCompany();
  if (!me) redirect(`/login?next=/sources/${params.slug}`);
  const source = await prisma.source.findUnique({
    where: { slug: params.slug },
    include: { _count: { select: { entries: true } } },
  });
  if (!source) return notFound();

  const entries = await prisma.dnrEntry.findMany({
    where: { sourceId: source.id },
    orderBy: [{ severity: "desc" }, { fullName: "asc" }],
    take: 100,
    include: { photos: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="space-y-6 fade-in">
      <Link href="/sources" className="btn-link">← All sources</Link>
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{source.name}</h1>
              <span className="pill bg-ink-800 text-neutral-300 ring-1 ring-inset ring-ink-700">{source.kind}</span>
            </div>
            {source.region && <div className="mt-0.5 text-sm text-neutral-400">{source.region}</div>}
            {source.description && <p className="mt-3 max-w-2xl text-sm text-neutral-300">{source.description}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Entries" value={source._count.entries.toLocaleString()} />
            <Stat label="Trust" value={`${source.trustScore}/100`} />
            <Stat label="Sync" value={source.syncFrequency || "manual"} />
          </div>
        </div>
        {source.url && (
          <a
            href={source.url} target="_blank" rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            {source.url} ↗
          </a>
        )}
      </header>

      <div className="card overflow-hidden">
        <header className="border-b border-ink-800 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Entries — showing {Math.min(100, source._count.entries)} of {source._count.entries.toLocaleString()}
          </h2>
        </header>
        <ul className="divide-y divide-ink-800">
          {entries.map((e) => (
            <li key={e.id}>
              <Link href={`/entry/${e.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-800/40">
                <div className="size-10 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                  {e.photos[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photos[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-neutral-400">
                      {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{e.fullName}</div>
                  <div className="truncate text-xs text-neutral-500">{e.primaryReason}</div>
                </div>
                {e.licenseId ? (
                  <span className="font-mono tag">
                    {e.licenseState ? `${e.licenseState}·` : ""}{e.licenseId}
                  </span>
                ) : null}
                <SeverityPill severity={e.severity} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-ink-950/50 px-3 py-2">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}
