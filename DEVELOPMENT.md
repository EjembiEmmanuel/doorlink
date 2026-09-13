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

## Session 4 — Module 5, admin catalogue CRUD (partial, by design)

Scoped this to a real, fully-verified vertical slice rather than thin CRUD
across every catalogue entity: **Manufacturers and Categories** are done.
Models, Documents, and Compatibility admin screens are not — the `/admin`
dashboard says so plainly (`Admin screen not built yet.` on those three
stat tiles) rather than linking to something that doesn't exist.

**Every mutation re-checks permission itself.** `/admin`'s layout gates on
`can(session.role, 'catalogue:write')` and redirects, but Server Actions
are directly callable regardless of which page rendered them — so
`createManufacturerAction`, `updateManufacturerAction`,
`deleteManufacturerAction`, and their category equivalents each call
`requirePermission()` again before touching the database. The layout gate
is for navigation; the actions are the actual boundary.

**Delete is blocked when a row is in use, with a real reason shown.**
Deleting a manufacturer that still has models, or a category that still
has models or subcategories, catches Prisma's `P2003` (foreign key
violation) and returns a specific error inline — "Cannot delete: this
manufacturer still has product lines or models linked to it" — rather than
either crashing or silently failing.

**A real bug this surfaced, not just a design choice:** the first pass at
verifying category deletion found that deleting a parent category with a
child did *not* get blocked — it succeeded silently and orphaned the child
into a top-level category. Root cause: `parentId` is an optional field, and
Prisma's default `onDelete` for an *optional* relation is `SetNull`, unlike
the `Restrict` default for the required relations (`Model.categoryId`, for
instance) everywhere else in the schema. Fixed by adding an explicit
`onDelete: Restrict` to `Category.parent` in `schema.prisma`, then
`prisma db push` to apply it — confirmed the new constraint's delete action
directly with `psql` (`SELECT confdeltype FROM pg_constraint ...` now
reads `r`, not the `SetNull` default), not just by re-testing the UI.

**Registration's earlier catalogue safeguard (Session 3) still holds
here too** — nothing in these admin screens lets a `MANUFACTURER`-role
user's own organization write directly into the `Manufacturer` catalogue
table; that link stays admin-only and manual, on purpose.

### What was verified, in a real browser and against the database directly

- RBAC gating on `/admin`: signed out → redirected to `/sign-in`; signed in
  as `customer@demo.doorlink` → redirected to `/`, no "Admin" link shown in
  the header; signed in as `admin@demo.doorlink` → "Admin" link appears,
  dashboard loads with counts matching `psql` directly (3 manufacturers, 4
  categories, 5 models, 5 documents, 2 compatibility links).
- Manufacturer CRUD: created one, confirmed it in the list; edited its name,
  confirmed the change; attempted to delete Northgate (has product lines
  and models) and got the in-use error with the row count unchanged;
  deleted the unused test manufacturer and confirmed it was gone.
- Category CRUD, including the bug above: created a parent and a child
  with the parent selected via the dropdown, confirmed the child's row
  shows the parent's name; attempted to delete the parent while the child
  still pointed at it (this is what caught the `SetNull` bug); after the
  schema fix, re-ran the same sequence and got the correct in-use error
  instead, then deleted the child and confirmed the parent could then be
  deleted successfully; separately confirmed deleting Smart Locks (has a
  seeded model) is blocked the same way.
- Test debris cleanup: the crashed first attempt at the category test left
  two orphaned rows in the database from before the selector bug was
  fixed — found and removed directly with `psql`, then confirmed row
  counts were back to the original 3/4/5 baseline.

### Module 5 (continued) — Model admin CRUD

Added `/admin/models`: list, create, edit, delete. Manufacturer and
category are required selects; product line is optional and the form
filters its options client-side to only the chosen manufacturer's lines
(a plain UX convenience — the action re-validates the pairing
server-side regardless, since the client-side filter is trivially
bypassable). Slug auto-generates as `{manufacturer-slug}-{name}` when
left blank, mirroring the seed's own naming convention. Model deletion
relies on the schema's existing cascade behavior rather than needing a
new fix: `ModelSpec`, `Document`, `Compatibility`, and `Favorite` all
cascade-delete with their model (they're meaningless without it); `Job`
and `Lead` null out their optional reference; `Listing` is a required
relation with no cascade specified, so it defaults to `Restrict` —
deleting a model that's still listed for sale is blocked, same pattern
as manufacturers and categories.

Verified in a real browser and against the database: created a model
under Northgate / Garage Door Openers / Drive Series and confirmed it
appeared correctly attributed in the list; attempted a second model
with a model code already used by the same manufacturer and confirmed
it was rejected without creating a row (`POST .../new` returned `200`,
not a redirect — checked in the server log, since the rendered error
text was once again obscured by the same Next.js route-announcer
`role="alert"` collision noted in Session 3, not an app bug); edited
the model's name and confirmed the change; deleted it and confirmed
removal; then attempted to delete RC-2 (has a seeded active listing)
and got the same in-use error pattern as manufacturers/categories.
Model count was back at the 5-row baseline afterward, confirming no
test debris was left behind this time.

### Module 8 (continued) — Compatibility link admin CRUD

Added `/admin/compatibility`: list, create, edit, delete. Unlike
manufacturers, categories, and models, this is a leaf table — nothing
references a `Compatibility` row, so delete needed no in-use check at
all; the action comment says so explicitly rather than leaving the
absence of that check looking like an oversight. Two validations that
do matter here: a model can't be linked to itself (`fromModelId !==
toModelId`, checked with a Zod `.refine()`), and the same
`(fromModelId, toModelId, kind)` triple can't be created twice, since
that's the schema's own unique constraint — checked explicitly first so
the error names the actual problem instead of surfacing a raw
constraint-violation message.

Verified in a real browser and against the database: created a
cross-manufacturer link (Veltrix's RS-40 → Harbrook's SL-200, kind
Accessory) and confirmed it rendered correctly in the list; attempting
the identical triple again was rejected (confirmed via the server log's
`200` non-redirect response, same verification style as the Model
duplicate-code case); attempting a self-link (same model both sides)
was rejected the same way; edited the link's confidence from Likely to
Confirmed and confirmed the change; deleted it and confirmed removal.
Row count was back at the 2-link baseline afterward.

That's four of the five catalogue entities with working admin CRUD —
Documents is the one left, and it stays blocked on Supabase storage
being connected (see "Still needs you, not code").

## Session 5 — Modules 13–15, marketplace listing and product pages

Built both halves: a public browse page (`/marketplace`, showing only
`ACTIVE` listings) and supplier-side listing management
(`/supplier/listings` — list, create, edit, delete), scoped to the
signed-in supplier's own organization.

**The provenance boundary from Session 3 extends here too.** A supplier
creating their own listing cannot choose its `DataSource` — it's hardcoded
to `COMMUNITY_SUBMITTED` in the action, never exposed as a form field.
Letting a supplier mark their own listing `ADMIN_VERIFIED` or
`MANUFACTURER_VERIFIED` would be self-attested verification, which is
exactly what the whole `DataSource` system exists to prevent. This is the
same shape of decision as "registering as a manufacturer doesn't create a
`Manufacturer` catalogue row" — a different entity, the same principle.

**Two layers of ownership enforcement, not one.** `/supplier`'s layout
gates on `can(session.role, 'listing:write:own') && session.organizationId`
and redirects otherwise — but as with `/admin`, Server Actions are
directly callable regardless of which page rendered them, so
`createListingAction`, `updateListingAction`, and `deleteListingAction`
each re-check both the permission and the organization requirement via
`assertCanManageOwnListings()`, and update/delete additionally verify the
target listing's `organizationId` actually matches the caller's before
touching it. The edit *page* does the same ownership check before ever
rendering the form (not just the action) — a supplier can't view another
supplier's listing pre-filled into an edit form even read-only, and a
mismatch renders the real `not-found.tsx`, not a distinguishable
"forbidden" response, so probing listing ids can't be used to enumerate
which ones exist.

### What was verified, in a real browser and against the database directly

- Public `/marketplace` shows the seeded RC-2 listing (Demo Door Supplies,
  $45.00) with no sign-in required.
- Signed in as `supplier@demo.doorlink`: header shows "My listings" and
  not "Admin" (confirming the nav computation is permission-specific, not
  a blanket "any signed-in user" check); `/supplier/listings` shows their
  own seeded listing.
- Created a listing for Northgate's DR-700, status Active: appeared in
  both the supplier's own list and the public marketplace immediately.
  Edited it to Paused: disappeared from the public marketplace but stayed
  visible in the supplier's own list (status filtering, not deletion).
  Deleted it: gone from both.
- Signed in as `customer@demo.doorlink` and confirmed `/supplier/listings`
  redirects to `/` (customers don't have `listing:write:own`).
- Registered a **second, brand-new** supplier account through `/register`
  and confirmed it starts with zero listings, then tried to load the
  *first* supplier's seeded listing's edit URL directly
  (`/supplier/listings/demo-listing-rc-2/edit`) while signed in as the
  second supplier — got a real `404`, not the listing's data and not a
  permission page. This is the actual cross-tenant boundary test, not
  just a same-account round trip.
- Listing count was back at the 1-row baseline afterward.

---

## Status by module

| # | Module | Status |
|---|---|---|
| 0 | Audit and architecture | Done |
| 1 | Design system | Core primitives done; modal, drawer, tabs, toast outstanding |
| 2 | Public website | ~30% — 6 of ~18 pages |
| 3 | Auth and roles | RBAC matrix, guards, and dev-mode sign-in/register screens done and verified; Supabase wiring still outstanding |
| 4 | Database architecture | Done; `db push` + seed verified against a local Postgres this session |
| 5 | Product database | Manufacturer, Category, and Model admin CRUD done and verified; Document/Compatibility admin screens still outstanding |
| 6 | Product finder | Cascade, model profile page (`/model/[id]`), and honest no-DB handling all done and verified in a browser (see Session 2) |
| 7 | Technical library | Schema done; documents listed on the model page, download UI still outstanding (needs storage) |
| 8 | Compatibility engine | Schema, seed, bidirectional query, and admin CRUD (`/admin/compatibility`) all done and verified |
| 9–12 | Customer / technician / supplier / manufacturer portals | Navigation and permissions defined; screens outstanding |
| 13–15 | Marketplace, search, checkout | Public browse page and supplier listing CRUD done and verified; search and checkout still outstanding |
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
6. ~~Admin catalogue CRUD.~~ Manufacturers, Categories, Models, and
   Compatibility links done and verified (Session 4). The one entity left
   is Documents, which is blocked on Supabase storage for actual file
   upload rather than being a design gap — see item 7.
7. The document upload workflow (Module 29) — blocked on Supabase storage
   being connected; see "Still needs you, not code" below.
8. ~~Marketplace listing and product pages.~~ Public `/marketplace` browse
   page and supplier-scoped listing CRUD (`/supplier/listings`) done and
   verified (Session 5), including the cross-tenant ownership boundary.
   Still outstanding: search/filtering on the marketplace page, cart, and
   checkout (blocked on Stripe — see "Still needs you, not code").
9. Wire in a real auth provider (Supabase) to replace `src/lib/dev-session.ts`
   — see "Still needs you, not code" below.

## Still needs you, not code

- Real manufacturer, model and part data, and permission to host their manuals.
- Supplier onboarding terms and the commission rate (`SupplierProfile.commissionBps` is 0).
- Stripe account for Connect payouts.
- Supabase project (auth + storage) or a decision to self-host.
- Whether technician "verified" status requires a real accreditation check.
