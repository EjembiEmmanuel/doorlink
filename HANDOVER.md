# Doorlink workflow handover (for mizlaa)

Steps only you can click (the freelancer has WRITE, not admin).

## 1. Protect `main` (GitHub Free, public repo)

Settings → Branches → **Add branch protection rule** → branch name `main`:

1. **Require a pull request before merging**
2. **Do not allow bypassing** (include administrators if offered)
3. Block **force pushes** and **branch deletion**
4. After the workflow PR has a **green CI run**, enable **Require status checks**
   and select the **CI / verify** job

Verify:

```bash
gh api repos/mizlaa/doorlink/branches/main/protection
```

If this returns `404`, protection is not on yet.

Making the repo **private** again on GitHub Free without Pro disables classic
protection on `main`.

## 2. Connect Replit (your account)

**Do not use Import from GitHub** — it always tries to port Next.js to a pnpm
workspace because `package.json` includes `next`.

If you **already have a private Repl** that pushes to `mizlaa/doorlink` on
`replit-ui-improvements`, keep using it. Do not recreate it.

If you need a **new** Repl, follow **Setting up a fresh Repl** in `WORKFLOW.md`
(Blank Repl + Shell git to `mizlaa/doorlink`).

Grant collaborators with **Invite** (Replit), not by sharing your password.

## 3. Day to day

See `WORKFLOW.md` (written for phone use).

## 4. Safety reminders

- Do not merge unsolicited PRs without reading the full diff.
- Never use GitHub Import for this repo.
- Ping the freelancer on merge conflicts in nav files or `package.json`.
