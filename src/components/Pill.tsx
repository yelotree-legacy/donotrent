import { cn } from "@/lib/cn";

export function SeverityPill({ severity }: { severity: string }) {
  const cls =
    severity === "CRITICAL"
      ? "pill-critical"
      : severity === "HIGH"
        ? "pill-high"
        : severity === "MEDIUM"
          ? "pill-medium"
          : "pill-low";
  return <span className={cls}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const cls =
    status === "ACTIVE" ? "pill-active"
      : status === "REFORMED" ? "pill-reformed"
        : status === "DISPUTED" ? "pill-disputed"
          : "pill-archived";
  return <span className={cls}>{status}</span>;
}

export function MatchPill({ kind }: { kind: string }) {
  const label =
    kind === "exact_license" ? "License match"
      : kind === "exact_name" ? "Exact name"
        : kind === "prefix" ? "Name prefix"
          : kind === "fuzzy" ? "Fuzzy"
            : kind === "alias" ? "Alias / reason"
              : "Match";
  return <span className={cn("pill bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30")}>{label}</span>;
}
