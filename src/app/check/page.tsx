import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { crossCheck } from "@/lib/cross-check";
import { logSearch } from "@/lib/audit";
import { requireCompany } from "@/lib/auth";
import { CheckForm } from "./CheckForm";

type SP = { license?: string; name?: string; dob?: string };

async function runCheck(formData: FormData) {
  "use server";
  const license = String(formData.get("license") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const dob = String(formData.get("dob") || "").trim();

  if (!license && !name) redirect("/check");

  const me = await requireCompany();
  const xc = await crossCheck({
    licenseId: license || undefined,
    fullName: name || undefined,
    dateOfBirth: dob || undefined,
  });

  const session = await prisma.checkSession.create({
    data: {
      fullName: name || null,
      licenseId: license || null,
      dateOfBirth: dob ? new Date(dob) : null,
      verdict: xc.verdict,
      riskScore: xc.riskScore,
      totalHits: xc.totalHits,
      matchedSources: xc.matchedSources,
      worstSeverity: xc.worstSeverity,
      companyId: me?.id ?? null,
    },
  });

  await logSearch(`${name} ${license}`.trim(), license ? "license" : "name", xc.totalHits);
  redirect(`/check/${session.id}`);
}

export default async function CheckPage({ searchParams }: { searchParams: SP }) {
  const sources = await prisma.source.findMany({ where: { isActive: true }, orderBy: { trustScore: "desc" } });

  return (
    <div className="space-y-6 fade-in">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
          Cross-source check
        </div>
        <h1 className="text-3xl font-bold text-white">Run a Rent Report</h1>
        <p className="text-sm text-neutral-400">
          Check a renter against {sources.length} integrated source{sources.length === 1 ? "" : "s"}.
          Returns a verdict, risk score, and per-source breakdown — plus optional Stripe Identity verification.
        </p>
      </header>

      <div className="card p-5">
        <Suspense>
          <CheckForm
            initial={{
              license: searchParams.license,
              name: searchParams.name,
              dob: searchParams.dob,
            }}
            action={runCheck}
          />
        </Suspense>
      </div>

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Sources currently checked
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <Link key={s.id} href={`/sources/${s.slug}`} className="card-hover block p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{s.name}</div>
                <KindBadge kind={s.kind} />
              </div>
              {s.region && <div className="mt-0.5 text-[11px] text-neutral-500">{s.region}</div>}
              {s.description && <p className="mt-2 line-clamp-2 text-xs text-neutral-400">{s.description}</p>}
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
                <span>Trust {s.trustScore}/100</span>
                {s.lastSyncedAt && <span>Synced {timeAgo(s.lastSyncedAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const cls = {
    scraped: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    partner: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
    network: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    manual: "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
  }[kind] || "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30";
  return <span className={`pill ring-1 ring-inset ${cls}`}>{kind}</span>;
}

function timeAgo(d: Date | string): string {
  const then = new Date(d).getTime();
  const diff = (Date.now() - then) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
