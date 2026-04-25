"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const STATUSES = ["ACTIVE", "REFORMED", "DISPUTED", "ARCHIVED"] as const;

export function Filters({
  categories,
  selectedCategories,
  selectedSeverity,
  selectedStatus,
}: {
  categories: { slug: string; label: string; count?: number }[];
  selectedCategories: string[];
  selectedSeverity: string[];
  selectedStatus: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle(key: string, value: string) {
    const usp = new URLSearchParams(params.toString());
    const current = usp.getAll(key);
    if (current.includes(value)) {
      usp.delete(key);
      current.filter((v) => v !== value).forEach((v) => usp.append(key, v));
    } else {
      usp.append(key, value);
    }
    router.push(`?${usp.toString()}`);
  }

  function clearAll() {
    const usp = new URLSearchParams();
    const q = params.get("q");
    const field = params.get("field");
    if (q) usp.set("q", q);
    if (field) usp.set("field", field);
    router.push(`?${usp.toString()}`);
  }

  const hasFilters =
    selectedCategories.length || selectedSeverity.length || selectedStatus.length;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Severity</span>
          {hasFilters ? <button className="btn-link" onClick={clearAll}>Clear all</button> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => toggle("severity", s)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-medium transition",
                selectedSeverity.includes(s)
                  ? "border-accent bg-accent text-white"
                  : "border-ink-700 bg-ink-900 text-neutral-300 hover:border-neutral-500"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Status</span>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggle("status", s)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-medium transition",
                selectedStatus.includes(s)
                  ? "border-accent bg-accent text-white"
                  : "border-ink-700 bg-ink-900 text-neutral-300 hover:border-neutral-500"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Categories</span>
        <div className="space-y-1">
          {categories.map((c) => {
            const on = selectedCategories.includes(c.slug);
            return (
              <button
                key={c.slug}
                onClick={() => toggle("cat", c.slug)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition",
                  on ? "bg-accent text-white" : "text-neutral-300 hover:bg-ink-800"
                )}
              >
                <span>{c.label}</span>
                {typeof c.count === "number" && (
                  <span className={cn("text-xs", on ? "text-white/70" : "text-neutral-500")}>
                    {c.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
