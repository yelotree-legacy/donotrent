import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";

export default async function MyReportsPage() {
  const me = await requireCompany();
  if (!me) redirect("/login?err=auth&next=/dashboard/reports");
  const reports = await prisma.report.findMany({
    where: { reportingCoId: me.id },
    orderBy: { createdAt: "desc" },
    include: { entry: { select: { id: true, fullName: true, primaryReason: true } } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">My reports</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Reports your company has filed corroborating other operators' entries.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-400">
          You haven't filed any corroborating reports yet. Click "+ Add report" on any entry detail page.
        </div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {reports.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/entry/${r.entry.id}`} className="font-medium text-white hover:underline">
                  {r.entry.fullName}
                </Link>
                <span className="text-xs text-neutral-500">{r.createdAt.toISOString().slice(0, 10)}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-300">{r.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
