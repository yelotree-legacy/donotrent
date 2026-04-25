import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function BrowsePage({ searchParams }: { searchParams: { letter?: string } }) {
  const letter = (searchParams.letter || "").toLowerCase().slice(0, 1);

  const where = letter ? { fullNameNorm: { startsWith: letter } } : {};
  const [entries, lettersRaw] = await Promise.all([
    prisma.dnrEntry.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: letter ? 500 : 0,
      select: { id: true, fullName: true, primaryReason: true, severity: true, status: true, licenseId: true },
    }),
    prisma.dnrEntry.findMany({
      select: { fullNameNorm: true },
      orderBy: { fullNameNorm: "asc" },
    }),
  ]);

  const letters = Array.from(new Set(lettersRaw.map((e) => e.fullNameNorm[0]?.toLowerCase()).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Browse alphabetically</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a letter to list everyone whose normalized name starts with it.
        </p>
      </header>

      <div className="flex flex-wrap gap-1">
        {"abcdefghijklmnopqrstuvwxyz".split("").map((l) => {
          const active = letter === l;
          const present = letters.includes(l);
          return (
            <Link
              key={l}
              href={present ? `/browse?letter=${l}` : "#"}
              className={`grid size-9 place-items-center rounded text-sm font-semibold uppercase ${
                active
                  ? "bg-accent text-white"
                  : present
                    ? "bg-ink-900 text-neutral-200 hover:bg-ink-800"
                    : "bg-ink-950 text-neutral-700 pointer-events-none"
              }`}
            >
              {l}
            </Link>
          );
        })}
      </div>

      {!letter ? (
        <div className="card p-6 text-sm text-neutral-400">Select a letter above to begin browsing.</div>
      ) : entries.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-400">No entries for that letter.</div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {entries.map((e) => (
            <Link key={e.id} href={`/entry/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-800/50">
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{e.fullName}</div>
                <div className="truncate text-xs text-neutral-400">{e.primaryReason}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                {e.licenseId ? <span className="font-mono">{e.licenseId}</span> : <span className="tag">no license</span>}
                <span className={
                  e.severity === "CRITICAL" ? "pill-critical"
                    : e.severity === "HIGH" ? "pill-high"
                      : e.severity === "MEDIUM" ? "pill-medium" : "pill-low"
                }>{e.severity}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
