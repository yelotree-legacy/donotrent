import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS, PUBLIC_PLAN_SLUGS } from "@/lib/plans";
import { requireCompany } from "@/lib/auth";
import { isFreeTier } from "@/lib/billing-mode";
import { ChoosePlanButton } from "./ChoosePlanButton";

export default async function PricingPage({ searchParams }: { searchParams: { checkout?: string } }) {
  if (isFreeTier()) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-12 text-center fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
          Free for verified rental operators
        </div>
        <h1 className="text-4xl font-bold text-white md:text-5xl">No subscription. No per-check fee.</h1>
        <p className="text-base text-neutral-300">
          DNR Registry is currently free for the rental industry. Sign up, run unlimited cross-source DNR + OFAC checks, and integrate the API into your booking flow at no cost.
        </p>
        <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-neutral-300">
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Unlimited cross-source DNR checks</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> OFAC sanctions screening on every check</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> API access for booking-flow integration</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Bulk CSV upload of your own list</li>
          <li className="flex gap-2"><span className="text-neutral-500">+</span> Optional Stripe Identity ($1.50/check, passthrough)</li>
          <li className="flex gap-2"><span className="text-neutral-500">+</span> Optional Checkr criminal background ($5–15/check, passthrough)</li>
        </ul>
        <div className="pt-4">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">Create free account</Link>
        </div>
        <p className="text-xs text-neutral-500">No credit card required · Cancel anytime · Your data is yours</p>
      </div>
    );
  }

  const me = await requireCompany();

  return (
    <div className="space-y-10 fade-in">
      {searchParams.checkout === "canceled" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout canceled. Pick a plan when you're ready.
        </div>
      )}

      <header className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
          Pricing
        </div>
        <h1 className="text-4xl font-bold text-white md:text-5xl">Protect your fleet for less than one bad rental.</h1>
        <p className="mx-auto max-w-2xl text-base text-neutral-400">
          One subscription. Cross-source DNR check + Stripe Identity verification on every renter.
          A single declined-but-correct call pays for the year.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        {PUBLIC_PLAN_SLUGS.map((slug) => {
          const plan = PLANS[slug];
          const highlight = plan.highlight;
          return (
            <div
              key={slug}
              className={`relative card overflow-hidden p-6 ${highlight ? "border-2 border-accent shadow-lg shadow-red-900/30" : ""}`}
            >
              {highlight && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-md bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                  Most popular
                </div>
              )}
              <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">{plan.label}</div>
              <div className="mt-3">
                {plan.slug === "enterprise" ? (
                  <div className="text-2xl font-bold text-white">Custom</div>
                ) : (
                  <>
                    <span className="text-4xl font-bold text-white">${plan.monthlyPrice}</span>
                    <span className="text-sm text-neutral-400">/month</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-neutral-400">{plan.description}</p>

              <ul className="mt-5 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-300">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {me ? (
                  <ChoosePlanButton plan={plan.slug} highlight={highlight} />
                ) : (
                  <Link
                    href={`/signup?plan=${plan.slug}`}
                    className={highlight ? "btn-primary w-full justify-center" : "btn-ghost w-full justify-center"}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-center">
        <h3 className="text-lg font-semibold text-white">Need more than 500 checks/month or a custom contract?</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Enterprise tier with unlimited checks, white-label, dedicated account manager, and SLA.
        </p>
        <a href="mailto:sales@dnr.local" className="btn-ghost mt-4 inline-flex">Contact sales</a>
      </section>

      <section className="card p-8">
        <h2 className="text-xl font-bold text-white">Free trial</h2>
        <p className="mt-2 text-sm text-neutral-400">
          New companies get <strong className="text-white">{PLANS.free.trialChecks} free Rent Reports</strong> on signup. No credit card.
          Upgrade when you've seen it work.
        </p>
        {!me && (
          <Link href="/signup" className="btn-primary mt-4 inline-flex">Start free trial</Link>
        )}
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-base font-semibold text-white">What counts as a "Rent Report"?</h3>
          <p className="mt-2 text-sm text-neutral-400">
            One submitted check on `/check`. Includes the cross-source DNR query and any
            Stripe Identity verification you initiate from that check session. Re-running an
            already-completed check does not count again.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-white">What if I exceed my plan?</h3>
          <p className="mt-2 text-sm text-neutral-400">
            We soft-block at your monthly limit and prompt to upgrade. No surprise charges.
            Need overages instead? <a href="mailto:sales@dnr.local" className="text-accent underline">Talk to us</a>.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-white">Can I cancel anytime?</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Yes — cancel from the customer portal. Your plan stays active through the end of the
            paid period, then drops to Free.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-white">Do you sell my renter data?</h3>
          <p className="mt-2 text-sm text-neutral-400">
            No. Verification data from Stripe Identity is retained only for the matching audit
            window and disclosed only to the company that initiated the check.
          </p>
        </div>
      </section>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
