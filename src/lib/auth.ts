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

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
