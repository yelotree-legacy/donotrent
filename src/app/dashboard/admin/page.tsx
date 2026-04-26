import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOfacCacheInfo } from "@/lib/checks/ofac";
import { OfacSyncButton } from "./OfacSyncButton";

export default async function AdminPage() {
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");

  const [companies, entries, searches, disputes] = await Promise.all([
    prisma.company.count(),
    prisma.dnrEntry.count(),
    prisma.searchLog.count(),
    prisma.dispute.count(),
  ]);

  const recentSearches = await prisma.searchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { company: { select: { name: true } } },
  });

  const pendingCompanies = await prisma.company.findMany({
    where: { verified: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-neutral-400">Network-wide moderation and analytics.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { l: "Companies", v: companies },
          { l: "Entries", v: entries },
          { l: "Searches", v: searches },
          { l: "Disputes", v: disputes },
        ].map((s) => (
          <div key={s.l} className="card p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">{s.l}</div>
            <div className="mt-1 text-2xl font-bold text-white">{s.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex h-full flex-col">
            <div className="flex-1">
              <h2 className="font-semibold text-amber-200">Operator verifications</h2>
              <p className="mt-1 text-xs text-amber-100/70">
                Approve new rental operators before they post.
              </p>
            </div>
            <a href="/dashboard/admin/verifications" className="btn-primary mt-3 justify-center">Open queue →</a>
          </div>
        </div>
        <div className="card border-blue-500/30 bg-blue-500/5 p-5">
          <div className="flex h-full flex-col">
            <div className="flex-1">
              <h2 className="font-semibold text-blue-200">Network activity</h2>
              <p className="mt-1 text-xs text-blue-100/70">
                Live feed of recently added DNR entries, brokers, and reviews.
              </p>
            </div>
            <a href="/dashboard/admin/activity" className="btn-primary mt-3 justify-center">Open feed →</a>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex h-full flex-col">
            <div className="flex-1">
              <h2 className="font-semibold text-white">Bulk CSV import</h2>
              <p className="mt-1 text-xs text-neutral-400">
                Paste a CSV of flagged renters and assign them to a source.
              </p>
            </div>
            <a href="/dashboard/admin/import" className="btn-primary mt-3 justify-center">Open import →</a>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex h-full flex-col">
            <div className="flex-1">
              <h2 className="font-semibold text-white">Photo migration</h2>
              <p className="mt-1 text-xs text-neutral-400">
                Move imported photos from external CDNs to Vercel Blob.
              </p>
            </div>
            <a href="/dashboard/admin/photo-migration" className="btn-ghost mt-3 justify-center">Open →</a>
          </div>
        </div>
        <OfacSyncCard />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Pending verification</h2>
          {pendingCompanies.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">No pending companies.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-800">
              {pendingCompanies.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <div className="font-medium text-white">{c.name}</div>
                  <div className="text-xs text-neutral-500">{c.email}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Recent searches</h2>
          <ul className="mt-3 divide-y divide-ink-800 text-sm">
            {recentSearches.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="font-mono text-neutral-300">"{s.query}"</span>
                <span className="text-xs text-neutral-500">
                  {s.field} · {s.resultsCount} hits {s.company ? `· ${s.company.name}` : ""}
                </span>
              </li>
            ))}
            {recentSearches.length === 0 && <li className="py-2 text-sm text-neutral-400">No searches yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OfacSyncCard() {
  const info = getOfacCacheInfo();
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-semibold text-white">OFAC SDN list</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Cached US Treasury sanctions list. Auto-refreshes every 24h.
          </p>
          <div className="mt-3 text-xs text-neutral-500">
            {info.cached
              ? <>{info.rowsLoaded.toLocaleString()} entries · refreshed {info.ageMinutes != null ? `${info.ageMinutes} min ago` : "now"}</>
              : <em>Not loaded yet</em>}
          </div>
        </div>
        <OfacSyncButton />
      </div>
    </div>
  );
}
