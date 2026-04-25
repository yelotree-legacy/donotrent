import Link from "next/link";
import { prisma } from "@/lib/db";
import { isFreeTier } from "@/lib/billing-mode";

export default async function MarketingHome() {
  const [totalEntries, totalSources, totalCompanies] = await Promise.all([
    prisma.dnrEntry.count(),
    prisma.source.count({ where: { isActive: true } }),
    prisma.company.count(),
  ]);
  const free = isFreeTier();

  return (
    <div className="space-y-20 fade-in">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-ink-700/80 bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 px-6 py-14 md:px-12 md:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-red-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-red-300">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            {free ? "Free for verified rental operators" : "For verified rental operators"}
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
            They Can't Be<span className="text-red-400"> Trusted</span>.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-400 md:text-lg">
            The rental industry's accountability network. Cross-source Do Not Rent + Broker Registry, in one place.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-neutral-300">
            Pass / Review / Decline verdict in 60 seconds — on the renter <em>and</em> the broker who brought them.{free ? " Free for the rental industry." : ""}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">
              {free ? "Create free account" : "Start free trial"}
            </Link>
            <Link href="#how" className="btn-ghost text-base px-6 py-3">How it works</Link>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            {free
              ? "Free forever for verified rental operators · No credit card · Unlimited cross-source checks"
              : "10 free Rent Reports · No credit card · Cancel anytime"}
          </p>
        </div>

        <div className="relative mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
          <Stat label="Flagged renters in registry" value={totalEntries.toLocaleString()} />
          <Stat label="Active data sources" value={totalSources} accent />
          <Stat label="Verification time" value="<60s" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">A renter walks up. What do you do?</h2>
          <p className="mt-2 text-neutral-400">
            One step replaces three vendors and saves you from the worst kind of customer.
          </p>
        </header>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          <Step n={1} title="Submit name + license" body="Paste their full name and license ID into the Rent Report tool. Or POST it from your booking system via API." />
          <Step n={2} title="Cross-source check" body="We query every active DNR source in parallel — partner operators, your own network, public registries — plus OFAC sanctions in the same request." />
          <Step n={3} title="Verdict in seconds" body="Approve · Manual review · Decline, with risk score and evidence. Optional Stripe Identity verification confirms the license is real." />
        </ol>
      </section>

      {/* FEATURES */}
      <section>
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">Two registries. One subscription.</h2>
          <p className="mt-2 text-neutral-400">Vet the renter AND the broker who brought them.</p>
        </header>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature title="Multi-source DNR cross-check" body="Aggregate across partner operators, your own uploads, and the public registry. Cross-source corroboration auto-escalates the verdict." />
          <Feature title="OFAC sanctions screening" body="Free US Treasury SDN list match runs on every check. Federal-grade watchlist, automatic." />
          <Feature title="Broker Registry" body="Rate and review the agents and middlemen who source your customers. Spot the brokers who keep bringing problem renters before you take their next call." />
          <Feature title="Risk score 0–100" body="Severity × source-trust × hit count, weighted for multi-source corroboration. Tune your own thresholds." />
          <Feature title="API access" body="POST /api/v1/check from your booking system. Auto-block at booking time." />
          <Feature title="Bring your own list" body="Upload your existing DNR list as a private source via CSV. Cross-checks gain your data instantly." />
        </div>
      </section>

      {/* BROKER REGISTRY CALLOUT */}
      <section className="card overflow-hidden">
        <div className="grid items-center gap-6 p-8 md:grid-cols-[1.4fr_1fr] md:gap-10 md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
              Broker Registry
            </div>
            <h2 className="mt-3 text-3xl font-bold text-white">Some brokers bring you problems wholesale.</h2>
            <p className="mt-3 text-neutral-300">
              Every problem renter has a story — and often, a person who introduced you. The Broker Registry lets operators rate the agents who source their customers. Search by name, email, or Instagram handle. See the rating before you take their next call.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/brokers" className="btn-primary">Browse brokers</Link>
              <Link href="/brokers/new" className="btn-ghost">+ Add a broker</Link>
            </div>
          </div>
          <div className="grid gap-3">
            <ExampleBroker name="Sample Brokerage Inc." rating={2.1} reviews={12} note="Multiple unpaid damages; nonresponsive after rentals" tone="red" />
            <ExampleBroker name="Trusted Agent LLC" rating={4.7} reviews={8} note="Consistent vetting; reliable communication" tone="green" />
            <ExampleBroker name="New Broker Co." rating={null} reviews={0} note="No reviews yet" tone="neutral" />
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-8">
          <h3 className="text-xl font-bold text-white">Why this exists</h3>
          <ul className="mt-4 space-y-3 text-sm text-neutral-300">
            <li className="flex gap-3"><Dot /> <span><strong className="text-white">Rental-industry specific.</strong> Every entry is from a real flagged renter, not a generic background-check pull.</span></li>
            <li className="flex gap-3"><Dot /> <span><strong className="text-white">Cross-source by default.</strong> One check hits every active DNR source. No second contract.</span></li>
            <li className="flex gap-3"><Dot /> <span><strong className="text-white">{free ? "Free for the industry." : "Lower entry price."}</strong> {free ? "No subscription. No per-check fee. The platform is free; only optional add-ons (IDV, criminal checks) carry passthrough costs." : "Persona starts at $300/mo. We start at $49/mo."}</span></li>
            <li className="flex gap-3"><Dot /> <span><strong className="text-white">Network effects.</strong> Your uploads cross-check against everyone else's. The bigger the network, the better it gets.</span></li>
          </ul>
        </div>

        <div className="card p-8">
          <h3 className="text-xl font-bold text-white">A single bad rental can ruin a quarter</h3>
          <p className="mt-3 text-sm text-neutral-300">
            The average exotic-rental damage incident in our registry totals <span className="font-semibold text-white">$3,800+</span>. Several entries exceed <span className="font-semibold text-white">$15,000</span>. {free ? "The platform is free — one declined-but-correct call has paid back forever." : "The Pro plan is $149/month — one declined-but-correct call pays for the year."}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MicroStat label="Avg damages / incident" value="$3.8K" />
            <MicroStat label="Critical severity rate" value="38%" />
            <MicroStat label="Time to verdict" value="<60s" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">Common questions</h2>
        </header>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          {free && <FAQ q="Is it really free?" a="Yes — for verified rental operators. Cross-source DNR + OFAC + Broker Registry + the API are unlimited and free. Future add-ons may carry passthrough vendor costs but the core platform stays free." />}
          <FAQ q="What's the Broker Registry?" a="A separate registry for the agents and middlemen who source rental customers. Operators rate brokers on the quality of customers they bring, payment reliability, and communication. Search by name, email, or Instagram handle." />
          <FAQ q="How fast is a Rent Report?" a="Cross-source check runs in under a second. Stripe Identity adds a 30–60 second flow on the renter's phone. The verdict updates live as the renter completes." />
          <FAQ q="Does the public see who's flagged?" a="No. The registry is gated behind operator authentication. Public visitors see only this marketing site, signup, and the dispute form." />
          <FAQ q="What if a renter disputes their listing?" a="Anyone listed can file a dispute. The entry's status flips to DISPUTED until the listing operator responds. Disputed entries carry lower trust weight in the verdict." />
          <FAQ q="Can I integrate with my booking system?" a={free ? "Yes — every account gets API access. POST a name + license ID, get back the verdict + risk score in milliseconds." : "Yes — Pro and Business plans expose a JSON API."} />
          <FAQ q="Can I upload my own DNR list?" a="Yes. Use the bulk CSV import or upload one entry at a time. Your list becomes a private source and participates in cross-checks." />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="rounded-2xl border-2 border-accent bg-gradient-to-br from-red-950/40 to-ink-900 px-6 py-12 text-center md:px-12 md:py-16">
        <h2 className="text-3xl font-bold text-white md:text-4xl">Run your first Rent Report in 5 minutes.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-300">
          {free
            ? "Sign up, run unlimited checks against the network, integrate the API. Free for the rental industry."
            : "Sign up, run 10 free checks, integrate the API. Decide whether to keep the subscription after."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">{free ? "Create free account" : "Start free trial"}</Link>
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
function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
    </div>
  );
}
function ExampleBroker({ name, rating, reviews, note, tone }: { name: string; rating: number | null; reviews: number; note: string; tone: "red" | "green" | "neutral" }) {
  const ratingCls = tone === "red" ? "text-red-300" : tone === "green" ? "text-emerald-300" : "text-neutral-500";
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-white">{name}</span>
        {rating != null ? (
          <span className={`text-sm font-semibold ${ratingCls}`}>★ {rating.toFixed(1)}</span>
        ) : (
          <span className="text-xs text-neutral-500">No reviews</span>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-400">{note}</div>
      {reviews > 0 && <div className="mt-1 text-[10px] text-neutral-500">{reviews} reviews</div>}
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
