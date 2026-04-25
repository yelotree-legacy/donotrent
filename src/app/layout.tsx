import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "DNR Registry — Do Not Rent List",
  description:
    "A multi-tenant Do Not Rent registry for vehicle rental companies. Search by name or license ID, upload incidents, and protect your fleet.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const signedIn = Boolean(session.companyId);

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid size-7 place-items-center rounded bg-accent text-white">D</span>
              <span>DNR Registry</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded px-3 py-1.5 text-neutral-300 hover:bg-ink-800">Search</Link>
              <Link href="/browse" className="rounded px-3 py-1.5 text-neutral-300 hover:bg-ink-800">Browse</Link>
              {signedIn ? (
                <>
                  <Link href="/dashboard" className="rounded px-3 py-1.5 text-neutral-300 hover:bg-ink-800">Dashboard</Link>
                  <Link href="/dashboard/upload" className="btn-primary ml-1">+ Upload</Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded px-3 py-1.5 text-neutral-300 hover:bg-ink-800">Sign in</Link>
                  <Link href="/signup" className="btn-primary ml-1">Register company</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-9rem)] max-w-6xl px-5 py-8">{children}</main>
        <footer className="border-t border-ink-800 text-xs text-neutral-500">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5">
            <span>© DNR Registry — for verified rental operators only.</span>
            <span>
              Disputes? <Link className="underline" href="/dispute">File a dispute</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
