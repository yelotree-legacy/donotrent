import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { SeverityPill, StatusPill } from "@/components/Pill";

export default async function MyEntriesPage() {
  const me = (await requireCompany())!;
  const entries = await prisma.dnrEntry.findMany({
    where: { createdById: me.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { reports: true, disputes: true } } },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My entries</h1>
          <p className="mt-1 text-sm text-neutral-400">{entries.length} record{entries.length === 1 ? "" : "s"} added by your company.</p>
        </div>
        <Link href="/dashboard/upload" className="btn-primary">+ New entry</Link>
      </header>

      {entries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-400">No entries yet.</p>
          <Link href="/dashboard/upload" className="btn-primary mt-3">Upload your first entry</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800/40 text-left text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Reports</th>
                <th className="px-4 py-3 text-right">Disputes</th>
                <th className="px-4 py-3 text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-ink-800/30">
                  <td className="px-4 py-2">
                    <Link href={`/entry/${e.id}`} className="font-medium text-white hover:underline">{e.fullName}</Link>
                    <div className="text-xs text-neutral-500 truncate max-w-[28ch]">{e.primaryReason}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {e.licenseId
                      ? <>{e.licenseState ? `${e.licenseState}·` : ""}{e.licenseId}</>
                      : <span className="text-neutral-500 italic">pending</span>}
                  </td>
                  <td className="px-4 py-2"><SeverityPill severity={e.severity} /></td>
                  <td className="px-4 py-2"><StatusPill status={e.status} /></td>
                  <td className="px-4 py-2 text-right text-neutral-400">{e._count.reports}</td>
                  <td className="px-4 py-2 text-right text-neutral-400">{e._count.disputes}</td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-500">{e.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
