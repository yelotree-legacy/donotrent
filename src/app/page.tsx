import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { searchEntries } from "@/lib/search";
import { LiveSearch } from "@/components/LiveSearch";
import { Filters } from "@/components/Filters";
import { EntryCard } from "@/components/EntryCard";
import { logSearch } from "@/lib/audit";

type SP = {
  q?: string;
  field?: string;
  cat?: string | string[];
  severity?: string | string[];
  status?: string | string[];
  state?: string;
};

function asArray(v?: string | string[]) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function HomePage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q || "").trim();
  const field = (searchParams.field as any) || "any";
  const cats = asArray(searchParams.cat);
  const severity = asArray(searchParams.severity);
  const status = asArray(searchParams.status);

  const [{ hits, total }, categories, totalCount, withLicenseCount, criticalCount] = await Promise.all([
    searchEntries({ query: q, field, categories: cats, severity, status, limit: 50 }),
    prisma.category.findMany({
      orderBy: { label: "asc" },
      include: { _count: { select: { entries: true } } },
    }),
    prisma.dnrEntry.count(),
    prisma.dnrEntry.count({ where: { licenseId: { not: null } } }),
    prisma.dnrEntry.count({ where: { severity: "CRITICAL" } }),
  ]);

  if (q) await logSearch(q, field, hits.length);

  const isSearching = Boolean(q || cats.length || severity.length || status.length);

  return (
    <div className="space-y-10">
      <Hero
        totalCount={totalCount}
        withLicenseCount={withLicenseCount}
        criticalCount={criticalCount}
        categoryCount={categories.length}
        q={q}
        field={field}
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card sticky top-20 self-start p-4 max-md:static">
          <h2 className="mb-3 text-sm font-semibold text-white">Filters</h2>
          <Suspense>
            <Filters
              categories={categories.map((c) => ({ slug: c.slug, label: c.label, count: c._count.entries }))}
              selectedCategories={cats}
              selectedSeverity={severity}
              selectedStatus={status}
            />
          </Suspense>
        </aside>

        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">
              {q ? <>Results for <span className="text-accent">"{q}"</span></> : isSearching ? "Filtered entries" : "All entries"}
            </h2>
            <span className="text-sm text-neutral-500">
              {total.toLocaleString()} {total === 1 ? "match" : "matches"}
            </span>
          </div>

          {hits.length === 0 ? (
            <EmptyState query={q} hasFilters={isSearching} />
          ) : (
            <div className="grid gap-3 stagger">
              {hits.map((h) => <EntryCard key={h.id} hit={h} query={q} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Hero({
  totalCount, withLicenseCount, criticalCount, categoryCount, q, field,
}: { totalCount: number; withLicenseCount: number; criticalCount: number; categoryCount: number; q: string; field: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink-700/80 bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-red-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-blue-500/5 blur-3xl" />

      <div className="relative max-w-3xl space-y-3 fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-red-300">
          <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
          Live registry · cross-company
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
          Search the Do Not Rent list.
        </h1>
        <p className="text-base text-neutral-400 md:text-lg">
          Vehicle rental operators sharing one searchable database of flagged renters.
          Search by full name <em>or</em> license ID — exact, prefix, alias, and fuzzy matches included.
        </p>
      </div>

      <div className="relative mt-6">
        <Suspense>
          <LiveSearch initial={q} initialField={field} />
        </Suspense>
      </div>

      <div className="relative mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span>Try:</span>
        {["Tyler Treasure", "Brown", "Williams", "F5362380", "Y8932441"].map((ex) => (
          <a
            key={ex}
            href={`/?q=${encodeURIComponent(ex)}`}
            className="rounded-md bg-ink-800/60 px-2 py-1 text-neutral-300 transition hover:bg-ink-700"
          >
            {ex}
          </a>
        ))}
      </div>

      <div className="relative mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total entries" value={totalCount} accent />
        <Stat label="Verified license IDs" value={withLicenseCount} />
        <Stat label="Critical severity" value={criticalCount} />
        <Stat label="Violation categories" value={categoryCount} />
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border ${accent ? "border-red-500/30 bg-red-500/5" : "border-ink-700 bg-ink-900/60"} px-4 py-3`}>
      <div className={`text-2xl font-bold ${accent ? "text-red-300" : "text-white"} md:text-3xl`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function EmptyState({ query, hasFilters }: { query: string; hasFilters: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-8 py-12 text-center fade-in">
      <div className="grid size-12 place-items-center rounded-full bg-ink-800 ring-1 ring-ink-700">
        <svg className="size-5 text-neutral-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="9" r="6" />
          <path d="m17 17-3.5-3.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="text-base font-semibold text-white">No matches</p>
        <p className="mt-1 text-sm text-neutral-400">
          {query
            ? <>Nothing matches <span className="font-mono text-neutral-300">"{query}"</span>. Try a partial last name, a license ID, or relax filters.</>
            : "Try removing some filters or searching by name or license ID."}
        </p>
      </div>
      {hasFilters && (
        <a href="/" className="btn-link">Clear all filters</a>
      )}
    </div>
  );
}
