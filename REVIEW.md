# Codebase review (workflow job)

Review date: September 2026. Branch: `claude/workflow-lock`. App code on `main` was not redesigned; this pass checked health, merge/conflict risks, and stale handoff docs.

## Health evidence

| Check | Result | Notes |
|-------|--------|--------|
| `npm run typecheck` | Pass | |
| `npm test` | Pass | 42 tests in 4 files — unit coverage is narrow, not full-app |
| `npm run build` | Pass | 56 routes generated; **CI does not run build** (only typecheck + test + import-integrity) |
| `npm ci` | Failed then fixed | Lockfile was out of sync with resolved React versions; see **Found and fixed** |

Run on a machine with `npm install` / `npm ci`, then `DATABASE_URL` + `db:push` + `db:seed` for local dev (same as `WORKFLOW.md`).

## Found and fixed

- **`package-lock.json` vs `npm ci`** — GitHub Actions uses `npm ci`. The committed lockfile did not match what npm resolves for `react` / `react-dom` (^19.0.0), so CI could fail with `ERESOLVE` / lock mismatch. Regenerated lockfile so `npm ci` succeeds after a clean checkout.

No other demonstrated breakers (no failing typecheck, tests, or build; no remaining `session!` in `src/`).

## Found, will not fix

| Item | Why |
|------|-----|
| Missing-table 500 when `db:push` not run | Deliberate; must stay loud (`WORKFLOW.md`) |
| `PaymentsNotConfiguredError`, empty entitlements, no Subscribe on `/plans` | Brief §9 — honest until Stripe |
| `<NotConnected />` across the app | Honest disconnected state, not missing work |
| Passwordless dev cookie auth | Supabase later; refuses production |
| `X-Frame-Options: DENY` (`next.config.mjs`) | Security default; Replit iframe preview may differ — document only |
| Admin create slug race (`P2002`) | Needs two admins at once; noted in `DEVELOPMENT.md` Session 15 |
| No root `error.tsx` | Polish gap, app works without it |
| `npm audit` (5 issues, dev/transitive) | `audit fix --force` bumps Next/Capacitor majors — out of scope |
| Message attachments, report/safety flow, worker **reply write** UI | Not built yet; display of `workerReply` exists on technician profiles |
| `DEVELOPMENT.md` “Status by module” table | Stale history — use this file + live routes, not that table |

## Already fixed earlier

See **`DEVELOPMENT.md` Session 15** (full codebase audit): production build crash on `/support` from `session!` during prerender; `P2025` / not-found handling in admin deletes and support updates; 3D DoF white-background bug. No recurrence found in this pass.

## Structure and conflict risks (for parallel Replit + Claude Code)

- **Nav arrays** — `Header.tsx`, `MobileTabBar.tsx`, `admin/layout.tsx`: both sides may edit; keep every permission-gated entry when merging.
- **`page.tsx` split** — data/query above `return()`, JSX inside `return()`: Replit owns markup; Claude owns server data and actions. Git will not split this automatically.
- **Stale `FRONTEND_HANDOFF.md` §7** — listed screens as missing that already exist; corrected in this PR so a UI pass does not assume routes are absent.
- **Import / port scaffold** — `pnpm-workspace.yaml`, `.migration-backup/`, Agent `artifacts/` at repo root: recovery is `git reset --hard` from GitHub, not commit (`WORKFLOW.md`).

## Intentional non-bugs (brief §9)

Do not “fix”: payments stub, subscriptions with no charge path, entitlements gate off, NotConnected panels, dev-only sign-in without passwords, placeholder 3D realism. Do not make dead controls look live.
