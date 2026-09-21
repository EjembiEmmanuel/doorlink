---
name: Workflow port conflicts
description: A stale Next dev process can make a healthy app look like a crashed workflow
---

If the Start application workflow reports a startup or runtime failure while port 5000 already returns the app, check for an orphaned `next dev` process before changing application code. Stop the stale process and restart the managed workflow once.

**Why:** The workflow wrapper can be marked finished even though its previous child remains bound to port 5000, causing the replacement process to fail with `EADDRINUSE`.

**How to apply:** Confirm the listener and HTTP response on port 5000, inspect the workflow log for `EADDRINUSE`, then clean up only the stale dev-process tree and verify the restarted workflow reaches `Ready`.