"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RenterHit = {
  type: "renter";
  id: string;
  url: string;
  fullName: string;
  licenseId: string | null;
  licenseState: string | null;
  severity: string;
  status: string;
  primaryReason: string;
  matchKind: string;
  thumbnailUrl: string | null;
};

type BrokerHit = {
  type: "broker";
  id: string;
  url: string;
  name: string;
  city: string | null;
  state: string | null;
  avgRating: number | null;
  reviewCount: number;
  description: string | null;
};

type AnyHit = RenterHit | BrokerHit;

export function LiveSearch({
  initial = "",
  initialField = "any",
  size = "lg",
}: {
  initial?: string;
  initialField?: string;
  size?: "sm" | "lg";
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [field, setField] = useState(initialField);
  const [renters, setRenters] = useState<RenterHit[]>([]);
  const [brokers, setBrokers] = useState<BrokerHit[]>([]);
  const [renterTotal, setRenterTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all: AnyHit[] = [...renters, ...brokers];

  useEffect(() => {
    if (!q.trim()) {
      setRenters([]); setBrokers([]); setRenterTotal(0); setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const usp = new URLSearchParams();
        usp.set("q", q);
        usp.set("field", field);
        usp.set("entry_limit", "8");
        usp.set("broker_limit", "5");
        const r = await fetch(`/api/search/unified?${usp.toString()}`);
        const data = await r.json();
        setRenters(data.entries?.hits || []);
        setBrokers(data.brokers?.hits || []);
        setRenterTotal(data.entries?.total || 0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, field]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function submitFull() {
    const usp = new URLSearchParams(params.toString());
    if (q) usp.set("q", q); else usp.delete("q");
    if (field && field !== "any") usp.set("field", field); else usp.delete("field");
    router.push(`/search?${usp.toString()}`);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, all.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = all[highlighted];
      if (target) {
        router.push(target.url);
        setOpen(false);
      } else {
        submitFull();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const inputCls = size === "lg"
    ? "flex-1 bg-transparent py-3.5 text-base placeholder:text-neutral-500 focus:outline-none"
    : "flex-1 bg-transparent py-2 text-sm placeholder:text-neutral-500 focus:outline-none";

  return (
    <div ref={wrapRef} className="relative">
      <form
        onSubmit={(e) => { e.preventDefault(); submitFull(); }}
        className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/80 px-3 backdrop-blur transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
      >
        <SearchIcon />
        <select
          aria-label="Search field"
          className="border-r border-ink-800 bg-transparent py-2 pr-2 text-xs uppercase tracking-wider text-neutral-400 focus:outline-none"
          value={field}
          onChange={(e) => setField(e.target.value)}
        >
          <option value="any">Any</option>
          <option value="name">Name</option>
          <option value="license">License</option>
        </select>
        <input
          ref={inputRef}
          className={inputCls}
          placeholder="Renters or brokers — search by name, license ID, IG handle, F5362380…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => setOpen(Boolean(q))}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {q && (
          <button
            type="button"
            className="rounded p-1 text-neutral-500 hover:text-white hover:bg-ink-800"
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <kbd className="hidden rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-500 sm:inline">/</kbd>
      </form>

      {open && q && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-ink-700 bg-ink-950/95 shadow-2xl shadow-black/60 backdrop-blur fade-in">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-neutral-500">
              <span className="size-2 animate-pulse rounded-full bg-accent" />
              Searching…
            </div>
          )}
          {!loading && all.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">
              No matches for <span className="text-neutral-300">"{q}"</span>.
            </div>
          )}
          {!loading && all.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {renters.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                    Flagged renters · {renterTotal}
                  </div>
                  <ul>
                    {renters.map((h, i) => (
                      <li key={`r-${h.id}`}>
                        <Link
                          href={h.url}
                          onClick={() => setOpen(false)}
                          onMouseEnter={() => setHighlighted(i)}
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${i === highlighted ? "bg-ink-800/80" : ""}`}
                        >
                          <div className="size-11 shrink-0 overflow-hidden rounded-md bg-ink-800 ring-1 ring-ink-700">
                            {h.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={h.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-xs font-semibold text-neutral-400">
                                {(h.fullName.split(" ")[0]?.[0] || "") + (h.fullName.split(" ").slice(-1)[0]?.[0] || "")}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-white">{h.fullName}</span>
                              <span className="pill bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30">Renter</span>
                            </div>
                            <div className="truncate text-xs text-neutral-500">{h.primaryReason}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                            {h.licenseId && (
                              <span className="font-mono tag">
                                {h.licenseState ? `${h.licenseState}·` : ""}{h.licenseId}
                              </span>
                            )}
                            <SeverityDot s={h.severity} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {brokers.length > 0 && (
                <>
                  <div className="border-t border-ink-800 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                    Brokers · {brokers.length}
                  </div>
                  <ul>
                    {brokers.map((b, i) => {
                      const idx = renters.length + i;
                      return (
                        <li key={`b-${b.id}`}>
                          <Link
                            href={b.url}
                            onClick={() => setOpen(false)}
                            onMouseEnter={() => setHighlighted(idx)}
                            className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${idx === highlighted ? "bg-ink-800/80" : ""}`}
                          >
                            <div className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-500/10 ring-1 ring-blue-500/30 text-blue-300">
                              <BrokerIcon />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-white">{b.name}</span>
                                <span className="pill bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30">Broker</span>
                              </div>
                              <div className="truncate text-xs text-neutral-500">
                                {[b.city, b.state].filter(Boolean).join(", ") || (b.description ? b.description.slice(0, 60) : "—")}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-[10px]">
                              {b.reviewCount > 0 ? (
                                <span className={`font-semibold ${b.avgRating! >= 4 ? "text-emerald-300" : b.avgRating! >= 3 ? "text-amber-300" : "text-red-300"}`}>
                                  ★ {b.avgRating!.toFixed(1)}
                                </span>
                              ) : <span className="text-neutral-500">—</span>}
                              <span className="text-neutral-500">{b.reviewCount}</span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <button
                onClick={submitFull}
                className="flex w-full items-center justify-between border-t border-ink-800 px-4 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-ink-800 hover:text-white"
              >
                <span>See all renter results</span>
                <span>↵</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="size-4 shrink-0 text-neutral-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="9" r="6" />
      <path d="m17 17-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function BrokerIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="6" r="3" />
      <path d="M3 17c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  );
}

function SeverityDot({ s }: { s: string }) {
  const cls =
    s === "CRITICAL" ? "bg-red-500" :
    s === "HIGH" ? "bg-orange-400" :
    s === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} title={s} />;
}
