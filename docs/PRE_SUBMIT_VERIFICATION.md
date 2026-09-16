# Pre-submission verification

Run before Fiverr delivery. Any fail = not done.

## A. Local (app not rebuilt)

```bash
npm ci
npx prisma generate
npm run typecheck
npm test
```

Spot-check: payments stub and `<NotConnected />` still present (not bugs).

## B. GitHub

```bash
gh repo view mizlaa/doorlink --json isPrivate,visibility
gh api repos/mizlaa/doorlink/branches --jq '.[].name'
gh api repos/mizlaa/doorlink/branches/main/protection
```

- Public repo; `main` + `replit-ui-improvements` exist
- Protection on `main` not `404` (or process-only fallback documented in HANDOVER.md)
- Direct push to `main` rejected
- PR template and green CI on workflow-lock merge

## C. Throwaway Replit (freelancer)

See `docs/THROWAWAY_REPLIT_CHECKLIST.md`.

## D. Client Repl

See `HANDOVER.md` §2 — commit on `replit-ui-improvements` visible on GitHub; Repl private.

## E. Recovery drill

On a scratch clone: simulate bad state, then `git reset --hard origin/replit-ui-improvements`; `src/app/` returns.
