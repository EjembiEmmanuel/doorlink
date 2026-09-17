# Working in Replit and Claude Code on the same project

Two tools, one codebase, nothing handed over and nothing lost.

**GitHub is the connection.** Replit and Claude Code never talk to each
other. They both read and write this repository, and that is the whole
mechanism. Switching tools is just a matter of pushing before you leave
and pulling before you start.

```
                    ┌──────────────────────────┐
                    │   github.com/mizlaa/      │
                    │        doorlink          │
                    │                          │
                    │   main  ← the truth      │
                    └────────┬─────────┬───────┘
                       pull  │         │  pull
                       push  │         │  push
              ┌─────────────▼──┐   ┌──▼──────────────┐
              │     Replit     │   │  Claude Code    │
              │                │   │                 │
              │  interface,    │   │  backend, data, │
              │  styling, 3D   │   │  features, APIs │
              │                │   │                 │
              │ branch:        │   │ branch:         │
              │ replit-ui-     │   │ claude/*        │
              │ improvements   │   │                 │
              └────────────────┘   └─────────────────┘
```

## The rule that keeps it safe

**Neither tool commits directly to `main`.** Each works on its own
branch and `main` only changes through a merged pull request. That is
what makes this reversible: if a design pass goes wrong, the branch is
abandoned and nothing is lost, because `main` never moved.

It also means the two sides can never overwrite each other. Git merges
their changes, and where they genuinely touched the same line it stops
and asks rather than silently picking one.

## Who owns what

Set out in full in `FRONTEND_HANDOFF.md` §8. In short:

|                            | Replit            | Claude Code    |
| -------------------------- | ----------------- | -------------- |
| `src/components/ui/`       | owns              | does not touch |
| `tailwind.config.ts`       | owns              | does not touch |
| Markup of existing screens | owns              | does not touch |
| `src/components/three/`    | owns              | does not touch |
| `src/lib/`                 | does not touch    | owns           |
| `prisma/`                  | does not touch    | owns           |
| Server actions, API routes | does not touch    | owns           |
| New routes                 | styles them after | creates them   |

The overlap worth knowing about is the navigation arrays — `Header.tsx`,
`MobileTabBar.tsx`, `admin/layout.tsx`. Both sides may edit those. If git
reports a conflict there, keep **every** entry from both sides: they are
permission-gated, and dropping one hides a working screen from whichever
role needed it.

## Going to Replit to design (phone checklist)

1. Open **your** Repl (keep it **private**).
2. Git pane: confirm branch is **`replit-ui-improvements`**, not `main`.
3. **Pull** so that branch has the latest from `main`.
4. Design.
5. **Commit and push** before you stop — even mid-way.

## Coming back to Claude Code to build

1. Open a **pull request** from `replit-ui-improvements` (or `claude/<feature>`).
2. Review the diff. Resolve conflicts using the ownership rules in
   `FRONTEND_HANDOFF.md` §8.
3. Merge into `main` when CI is green.
4. Claude Code pulls `main`, then starts a fresh `claude/<feature>` branch.

Nothing needs migrating. The repository is the project; both tools are
just views onto it.

## GitHub Import — do not use it

Replit **Import from GitHub** is not safe for Doorlink. Agent auto-starts
**“Port imported Vercel app”** when root `package.json` depends on
**`next`**. Repo tweaks (`next.config.mjs`, `.replit`, `replit.nix`) do
**not** stop it; only removing the `next` package stops it — which breaks
the app. Doorlink must keep `next`, so **Import cannot be made safe**.

Do not use Import from Vercel, Bolt, Lovable, ZIP, or Empty + Agent either.

### If a port still happens

Cancel Agent. On `replit-ui-improvements`:

```bash
git fetch origin
git reset --hard origin/replit-ui-improvements
```

Do not commit `pnpm-workspace.yaml`, root `artifacts/`, or a scaffold.
Do not gitignore `.migration-backup/`.

## Setting up a fresh Repl

Only if you **do not** already have a Repl that pushes to `mizlaa/doorlink`.
Do not recreate a working Repl.

1. Account → **Git Providers** → GitHub.
2. Create **Blank** Repl (not Agent, not Import). Private. Do not run Agent.
3. **Shell** — do not `git clone`:

```bash
git init
git remote add origin https://github.com/mizlaa/doorlink.git
git remote -v
git fetch origin
git checkout -B replit-ui-improvements origin/replit-ui-improvements
git reset --hard origin/replit-ui-improvements
```

4. Files at Repl **root**: `src/app/`, `prisma/`, `next.config.mjs`. Remote
   is `mizlaa/doorlink`.
5. Secrets: `DATABASE_URL`, `DIRECT_URL` (same Postgres URL).
6. Run:

```
npm install
npm run db:push
npm run db:seed
npm run dev
```

A 500 about a missing table means `db:push` has not run — that should stay loud.

Proof checklist for a throwaway test: `docs/BLANK_REPLIT_PROOF.md`.

## If the Repl disappears

**GitHub is the backup.** Set up again with **Setting up a fresh Repl** above
(Blank + git — never Import). Unpushed work is lost.

## Stop — do not keep going if

- You are on **`main`** in the Repl when about to commit.
- The tree shows `pnpm-workspace.yaml` or `.migration-backup/` instead of `src/app/`.
- Agent offers to port to **pnpm workspace**.
- You clicked **Deploy** by mistake on a dev Repl with seeded admin accounts.

## Public GitHub, private Repl

The repo may be public; the Repl should stay **private** (`admin@demo.doorlink`
is passwordless in dev). Do not merge unsolicited PRs without reading the diff.

See `replit.md` and `HANDOVER.md` (branch protection and Replit Invite).
