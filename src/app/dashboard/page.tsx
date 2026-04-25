import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { SeverityPill } from "@/components/Pill";

export default async function DashboardHome({ searchParams }: { searchParams: { welcome?: string } }) {
  const me = (await requireCompany())!;
  const [myCount, totalEntries, totalCompanies, totalReports, recent] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6 fade-in">
      {searchParams.welcome && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 fade-in">
          <span className="font-semibold">Welcome to DNR Registry.</span> Upload your first incident to get started.
        </div>
      )}

      <header>
        <h1 className="text-2xl font-bold text-white">Welcome back, {me.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Manage your company's DNR entries, reports, and disputes.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Your entries" value={myCount} icon={<EntryIcon />} accent />
        <Stat label="Network total" value={totalEntries} icon={<NetworkIcon />} />
        <Stat label="Member companies" value={totalCompanies} icon={<CompanyIcon />} />
        <Stat label="Reports filed" value={totalReports} icon={<ReportIcon />} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card overflow-hidden md:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
            <h2 className="font-semibold text-white">Recent entries</h2>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/entries" className="btn-link">View all →</Link>
              <Link href="/dashboard/upload" className="btn-primary">+ New</Link>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-neutral-400">You haven't uploaded anyone yet.</p>
              <Link className="btn-primary mt-3 inline-flex" href="/dashboard/upload">Upload your first entry</Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {recent.map((r) => (
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
                    <span className="text-xs text-neutral-500">{r.createdAt.toISOString().slice(0, 10)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-white">Quick actions</h2>
          <div className="mt-4 space-y-2">
            <ActionLink href="/dashboard/upload" icon="+" label="Upload new entry" sub="Capture license + reason" />
            <ActionLink href="/dashboard/entries" icon="◇" label="My entries" sub="Edit, archive, or update" />
            <ActionLink href="/dashboard/reports" icon="⤴" label="My reports" sub="Corroborate other entries" />
            <ActionLink href="/" icon="⌕" label="Search registry" sub="Look up before you rent" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card overflow-hidden ${accent ? "border-red-500/30 bg-red-500/5" : ""}`}>
      <div className="flex items-center gap-3 p-4">
        <div className={`grid size-10 place-items-center rounded-lg ${accent ? "bg-red-500/15 text-red-300" : "bg-ink-800 text-neutral-400"}`}>
          {icon}
        </div>
        <div>
          <div className={`text-2xl font-bold ${accent ? "text-red-300" : "text-white"}`}>{value.toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ActionLink({ href, icon, label, sub }: { href: string; icon: string; label: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-ink-800">
      <div className="grid size-9 place-items-center rounded-md bg-ink-800 text-base font-semibold text-neutral-300 ring-1 ring-ink-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-neutral-500">{sub}</div>
      </div>
    </Link>
  );
}

function EntryIcon() { return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 8h6M7 12h4" strokeLinecap="round"/></svg>; }
function NetworkIcon() { return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6"/><path d="M4 10h12M10 4v12"/></svg>; }
function CompanyIcon() { return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17h14M5 17V7l5-3 5 3v10M9 11h2M9 14h2"/></svg>; }
function ReportIcon() { return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10m0 0-3-3m3 3 3-3M3 17h14"/></svg>; }
