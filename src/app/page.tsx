import Link from "next/link";
import { prisma } from "@/lib/db";
import { PLANS, PUBLIC_PLAN_SLUGS } from "@/lib/plans";

export default async function MarketingHome() {
  const [totalEntries, totalSources, totalCompanies] = await Promise.all([
    prisma.dnrEntry.count(),
    prisma.source.count({ where: { isActive: true } }),
    prisma.company.count(),
  ]);

  return (
    <div className="space-y-20 fade-in">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-ink-700/80 bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 px-6 py-14 md:px-12 md:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-red-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-red-300">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            For verified rental operators
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
            Stop renting to the wrong people.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-300 md:text-lg">
            Cross-source Do Not Rent check + Stripe Identity verification on every renter.
            One subscription. Pass / Review / Decline verdict in 60 seconds.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">Start free trial</Link>
            <Link href="/pricing" className="btn-ghost text-base px-6 py-3">View pricing</Link>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            10 free Rent Reports · No credit card · Cancel anytime
          </p>
        </div>

        <div className="relative mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
          <Stat label="Flagged renters in registry" value={totalEntries.toLocaleString()} />
          <Stat label="Active data sources" value={totalSources} accent />
          <Stat label="Verification time" value="<60s" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">A renter walks up. What do you do?</h2>
          <p className="mt-2 text-neutral-400">
            One step replaces three vendors and saves you from the worst kind of customer.
          </p>
        </header>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          <Step
            n={1}
            title="Submit name + license"
            body="Paste their full name and license ID into the Rent Report tool. Or POST it from your booking system via API."
          />
          <Step
            n={2}
            title="Cross-source check"
            body="We query every active DNR source in parallel — partner operators, your own network, and disputed records. Returns hits, severity, and matched fields."
          />
          <Step
            n={3}
            title="Verdict in seconds"
            body="Approve · Manual review · Decline, with risk score and evidence. Optional Stripe Identity verification confirms the license is real and the person matches."
          />
        </ol>
      </section>

      {/* FEATURES */}
      <section>
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">Built for exotic + luxury rental operators</h2>
          <p className="mt-2 text-neutral-400">
            Everything you need to vet a renter, in one tool, at one price.
          </p>
        </header>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Multi-source DNR cross-check"
            body="Aggregate across partner operators, your own uploads, and the public registry. Cross-source corroboration auto-escalates the verdict."
          />
          <Feature
            title="Stripe Identity verification"
            body="Document scan + selfie + liveness. Confirms license is real and the renter standing there matches it. $1.50 / verification, included in Pro+."
          />
          <Feature
            title="Risk score 0–100"
            body="Severity × source-trust × hit count, weighted for multi-source corroboration. Tune your own thresholds."
          />
          <Feature
            title="API access"
            body="POST /api/v1/check from your booking system. Auto-block at booking time. Pro and Business plans."
            badge="Pro+"
          />
          <Feature
            title="Team seats"
            body="Multiple users per company, shared usage pool, audit trail of who checked who."
          />
          <Feature
            title="Search alerts"
            body="Get notified when a renter you flagged is searched by another operator in the network. Network reputation in real time."
          />
        </div>
      </section>

      {/* SOCIAL PROOF / WHY */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-8">
          <h3 className="text-xl font-bold text-white">Why this over Persona / Checkr / Samba?</h3>
          <ul className="mt-4 space-y-3 text-sm text-neutral-300">
            <li className="flex gap-3">
              <Dot /> <span><strong className="text-white">Rental-industry specific.</strong> Every entry in the registry is from a real flagged renter, not a generic background-check pull.</span>
            </li>
            <li className="flex gap-3">
              <Dot /> <span><strong className="text-white">Cross-source by default.</strong> One check hits every active DNR source we have. No second contract.</span>
            </li>
            <li className="flex gap-3">
              <Dot /> <span><strong className="text-white">Lower entry price.</strong> Persona starts at $300/mo + per-check fees. We start at $49/mo with 25 checks included.</span>
            </li>
            <li className="flex gap-3">
              <Dot /> <span><strong className="text-white">No FCRA hand-wringing for you.</strong> We handle consent + adverse action notices in the workflow.</span>
            </li>
          </ul>
        </div>

        <div className="card p-8">
          <h3 className="text-xl font-bold text-white">A single bad rental costs more than a year of subscription</h3>
          <p className="mt-3 text-sm text-neutral-300">
            The average exotic-rental damage incident in our registry totals <span className="font-semibold text-white">$3,800+</span>.
            Several entries exceed <span className="font-semibold text-white">$15,000</span> in damages alone. The Pro plan
            is $149/month — one declined-but-correct call pays for the year.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MicroStat label="Avg damages / incident" value="$3.8K" />
            <MicroStat label="Critical severity rate" value="38%" />
            <MicroStat label="Time to verdict" value="<60s" />
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="card overflow-hidden">
        <div className="grid items-center gap-6 p-8 md:grid-cols-[1.4fr_1fr] md:gap-10 md:p-12">
          <div>
            <h2 className="text-3xl font-bold text-white">Plans starting at $49/month.</h2>
            <p className="mt-3 text-neutral-300">
              Free trial included — 10 Rent Reports, no credit card. Upgrade once you've seen it work.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/pricing" className="btn-primary text-base px-6 py-3">View all plans</Link>
              <Link href="/signup" className="btn-ghost text-base px-6 py-3">Start free trial</Link>
            </div>
          </div>
          <div className="grid gap-2">
            {PUBLIC_PLAN_SLUGS.map((slug) => {
              const p = PLANS[slug];
              const isPopular = p.highlight;
              return (
                <div
                  key={slug}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    isPopular ? "border-accent bg-accent/5" : "border-ink-700 bg-ink-900/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{p.label}</span>
                      {isPopular && (
                        <span className="pill bg-accent text-white">Popular</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400">{p.monthlyChecks} checks/mo</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">${p.monthlyPrice}</div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">/mo</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">Common questions</h2>
        </header>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <FAQ q="How fast is a Rent Report?" a="Cross-source check runs in under a second. Stripe Identity adds a 30–60 second flow on the renter's phone. The verdict updates live as the renter completes." />
          <FAQ q="Does the public see who's flagged?" a="No. The registry is gated behind operator authentication. Public visitors see only this marketing site, pricing, and the dispute form." />
          <FAQ q="What if a renter disputes their listing?" a="Anyone listed can file a dispute. The entry's status flips to DISPUTED until the listing operator responds. Disputed entries carry lower trust weight in the verdict." />
          <FAQ q="Can I integrate with my booking system?" a="Yes — Pro and Business plans expose a JSON API. POST a name + license ID, get back the verdict + risk score in milliseconds. Full docs at signup." />
          <FAQ q="Is it FCRA-compliant?" a="The cross-source check uses publicly published DNR data and isn't a consumer report. Stripe Identity collects FCRA-grade consent before the renter scans their license." />
          <FAQ q="Can I add my own DNR list?" a="Yes — every member operator's uploads become a Network Reports source. Optional partner integration to ingest your existing public list automatically." />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="rounded-2xl border-2 border-accent bg-gradient-to-br from-red-950/40 to-ink-900 px-6 py-12 text-center md:px-12 md:py-16">
        <h2 className="text-3xl font-bold text-white md:text-4xl">Run your first Rent Report in 5 minutes.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-300">
          Sign up, run 10 free checks against the live registry, integrate the API.
          Decide whether to keep the subscription after.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">Start free trial</Link>
          <Link href="/pricing" className="btn-ghost text-base px-6 py-3">See pricing</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border ${accent ? "border-red-500/30 bg-red-500/5" : "border-ink-700 bg-ink-900/60"} px-4 py-3 text-center`}>
      <div className={`text-2xl font-bold md:text-3xl ${accent ? "text-red-300" : "text-white"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/50 p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="card relative p-6">
      <div className="absolute -top-3 left-6 grid size-7 place-items-center rounded-full bg-accent text-sm font-bold text-white">{n}</div>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
    </li>
  );
}

function Feature({ title, body, badge }: { title: string; body: string; badge?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {badge && <span className="pill bg-accent/20 text-red-300 ring-1 ring-inset ring-red-500/30">{badge}</span>}
      </div>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-white">{q}</h3>
      <p className="mt-2 text-sm text-neutral-400">{a}</p>
    </div>
  );
}

function Dot() {
  return <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />;
}
