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
