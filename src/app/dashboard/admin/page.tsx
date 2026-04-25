import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
