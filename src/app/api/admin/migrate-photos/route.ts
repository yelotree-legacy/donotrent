import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth";
import { getMigrationStatus, migrateBatch, findBlobToken, listBlobEnvNames } from "@/lib/photo-migration";

// Vercel: extend serverless duration so a batch has time to fetch + upload.
// Hobby plan caps at 60s; Pro at 300s. Free will respect 60.
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET() {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = await getMigrationStatus();
  const { token, name } = findBlobToken();
  return NextResponse.json({
    ...status,
    blobConfigured: Boolean(token),
    blobTokenName: name,
    blobEnvNames: listBlobEnvNames(),
  });
}

export async function POST(req: NextRequest) {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { token, name } = findBlobToken();
  if (!token) {
    return NextResponse.json({
      error: "Blob token not found",
      blobEnvNames: listBlobEnvNames(),
      hint: "Vercel Blob isn't connected to this deployment. Connect it via Storage tab and redeploy.",
    }, { status: 503 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const batchSize = Math.min(50, Math.max(1, Number(body.batchSize) || 20));
  const concurrency = Math.min(8, Math.max(1, Number(body.concurrency) || 4));

  const result = await migrateBatch({ batchSize, concurrency });
  return NextResponse.json({ ...result, tokenName: name });
}
