# Pre-submission verification

## A. Local

```bash
npm ci
npx prisma generate
npm run typecheck
npm test
```

## B. GitHub (`mizlaa/doorlink`)

- `main` at expected SHA; `replit-ui-improvements` exists
- Branch protection on `main` not `404` (or documented in HANDOVER.md)
- Workflow PR merged with green CI

## C. Blank Repl proof

`docs/BLANK_REPLIT_PROOF.md` completed on freelancer account.

## D. Client Repl

If already connected and pushing, leave it. Otherwise HANDOVER.md §2.
