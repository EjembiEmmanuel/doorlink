---
name: Manual contribution boundary
description: How user-submitted manuals are handled while document storage is unavailable
---

User manual contributions should enter review through the existing support queue and include a public source link rather than claiming immediate publication or accepting a runtime file upload.

**Why:** Local runtime uploads are intentionally disabled, and Supabase Storage is not connected. A reviewed link keeps the submission persistent and honest without creating a competing document system.

**How to apply:** If storage is connected later, extend the same review flow to accept files through `src/lib/storage.ts`, then publish a `Document` only after provenance and metadata checks.