"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Hit = {
  id: string;
  fullName: string;
  licenseId: string | null;
  licenseState: string | null;
  reason: string;
  severity: string;
  matchKind: string;
  thumbnailUrl: string | null;
};

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
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (!q.trim()) {
      setHits([]); setTotal(0); setLoading(false); return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const usp = new URLSearchParams();
        usp.set("q", q);
        usp.set("field", field);
        usp.set("limit", "8");
        const r = await fetch(`/api/search?${usp.toString()}`);
        const data = await r.json();
        setHits(data.hits || []);
        setTotal(data.total || 0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, field]);

  // Click-away
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
    router.push(`/?${usp.toString()}`);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = hits[highlighted];
      if (target) {
        router.push(`/entry/${target.id}`);
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
          placeholder="Search by full name or license ID — try Tyler, Brown, F5362380…"
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
          {!loading && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">
              No matches for <span className="text-neutral-300">"{q}"</span>.
            </div>
          )}
          {!loading && hits.length > 0 && (
            <>
              <ul className="max-h-[60vh] overflow-y-auto py-1">
                {hits.map((h, i) => (
                  <li key={h.id}>
                    <Link
                      href={`/entry/${h.id}`}
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
                        <div className="truncate text-sm font-medium text-white">{h.fullName}</div>
                        <div className="truncate text-xs text-neutral-500">{h.reason}</div>
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
              <button
                onClick={submitFull}
                className="flex w-full items-center justify-between border-t border-ink-800 px-4 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-ink-800 hover:text-white"
              >
                <span>See all {total.toLocaleString()} result{total === 1 ? "" : "s"}</span>
                <span>↵</span>
              </button>
            </>
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

function SeverityDot({ s }: { s: string }) {
  const cls =
    s === "CRITICAL" ? "bg-red-500" :
    s === "HIGH" ? "bg-orange-400" :
    s === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} title={s} />;
}
