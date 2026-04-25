import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

async function fileDispute(formData: FormData) {
  "use server";
  const entryId = String(formData.get("entryId") || "");
  const filerName = String(formData.get("filerName") || "").trim();
  const filerContact = String(formData.get("filerContact") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!entryId || !filerName || !filerContact || reason.length < 20) {
    redirect(`/dispute?entry=${entryId}&err=invalid`);
  }
  const entry = await prisma.dnrEntry.findUnique({ where: { id: entryId } });
  if (!entry) redirect("/dispute?err=notfound");

  await prisma.dispute.create({
    data: { entryId, filerName, filerContact, reason },
  });
  await prisma.dnrEntry.update({ where: { id: entryId }, data: { status: "DISPUTED" } });
  redirect(`/dispute/filed?entry=${entryId}`);
}

export default async function DisputePage({ searchParams }: { searchParams: { entry?: string; err?: string } }) {
  const entryId = searchParams.entry;
  const entry = entryId
    ? await prisma.dnrEntry.findUnique({ where: { id: entryId }, select: { id: true, fullName: true } })
    : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 py-6">
      <div className="card p-6">
        <h1 className="text-xl font-bold">File a dispute</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {entry
            ? <>Disputing the listing of <span className="text-white font-medium">{entry.fullName}</span>.</>
            : "Provide details about the entry you're disputing."}
        </p>
        {searchParams.err && (
          <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {searchParams.err === "notfound" ? "Entry not found." : "Please complete the form (reason ≥ 20 characters)."}
          </div>
        )}
        <form action={fileDispute} className="mt-5 space-y-4">
          {entry ? <input type="hidden" name="entryId" value={entry.id} /> : (
            <div>
              <label className="label">Entry ID</label>
              <input className="input font-mono" name="entryId" required placeholder="cl…" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Your name</label>
              <input className="input" name="filerName" required />
            </div>
            <div>
              <label className="label">Email or phone</label>
              <input className="input" name="filerContact" required />
            </div>
          </div>
          <div>
            <label className="label">Why is this listing wrong?</label>
            <textarea className="input min-h-[140px]" name="reason" required minLength={20} />
          </div>
          <div className="flex justify-end gap-3">
            <Link href="/" className="btn-link">Cancel</Link>
            <button type="submit" className="btn-primary">Submit dispute</button>
          </div>
        </form>
      </div>
    </div>
  );
}
