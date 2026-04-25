import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { EXPERIENCE_TYPES } from "@/lib/brokers";

export default async function MyBrokerReviewsPage() {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/dashboard/broker-reviews");

  const reviews = await prisma.brokerReview.findMany({
    where: { reviewerCompanyId: me.id },
    orderBy: { createdAt: "desc" },
    include: { broker: { select: { id: true, slug: true, name: true } } },
  });

  return (
    <div className="space-y-5 fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My broker reviews</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {reviews.length === 0
              ? "You haven't reviewed any brokers yet."
              : `${reviews.length} review${reviews.length === 1 ? "" : "s"} you've written.`}
          </p>
        </div>
        <Link href="/brokers" className="btn-primary">+ New review</Link>
      </header>

      {reviews.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-400">No reviews yet.</p>
          <p className="mt-2 text-xs text-neutral-500">
            Rate the agents who source your customers — it helps you and the rest of the network avoid the bad ones.
          </p>
          <Link href="/brokers/new" className="btn-primary mt-3 inline-flex">+ Review a broker</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-ink-800">
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/brokers/${r.broker.slug}`} className="text-base font-semibold text-white hover:underline">
                        {r.broker.name}
                      </Link>
                      <span className={`text-sm font-semibold ${
                        r.rating >= 4 ? "text-emerald-300" : r.rating >= 3 ? "text-amber-300" : "text-red-300"
                      }`}>
                        {"★".repeat(r.rating)}<span className="text-neutral-700">{"★".repeat(5 - r.rating)}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-300">{r.title}</div>
                    {r.experienceType && (
                      <span className="mt-1 inline-block tag">
                        {EXPERIENCE_TYPES.find((e) => e.value === r.experienceType)?.label || r.experienceType}
                      </span>
                    )}
                    <p className="mt-2 line-clamp-2 text-xs text-neutral-400">{r.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                      <span>Posted {r.createdAt.toISOString().slice(0, 10)}</span>
                      {r.updatedAt.getTime() !== r.createdAt.getTime() && (
                        <span>· Edited {r.updatedAt.toISOString().slice(0, 10)}</span>
                      )}
                      {r.damageAmount != null && r.damageAmount > 0 && <span>· ${r.damageAmount.toLocaleString()} damages</span>}
                      {r.resolved && <span className="text-emerald-300">· Resolved</span>}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/broker-reviews/${r.id}/edit`}
                    className="btn-ghost shrink-0"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
