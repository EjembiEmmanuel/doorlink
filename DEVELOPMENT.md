# DoorLink — development log

Everything for your door, in one place.

---

## Session 1

### Module 0 — Project audit

**Finding: there is no existing codebase.** The workspace contained only the brief.
No package.json, no prior framework, no database, no assets, no technical debt.
So there is nothing to refactor around and no working code to protect — DoorLink
starts greenfield, which removes the "broken hybrid architecture" risk in §9 of the brief.

**Environment constraint, stated plainly:** this session ran inside a sandbox with
**no network access**, so `npm install` could not run. That means the code below is
written but **not compiled, not type-checked and not executed**. Treat every file as
reviewed-by-eye, not verified. First action on a connected machine:

```bash
npm install && npx prisma generate && npm run typecheck
```

Expect a small number of import and Prisma-type fixes on that first pass. Nothing in
the architecture depends on them.

### Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Matches the brief; server components keep authorisation on the server |
| Data | PostgreSQL via Prisma | Relational from the start — the compatibility engine is a join table, not JSON blobs |
| Auth | Provider-agnostic `getSession()` behind one interface | Supabase drops in without touching call sites; dev cookie works today and refuses to run in production |
| Money | Integer minor units everywhere | No float drift in a marketplace |
| Provenance | `DataSource` enum on every catalogue record | Brief rules 28 and 35 enforced in the schema, not by convention |
| Integrations | Central registry in `src/lib/integrations.ts` | One place decides whether a feature is live; UI renders an honest "not connected" state otherwise |
| Styling | Tailwind with a fixed token set | No arbitrary hex values in components |

### Module 1 — Design system

Palette drawn from the subject matter: spec-sheet white, powder-coat charcoal,
galvanised zinc greys, one signal blue for every interactive affordance, and amber
reserved **exclusively** for provenance and not-connected warnings so a caution can
never read as decoration. Type is IBM Plex Sans throughout, with IBM Plex Mono
restricted to identifiers — model codes, part numbers, order references — because
those are the data a technician reads off a plate. Radius is 3px: industrial, not
consumer-app.

Built: `Button`, `Panel`/`PanelHeader`/`PanelBody`, `Badge`, `SourceBadge`,
`Input`/`Select`/`Textarea`/`Field`, `Table`/`Th`/`Td`/`SpecList`,
`EmptyState`, `ErrorState`, `Skeleton`, `NotConnected`.

Quality floor built in, not announced: 44px minimum touch targets on `md`/`lg`
buttons (technicians use this outdoors, often gloved), visible keyboard focus on
every interactive element, `prefers-reduced-motion` respected globally, skip link
in the root layout.

### Module 2 — Public website (partial)

Done: root layout with metadata template and font loading, header with real mobile
navigation, footer, homepage, `/find`, `/find/unknown`, `/data-sources`, 404.

The homepage leads with the **working finder** rather than a hero image, because the
finder is the product. Demo-mode banner sits above everything.

### Module 4 — Database architecture (complete)

`prisma/schema.prisma` — 30 models covering identity and organisations, the
catalogue tree, documents, compatibility, marketplace, orders, leads, jobs, support,
notifications, audit log, staged imports and platform settings. Notable choices:

- `Compatibility` is a first-class model with `kind` and `confidence`, queried in
  both directions. It is never hardcoded in a component.
- `Document.supersedesId` forms a revision chain, so an old installation keeps its
  correct manual instead of being shown the current one.
- `OrderItem` carries `orgId` and its own status, so a multi-vendor basket fulfils
  per seller.
- `ImportJob` stages and validates rows; nothing reaches the catalogue until `APPLIED`.

### Module 6 — Product finder (partial)

`/api/finder` drives all five steps from one endpoint. Each step only offers
options that actually exist downstream — the category step, for example, lists only
categories the chosen brand has products in, so the cascade can never dead-end.
Breadcrumbs are clickable to step back. "I don't know my model" is built.

### Module 28 — Seed data

Three **invented** manufacturers (Northgate, Veltrix, Harbrook). No real brand,
model, manual or price appears anywhere in the seed. Fabricating those would be
worse than an empty catalogue, because a technician could act on it. Every seeded
row is `DataSource.DEMO` and renders a caution badge.

---

## Session 2

**Correction to Session 1's account of itself.** Session 1's own audit said the
workspace held only the brief and that the code below "is written but not
compiled, not type-checked and not executed." That was optimistic in one
respect: `prisma/schema.prisma` and the entire `src/` tree it describes were
never actually committed. Only the config and meta files reached the repo
(`package.json`, `next.config.mjs`, `tailwind.config.ts`, `DEVELOPMENT.md`,
`README.md`, `.env.example`, `.gitignore`, `tsconfig.json`, `postcss.config.mjs`).
`npx prisma generate` failed outright — there was no schema file to find — and
`npm run typecheck` "passed" only because there was no source for `tsc` to check.

Everything under `prisma/` and `src/` on this branch as of this session is a
**good-faith reconstruction from DEVELOPMENT.md and README.md's own
descriptions**, written this session — not a recovery of whatever the original
Session 1 code actually contained. The architecture decisions, module scope,
and status table above were treated as the spec. Model names, field names,
route shapes, and component boundaries in the current code are this session's
implementation choices, not the original ones. If the real Session 1 files
turn up later, expect real differences, not just cosmetic ones.

### What this session actually verified, and how

1. **Postgres + schema + seed.** Provisioned a local PostgreSQL 16 instance,
   pointed `DATABASE_URL`/`DIRECT_URL` at it, and ran `npx prisma db push`.
   All 30 models created their tables cleanly with no migration errors. Ran
   `npm run db:seed`; it completed and produced the expected row counts (5
   users, 3 manufacturers, 4 categories, 5 models, 9 specs, 5 documents, 2
   compatibility rows, 1 listing), checked directly with `psql`. Nothing
   broke in this step.
2. **Finder cascade, in an actual browser.** Ran `npm run dev` and drove the
   five-step cascade with a real Chromium instance (Playwright), not just
   `curl`: category → manufacturer → productLine → model → confirm. Confirmed
   at each step that only options with a downstream match are offered — e.g.
   choosing "Garage Door Openers" offers only Northgate as a manufacturer;
   choosing "Smart Locks" offers only Harbrook. Also exercised the edge case
   where a manufacturer has models in a category but no product line for it
   (Northgate's remote): the product-line step correctly shows an empty state
   with a working "skip" path through to the model step instead of a dead
   end. Breadcrumb back-navigation correctly clears everything selected after
   the target step. One unrelated issue surfaced in the browser console: a
   404 for `/favicon.ico` — there is no favicon in the project. Cosmetic, not
   fixed yet.
3. **No-database behavior — a real gap, not fixed.** Unset `DATABASE_URL`/
   `DIRECT_URL` and restarted the dev server. The site does **not** crash —
   the shell, header, footer, and every page other than the finder's live
   data still render — but this does not match what the README promises
   ("the finder shows an honest 'catalogue not connected' state rather than
   fake products"). What actually happens: `/api/finder` throws an uncaught
   `PrismaClientInitializationError` and returns a bare 500, and the finder
   panel falls back to the generic `<ErrorState>` ("Something went wrong /
   Could not load options. Try again.") — the same message a real transient
   failure would produce. There is no code today that checks
   `isConnected('catalogue')` (no such check exists in
   `src/lib/integrations.ts`) or renders `<NotConnected />` for the finder.
   This is left as a known, reported gap rather than patched in the same pass
   that was supposed to be verification, not repair.

### Dependency bumps considered this session

- **`vitest` 2.x → 5.x**: taken. Self-contained — no test files exist yet to
  migrate, and no other package in this project depends on the vitest 2 API
  surface. Resolves the one `critical` npm audit advisory.
- **`next` 15 → 16**: not taken this session. It removes `next lint`, which
  would require rewriting the `lint` script to call `eslint` directly and
  adding an ESLint config and dependency that don't exist in this project
  yet — a larger, unrelated change bundled into what should be a small
  version bump. Left as a deliberate follow-up rather than done quietly
  alongside the vitest bump.

### Module 6 (continued) — model profile page

Built `/model/[id]` — specs, documents, compatible parts (both directions of
the `Compatibility` join, with a confidence badge), and active listings.
Linked to it from the finder's confirm step ("View full product page").
Verified in a browser against the seeded data, not just typechecked:

- DR-700's page shows its three specs, its two documents behind a
  `<NotConnected>` panel (storage isn't configured, so titles are listed but
  nothing is downloadable), its `REMOTE_PAIR` link to RC-2, and correctly
  shows no listings (none were seeded for it).
- RC-2's page shows both of its compatibility links (`CONFIRMED` to DR-700,
  `LIKELY` to DR-900) and its one seeded listing from Demo Door Supplies.
- An unknown id renders the real `not-found.tsx` page with a `404` status,
  not a crash.
- If the catalogue database itself is unreachable, the page catches the
  Prisma error and renders `<NotConnected feature="The product catalogue" />`
  instead of a 500 — this page does check, unlike `/api/finder` (see the
  no-database finding above, which was left as-is rather than fixed here).

### Follow-up — `/api/finder`'s no-database gap (finding 3, above) is fixed

Added `src/lib/db-errors.ts`: `isDatabaseUnreachable(error)` recognizes
`Prisma.PrismaClientInitializationError` and the connection-shaped
`PrismaClientKnownRequestError` codes (P1000–P1017 family — auth failure,
can't reach server, timeout, TLS error, etc.), as opposed to a bug in a
query. `/api/finder`'s handler now wraps its database calls in `try/catch`
and returns `503 { error: 'catalogue_not_connected', message }` when
`isDatabaseUnreachable` is true, instead of letting the error escape as a
bare 500. `FinderCascade` checks for a `503` response and renders
`<NotConnected feature="The product catalogue" />` in place of the
options list or the confirm panel, instead of the generic `<ErrorState>`
it used to fall back to. The model page's own catch was tightened to use
the same helper too, so a real query bug there gets rethrown to Next's
error handling instead of being silently relabelled "not connected."

Verified two different unreachable-database scenarios, not just the
missing-env-var case from finding 3:

- **`DATABASE_URL` unset** (finding 3's original case): still 503 /
  `<NotConnected>`, not the old bare 500.
- **`DATABASE_URL` set but Postgres stopped** (`service postgresql stop`,
  a closer match to a real outage than a missing env var): `curl` against
  `/api/finder?step=category` returned the same 503 payload; a real
  Chromium browser showed `<NotConnected>` on both the homepage finder and
  `/model/[id]`. Restarted Postgres and re-ran the full five-step cascade
  in the browser afterward to confirm the fix doesn't regress the working
  case — all four categories, correct manufacturer/product-line/model
  narrowing, and the confirm panel all still work exactly as in finding 2.

---

## Session 3 — Module 3, sign-in and registration

Built the two screens Module 3 was missing, against the existing
`getSession()` interface rather than adding a new one.

**Dev-only mechanism, kept out of the provider interface.** `src/lib/
dev-session.ts` (`'use server'`) holds three Server Actions —
`devSignInAction`, `devRegisterAction`, `devSignOutAction` — that read and
write the same `doorlink-dev-session` cookie `DevCookieSessionProvider`
already read (constant factored out to `src/lib/session-cookie.ts` so both
sides import it instead of duplicating the string). These actions are
deliberately *not* part of the `SessionProvider` interface in `auth.ts`:
when Supabase gets wired in, this whole file is replaced, not extended.
Both actions refuse outright in production, same as the provider already
did — checked with `process.env.NODE_ENV !== 'production'` in the page
components too, so production renders `<NotConnected feature="Sign-in" />`
instead of a form that can't do anything.

**Registration doesn't touch the catalogue.** Registering as a supplier
creates an `Organization` + `SupplierProfile` (`verified: false`, same as
the seed). Registering as a manufacturer creates only an `Organization` —
deliberately *not* a `Manufacturer` catalogue row. Linking a manufacturer's
account to a verified `Manufacturer` entity is left for an admin to do
(Module 5, still outstanding); letting a signup form create that link
itself would let anyone inject an unverified catalogue entry, which is
exactly what the `DataSource` provenance system exists to prevent.

**A robustness fix this forced:** `Header` now calls `getSession()` on
every single page (it needs to know whether to show "Sign in" or a name +
sign-out button), so a database error inside `getSession()` would have
taken down every page on the site, not just the finder. Tightened
`DevCookieSessionProvider.getSession()` to catch a database-unreachable
error (via the same `isDatabaseUnreachable` helper) and return `null`
instead of throwing — failing to "signed out" rather than crashing.

### What was verified, in a real browser and against the database directly

- Signed in via a demo-account quick-select button on `/sign-in`; header
  updated from "Sign in" to the account's name + "Sign out". Clicked
  "Sign out"; header reverted. (The first pass of this test used
  `page.waitForURL()` after already being on that URL, which no-ops — the
  server log showed the sign-out `POST` correctly getting a `303`, so the
  first "sign-out didn't work" reading was a test bug, not an app one;
  re-tested waiting on the actual header content and confirmed it works.)
- Signing in with an email that doesn't exist shows "No account found with
  that email." inline and stays on `/sign-in` (`POST /sign-in` returned
  `200`, not a redirect) — confirmed via the rendered DOM, since Next's own
  built-in route announcer also uses `role="alert"`, which the first
  Playwright selector matched ambiguously before this was narrowed down.
- Registered one account of each of the four self-registrable roles
  (`CUSTOMER`, `TECHNICIAN`, `SUPPLIER`, `MANUFACTURER`) and checked the
  result directly with `psql`, not just the UI: the `TechnicianProfile` row
  exists for the technician; `Organization` + `OrganizationMember(OWNER)`
  exist for both the supplier and manufacturer; `SupplierProfile` exists
  only for the supplier's organization; and — the specific thing worth
  checking — the `Manufacturer` catalogue table has zero rows matching the
  test manufacturer's name after registering it.
- Registering a second account with an email already in use stays on
  `/register` instead of creating a duplicate `User` row.
- Signed in, then stopped Postgres mid-session with the session cookie
  still set: `GET /` and `GET /find` both still returned `200` (header
  fell back to "Sign in" rather than the page crashing), and
  `/api/finder` still returned its `503` from the Session 2 fix. No
  unhandled exceptions in the server log. Restarted Postgres afterward.

---

## Status by module

| # | Module | Status |
|---|---|---|
| 0 | Audit and architecture | Done |
| 1 | Design system | Core primitives done; modal, drawer, tabs, toast outstanding |
| 2 | Public website | ~30% — 6 of ~18 pages |
| 3 | Auth and roles | RBAC matrix, guards, and dev-mode sign-in/register screens done and verified; Supabase wiring still outstanding |
| 4 | Database architecture | Done; `db push` + seed verified against a local Postgres this session |
| 5 | Product database | Schema done; admin CRUD outstanding |
| 6 | Product finder | Cascade, model profile page (`/model/[id]`), and honest no-DB handling all done and verified in a browser (see Session 2) |
| 7 | Technical library | Schema done; documents listed on the model page, download UI still outstanding (needs storage) |
| 8 | Compatibility engine | Schema, seed, and bidirectional query done via the model page; admin UI to create/edit links outstanding |
| 9–12 | Customer / technician / supplier / manufacturer portals | Navigation and permissions defined; screens outstanding |
| 13–15 | Marketplace, search, checkout | Schema done; UI outstanding |
| 16–18 | Leads, support, admin | Schema done; UI outstanding |
| 19 | SEO | Metadata template and canonicals started; sitemap and JSON-LD outstanding |
| 20–25 | Notifications, analytics, security, performance, testing, production | Foundations only |
| 26 | AI features | Interfaces present, honestly disconnected |

---

## Next actions, in order

1. ~~`npm install`, `prisma generate`, `npm run typecheck`.~~ Done (Session 1/2).
2. ~~Provision Postgres, `prisma db push`, `npm run db:seed`.~~ Done and verified (Session 2).
3. ~~Model profile page `/model/[id]`.~~ Done and verified (Session 2).
4. ~~Make `/api/finder` fail honestly when the database is unreachable.~~
   Done and verified (Session 2) — see the follow-up under Module 6.
5. ~~Sign-in and registration screens against the existing session interface.~~
   Done and verified (Session 3) — dev-mode only, refuses in production.
6. Admin catalogue CRUD, then the document upload workflow (Module 29).
7. Marketplace listing and product pages.
8. Wire in a real auth provider (Supabase) to replace `src/lib/dev-session.ts`
   — see "Still needs you, not code" below.

## Still needs you, not code

- Real manufacturer, model and part data, and permission to host their manuals.
- Supplier onboarding terms and the commission rate (`SupplierProfile.commissionBps` is 0).
- Stripe account for Connect payouts.
- Supabase project (auth + storage) or a decision to self-host.
- Whether technician "verified" status requires a real accreditation check.
