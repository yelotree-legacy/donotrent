import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SeverityPill, StatusPill } from "@/components/Pill";
import { Lightbox } from "@/components/Lightbox";
import { requireCompany } from "@/lib/auth";
import { crossCheck } from "@/lib/cross-check";

export default async function EntryPage({ params }: { params: { id: string } }) {
  const me = await requireCompany();
  const entry = await prisma.dnrEntry.findUnique({
    where: { id: params.id },
    include: {
      categories: { include: { category: true } },
      photos: { orderBy: { createdAt: "asc" } },
      reasons: { orderBy: { createdAt: "asc" } },
      reports: { include: { reportingCo: { select: { id: true, name: true, slug: true, city: true, state: true } } } },
      createdBy: { select: { id: true, name: true, slug: true, city: true, state: true } },
    },
  });

  if (!entry) return notFound();

  const aliases: string[] = entry.aliases ? JSON.parse(entry.aliases) : [];
  const heroPhoto = entry.photos[0];

  // Cross-source: who else has this person?
  const xc = await crossCheck({
    licenseId: entry.licenseId || undefined,
    fullName: entry.fullName,
    dateOfBirth: entry.dateOfBirth?.toISOString().slice(0, 10),
  });
  const otherHits = xc.hits.filter((h) => h.id !== entry.id);
  const otherSources = xc.sources.filter((s) => s.hits > 0 && s.entryIds.some((id) => id !== entry.id));

  return (
    <article className="space-y-6 fade-in">
      <Link href="/" className="btn-link inline-flex items-center gap-1">
        <span className="text-base leading-none">←</span> Back to search
      </Link>

      {/* HERO */}
      <header className="card overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_1.4fr]">
          <HeroPhoto photo={heroPhoto} fullName={entry.fullName} />
          <div className="flex flex-col justify-between gap-5 p-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityPill severity={entry.severity} />
                <StatusPill status={entry.status} />
                {entry.categories.slice(0, 4).map((ec) => (
                  <span key={ec.categoryId} className="tag">{ec.category.label}</span>
                ))}
                {entry.categories.length > 4 && (
                  <span className="tag">+{entry.categories.length - 4}</span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{entry.fullName}</h1>
                {aliases.length > 0 && (
                  <p className="mt-2 text-sm text-neutral-400">
                    Also known as: {aliases.map((a, i) => (
                      <em key={i} className="not-italic text-neutral-300">{i > 0 ? ", " : ""}{a}</em>
                    ))}
                  </p>
                )}
              </div>
              <p className="text-base text-neutral-300">{entry.primaryReason}</p>
            </div>

            <KeyFacts entry={entry} />

            {me && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {(me.id === entry.createdById || me.isAdmin) && (
                  <Link className="btn-ghost" href={`/dashboard/edit/${entry.id}`}>Edit entry</Link>
                )}
                <Link className="btn-primary" href={`/entry/${entry.id}/report`}>+ Add report</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="space-y-6 md:col-span-2">
          {entry.detailedNotes && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">OCR & notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{entry.detailedNotes}</p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Reported incidents
            </h2>
            <ol className="mt-4 space-y-3">
              {entry.reasons.map((r, i) => (
                <li key={r.id} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 grid size-4 place-items-center rounded-full bg-accent/20 ring-2 ring-accent/40 text-[10px] font-bold text-red-300">
                    {i + 1}
                  </span>
                  <p className="text-sm text-white">{r.text}</p>
                  {r.amount != null && r.amount > 0 && (
                    <p className="mt-0.5 text-xs text-neutral-400">Damages: ${r.amount.toLocaleString()}</p>
                  )}
                  {r.occurredAt && (
                    <p className="text-xs text-neutral-500">{r.occurredAt.toISOString().slice(0, 10)}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {entry.reports.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Corroborated by {entry.reports.length} other compan{entry.reports.length === 1 ? "y" : "ies"}
              </h2>
              <ul className="mt-3 space-y-3">
                {entry.reports.map((r) => (
                  <li key={r.id} className="rounded-lg border border-ink-700 bg-ink-800/40 p-3">
                    <div className="text-sm font-medium text-white">{r.reportingCo.name}</div>
                    <div className="text-xs text-neutral-500">
                      {[r.reportingCo.city, r.reportingCo.state].filter(Boolean).join(", ")}
                      {" · "}{r.createdAt.toISOString().slice(0, 10)}
                    </div>
                    <p className="mt-2 text-sm text-neutral-300">{r.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {otherHits.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Also flagged across {otherSources.length} other source{otherSources.length === 1 ? "" : "s"}
              </h2>
              <ul className="mt-3 space-y-2">
                {otherHits.map((h) => (
                  <li key={h.id}>
                    <Link href={`/entry/${h.id}`} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800/30 p-3 transition hover:bg-ink-800/60">
                      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                        {h.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{h.fullName}</div>
                        <div className="truncate text-xs text-neutral-500">{h.primaryReason}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        {h.source && <div className="text-neutral-300">{h.source.name}</div>}
                        <div className="text-neutral-500">
                          {h.matchedOn.includes("license") ? "license · " : ""}
                          {h.matchedOn.includes("name") ? "name" : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          {entry.photos.length > 1 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Documents · {entry.photos.length}
              </h2>
              <Lightbox photos={entry.photos} />
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Run a Rent Report</h2>
            <p className="text-xs text-neutral-400">
              See this person's full cross-source verdict, risk score, and evidence trail.
            </p>
            <Link
              href={`/check?${new URLSearchParams({
                ...(entry.licenseId ? { license: entry.licenseId } : {}),
                name: entry.fullName,
                ...(entry.dateOfBirth ? { dob: entry.dateOfBirth.toISOString().slice(0, 10) } : {}),
              }).toString()}`}
              className="btn-primary mt-3 w-full justify-center"
            >
              Run cross-check →
            </Link>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Source</h2>
            {entry.createdBy ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium text-white">{entry.createdBy.name}</div>
                {(entry.createdBy.city || entry.createdBy.state) && (
                  <div className="text-xs text-neutral-500">
                    {[entry.createdBy.city, entry.createdBy.state].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-neutral-500 italic">Unknown</p>}
            <p className="mt-3 border-t border-ink-800 pt-3 text-xs text-neutral-500">
              Added {entry.createdAt.toISOString().slice(0, 10)}
              {entry.sourceUrl && <> · <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">External</a></>}
            </p>
          </div>

          <div className="card border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="mb-1 text-sm font-semibold text-amber-200">On this list by mistake?</h2>
            <p className="text-xs text-amber-100/70">
              File a dispute and the listing company will be notified.
            </p>
            <Link href={`/dispute?entry=${entry.id}`} className="btn-ghost mt-3 w-full justify-center border-amber-500/30 hover:border-amber-500/50">
              File a dispute
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

function HeroPhoto({
  photo,
  fullName,
}: {
  photo?: { url: string; kind: string };
  fullName: string;
}) {
  if (!photo) {
    return (
      <div className="grid place-items-center bg-gradient-to-br from-ink-800 to-ink-900 p-12 text-center min-h-[260px]">
        <div>
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-ink-800 ring-1 ring-ink-700">
            <span className="text-2xl font-bold text-neutral-400">
              {fullName.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-xs uppercase tracking-wider text-neutral-500">No license photo</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative bg-ink-950 min-h-[260px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={`License of ${fullName}`}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 to-transparent p-3">
        <span className="rounded bg-ink-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur">
          {photo.kind.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

function KeyFacts({ entry }: { entry: any }) {
  const facts: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "License ID", value: entry.licenseId || <em className="text-neutral-500 not-italic">pending</em>, mono: true },
    { label: "State", value: entry.licenseState || <em className="text-neutral-500 not-italic">—</em> },
    { label: "DOB", value: entry.dateOfBirth?.toISOString().slice(0, 10) || <em className="text-neutral-500 not-italic">—</em> },
    { label: "Damages", value: entry.damageAmount ? `$${entry.damageAmount.toLocaleString()}` : <em className="text-neutral-500 not-italic">—</em> },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-ink-700 bg-ink-950/50 p-4 sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{f.label}</dt>
          <dd className={`mt-1 text-sm text-white ${f.mono ? "font-mono" : ""}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
