import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { EXPERIENCE_TYPES, recomputeBrokerAggregates } from "@/lib/brokers";
import { logAudit } from "@/lib/audit";
import { DeleteReviewButton } from "./DeleteReviewButton";

async function updateReview(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login");
  const id = String(formData.get("id") || "");
  const review = await prisma.brokerReview.findUnique({
    where: { id },
    select: { id: true, brokerId: true, reviewerCompanyId: true },
  });
  if (!review) redirect("/dashboard/broker-reviews");
  if (review.reviewerCompanyId !== me.id) redirect("/dashboard/broker-reviews");

  const rating = Math.min(5, Math.max(1, parseInt(String(formData.get("rating") || "3"), 10) || 3));
  const experienceType = String(formData.get("experienceType") || "") || null;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const incidentDateRaw = String(formData.get("incidentDate") || "").trim();
  const damageRaw = String(formData.get("damageAmount") || "").trim();
  const resolved = formData.get("resolved") === "on";

  if (!title || !body) redirect(`/dashboard/broker-reviews/${id}/edit?err=fields`);

  await prisma.brokerReview.update({
    where: { id },
    data: {
      rating,
      experienceType,
      title,
      body,
      incidentDate: incidentDateRaw ? new Date(incidentDateRaw) : null,
      damageAmount: damageRaw ? parseFloat(damageRaw) : null,
      resolved,
    },
  });
  await recomputeBrokerAggregates(review.brokerId);
  await logAudit("broker_review.update", id);
  redirect("/dashboard/broker-reviews");
}

async function deleteReview(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login");
  const id = String(formData.get("id") || "");
  const review = await prisma.brokerReview.findUnique({
    where: { id },
    select: { id: true, brokerId: true, reviewerCompanyId: true },
  });
  if (!review || review.reviewerCompanyId !== me.id) redirect("/dashboard/broker-reviews");
  await prisma.brokerReview.delete({ where: { id } });
  await recomputeBrokerAggregates(review.brokerId);
  await logAudit("broker_review.delete", id);
  redirect("/dashboard/broker-reviews");
}

export default async function EditBrokerReviewPage({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: { err?: string };
}) {
  const me = await requireCompany();
  if (!me) redirect("/login");

  const review = await prisma.brokerReview.findUnique({
    where: { id: params.id },
    include: { broker: { select: { slug: true, name: true } } },
  });
  if (!review) return notFound();
  if (review.reviewerCompanyId !== me.id) {
    return (
      <div className="card p-6 text-sm">
        You can only edit reviews you posted.{" "}
        <Link className="underline" href="/dashboard/broker-reviews">Back to your reviews</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <Link href="/dashboard/broker-reviews" className="btn-link">← My reviews</Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Edit review</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Reviewing <Link href={`/brokers/${review.broker.slug}`} className="text-accent hover:underline">{review.broker.name}</Link>
        </p>
      </header>

      {searchParams.err && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Title and details are required.
        </div>
      )}

      <form action={updateReview} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={review.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Rating *</label>
            <select name="rating" className="input" required defaultValue={String(review.rating)}>
              <option value="5">★★★★★ — Excellent</option>
              <option value="4">★★★★☆ — Good</option>
              <option value="3">★★★☆☆ — Mixed</option>
              <option value="2">★★☆☆☆ — Poor</option>
              <option value="1">★☆☆☆☆ — Avoid</option>
            </select>
          </div>
          <div>
            <label className="label">Experience type</label>
            <select name="experienceType" className="input" defaultValue={review.experienceType || ""}>
              <option value="">— select —</option>
              {EXPERIENCE_TYPES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Headline *</label>
          <input name="title" className="input" required defaultValue={review.title} />
        </div>
        <div>
          <label className="label">Details *</label>
          <textarea name="body" className="input min-h-[160px]" required defaultValue={review.body} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Incident date</label>
            <input
              name="incidentDate" type="date" className="input"
              defaultValue={review.incidentDate?.toISOString().slice(0, 10) || ""}
            />
          </div>
          <div>
            <label className="label">Damages ($)</label>
            <input
              name="damageAmount" type="number" min="0" step="0.01" className="input"
              defaultValue={review.damageAmount ?? ""}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="resolved" defaultChecked={review.resolved} className="accent-accent" />
          Mark as resolved (issue was addressed)
        </label>
        <div className="flex items-center justify-between gap-3 pt-2">
          <DeleteReviewButton reviewId={review.id} action={deleteReview} />
          <div className="flex items-center gap-3">
            <Link href="/dashboard/broker-reviews" className="btn-link">Cancel</Link>
            <button type="submit" className="btn-primary">Save changes</button>
          </div>
        </div>
      </form>
    </div>
  );
}
