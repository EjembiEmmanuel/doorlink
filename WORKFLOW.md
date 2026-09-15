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

## Going to Replit to design

1. In the Repl, open the **Git** pane and **pull** from `main`. This is
   the step that brings across everything built in Claude Code since
   last time.
2. Make sure you are on the branch `replit-ui-improvements`, not `main`.
3. Design.
4. **Commit and push** when you stop, even mid-way. Unpushed work in a
   Repl is the one thing here that can actually be lost — containers get
   reclaimed.

## Coming back to Claude Code to build

1. Say so, and the branch gets pulled and reviewed before anything is
   merged.
2. Once merged into `main`, backend work continues from there.

Nothing needs migrating and nothing needs re-importing. The repository
is the project; both tools are just views onto it.

## If Replit offers to "port" or "migrate" the project

Decline it, every time.

Replit detects Next.js and offers to convert the project to its own
`PNPM_WORKSPACE` stack. That is a framework migration, not an import: it
moves the real application into `.migration-backup/` and leaves an empty
Express + Drizzle scaffold at the root. It has happened twice here.

It is recoverable — the application is intact inside
`.migration-backup/`, and moving it back to the root and deleting the
scaffold restores everything. But it is easier to decline.

Doorlink is **Next.js 15 on npm**, with Prisma and PostgreSQL. Not pnpm,
not workspaces, not Express, not Drizzle. The `.replit` file in the root
says so.

## Setting up the database in a fresh Repl

Once, per Repl, after the first import:

```
npm install
npm run db:push     # creates the tables from prisma/schema.prisma
npm run db:seed     # loads the demo catalogue and demo accounts
npm run dev
```

If the home page returns a 500 with a message about a missing table,
`db:push` has not been run against that database. That failure is
deliberately loud: a database that is reachable but empty is a broken
deployment, not an outage, and it should not quietly render a page with
everything blank.
