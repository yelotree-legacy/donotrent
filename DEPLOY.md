# Deploying DNR Registry to Vercel

This project is Vercel-ready. The deployment requires three Vercel-managed
resources: a Postgres database (Neon), Blob storage (license uploads), and
the Next.js app itself.

## 1. Prerequisites

- Vercel account
- A custom domain (optional — you can use a free `.vercel.app` URL first)
- This repo pushed to GitHub: `https://github.com/yelotree-legacy/donotrent`

## 2. Import the project

1. Go to **https://vercel.com/new**
2. Click **Import Git Repository** → pick `yelotree-legacy/donotrent`
3. Framework: **Next.js** (auto-detected)
4. Root directory: leave blank (project root)
5. Click **Deploy** (it will fail the first build because env vars are missing — that's fine, fix in step 3)

## 3. Provision Postgres (Neon via Vercel)

1. From your project page → **Storage** tab → **Create Database**
2. Pick **Neon Postgres** → choose region (`iad1` / `us-east-1` to match `vercel.json`)
3. Connect the store to the project
4. Vercel automatically sets these env vars:
   - `DATABASE_URL` (pooled, used at runtime)
   - `DIRECT_URL` (direct, used by `prisma migrate`)
   - `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, etc. (extras — ignore)

## 4. Provision Blob storage

1. Same **Storage** tab → **Create Database** → **Blob**
2. Connect to project
3. Vercel sets `BLOB_READ_WRITE_TOKEN` automatically

## 5. Set the session secret

In project **Settings → Environment Variables**, add:

```
SESSION_PASSWORD = <32+ char random string>
```

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it for all three environments (Production, Preview, Development).

## 6. Initial migration + seed

The build command (`vercel.json`) runs `prisma migrate deploy` automatically.
But the database starts empty, so you also need to seed it once:

```bash
# Locally — pull the env vars Vercel set, then run:
npx vercel env pull .env.local
npm run db:push           # applies the schema (or use prisma migrate dev)
npm run db:seed:full      # imports 263 entries with OCR-extracted licenses
```

## 7. Redeploy

From the Vercel dashboard → **Deployments** → click the **⋯** menu on the
latest deployment → **Redeploy**. The build will now succeed.

## 8a. (Required for paid tiers) Stripe Billing for subscriptions

Sells the Starter / Pro / Business plans.

1. **Stripe dashboard** → **Products** → **Add product** — repeat for each:
   - "DNR Starter" with a $49/month recurring price
   - "DNR Pro" with a $149/month recurring price
   - "DNR Business" with a $399/month recurring price
2. After creating each, click into it and copy its **Price ID** (looks like `price_1Xxxx…`)
3. In Vercel **Settings → Environment Variables**, add:
   - `STRIPE_PRICE_STARTER` = `price_…`
   - `STRIPE_PRICE_PRO` = `price_…`
   - `STRIPE_PRICE_BUSINESS` = `price_…`
4. **Stripe → Developers → Webhooks** → either reuse the same endpoint as
   IDV (`/api/idv/webhook`) and **subscribe additional events**, or create a
   new endpoint pointing to `/api/billing/webhook`. The events to subscribe:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
5. If you used a separate endpoint, copy its signing secret to
   `STRIPE_BILLING_WEBHOOK_SECRET`. If you reused the IDV endpoint, the
   existing `STRIPE_WEBHOOK_SECRET` works for both.
6. **Stripe → Settings → Customer portal** → **Activate test/live link**.
   This is what the "Manage subscription" button on `/dashboard/billing` opens.
7. Redeploy. The Pricing page (`/pricing`) buttons now hand off to Stripe Checkout.

## 8b. (Optional) Stripe Identity for ID verification

The `/check` flow can hand off to **Stripe Identity** for document scanning,
liveness check, and selfie matching ($1.50 per verification).

1. **Stripe dashboard** → **Developers → API keys** → copy the **Secret key**
2. In Vercel **Settings → Environment Variables**, add:
   - `STRIPE_SECRET_KEY` = `sk_live_…` (or `sk_test_…` for testing)
3. **Stripe dashboard** → **Developers → Webhooks** → **Add endpoint**
   - URL: `https://<your-domain>/api/idv/webhook`
   - Events:
     - `identity.verification_session.verified`
     - `identity.verification_session.requires_input`
     - `identity.verification_session.canceled`
     - `identity.verification_session.processing`
4. Copy the **Signing secret** → in Vercel, add:
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…`
5. Redeploy. The IDV card on `/check/[id]` will switch from "not configured" to "Generate verification link".

When unset, IDV gracefully degrades — the card shows a notice and the rest of the
Rent Report works normally.

## 9. Custom domain

Project **Settings → Domains** → **Add Domain** → enter your domain.

Vercel shows the DNS record(s) to add at your registrar. For an apex domain:

```
Type: A    @    76.76.21.21
Type: CNAME www  cname.vercel-dns.com
```

DNS propagates in 1–60 minutes; Vercel auto-provisions the TLS cert.

## 10. Local development against Vercel Postgres

After step 3, you can develop locally against the same DB:

```bash
npx vercel link             # one-time, link this folder to the project
npx vercel env pull .env.local
npm run dev
```

Or keep a separate Neon dev database and use it via plain `.env`.

## Troubleshooting

- **`prisma migrate deploy` fails on first deploy** → the database connection
  string isn't reachable from Vercel's build region. Confirm the Neon DB region
  matches `vercel.json` `regions`.
- **Images don't load** → Shopify CDN host is in `next.config.mjs`'s
  `remotePatterns`; if you change to a different mirror, add it there.
- **License uploads fail** → `BLOB_READ_WRITE_TOKEN` not set, or the Blob
  store isn't connected to this project.
- **Sessions disappear between requests** → set `SESSION_PASSWORD` for all
  environments and redeploy.
