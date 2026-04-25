import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { EXPERIENCE_TYPES } from "@/lib/brokers";

export default async function BrokerDetailPage({ params }: { params: { slug: string } }) {
  const me = await requireCompany();
  if (!me) redirect(`/login?next=/brokers/${params.slug}`);

  const broker = await prisma.broker.findUnique({
    where: { slug: params.slug },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { reviewerCompany: { select: { id: true, name: true, city: true, state: true } } },
      },
      disputes: {
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
        select: { id: true, status: true },
      },
    },
  });
  if (!broker) return notFound();
  const openDisputes = broker.disputes.length;

  const aliases: string[] = broker.aliases ? JSON.parse(broker.aliases) : [];

  // Rating distribution
  const dist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: broker.reviews.filter((r) => r.rating === stars).length,
  }));
  const max = Math.max(1, ...dist.map((d) => d.count));

  return (
    <article className="space-y-6 fade-in">
      <Link href="/brokers" className="btn-link">← All brokers</Link>

      {openDisputes > 0 && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <strong>{openDisputes} open dispute{openDisputes === 1 ? "" : "s"}.</strong> The broker (or someone representing them) has challenged this listing. Network admins are reviewing.
        </div>
      )}

      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold text-white">{broker.name}</h1>
              {broker.status === "DISPUTED" && (
                <span className="pill bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-500/30">
                  Disputed
                </span>
              )}
              {broker.status === "RESOLVED" && (
                <span className="pill bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                  Resolved
                </span>
              )}
            </div>
            {aliases.length > 0 && (
              <p className="mt-1 text-sm text-neutral-400">a.k.a. {aliases.join(", ")}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
              {broker.city || broker.state ? <span>{[broker.city, broker.state].filter(Boolean).join(", ")}</span> : null}
              {broker.email && <a href={`mailto:${broker.email}`} className="hover:text-white">{broker.email}</a>}
              {broker.phone && <span>{broker.phone}</span>}
              {broker.website && <a href={broker.website} target="_blank" rel="noreferrer" className="hover:text-white">{broker.website}</a>}
              {broker.instagram && <a href={`https://instagram.com/${broker.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="hover:text-white">@{broker.instagram.replace(/^@/, "")}</a>}
            </div>
            {broker.description && <p className="mt-4 max-w-2xl text-sm text-neutral-300">{broker.description}</p>}
          </div>

          <div className="shrink-0 text-right">
            {broker.reviewCount > 0 ? (
              <>
                <div className={`text-4xl font-bold ${getRatingColor(broker.avgRating)}`}>
                  {broker.avgRating?.toFixed(1)}<span className="text-2xl">/5</span>
                </div>
                <div className="text-xs text-neutral-500">
                  {broker.reviewCount} review{broker.reviewCount === 1 ? "" : "s"}
                </div>
              </>
            ) : (
              <span className="text-sm italic text-neutral-500">No reviews yet</span>
            )}
            <Link href={`/brokers/${broker.slug}/review`} className="btn-primary mt-3 inline-flex">+ Add review</Link>
            <div className="mt-2">
              <Link href={`/brokers/${broker.slug}/dispute`} className="text-[11px] text-neutral-500 underline hover:text-amber-300">
                Dispute this listing
              </Link>
            </div>
          </div>
        </div>
      </header>

      {broker.reviewCount > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Rating distribution</h2>
          <div className="mt-4 space-y-1.5">
            {dist.map((d) => (
              <div key={d.stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 shrink-0 text-neutral-400">{d.stars} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                  <div className={`h-full ${d.stars >= 4 ? "bg-emerald-500" : d.stars >= 3 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(d.count / max) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-neutral-500">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Reviews</h2>
        {broker.reviews.length === 0 ? (
          <div className="card p-8 text-center text-sm text-neutral-400">
            No reviews yet. <Link href={`/brokers/${broker.slug}/review`} className="text-accent underline">Be the first</Link>.
          </div>
        ) : (
          <ul className="space-y-3">
            {broker.reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-base font-semibold text-white">{r.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {r.reviewerCompany.name}{r.reviewerCompany.city ? ` · ${r.reviewerCompany.city}` : ""}
                      {r.reviewerCompany.state ? `, ${r.reviewerCompany.state}` : ""}
                      {" · "}{r.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </div>
                  {r.experienceType && (
                    <span className="tag">{EXPERIENCE_TYPES.find((e) => e.value === r.experienceType)?.label || r.experienceType}</span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{r.body}</p>
                {(r.damageAmount || r.incidentDate) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                    {r.damageAmount != null && r.damageAmount > 0 && <span>${r.damageAmount.toLocaleString()} damages</span>}
                    {r.incidentDate && <span>· Incident {r.incidentDate.toISOString().slice(0, 10)}</span>}
                    {r.resolved && <span className="text-emerald-300">· Resolved</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={`text-sm font-semibold ${getRatingColor(rating)}`}>
      {"★".repeat(rating)}<span className="text-neutral-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function getRatingColor(rating: number | null) {
  if (rating == null) return "text-neutral-500";
  if (rating >= 4) return "text-emerald-300";
  if (rating >= 3) return "text-amber-300";
  return "text-red-300";
}
