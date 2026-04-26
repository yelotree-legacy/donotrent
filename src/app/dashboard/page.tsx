import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { SeverityPill } from "@/components/Pill";
import { Sparkline } from "@/components/Sparkline";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export default async function DashboardHome({ searchParams }: { searchParams: { welcome?: string } }) {
  // Don't rely on the parent layout's redirect — Next 14 renders layouts and
  // pages in parallel, so a stale-session render can dereference null here
  // before the layout's redirect fires, which 500s the page.
  const me = await requireCompany();
  if (!me) redirect("/login?err=auth&next=/dashboard");

  // Pull a wide-but-bounded set of dashboard data in parallel.
  const periodStart = me.currentPeriodStart || new Date(Date.now() - 30 * 86400_000);
  const [
    myEntriesCount,
    totalEntries,
    totalCompanies,
    myReportsCount,
    recentEntries,
    recentChecks,
    verdictBreakdown,
    last30Checks,
    myBrokerReviews,
    networkBrokerReviews,
    myBrokerReviewCount,
  ] = await Promise.all([
    prisma.dnrEntry.count({ where: { createdById: me.id } }),
    prisma.dnrEntry.count(),
    prisma.company.count(),
    prisma.report.count({ where: { reportingCoId: me.id } }),
    prisma.dnrEntry.findMany({
      where: { createdById: me.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, fullName: true, primaryReason: true, severity: true, createdAt: true,
        photos: { take: 1, select: { url: true } },
      },
    }),
    prisma.checkSession.findMany({
      where: { companyId: me.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, fullName: true, licenseId: true, verdict: true,
        riskScore: true, totalHits: true, createdAt: true,
      },
    }),
    prisma.checkSession.groupBy({
      by: ["verdict"],
      where: { companyId: me.id, verdict: { not: null } },
      _count: { _all: true },
    }),
    prisma.checkSession.findMany({
      where: { companyId: me.id, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.brokerReview.findMany({
      where: { reviewerCompanyId: me.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { broker: { select: { slug: true, name: true } } },
    }),
    prisma.brokerReview.findMany({
      where: { reviewerCompanyId: { not: me.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        broker: { select: { slug: true, name: true } },
        reviewerCompany: { select: { name: true, city: true, state: true } },
      },
    }),
    prisma.brokerReview.count({ where: { reviewerCompanyId: me.id } }),
  ]);

  // 30-day sparkline of check counts
  const dailyCounts: number[] = new Array(30).fill(0);
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0); startDay.setDate(startDay.getDate() - 29);
  for (const c of last30Checks) {
    const day = Math.floor((c.createdAt.getTime() - startDay.getTime()) / 86400_000);
    if (day >= 0 && day < 30) dailyCounts[day]++;
  }

  const verdictMap = Object.fromEntries(
    verdictBreakdown.map((v) => [v.verdict || "", v._count._all])
  );
  const totalVerdicts = (verdictMap.APPROVE || 0) + (verdictMap.REVIEW || 0) + (verdictMap.DECLINE || 0);

  // Onboarding checklist — based on actual data
  const checklist = [
    {
      key: "first_check",
      label: "Run your first Rent Report",
      href: "/check",
      done: recentChecks.length > 0,
      hint: "See the cross-source verdict on a sample renter",
    },
    {
      key: "upload_entry",
      label: "Add a flagged renter to your DNR list",
      href: "/dashboard/upload",
      done: myEntriesCount > 0,
      hint: "Build your private network on top of the public registry",
    },
    {
      key: "broker_review",
      label: "Review a broker",
      href: "/brokers",
      done: myBrokerReviewCount > 0,
      hint: "Rate the agents who source your customers",
    },
    {
      key: "api_key",
      label: "Generate your API key",
      href: "/dashboard/api",
      done: Boolean(me.apiKeyHash),
      hint: "Integrate the Rent Report into your booking flow",
    },
  ];

  return (
    <div className="space-y-6 fade-in">
      {searchParams.welcome && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 fade-in">
          <span className="font-semibold">Welcome to They Can't Be Trusted.</span> Run your first Rent Report below.
        </div>
      )}

      {!me.verified && !me.isAdmin && (
        <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/10 p-4 fade-in">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-300">
              <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 1.5 14.5 13H1.5L8 1.5Z" strokeLinejoin="round" />
                <path d="M8 6.5v3.5M8 11.75v.01" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold text-amber-200">Verification pending</div>
              <p className="mt-1 text-xs text-amber-100/80">
                You can search the registry and run Rent Reports right now. To <strong>post DNR entries or broker reviews</strong>,
                an admin needs to verify your operator status. Most approvals come through within 24 hours — we'll reach out at <strong>{me.email}</strong> if we need more info.
              </p>
            </div>
          </div>
        </div>
      )}

      <header>
        <h1 className="text-2xl font-bold text-white">Welcome back, {me.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Verified rental operator · cross-source DNR + Broker Registry
        </p>
      </header>

      <OnboardingChecklist items={checklist} />

      {/* Stat cards with sparklines */}
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Rent Reports"
          value={recentChecks.length === 0 ? "—" : me.checksUsedThisPeriod.toString()}
          sub="last 30 days"
          accent
          spark={dailyCounts}
        />
        <StatCard
          label="Your DNR entries"
          value={myEntriesCount}
          sub="added by your company"
        />
        <StatCard
          label="Network total"
          value={totalEntries}
          sub="across all sources"
        />
        <StatCard
          label="Member companies"
          value={totalCompanies}
          sub="trusted operators"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Verdict breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Your verdict mix
          </h2>
          {totalVerdicts === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-4 text-center text-sm text-neutral-500">
              <span className="grid size-10 place-items-center rounded-full bg-ink-800 text-neutral-400">
                <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 2a8 8 0 1 1-8 8" strokeLinecap="round" />
                </svg>
              </span>
              No checks yet
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <VerdictRow
                label="Approve"
                count={verdictMap.APPROVE || 0}
                total={totalVerdicts}
                color="bg-emerald-500"
              />
              <VerdictRow
                label="Review"
                count={verdictMap.REVIEW || 0}
                total={totalVerdicts}
                color="bg-amber-500"
              />
              <VerdictRow
                label="Decline"
                count={verdictMap.DECLINE || 0}
                total={totalVerdicts}
                color="bg-red-500"
              />
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card md:col-span-2 overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Recent Rent Reports
            </h2>
            <Link href="/check" className="btn-primary">+ New check</Link>
          </header>
          {recentChecks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-neutral-400">You haven't run any Rent Reports yet.</p>
              <Link href="/check" className="btn-primary mt-3 inline-flex">Run your first check</Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {recentChecks.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/check/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <VerdictDot verdict={c.verdict} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {c.fullName || <em className="text-neutral-500">no name</em>}
                        </span>
                        {c.licenseId && <span className="font-mono text-[11px] text-neutral-500">{c.licenseId}</span>}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {c.totalHits} {c.totalHits === 1 ? "hit" : "hits"} · risk {c.riskScore ?? 0}
                      </div>
                    </div>
                    <VerdictPill verdict={c.verdict} />
                    <span className="hidden text-xs text-neutral-500 sm:block">{relTime(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`grid gap-6 ${me.isAdmin ? "md:grid-cols-2" : ""}`}>
        {/* My recent entries */}
        <div className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Recent entries you added
            </h2>
            <Link href="/dashboard/entries" className="btn-link">View all →</Link>
          </header>
          {recentEntries.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-neutral-400">No entries yet.</p>
              <Link href="/dashboard/upload" className="btn-primary mt-3 inline-flex">Upload an entry</Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {recentEntries.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/entry/${r.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                      {r.photos[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photos[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-neutral-400">
                          {r.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{r.fullName}</div>
                      <div className="truncate text-xs text-neutral-500">{r.primaryReason}</div>
                    </div>
                    <SeverityPill severity={r.severity} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Setup health — admin only */}
        {me.isAdmin && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Setup health</h2>
            <ul className="mt-3 space-y-2">
              <HealthRow label="Database" ok={true} note="Connected" />
              <HealthRow label="Vercel Blob" ok={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} note="Photo uploads" />
            </ul>
          </div>
        )}
      </div>

      {/* Broker activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Your broker reviews
              {myBrokerReviewCount > 0 && (
                <span className="ml-2 text-xs text-neutral-500">· {myBrokerReviewCount}</span>
              )}
            </h2>
            <Link href="/brokers" className="btn-link">All brokers →</Link>
          </header>
          {myBrokerReviews.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-neutral-400">You haven't reviewed any brokers yet.</p>
              <p className="mt-1 text-xs text-neutral-500">
                Rate the agents who source your customers — it helps you and the rest of the network avoid the bad ones.
              </p>
              <Link href="/brokers/new" className="btn-primary mt-3 inline-flex">+ Review a broker</Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {myBrokerReviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/brokers/${r.broker.slug}`}
                    className="block px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-white">{r.broker.name}</span>
                      <span className={`shrink-0 text-sm font-semibold ${
                        r.rating >= 4 ? "text-emerald-300" : r.rating >= 3 ? "text-amber-300" : "text-red-300"
                      }`}>
                        {"★".repeat(r.rating)}<span className="text-neutral-700">{"★".repeat(5 - r.rating)}</span>
                      </span>
                    </div>
                    <div className="truncate text-xs text-neutral-400">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">{relTime(r.createdAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Latest network activity
            </h2>
            <Link href="/brokers" className="btn-link">Browse →</Link>
          </header>
          {networkBrokerReviews.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-neutral-400">
              No network broker reviews yet. Be the first.
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {networkBrokerReviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/brokers/${r.broker.slug}`}
                    className="block px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-white">{r.broker.name}</span>
                      <span className={`shrink-0 text-sm font-semibold ${
                        r.rating >= 4 ? "text-emerald-300" : r.rating >= 3 ? "text-amber-300" : "text-red-300"
                      }`}>
                        ★ {r.rating}
                      </span>
                    </div>
                    <div className="truncate text-xs text-neutral-300">{r.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                      {r.reviewerCompany.name}
                      {r.reviewerCompany.city ? ` · ${r.reviewerCompany.city}` : ""} · {relTime(r.createdAt)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, accent, spark,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  spark?: number[];
}) {
  return (
    <div className={`card overflow-hidden p-4 ${accent ? "border-red-500/30 bg-red-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-2xl font-bold ${accent ? "text-red-300" : "text-white"}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
        </div>
        {spark && spark.length > 0 && spark.some((v) => v > 0) && (
          <Sparkline values={spark} width={70} height={28} color={accent ? "rgb(248 113 113)" : "rgb(96 165 250)"} />
        )}
      </div>
      {sub && <div className="mt-2 border-t border-ink-800 pt-2 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function VerdictRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-300">{label}</span>
        <span className="text-neutral-400">{count} <span className="text-neutral-500">· {pct}%</span></span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VerdictDot({ verdict }: { verdict: string | null }) {
  const cls =
    verdict === "DECLINE" ? "bg-red-500" :
    verdict === "REVIEW" ? "bg-amber-500" :
    verdict === "APPROVE" ? "bg-emerald-500" : "bg-neutral-500";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} />;
}

function VerdictPill({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const cls =
    verdict === "DECLINE" ? "bg-red-500/15 text-red-300 ring-red-500/30" :
    verdict === "REVIEW" ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" :
    "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  return (
    <span className={`pill ring-1 ring-inset ${cls}`}>
      {verdict.toLowerCase()}
    </span>
  );
}

function HealthRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <li className="flex items-center justify-between rounded border border-ink-700 bg-ink-800/30 p-2.5">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="text-sm text-white">{label}</span>
      </div>
      <span className="text-[11px] text-neutral-400">{note}</span>
    </li>
  );
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
