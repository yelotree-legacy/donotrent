import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function approveCompany(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");
  const id = String(formData.get("companyId") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!id) redirect("/dashboard/admin/verifications");

  await prisma.company.update({
    where: { id },
    data: {
      verified: true,
      verifiedAt: new Date(),
      verifiedById: me.id,
      verificationNote: note,
      rejectedAt: null,
      rejectionReason: null,
    },
  });
  await logAudit("verification.approve", id, { note });
  redirect("/dashboard/admin/verifications");
}

async function rejectCompany(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");
  const id = String(formData.get("companyId") || "");
  const reason = String(formData.get("reason") || "").trim() || "No reason given";
  if (!id) redirect("/dashboard/admin/verifications");

  await prisma.company.update({
    where: { id },
    data: {
      verified: false,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });
  await logAudit("verification.reject", id, { reason });
  redirect("/dashboard/admin/verifications");
}

async function unverifyCompany(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");
  const id = String(formData.get("companyId") || "");
  if (!id) redirect("/dashboard/admin/verifications");
  await prisma.company.update({
    where: { id },
    data: { verified: false, verifiedAt: null, verifiedById: null, verificationNote: null },
  });
  await logAudit("verification.revoke", id);
  redirect("/dashboard/admin/verifications");
}

export default async function VerificationsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");

  const tab = (searchParams.tab as "pending" | "verified" | "rejected") || "pending";

  const where: any = (() => {
    if (tab === "verified") return { verified: true, isAdmin: false };
    if (tab === "rejected") return { rejectedAt: { not: null }, verified: false };
    return { verified: false, rejectedAt: null, isAdmin: false };
  })();

  const [companies, counts] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, name: true, email: true, phone: true, city: true, state: true,
        verified: true, verifiedAt: true, verificationNote: true,
        rejectedAt: true, rejectionReason: true, createdAt: true,
        _count: { select: { entries: true, brokerReviews: true } },
      },
    }),
    prisma.company.groupBy({
      by: ["verified"],
      _count: { _all: true },
      where: { isAdmin: false },
    }),
  ]);

  const pendingCount = counts.find((c) => !c.verified)?._count._all ?? 0;
  const verifiedCount = counts.find((c) => c.verified)?._count._all ?? 0;
  const rejectedCount = await prisma.company.count({ where: { rejectedAt: { not: null }, verified: false } });

  return (
    <div className="space-y-6 fade-in">
      <Link href="/dashboard/admin" className="btn-link">← Back to admin</Link>

      <header>
        <h1 className="text-2xl font-bold text-white">Operator verifications</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Approve rental operators before they can post entries or broker reviews. Anyone signed up but unverified can search the registry but not contribute.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <TabLink tab="pending" current={tab} count={Math.max(0, pendingCount - rejectedCount)} />
        <TabLink tab="verified" current={tab} count={verifiedCount} />
        <TabLink tab="rejected" current={tab} count={rejectedCount} />
      </div>

      {companies.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-400">
          {tab === "pending" ? "No companies pending verification."
            : tab === "verified" ? "No verified companies yet."
              : "No rejected companies."}
        </div>
      ) : (
        <ul className="space-y-3">
          {companies.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-white">{c.name}</div>
                  <div className="mt-1 grid gap-1 text-xs text-neutral-400 sm:grid-cols-2">
                    <span><strong className="text-neutral-300">Email:</strong> {c.email}</span>
                    {c.phone && <span><strong className="text-neutral-300">Phone:</strong> {c.phone}</span>}
                    {(c.city || c.state) && (
                      <span><strong className="text-neutral-300">Location:</strong> {[c.city, c.state].filter(Boolean).join(", ")}</span>
                    )}
                    <span><strong className="text-neutral-300">Joined:</strong> {c.createdAt.toISOString().slice(0, 10)}</span>
                    <span><strong className="text-neutral-300">DNR entries:</strong> {c._count.entries}</span>
                    <span><strong className="text-neutral-300">Broker reviews:</strong> {c._count.brokerReviews}</span>
                  </div>
                  {c.verifiedAt && (
                    <div className="mt-2 text-[11px] text-emerald-300">
                      Verified {c.verifiedAt.toISOString().slice(0, 10)}
                      {c.verificationNote && <span className="ml-1 text-neutral-400">· {c.verificationNote}</span>}
                    </div>
                  )}
                  {c.rejectedAt && c.rejectionReason && (
                    <div className="mt-2 text-[11px] text-red-300">
                      Rejected {c.rejectedAt.toISOString().slice(0, 10)} · {c.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {tab === "pending" && (
                    <details className="rounded-md">
                      <summary className="btn-primary cursor-pointer">Review</summary>
                      <div className="mt-3 space-y-2 rounded border border-ink-700 bg-ink-900/60 p-3 text-xs">
                        <form action={approveCompany} className="space-y-2">
                          <input type="hidden" name="companyId" value={c.id} />
                          <input
                            name="note"
                            className="input text-xs"
                            placeholder="Optional: how you verified them (phone call, business doc, etc.)"
                          />
                          <button type="submit" className="btn-primary w-full justify-center">✓ Approve</button>
                        </form>
                        <form action={rejectCompany} className="space-y-2 border-t border-ink-800 pt-2">
                          <input type="hidden" name="companyId" value={c.id} />
                          <input
                            name="reason"
                            className="input text-xs"
                            placeholder="Reason for rejection"
                            required
                          />
                          <button type="submit" className="btn-ghost w-full justify-center text-red-300 border-red-500/30 hover:border-red-500/50">
                            ✗ Reject
                          </button>
                        </form>
                      </div>
                    </details>
                  )}
                  {tab === "verified" && (
                    <form action={unverifyCompany}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <button type="submit" className="btn-ghost text-amber-300 border-amber-500/30 hover:border-amber-500/50">
                        Revoke
                      </button>
                    </form>
                  )}
                  {tab === "rejected" && (
                    <form action={approveCompany}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <button type="submit" className="btn-primary">Reconsider — Approve</button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabLink({ tab, current, count }: { tab: string; current: string; count: number }) {
  const labels: Record<string, string> = { pending: "Pending", verified: "Verified", rejected: "Rejected" };
  const active = tab === current;
  return (
    <Link
      href={`/dashboard/admin/verifications?tab=${tab}`}
      className={`rounded-lg border px-4 py-2 text-sm transition ${
        active
          ? "border-accent bg-accent/10 text-red-300"
          : "border-ink-700 bg-ink-900/60 text-neutral-300 hover:bg-ink-800"
      }`}
    >
      {labels[tab]}
      <span className="ml-2 text-xs opacity-70">{count}</span>
    </Link>
  );
}
