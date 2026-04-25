import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function DisputeFiledPage({ params }: { params: { slug: string } }) {
  const broker = await prisma.broker.findUnique({
    where: { slug: params.slug },
    select: { name: true, slug: true },
  });
  if (!broker) return notFound();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="card p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
          <svg className="size-6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-white">Dispute filed</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Your dispute against <span className="font-semibold text-white">{broker.name}</span> is in the moderation queue.
          The listing status is now <span className="font-semibold text-yellow-300">DISPUTED</span>.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Network admins typically review disputes within 3–5 business days. We'll reach out at the email or phone you provided.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href={`/brokers/${broker.slug}`} className="btn-ghost">View broker</Link>
          <Link href="/" className="btn-primary">Home</Link>
        </div>
      </div>
    </div>
  );
}
