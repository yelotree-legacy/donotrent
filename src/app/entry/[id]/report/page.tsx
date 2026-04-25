import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function fileReport(formData: FormData) {
  "use server";
  const me = await requireCompany();
  const entryId = String(formData.get("entryId") || "");
  if (!me) redirect(`/login?err=auth&next=/entry/${entryId}/report`);
  const description = String(formData.get("description") || "").trim();
  const incidentDate = String(formData.get("incidentDate") || "").trim();
  if (!description || description.length < 10) redirect(`/entry/${entryId}/report?err=short`);

  await prisma.report.upsert({
    where: { entryId_reportingCoId: { entryId, reportingCoId: me.id } },
    update: { description, incidentDate: incidentDate ? new Date(incidentDate) : null },
    create: {
      entryId,
      reportingCoId: me.id,
      description,
      incidentDate: incidentDate ? new Date(incidentDate) : null,
    },
  });
  await logAudit("report.create", entryId);
  redirect(`/entry/${entryId}`);
}

export default async function ReportPage({ params, searchParams }: { params: { id: string }; searchParams: { err?: string } }) {
  const entry = await prisma.dnrEntry.findUnique({ where: { id: params.id }, select: { id: true, fullName: true } });
  if (!entry) return notFound();
  const me = await requireCompany();

  return (
    <div className="mx-auto max-w-xl space-y-5 py-6">
      <Link href={`/entry/${entry.id}`} className="btn-link">← Back to entry</Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Add a corroborating report</h1>
        <p className="mt-1 text-sm text-neutral-400">
          You're filing a report against <span className="text-white font-medium">{entry.fullName}</span>. Other rental
          operators will see your company's name attached.
        </p>
        {!me && (
          <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            You must <Link className="underline" href="/login">sign in</Link> to file a report.
          </div>
        )}
        {searchParams.err === "short" && (
          <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Description must be at least 10 characters.
          </div>
        )}
        <form action={fileReport} className="mt-5 space-y-4">
          <input type="hidden" name="entryId" value={entry.id} />
          <div>
            <label className="label">Describe your incident with this person</label>
            <textarea className="input min-h-[140px]" name="description" required minLength={10} />
          </div>
          <div>
            <label className="label">Incident date</label>
            <input className="input" name="incidentDate" type="date" />
          </div>
          <div className="flex justify-end gap-3">
            <Link href={`/entry/${entry.id}`} className="btn-link">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={!me}>Submit report</button>
          </div>
        </form>
      </div>
    </div>
  );
}
