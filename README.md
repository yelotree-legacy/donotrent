# DNR Registry — Do Not Rent List

A multi-tenant **Do Not Rent** registry for vehicle rental companies. Verified operators upload customer licenses + reasons; any company (or the public) can search by full name or license ID with exact, prefix, substring, alias, and fuzzy (Levenshtein) matching.

Seed data: **263 entries** imported from
[`supremesportrental.com/pages/do-not-rent-list`](https://supremesportrental.com/pages/do-not-rent-list)
including **263 license images**, **110 OCR-extracted license numbers**,
**91 license states**, **81 dates of birth**, **59 expiration dates**.

## Stack

- **Next.js 14** App Router + React Server Components + Server Actions
- **TypeScript**
- **Prisma** + Postgres (use Neon free tier, or Vercel Postgres in prod)
- **Vercel Blob** for license uploads (with local-fs fallback in dev)
- **Tailwind CSS**
- **iron-session** (cookie-based auth, no external IdP needed)
- **bcryptjs** for password hashing

For Vercel deployment see [DEPLOY.md](./DEPLOY.md).

## Search engine

`src/lib/search.ts` runs a 6-strategy pipeline against `fullNameNorm` + `licenseIdNorm`:

| # | Strategy        | Score | Notes                                                       |
|---|-----------------|-------|-------------------------------------------------------------|
| 1 | Exact license   | 2000  | If query has letters+digits and ≥4 chars, normalized match. |
| 2 | Exact name      | 1500  | Normalized full name equality.                              |
| 3 | Prefix          | 800   | `startsWith` on normalized name.                            |
| 4 | Substring       | 600   | `contains` on normalized name.                              |
| 5 | Alias / reason  | 700   | Searches alternate spellings + the primary reason text.     |
| 6 | Fuzzy           | ≤400  | Levenshtein within first-letter bucket, ≤4 edit distance.   |

Filters: severity, status, category, license state. Composable via URL.

## Routes

| Route                     | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `/`                       | Public search (name, license, filters).              |
| `/browse`                 | Alphabetical browse.                                 |
| `/entry/:id`              | Detail page: identity, photos, reasons, reports.     |
| `/entry/:id/report`       | File a corroborating report (auth required).         |
| `/dispute?entry=:id`      | Public dispute form. Sets entry → `DISPUTED`.        |
| `/login` / `/signup`      | Company auth.                                        |
| `/dashboard`              | Company overview + stats.                            |
| `/dashboard/entries`      | Manage your company's entries.                       |
| `/dashboard/upload`       | Upload license + capture full name + license ID.     |
| `/dashboard/edit/:id`     | Edit owned entries.                                  |
| `/dashboard/reports`      | Reports your company has filed.                      |
| `/dashboard/admin`        | Admin: companies, search analytics, disputes.        |
| `/api/search`             | JSON search endpoint.                                |

## Schema highlights

- `DnrEntry` is the core record. `fullNameNorm` and `licenseIdNorm` are
  the two indexed primary search keys.
- Many-to-many `EntryCategory` lets each entry carry multiple violation tags.
- `Photo` table holds license front/back, person, damage shots.
- `Report` is one-per-(entry, company); used for cross-operator corroboration.
- `Dispute` flips status to `DISPUTED`, surfaces in admin.
- `SearchLog` + `AuditEvent` give analytics & tamper-evident history.

## Quick start

You need a Postgres connection string. Easiest path: sign up for
[Neon](https://neon.tech) (free) and grab the URL.

```bash
cp .env.example .env
# Edit .env: paste your DATABASE_URL + DIRECT_URL from Neon
# Generate SESSION_PASSWORD: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

npm install
npm run db:push           # applies the schema to Postgres

# Choose ONE seed path:
npm run db:seed           # 240 entries — names + reasons only (fast, no images)
npm run db:seed:full      # 263 entries with OCR-extracted license IDs + photos

npm run dev
```

### Re-running the OCR pipeline

`scripts/out/extracted.json` is committed so `db:seed:full` works without
re-running OCR. To regenerate it from scratch (you'll need internet, ~3 min on a CPU):

```bash
# Save the source page HTML to .scrape-page.html, then:
npm run ocr:download   # downloads ~263 license images to public/uploads/imported/
npm run ocr:run        # tesseract.js OCR with sharp preprocessing
npm run ocr:extract    # heuristic field extraction (license #, state, DOB, expiry)
npm run db:seed:full   # apply to DB
```

### License-number extraction notes

`scripts/03-extract.ts` uses state-specific regex patterns for the major
states (FL, CA, GA, TX, NY, IL, NJ, MI, OH, PA, MA, …) plus a generic fallback
that requires ≥4 digits and rejects all-letter tokens. Tesseract's default
output is noisy on driver licenses; for production swap in **AWS Textract
AnalyzeID** or **Google Document AI ID Parser** at `scripts/02-ocr.ts`.

Then sign in with one of the seeded accounts:

| Email                                  | Password    | Role            |
|----------------------------------------|-------------|-----------------|
| `admin@dnr.local`                      | `admin1234` | network admin   |
| `import@supremesportrental.com`        | `admin1234` | imported entries|
| `demo@acmeexotics.test`                | `admin1234` | demo operator   |

## Deployment

- Switch `DATABASE_URL` to a Postgres connection string and change the Prisma
  `datasource` provider to `postgresql`.
- Set a strong `SESSION_PASSWORD` (≥32 chars).
- Move the local `/uploads/*` folder behind S3 or another object store
  (`src/lib/upload.ts` is the single integration point).
- Add a moderation flow before entries become public.

## Legal note

This kind of registry can carry defamation and FCRA-adjacent risk. Before
opening it to live data, talk to counsel about: verification before publish,
notice/dispute SLAs, retention, and data subject rights.
