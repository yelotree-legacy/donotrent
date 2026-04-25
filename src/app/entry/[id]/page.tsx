import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { SeverityPill, StatusPill } from "@/components/Pill";
import { requireCompany } from "@/lib/auth";

export default async function EntryPage({ params }: { params: { id: string } }) {
  const me = await requireCompany();
  const entry = await prisma.dnrEntry.findUnique({
    where: { id: params.id },
    include: {
      categories: { include: { category: true } },
      photos: true,
      reasons: { orderBy: { createdAt: "asc" } },
      reports: { include: { reportingCo: { select: { id: true, name: true, slug: true, city: true, state: true } } } },
      createdBy: { select: { id: true, name: true, slug: true, city: true, state: true } },
    },
  });

  if (!entry) return notFound();

  const aliases: string[] = entry.aliases ? JSON.parse(entry.aliases) : [];

  return (
    <article className="space-y-6">
      <Link href="/" className="btn-link">← Back to search</Link>

      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{entry.fullName}</h1>
            {aliases.length > 0 && (
              <p className="mt-1 text-sm text-neutral-400">
                Also known as: {aliases.map((a, i) => <em key={i}>{i > 0 ? ", " : ""}{a}</em>)}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeverityPill severity={entry.severity} />
              <StatusPill status={entry.status} />
              {entry.categories.map((ec) => (
                <span key={ec.categoryId} className="tag">{ec.category.label}</span>
              ))}
            </div>
          </div>
          {me && (
            <div className="flex items-center gap-2">
              {(me.id === entry.createdById || me.isAdmin) && (
                <Link className="btn-ghost" href={`/dashboard/edit/${entry.id}`}>Edit</Link>
              )}
              <Link className="btn-primary" href={`/entry/${entry.id}/report`}>+ Add report</Link>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-300">Primary reason</h2>
            <p className="mt-1 text-base text-white">{entry.primaryReason}</p>
            {entry.detailedNotes && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-400">{entry.detailedNotes}</p>
            )}
          </div>

          {entry.reasons.length > 1 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-300">All reported incidents</h2>
              <ul className="mt-3 space-y-2">
                {entry.reasons.map((r) => (
                  <li key={r.id} className="rounded border border-ink-700 bg-ink-800/30 p-3">
                    <p className="text-sm text-white">{r.text}</p>
                    {r.amount != null && (
                      <p className="mt-1 text-xs text-neutral-400">Damages: ${r.amount.toLocaleString()}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.reports.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-300">
                Corroborated by {entry.reports.length} other compan{entry.reports.length === 1 ? "y" : "ies"}
              </h2>
              <ul className="mt-3 space-y-3">
                {entry.reports.map((r) => (
                  <li key={r.id} className="rounded border border-ink-700 bg-ink-800/30 p-3">
                    <div className="text-sm text-white">{r.reportingCo.name}</div>
                    <div className="text-xs text-neutral-500">
                      {[r.reportingCo.city, r.reportingCo.state].filter(Boolean).join(", ")}
                    </div>
                    <p className="mt-1 text-sm text-neutral-300">{r.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-300">Identity</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <Row label="License ID">
                {entry.licenseId
                  ? <span className="font-mono">{entry.licenseId}</span>
                  : <span className="text-neutral-500 italic">pending — no ID captured</span>}
              </Row>
              <Row label="State">{entry.licenseState || <em className="text-neutral-500">—</em>}</Row>
              <Row label="DOB">{entry.dateOfBirth?.toISOString().slice(0, 10) || <em className="text-neutral-500">—</em>}</Row>
              <Row label="Damages">{entry.damageAmount != null && entry.damageAmount > 0 ? `$${entry.damageAmount.toLocaleString()}` : <em className="text-neutral-500">—</em>}</Row>
            </dl>
          </div>

          {entry.photos.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-300">Documents & photos</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {entry.photos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" className="block overflow-hidden rounded border border-ink-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || p.kind} className="aspect-[4/3] w-full object-cover" />
                    <div className="bg-ink-800 px-2 py-1 text-[10px] uppercase text-neutral-400">{p.kind}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-300">Source</h2>
            <p className="mt-2 text-sm">
              {entry.createdBy ? (
                <>
                  Added by <span className="font-medium text-white">{entry.createdBy.name}</span>
                  {entry.createdBy.city && <span className="text-neutral-500"> · {entry.createdBy.city}{entry.createdBy.state ? `, ${entry.createdBy.state}` : ""}</span>}
                </>
              ) : <em className="text-neutral-500">Unknown</em>}
            </p>
            {entry.sourceUrl && (
              <p className="mt-2 text-xs">
                <a href={entry.sourceUrl} target="_blank" className="text-accent underline">External source</a>
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">Added {entry.createdAt.toISOString().slice(0, 10)}</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-300">On this list by mistake?</h2>
            <p className="mt-1 text-sm text-neutral-400">
              File a dispute and the listing company will be notified.
            </p>
            <Link href={`/dispute?entry=${entry.id}`} className="btn-ghost mt-3 w-full">File a dispute</Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-200">{children}</dd>
    </div>
  );
}
