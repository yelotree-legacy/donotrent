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
        <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
            <Link href="/" className="group flex items-center gap-2 font-bold tracking-tight">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white shadow-sm shadow-red-900/40 transition-transform group-hover:scale-105">
                <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M2 4l6-2 6 2v6c0 2.5-2.5 4.5-6 5-3.5-.5-6-2.5-6-5V4z" strokeLinejoin="round" />
                  <path d="m5 8 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm">
                <span className="text-white">DNR</span>
                <span className="text-neutral-500"> Registry</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/" label="Search" />
              <NavLink href="/check" label="Rent Report" />
              <NavLink href="/browse" label="Browse" />
              <NavLink href="/sources" label="Sources" />
              <NavLink href="/pricing" label="Pricing" />
              {signedIn ? (
                <>
                  <NavLink href="/dashboard" label="Dashboard" />
                  <Link href="/dashboard/upload" className="btn-primary ml-1">
                    <span className="text-base leading-none">+</span> Upload
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <NavLink href="/login" label="Sign in" />
                  <Link href="/signup" className="btn-primary ml-1">Register company</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-9rem)] max-w-6xl px-5 py-8">{children}</main>
        <footer className="border-t border-ink-800/80 text-xs text-neutral-500">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5">
            <span>© DNR Registry · for verified rental operators only</span>
            <span className="flex items-center gap-3">
              <Link className="hover:text-white transition-colors" href="/dispute">File a dispute</Link>
              <span className="text-neutral-700">·</span>
              <a className="hover:text-white transition-colors" href="https://github.com/yelotree-legacy/donotrent" target="_blank" rel="noreferrer">Source</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-neutral-300 transition-colors hover:bg-ink-800 hover:text-white"
    >
      {label}
    </Link>
  );
}
