import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { searchBrokers } from "@/lib/brokers";
import { BrokerSearchInput } from "./BrokerSearchInput";
import { Suspense } from "react";

export default async function BrokersPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/brokers");

  const q = (searchParams.q || "").trim();
  const brokers = await searchBrokers(q, 60);

  return (
    <div className="space-y-6 fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
            Broker Registry
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Search brokers</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Operators reviewing brokers + agents who source customers. Search by name, email, IG handle, or city.
          </p>
        </div>
        <Link href="/brokers/new" className="btn-primary">+ Add broker</Link>
      </header>

      <Suspense>
        <BrokerSearchInput initial={q} />
      </Suspense>

      {brokers.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-400">
          {q ? <>No brokers found for <span className="text-neutral-200">"{q}"</span>. <Link href="/brokers/new" className="text-accent underline">Add a new broker?</Link></> : (
            <>No brokers in the registry yet. <Link href="/brokers/new" className="text-accent underline">Add the first one</Link>.</>
          )}
        </div>
      ) : (
        <div className="grid gap-3 stagger md:grid-cols-2">
          {brokers.map((b) => <BrokerCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}

function BrokerCard({ b }: { b: any }) {
  return (
    <Link href={`/brokers/${b.slug}`} className="card-hover block p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-white">{b.name}</h3>
          {(b.city || b.state) && (
            <p className="text-xs text-neutral-500">{[b.city, b.state].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <RatingBadge avg={b.avgRating} count={b.reviewCount} />
      </div>
      {b.description && (
        <p className="mt-3 line-clamp-2 text-sm text-neutral-400">{b.description}</p>
      )}
    </Link>
  );
}

function RatingBadge({ avg, count }: { avg: number | null; count: number }) {
  if (count === 0) return <span className="tag opacity-60">No reviews</span>;
  const cls =
    avg! >= 4 ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : avg! >= 3 ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : "bg-red-500/15 text-red-300 ring-red-500/30";
  return (
    <div className={`shrink-0 rounded-md border ${cls.replace(/text-\w+-\d+/, "")} px-2 py-1 ring-1 ring-inset ${cls}`}>
      <div className="flex items-center gap-1 text-sm font-semibold">
        <span>★</span>
        <span>{avg!.toFixed(1)}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{count} review{count === 1 ? "" : "s"}</div>
    </div>
  );
}
