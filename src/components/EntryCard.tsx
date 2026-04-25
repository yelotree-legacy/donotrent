import Link from "next/link";
import type { SearchHit } from "@/lib/search";
import { MatchPill, SeverityPill, StatusPill } from "./Pill";

export function EntryCard({ hit, query }: { hit: SearchHit; query?: string }) {
  return (
    <Link
      href={`/entry/${hit.id}`}
      className="card group flex items-start gap-4 p-4 transition hover:border-accent/50 hover:bg-ink-800/40"
    >
      <div className="grid size-14 shrink-0 place-items-center rounded bg-ink-800 text-xl font-bold text-neutral-300 ring-1 ring-ink-700 group-hover:ring-accent/40">
        {initials(hit.fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold text-white">
            {highlight(hit.fullName, query)}
          </h3>
          <SeverityPill severity={hit.severity} />
          <StatusPill status={hit.status} />
          <MatchPill kind={hit.matchKind} />
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{hit.primaryReason}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {hit.licenseId ? (
            <span className="font-mono tag">
              ID {hit.licenseState ? `${hit.licenseState}·` : ""}
              {hit.licenseId}
            </span>
          ) : (
            <span className="tag">License pending</span>
          )}
          {hit.damageAmount != null && hit.damageAmount > 0 && (
            <span className="tag">${hit.damageAmount.toLocaleString()}</span>
          )}
          {hit.categories.slice(0, 4).map((c) => (
            <span key={c} className="tag">{c}</span>
          ))}
          {hit.categories.length > 4 && <span className="tag">+{hit.categories.length - 4}</span>}
        </div>
      </div>
    </Link>
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
      <mark className="rounded bg-yellow-500/30 px-0.5 text-yellow-200">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
