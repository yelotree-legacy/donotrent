import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SeverityPill } from "@/components/Pill";
import { requireCompany } from "@/lib/auth";

export default async function BrowsePage({ searchParams }: { searchParams: { letter?: string } }) {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/browse");
  const letter = (searchParams.letter || "").toLowerCase().slice(0, 1);

  const where = letter ? { fullNameNorm: { startsWith: letter } } : {};
  const [entries, lettersRaw, totalEntries] = await Promise.all([
    letter ? prisma.dnrEntry.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 500,
      select: {
        id: true, fullName: true, primaryReason: true, severity: true, status: true,
        licenseId: true, licenseState: true,
        photos: { select: { url: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    }) : [],
    prisma.dnrEntry.findMany({
      select: { fullNameNorm: true },
      orderBy: { fullNameNorm: "asc" },
    }),
    prisma.dnrEntry.count(),
  ]);

  const letterCounts = new Map<string, number>();
  for (const e of lettersRaw) {
    const l = e.fullNameNorm[0]?.toLowerCase();
    if (l) letterCounts.set(l, (letterCounts.get(l) || 0) + 1);
  }

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white">Browse alphabetically</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {totalEntries.toLocaleString()} total entries · pick a letter
        </p>
      </header>

      <div className="card p-3">
        <div className="flex flex-wrap gap-1">
          {"abcdefghijklmnopqrstuvwxyz".split("").map((l) => {
            const active = letter === l;
            const count = letterCounts.get(l) || 0;
            const present = count > 0;
            return (
              <Link
                key={l}
                href={present ? `/browse?letter=${l}` : "#"}
                className={`relative grid size-10 place-items-center rounded-md text-sm font-semibold uppercase transition-all ${
                  active
                    ? "bg-accent text-white shadow-sm shadow-red-900/40"
                    : present
                      ? "bg-ink-900 text-neutral-200 hover:bg-ink-800 hover:scale-105"
                      : "bg-ink-950 text-neutral-700 pointer-events-none"
                }`}
              >
                {l}
                {present && (
                  <span className={`absolute -top-1 -right-1 grid size-4 place-items-center rounded-full text-[9px] font-bold ${
                    active ? "bg-white text-accent" : "bg-ink-700 text-neutral-300"
                  }`}>
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {!letter ? (
        <div className="card p-8 text-center text-sm text-neutral-400">
          Select a letter above to begin browsing.
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-400">
          No entries for that letter.
        </div>
      ) : (
        <div className="card divide-y divide-ink-800 stagger overflow-hidden">
          {entries.map((e) => (
            <Link
              key={e.id}
              href={`/entry/${e.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/40"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                {e.photos[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photos[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-semibold text-neutral-400">
                    {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-white">{e.fullName}</div>
                <div className="truncate text-xs text-neutral-400">{e.primaryReason}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {e.licenseId ? (
                  <span className="font-mono tag">
                    {e.licenseState ? `${e.licenseState}·` : ""}{e.licenseId}
                  </span>
                ) : (
                  <span className="tag opacity-50">no license</span>
                )}
                <SeverityPill severity={e.severity} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
