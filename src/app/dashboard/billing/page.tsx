import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { getPlan, checksRemaining, PLANS, PUBLIC_PLAN_SLUGS } from "@/lib/plans";
import { isStripeConfigured } from "@/lib/stripe";
import { OpenPortalButton } from "./OpenPortalButton";

export default async function BillingPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const me = await requireCompany();
  if (!me) redirect("/login");

  const plan = getPlan(me.plan);
  const usage = checksRemaining({ plan: me.plan, checksUsedThisPeriod: me.checksUsedThisPeriod });
  const monthlyChecksDone = await prisma.checkSession.count({
    where: {
      companyId: me.id,
      ...(me.currentPeriodStart ? { createdAt: { gte: me.currentPeriodStart } } : {}),
    },
  });

  return (
    <div className="space-y-6 fade-in">
      {searchParams.checkout === "success" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 fade-in">
          Subscription activated! Welcome to {plan.label}.
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="mt-1 text-sm text-neutral-400">Manage your plan, usage, and invoices.</p>
        </div>
        <Link href="/pricing" className="btn-link">View all plans →</Link>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="card p-5 md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Current plan</div>
              <div className="mt-1 text-2xl font-bold text-white">{plan.label}</div>
              {plan.monthlyPrice > 0 && (
                <div className="mt-0.5 text-sm text-neutral-400">${plan.monthlyPrice}/month</div>
              )}
              {me.stripeStatus !== "none" && (
                <div className="mt-1 text-xs text-neutral-500">
                  Status: <span className="text-neutral-300">{me.stripeStatus}</span>
                  {me.currentPeriodEnd && (
                    <> · Renews {me.currentPeriodEnd.toISOString().slice(0, 10)}</>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {me.stripeCustomerId && isStripeConfigured() ? (
                <OpenPortalButton />
              ) : (
                <Link href="/pricing" className="btn-primary">Choose a plan</Link>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-ink-800 pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-neutral-300">Rent Reports this period</span>
              <span className="text-neutral-400">
                {usage.isUnlimited ? <em>Unlimited</em> : <>{me.checksUsedThisPeriod} / {usage.limit}</>}
              </span>
            </div>
            {!usage.isUnlimited && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className={`h-full transition-all ${
                    usage.remaining === 0 ? "bg-red-500" :
                    usage.remaining < usage.limit * 0.2 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (me.checksUsedThisPeriod / Math.max(1, usage.limit)) * 100)}%` }}
                />
              </div>
            )}
            {!usage.isUnlimited && usage.remaining === 0 && (
              <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                You've hit this period's limit.{" "}
                <Link href="/pricing" className="font-semibold underline">Upgrade your plan</Link> to keep running checks.
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">All-time</div>
          <div className="mt-1 text-3xl font-bold text-white">{monthlyChecksDone}</div>
          <div className="text-xs text-neutral-500">Rent Reports this period</div>
          <div className="mt-4 border-t border-ink-800 pt-3">
            <Link href="/check" className="btn-primary w-full justify-center">Run a Rent Report</Link>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <header className="border-b border-ink-800 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Compare plans</h2>
        </header>
        <div className="grid divide-y divide-ink-800 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {PUBLIC_PLAN_SLUGS.map((slug) => {
            const p = PLANS[slug];
            const isCurrent = me.plan === slug;
            return (
              <div key={slug} className="p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{p.label}</span>
                  {isCurrent && <span className="pill bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30">current</span>}
                </div>
                <div className="mt-1 text-xs text-neutral-400">${p.monthlyPrice}/mo · {p.monthlyChecks} checks</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
