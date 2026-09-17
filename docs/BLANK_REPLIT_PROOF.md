# Blank Repl + git — proof checklist (freelancer)

Run on **your** account after fork `main` matches `mizlaa/doorlink` workflow PR.
Delete the Repl when done. Do not use GitHub Import.

1. Create **Blank** Repl (not Agent, not Import). Private.
2. Shell:

```bash
git init
git remote add origin https://github.com/EjembiEmmanuel/doorlink.git
git remote -v
git fetch origin
git checkout -B replit-ui-improvements origin/replit-ui-improvements
git reset --hard origin/replit-ui-improvements
```

3. Record **before Run**:
   - [ ] Agent task “Port imported Vercel app” started? (yes/no)
   - [ ] Root has `src/app/`, `prisma/`, `next.config.mjs`? (yes/no)
   - [ ] No `pnpm-workspace.yaml`, no root `artifacts/`? (yes/no)

4. Secrets: `DATABASE_URL`, `DIRECT_URL` → `npm install`, `db:push`, `db:seed`, Run.

5. One trivial commit on `replit-ui-improvements` → visible on GitHub?

6. Delete Repl.

If step 3 shows a port task, Blank+git failed for this account; document
Import+cancel+`git reset --hard` as the fallback in delivery notes.
