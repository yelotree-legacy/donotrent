import Link from "next/link";

export default function DisputeFiledPage({ searchParams }: { searchParams: { entry?: string } }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold">Dispute filed</h1>
        <p className="mt-2 text-sm text-neutral-400">
          The listing company has been notified. The entry status is now <span className="font-semibold text-yellow-300">DISPUTED</span>{" "}
          while it is reviewed.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          {searchParams.entry && <Link href={`/entry/${searchParams.entry}`} className="btn-ghost">View entry</Link>}
          <Link href="/" className="btn-primary">Back to search</Link>
        </div>
      </div>
    </div>
  );
}
