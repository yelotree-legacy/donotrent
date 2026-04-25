import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany, isVerified } from "@/lib/auth";
import { recomputeBrokerAggregates, EXPERIENCE_TYPES } from "@/lib/brokers";
import { logAudit } from "@/lib/audit";

async function createReview(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login");
  if (!isVerified(me)) redirect("/brokers?err=unverified");
  const brokerId = String(formData.get("brokerId") || "");
  const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { id: true, slug: true } });
  if (!broker) redirect("/brokers");

  const rating = Math.min(5, Math.max(1, parseInt(String(formData.get("rating") || "3"), 10) || 3));
  const experienceType = String(formData.get("experienceType") || "") || null;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const incidentDateRaw = String(formData.get("incidentDate") || "").trim();
  const damageRaw = String(formData.get("damageAmount") || "").trim();
  if (!title || !body) redirect(`/brokers/${broker.slug}/review?err=fields`);

  await prisma.brokerReview.create({
    data: {
      brokerId: broker.id,
      reviewerCompanyId: me.id,
      rating,
      experienceType,
      title,
      body,
      incidentDate: incidentDateRaw ? new Date(incidentDateRaw) : null,
      damageAmount: damageRaw ? parseFloat(damageRaw) : null,
    },
  });
  await recomputeBrokerAggregates(broker.id);
  await logAudit("broker.review", broker.id);

  redirect(`/brokers/${broker.slug}`);
}

export default async function NewReviewPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { err?: string };
}) {
  const me = await requireCompany();
  if (!me) redirect(`/login?next=/brokers/${params.slug}/review`);
  const broker = await prisma.broker.findUnique({ where: { slug: params.slug }, select: { id: true, slug: true, name: true } });
  if (!broker) return notFound();

  if (!isVerified(me)) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="card border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <h1 className="text-xl font-bold text-amber-200">Pending verification</h1>
          <p className="mt-2 text-sm text-amber-100/80">
            Your account needs admin approval before you can post broker reviews.
          </p>
          <Link href={`/brokers/${broker.slug}`} className="btn-ghost mt-4 inline-flex">Back to {broker.name}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 fade-in">
      <Link href={`/brokers/${broker.slug}`} className="btn-link">← Back to {broker.name}</Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Review {broker.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Share your experience so other operators can decide whether to work with this broker.
        </p>
      </header>

      {searchParams.err && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Title and details are required.
        </div>
      )}

      <form action={createReview} className="card p-6 space-y-4">
        <input type="hidden" name="brokerId" value={broker.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Rating *</label>
            <select name="rating" className="input" required defaultValue="3">
              <option value="5">★★★★★ — Excellent</option>
              <option value="4">★★★★☆ — Good</option>
              <option value="3">★★★☆☆ — Mixed</option>
              <option value="2">★★☆☆☆ — Poor</option>
              <option value="1">★☆☆☆☆ — Avoid</option>
            </select>
          </div>
          <div>
            <label className="label">Experience type</label>
            <select name="experienceType" className="input" defaultValue="">
              <option value="">— select —</option>
              {EXPERIENCE_TYPES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Headline *</label>
          <input name="title" className="input" required placeholder="One-line summary" />
        </div>
        <div>
          <label className="label">Details *</label>
          <textarea name="body" className="input min-h-[160px]" required placeholder="What happened? What should other operators know?" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Incident date</label>
            <input name="incidentDate" type="date" className="input" />
          </div>
          <div>
            <label className="label">Damages ($)</label>
            <input name="damageAmount" type="number" min="0" step="0.01" className="input" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/brokers/${broker.slug}`} className="btn-link">Cancel</Link>
          <button type="submit" className="btn-primary">Post review</button>
        </div>
      </form>
    </div>
  );
}
