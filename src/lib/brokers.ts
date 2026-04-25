// Helpers for the Broker Registry: slug generation, computing aggregates,
// and a tiny search routine.

import { prisma } from "./db";

const slugBase = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function uniqueBrokerSlug(name: string): Promise<string> {
  let base = slugBase(name) || "broker";
  let slug = base;
  let i = 2;
  while (await prisma.broker.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function recomputeBrokerAggregates(brokerId: string): Promise<void> {
  const reviews = await prisma.brokerReview.findMany({
    where: { brokerId },
    select: { rating: true },
  });
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount === 0
      ? null
      : reviews.reduce((s, r) => s + r.rating, 0) / reviewCount;
  await prisma.broker.update({
    where: { id: brokerId },
    data: { reviewCount, avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null },
  });
}

export type BrokerSearchHit = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  reviewCount: number;
  avgRating: number | null;
  description: string | null;
};

export async function searchBrokers(query: string, limit = 30): Promise<BrokerSearchHit[]> {
  const q = query.trim();
  if (!q) {
    return prisma.broker.findMany({
      orderBy: [{ reviewCount: "desc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true, slug: true, name: true, city: true, state: true,
        reviewCount: true, avgRating: true, description: true,
      },
    });
  }
  const like = q;
  return prisma.broker.findMany({
    where: {
      OR: [
        { name: { contains: like, mode: "insensitive" } },
        { aliases: { contains: like, mode: "insensitive" } },
        { email: { contains: like.toLowerCase() } },
        { instagram: { contains: like } },
        { city: { contains: like, mode: "insensitive" } },
      ],
    },
    orderBy: [{ reviewCount: "desc" }, { name: "asc" }],
    take: limit,
    select: {
      id: true, slug: true, name: true, city: true, state: true,
      reviewCount: true, avgRating: true, description: true,
    },
  });
}

export const EXPERIENCE_TYPES = [
  { value: "payment", label: "Payment / nonpayment" },
  { value: "fraud", label: "Fraud / misrepresentation" },
  { value: "communication", label: "Communication / responsiveness" },
  { value: "quality", label: "Quality of customers brought" },
  { value: "other", label: "Other" },
] as const;
