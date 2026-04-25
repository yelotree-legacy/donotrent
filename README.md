# DNR Registry — Do Not Rent List

A multi-tenant **Do Not Rent** registry for vehicle rental companies. Verified operators upload customer licenses + reasons; any company (or the public) can search by full name or license ID with exact, prefix, substring, alias, and fuzzy (Levenshtein) matching.

Seed data: **240 entries** imported from
[`supremesportrental.com/pages/do-not-rent-list`](https://supremesportrental.com/pages/do-not-rent-list).

## Stack

- **Next.js 14** App Router + React Server Components + Server Actions
- **TypeScript**
- **Prisma** + SQLite (dev) / Postgres-ready (prod)
- **Tailwind CSS**
- **iron-session** (cookie-based auth, no external IdP needed)
- **bcryptjs** for password hashing

No external services required to run locally.

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

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed   # imports 240 entries from the seed list
npm run dev
```

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
