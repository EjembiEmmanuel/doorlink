# Throwaway Replit import checklist (freelancer)

Run once on **your** Replit account, then **delete** the Repl. This does not
replace the client's Repl on their account.

1. [replit.com/import](https://replit.com/import) → **GitHub** → `mizlaa/doorlink`
2. **Not** Import from Vercel
3. File tree includes `src/app/`, `prisma/`, `next.config.mjs`, `.replit`
4. No `pnpm-workspace.yaml`, no root `artifacts/` scaffold, no `[agent] stack = "PNPM_WORKSPACE"` in `.replit`
5. Git remote → `mizlaa/doorlink`
6. Checkout `replit-ui-improvements`, `git pull` works
7. Do **not** commit to `main`
8. Delete the Repl when done

If conversion happened: `git fetch && git reset --hard origin/replit-ui-improvements` and document in delivery notes — importer is not fully fixed.
