import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { SeverityPill } from "@/components/Pill";

type Tab = "dnr" | "brokers" | "reviews";

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");

  const tab: Tab = (searchParams.tab as Tab) || "dnr";

  const [counts, entries, brokers, reviews] = await Promise.all([
    Promise.all([
      prisma.dnrEntry.count(),
      prisma.broker.count(),
      prisma.brokerReview.count(),
    ]),
    tab === "dnr"
      ? prisma.dnrEntry.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            source: { select: { name: true, slug: true } },
            createdBy: { select: { name: true, city: true, state: true } },
            photos: { take: 1, select: { url: true } },
          },
        })
      : Promise.resolve([]),
    tab === "brokers"
      ? prisma.broker.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            _count: { select: { reviews: true, disputes: true } },
            reviews: {
              orderBy: { createdAt: "asc" },
              take: 1,
              include: { reviewerCompany: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    tab === "reviews"
      ? prisma.brokerReview.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            broker: { select: { slug: true, name: true } },
            reviewerCompany: { select: { name: true, city: true, state: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const [entryCount, brokerCount, reviewCount] = counts;

  return (
    <div className="space-y-6 fade-in">
      <Link href="/dashboard/admin" className="btn-link">← Back to admin</Link>

      <header>
        <h1 className="text-2xl font-bold text-white">Network activity</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Live feed of what operators are adding across the network. Use this to spot abuse, verify quality, and catch problem patterns early.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <TabLink tab="dnr" current={tab} label="DNR entries" count={entryCount} />
        <TabLink tab="brokers" current={tab} label="Brokers" count={brokerCount} />
        <TabLink tab="reviews" current={tab} label="Broker reviews" count={reviewCount} />
      </div>

      {tab === "dnr" && <DnrFeed entries={entries as any[]} />}
      {tab === "brokers" && <BrokerFeed brokers={brokers as any[]} />}
      {tab === "reviews" && <ReviewFeed reviews={reviews as any[]} />}
    </div>
  );
}

function TabLink({ tab, current, label, count }: { tab: Tab; current: Tab; label: string; count: number }) {
  const active = tab === current;
  return (
    <Link
      href={`/dashboard/admin/activity?tab=${tab}`}
      className={`rounded-lg border px-4 py-2 text-sm transition ${
        active ? "border-accent bg-accent/10 text-red-300" : "border-ink-700 bg-ink-900/60 text-neutral-300 hover:bg-ink-800"
      }`}
    >
      {label}
      <span className="ml-2 text-xs opacity-70">{count.toLocaleString()}</span>
    </Link>
  );
}

function DnrFeed({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return <div className="card p-8 text-center text-sm text-neutral-400">No DNR entries yet.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-ink-800">
        {entries.map((e) => (
          <li key={e.id}>
            <Link
              href={`/entry/${e.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/40"
            >
              <div className="size-10 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                {e.photos?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photos[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-neutral-400">
                    {e.fullName.split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-medium text-white">{e.fullName}</span>
                  {e.licenseId && (
                    <span className="font-mono text-[10px] text-neutral-500">
                      {e.licenseState ? `${e.licenseState}·` : ""}{e.licenseId}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-neutral-400">{e.primaryReason}</div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  {e.createdBy?.name ? `Added by ${e.createdBy.name}` : `via ${e.source?.name || "unknown"}`}
                  {" · "}{relTime(e.createdAt)}
                </div>
              </div>
              <SeverityPill severity={e.severity} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrokerFeed({ brokers }: { brokers: any[] }) {
  if (brokers.length === 0) {
    return <div className="card p-8 text-center text-sm text-neutral-400">No brokers yet.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-ink-800">
        {brokers.map((b) => (
          <li key={b.id}>
            <Link href={`/brokers/${b.slug}`} className="block px-5 py-3 transition-colors hover:bg-ink-800/40">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-white">{b.name}</span>
                    {b.status === "DISPUTED" && (
                      <span className="pill bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-500/30">DISPUTED</span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {(b.city || b.state) && <>{[b.city, b.state].filter(Boolean).join(", ")} · </>}
                    First reviewed by {b.reviews?.[0]?.reviewerCompany?.name || "—"}
                    {" · "}{relTime(b.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  {b.reviewCount > 0 ? (
                    <div className={`text-sm font-semibold ${b.avgRating >= 4 ? "text-emerald-300" : b.avgRating >= 3 ? "text-amber-300" : "text-red-300"}`}>
                      ★ {b.avgRating.toFixed(1)}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">No rating</span>
                  )}
                  <div className="text-[10px] text-neutral-500">
                    {b._count.reviews} review{b._count.reviews === 1 ? "" : "s"}
                    {b._count.disputes > 0 && <> · <span className="text-yellow-300">{b._count.disputes} dispute{b._count.disputes === 1 ? "" : "s"}</span></>}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewFeed({ reviews }: { reviews: any[] }) {
  if (reviews.length === 0) {
    return <div className="card p-8 text-center text-sm text-neutral-400">No broker reviews yet.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-ink-800">
        {reviews.map((r) => (
          <li key={r.id}>
            <Link href={`/brokers/${r.broker.slug}`} className="block px-5 py-3 transition-colors hover:bg-ink-800/40">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${r.rating >= 4 ? "text-emerald-300" : r.rating >= 3 ? "text-amber-300" : "text-red-300"}`}>
                      {"★".repeat(r.rating)}<span className="text-neutral-700">{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span className="truncate font-medium text-white">{r.broker.name}</span>
                  </div>
                  <div className="truncate text-xs text-neutral-300">{r.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                    by {r.reviewerCompany.name}
                    {r.reviewerCompany.city ? ` · ${r.reviewerCompany.city}` : ""}
                    {" · "}{relTime(r.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function relTime(d: Date | string): string {
  const then = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toISOString().slice(0, 10);
}
