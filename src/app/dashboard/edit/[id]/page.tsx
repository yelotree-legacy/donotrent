import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizeLicense, normalizeName, splitName } from "@/lib/normalize";

async function updateEntry(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login?err=auth");

  const id = String(formData.get("id") || "");
  const entry = await prisma.dnrEntry.findUnique({ where: { id } });
  if (!entry) redirect("/dashboard/entries");
  if (entry.createdById !== me.id && !me.isAdmin) redirect(`/entry/${id}?err=forbidden`);

  const fullName = String(formData.get("fullName") || "").trim();
  const licenseId = String(formData.get("licenseId") || "").trim();
  const licenseState = String(formData.get("licenseState") || "").trim().toUpperCase().slice(0, 2) || null;
  const primaryReason = String(formData.get("primaryReason") || "").trim();
  const detailedNotes = String(formData.get("detailedNotes") || "").trim() || null;
  const severity = String(formData.get("severity") || "MEDIUM");
  const status = String(formData.get("status") || "ACTIVE");
  const damageRaw = String(formData.get("damageAmount") || "").trim();

  const parts = splitName(fullName);

  await prisma.dnrEntry.update({
    where: { id },
    data: {
      fullName,
      fullNameNorm: normalizeName(fullName),
      firstName: parts.first,
      middleName: parts.middle,
      lastName: parts.last,
      licenseId: licenseId || null,
      licenseIdNorm: licenseId ? normalizeLicense(licenseId) : null,
      licenseState,
      primaryReason,
      detailedNotes,
      severity,
      status,
      damageAmount: damageRaw ? parseFloat(damageRaw) : null,
    },
  });

  await logAudit("entry.update", id);
  redirect(`/entry/${id}`);
}

export default async function EditEntryPage({ params }: { params: { id: string } }) {
  const me = await requireCompany();
  if (!me) redirect(`/login?err=auth&next=/dashboard/edit/${params.id}`);
  const entry = await prisma.dnrEntry.findUnique({ where: { id: params.id } });
  if (!entry) return notFound();
  if (entry.createdById !== me.id && !me.isAdmin) {
    return (
      <div className="card p-6 text-sm">
        You don't have permission to edit this entry.{" "}
        <Link className="underline" href={`/entry/${entry.id}`}>View it</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href={`/entry/${entry.id}`} className="btn-link">← Back</Link>
      <h1 className="text-2xl font-bold">Edit entry</h1>
      <form action={updateEntry} className="card divide-y divide-ink-800">
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Full name</label>
            <input className="input" name="fullName" required defaultValue={entry.fullName} />
          </div>
          <div>
            <label className="label">License ID</label>
            <input className="input font-mono" name="licenseId" defaultValue={entry.licenseId ?? ""} />
          </div>
          <div>
            <label className="label">License state</label>
            <input className="input" name="licenseState" maxLength={2} defaultValue={entry.licenseState ?? ""} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Primary reason</label>
            <input className="input" name="primaryReason" required defaultValue={entry.primaryReason} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Detailed notes</label>
            <textarea className="input min-h-[120px]" name="detailedNotes" defaultValue={entry.detailedNotes ?? ""} />
          </div>
          <div>
            <label className="label">Severity</label>
            <select className="input" name="severity" defaultValue={entry.severity}>
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue={entry.status}>
              <option>ACTIVE</option><option>ARCHIVED</option><option>REFORMED</option><option>DISPUTED</option>
            </select>
          </div>
          <div>
            <label className="label">Damages ($)</label>
            <input className="input" name="damageAmount" type="number" min="0" step="0.01" defaultValue={entry.damageAmount ?? ""} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5">
          <Link href={`/entry/${entry.id}`} className="btn-link">Cancel</Link>
          <button type="submit" className="btn-primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
