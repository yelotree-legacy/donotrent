import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { getSession } from "./session";

export async function authenticate(email: string, password: string) {
  const company = await prisma.company.findUnique({ where: { email: email.toLowerCase() } });
  if (!company) return null;
  const ok = await bcrypt.compare(password, company.passwordHash);
  if (!ok) return null;
  return company;
}

export async function requireCompany() {
  const session = await getSession();
  if (!session.companyId) return null;
  const co = await prisma.company.findUnique({ where: { id: session.companyId } });
  return co;
}

// True for admins and verified operators. Unverified operators get read-only
// access to the platform; they can't post entries, write broker reviews, or
// create new brokers until an admin approves them.
export function isVerified(co: { verified: boolean; isAdmin: boolean } | null | undefined): boolean {
  if (!co) return false;
  return co.isAdmin || co.verified;
}

export async function requireVerified() {
  const me = await requireCompany();
  if (!me) return null;
  if (!isVerified(me)) return { unverified: true as const, company: me };
  return { unverified: false as const, company: me };
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
