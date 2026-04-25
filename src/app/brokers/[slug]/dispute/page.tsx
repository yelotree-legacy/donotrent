import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimitStrict, getClientIp, Limits } from "@/lib/rate-limit";

async function fileBrokerDispute(formData: FormData) {
  "use server";
  const brokerId = String(formData.get("brokerId") || "");
  const reviewId = (String(formData.get("reviewId") || "")) || null;
  const filerName = String(formData.get("filerName") || "").trim();
  const filerContact = String(formData.get("filerContact") || "").trim();
  const filerRole = String(formData.get("filerRole") || "").trim() || null;
  const reason = String(formData.get("reason") || "").trim();

  const ip = getClientIp();
  const rl = await rateLimitStrict({ key: `broker_dispute:${ip}`, ...Limits.disputeByIp });
  if (!rl.ok) {
    const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { slug: true } });
    if (broker) redirect(`/brokers/${broker.slug}/dispute?err=ratelimit`);
    redirect("/brokers");
  }

  if (!brokerId || !filerName || !filerContact || reason.length < 20) {
    redirect(`/brokers/dispute-form?id=${brokerId}&err=invalid`);
  }
  const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { id: true, slug: true } });
  if (!broker) redirect("/brokers");

  await prisma.brokerDispute.create({
    data: { brokerId, reviewId, filerName, filerContact, filerRole, reason },
  });
  await prisma.broker.update({ where: { id: brokerId }, data: { status: "DISPUTED" } });
  await logAudit("broker_dispute.create", brokerId, { filerName, hasReview: !!reviewId });
  redirect(`/brokers/${broker.slug}/dispute/filed`);
}

export default async function BrokerDisputePage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { reviewId?: string; err?: string };
}) {
  const broker = await prisma.broker.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true, name: true },
  });
  if (!broker) return notFound();

  let review = null;
  if (searchParams.reviewId) {
    review = await prisma.brokerReview.findFirst({
      where: { id: searchParams.reviewId, brokerId: broker.id },
      select: { id: true, title: true, rating: true, body: true },
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 fade-in">
      <Link href={`/brokers/${broker.slug}`} className="btn-link">← Back to {broker.name}</Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Dispute a listing</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Disputing the {review ? "review" : "listing"} for <span className="text-white font-medium">{broker.name}</span>.
          Submit a rebuttal — the listing operator will be notified and the broker's status flips to DISPUTED while it's reviewed.
        </p>
      </header>

      {review && (
        <div className="card p-4 text-sm">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Disputed review</div>
          <div className="font-medium text-white">{"★".repeat(review.rating)} {review.title}</div>
          <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{review.body}</p>
        </div>
      )}

      {searchParams.err === "invalid" && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Please complete the form (rebuttal must be at least 20 characters).
        </div>
      )}
      {searchParams.err === "ratelimit" && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Too many disputes filed from your network today. Try again tomorrow.
        </div>
      )}

      <form action={fileBrokerDispute} className="card p-6 space-y-4">
        <input type="hidden" name="brokerId" value={broker.id} />
        {review && <input type="hidden" name="reviewId" value={review.id} />}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Your name *</label>
            <input name="filerName" className="input" required placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label">Email or phone *</label>
            <input name="filerContact" className="input" required placeholder="jane@example.com" />
          </div>
        </div>
        <div>
          <label className="label">Your role</label>
          <select name="filerRole" className="input" defaultValue="">
            <option value="">— select —</option>
            <option value="broker">I am the broker</option>
            <option value="associate">I represent the broker</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">What's wrong with this listing? *</label>
          <textarea
            name="reason"
            className="input min-h-[140px]"
            required
            minLength={20}
            placeholder="Explain in detail why this listing or review is inaccurate. Include any evidence (dates, transactions, communications)."
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/brokers/${broker.slug}`} className="btn-link">Cancel</Link>
          <button type="submit" className="btn-primary">Submit dispute</button>
        </div>
      </form>

      <p className="text-center text-xs text-neutral-500">
        Disputes are reviewed by network admins. Frivolous disputes will be rejected; valid ones may result in review removal or a "RESOLVED" status on the broker page.
      </p>
    </div>
  );
}
