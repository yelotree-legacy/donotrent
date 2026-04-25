import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { searchEntries } from "@/lib/search";
import { SearchBar } from "@/components/SearchBar";
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

  const [{ hits, total }, categories, totalCount] = await Promise.all([
    searchEntries({ query: q, field, categories: cats, severity, status, limit: 50 }),
    prisma.category.findMany({
      orderBy: { label: "asc" },
      include: { _count: { select: { entries: true } } },
    }),
    prisma.dnrEntry.count(),
  ]);

  if (q) await logSearch(q, field, hits.length);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-ink-700 bg-gradient-to-br from-ink-900 to-ink-950 p-6 md:p-8">
        <div className="max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">DNR Registry</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Search the Do Not Rent list.
          </h1>
          <p className="mt-2 text-neutral-400">
            Cross-company database of {totalCount.toLocaleString()} flagged renters. Search by full name <em>or</em> license
            ID — exact, prefix, and fuzzy matches included.
          </p>
        </div>
        <div className="mt-6">
          <Suspense>
            <SearchBar initial={q} initialField={field} />
          </Suspense>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
          <span>Try:</span>
          {["Tyler Treasure", "Brown", "Williams", "Smith"].map((ex) => (
            <a key={ex} href={`/?q=${encodeURIComponent(ex)}`} className="rounded bg-ink-800 px-2 py-0.5 text-neutral-300 hover:bg-ink-700">
              {ex}
            </a>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card sticky top-20 self-start p-4">
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
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              {q ? <>Results for <span className="text-accent">"{q}"</span></> : "All entries"}
            </h2>
            <span className="text-sm text-neutral-500">
              {total.toLocaleString()} match{total === 1 ? "" : "es"}
            </span>
          </div>

          {hits.length === 0 ? (
            <div className="card p-8 text-center text-neutral-400">
              <p className="text-base text-white">No matches.</p>
              <p className="mt-1 text-sm">
                Try a partial last name, a license ID, or relax filters. Fuzzy matching tolerates 1-2 letter misspellings.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {hits.map((h) => <EntryCard key={h.id} hit={h} query={q} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
