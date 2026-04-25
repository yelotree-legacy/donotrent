import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";

export default async function DashboardHome({ searchParams }: { searchParams: { welcome?: string } }) {
  const me = (await requireCompany())!;
  const [myCount, totalEntries, totalCompanies, recent] = await Promise.all([
    prisma.dnrEntry.count({ where: { createdById: me.id } }),
    prisma.dnrEntry.count(),
    prisma.company.count(),
    prisma.dnrEntry.findMany({
      where: { createdById: me.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, primaryReason: true, severity: true, createdAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      {searchParams.welcome && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Welcome to the DNR Registry. Upload your first incident below.
        </div>
      )}

      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Manage your company's DNR entries, reports, and disputes.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Your entries" value={myCount} />
        <Stat label="Total in registry" value={totalEntries} />
        <Stat label="Member companies" value={totalCompanies} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent entries you added</h2>
          <Link href="/dashboard/upload" className="btn-primary">+ New entry</Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            You haven't uploaded anyone yet.{" "}
            <Link className="text-accent underline" href="/dashboard/upload">Upload your first entry</Link>.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-800">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/entry/${r.id}`} className="min-w-0 flex-1 truncate text-white hover:underline">
                  {r.fullName}
                </Link>
                <span className="ml-3 truncate text-xs text-neutral-500">{r.primaryReason}</span>
                <span className="ml-3 text-xs text-neutral-500">{r.createdAt.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-white">{value.toLocaleString()}</div>
    </div>
  );
}
