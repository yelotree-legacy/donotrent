import Link from "next/link";
import type { SearchHit } from "@/lib/search";
import { MatchPill, SeverityPill, StatusPill } from "./Pill";

export type EntryCardData = SearchHit & { thumbnailUrl?: string | null };

export function EntryCard({ hit, query }: { hit: EntryCardData; query?: string }) {
  return (
    <Link
      href={`/entry/${hit.id}`}
      className="card-hover group flex items-stretch gap-0 overflow-hidden"
    >
      <Thumbnail url={hit.thumbnailUrl} fullName={hit.fullName} severity={hit.severity} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {highlight(hit.fullName, query)}
            </h3>
            <SeverityPill severity={hit.severity} />
            <StatusPill status={hit.status} />
          </div>
          <p className="line-clamp-2 text-sm text-neutral-400">{hit.primaryReason}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {hit.licenseId ? (
            <span className="font-mono tag">
              {hit.licenseState ? `${hit.licenseState}·` : ""}{hit.licenseId}
            </span>
          ) : (
            <span className="tag opacity-60">License pending</span>
          )}
          {hit.damageAmount != null && hit.damageAmount > 0 && (
            <span className="tag">${hit.damageAmount.toLocaleString()}</span>
          )}
          {hit.categories.slice(0, 3).map((c) => (
            <span key={c} className="tag">{c}</span>
          ))}
          {hit.categories.length > 3 && <span className="tag">+{hit.categories.length - 3}</span>}
          <MatchPill kind={hit.matchKind} />
        </div>
      </div>
    </Link>
  );
}

function Thumbnail({
  url,
  fullName,
  severity,
}: {
  url?: string | null;
  fullName: string;
  severity: string;
}) {
  const ring =
    severity === "CRITICAL" ? "ring-red-500/40"
      : severity === "HIGH" ? "ring-orange-500/40"
        : severity === "MEDIUM" ? "ring-amber-500/40"
          : "ring-emerald-500/40";

  if (url) {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-ink-800 ring-1 ring-inset ${ring}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`License of ${fullName}`}
          className="h-full w-32 object-cover transition-transform duration-300 group-hover:scale-105 sm:w-40"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-ink-900/50" />
      </div>
    );
  }
  return (
    <div className={`grid w-32 shrink-0 place-items-center bg-ink-800 ring-1 ring-inset ${ring} sm:w-40`}>
      <span className="text-2xl font-bold text-neutral-300">{initials(fullName)}</span>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

function highlight(text: string, q?: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-500/30 px-0.5 text-yellow-100">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
