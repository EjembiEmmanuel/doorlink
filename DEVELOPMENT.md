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

---

## Status by module

| # | Module | Status |
|---|---|---|
| 0 | Audit and architecture | Done |
| 1 | Design system | Core primitives done; modal, drawer, tabs, toast outstanding |
| 2 | Public website | ~30% — 6 of ~18 pages |
| 3 | Auth and roles | RBAC matrix and guards done; sign-in/up screens and Supabase wiring outstanding |
| 4 | Database architecture | Done, unmigrated |
| 5 | Product database | Schema done; admin CRUD outstanding |
| 6 | Product finder | Cascade done; model profile page outstanding |
| 7 | Technical library | Schema done; UI outstanding |
| 8 | Compatibility engine | Schema and seed done; query service and UI outstanding |
| 9–12 | Customer / technician / supplier / manufacturer portals | Navigation and permissions defined; screens outstanding |
| 13–15 | Marketplace, search, checkout | Schema done; UI outstanding |
| 16–18 | Leads, support, admin | Schema done; UI outstanding |
| 19 | SEO | Metadata template and canonicals started; sitemap and JSON-LD outstanding |
| 20–25 | Notifications, analytics, security, performance, testing, production | Foundations only |
| 26 | AI features | Interfaces present, honestly disconnected |

---

## Next actions, in order

1. `npm install`, `prisma generate`, `npm run typecheck` — fix the first-pass errors.
2. Provision Postgres, `prisma db push`, `npm run db:seed`.
3. Model profile page `/model/[id]` — specs, documents, compatible parts, listings.
   This is the page the whole finder points at and the highest-value screen left.
4. Sign-in and registration screens against the existing session interface.
5. Admin catalogue CRUD, then the document upload workflow (Module 29).
6. Marketplace listing and product pages.

## Still needs you, not code

- Real manufacturer, model and part data, and permission to host their manuals.
- Supplier onboarding terms and the commission rate (`SupplierProfile.commissionBps` is 0).
- Stripe account for Connect payouts.
- Supabase project (auth + storage) or a decision to self-host.
- Whether technician "verified" status requires a real accreditation check.
