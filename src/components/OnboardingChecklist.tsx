import Link from "next/link";

export type ChecklistItem = {
  key: string;
  label: string;
  href: string;
  done: boolean;
  hint?: string;
};

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  if (total === 0) return null;
  if (done === total) return null;

  const pct = Math.round((done / total) * 100);

  return (
    <section className="card overflow-hidden border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-ink-900 to-ink-900">
      <div className="flex items-start justify-between gap-3 p-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-300">
            Getting started
          </div>
          <h2 className="mt-2 text-xl font-bold text-white">
            {done === 0
              ? "Let's get you up and running"
              : done === total - 1
                ? "Almost there!"
                : "Make the most of They Can't Be Trusted"}
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            {done} of {total} steps complete
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{pct}%</div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">complete</div>
        </div>
      </div>

      <div className="h-1 w-full bg-ink-800">
        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="divide-y divide-ink-800">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                item.done ? "opacity-60" : "hover:bg-ink-800/40"
              }`}
            >
              <div className={`grid size-6 shrink-0 place-items-center rounded-full ${
                item.done
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                  : "bg-ink-800 text-neutral-500 ring-1 ring-ink-700"
              }`}>
                {item.done ? (
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${item.done ? "text-neutral-400 line-through" : "text-white"}`}>
                  {item.label}
                </div>
                {item.hint && !item.done && (
                  <div className="text-xs text-neutral-500">{item.hint}</div>
                )}
              </div>
              {!item.done && (
                <span className="shrink-0 text-xs text-blue-300">Start →</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
