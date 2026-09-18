---
name: Tailwind clean rebuild
description: Rebuild behavior to remember when palette changes appear stale in the Next.js preview.
---

When changing Tailwind theme tokens, a clean `.next` rebuild may be required before the dev preview reflects the updated utility CSS.

**Why:** The running preview can retain generated utility classes from an older Tailwind configuration even after the source config is correct.

**How to apply:** If shared utility colors look stale after a config change, remove the build output, run the production build, restart the application workflow, and then capture a fresh preview.