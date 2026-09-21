# Add a manual — upload, AI check, admin review

How a manual Doorlink does not have gets into the library, and what is
deliberately not automated about it.

## The flow

```
Manual finder → "Can't find your manual?" → /manuals/submit
   → validate the bytes → store privately → hash → duplicate check
   → AI check → a status that still needs a person
   → /admin/manual-submissions → approve / reject / ask for more
   → approval creates a Document
```

## What the AI is and is not allowed to do

**It cannot publish.** `decideStatus` in `src/lib/manuals/submission-policy.ts`
maps an AI verdict onto a submission status, and `APPROVED` is not
reachable from it at any input. A test asserts that across every
combination of verdict, confidence and duplicate state — not as a
comment, as a loop over the enums.

The most favourable thing the model can say moves a submission to
`AWAITING_REVIEW`, which is a queue position, not a decision.

Four things follow from the same principle:

- **A confident pass is still only a queue position.** There is no
  confidence at which the software publishes something by itself.
- **A low-confidence pass is not a pass.** Below
  `MIN_VERIFIED_CONFIDENCE` (70) a `VERIFIED` verdict is treated as
  `NEEDS_REVIEW`. A model saying "this is fine, I think" is telling you
  two things and the second one matters.
- **A check that did not run is never quieter than one that passed.**
  `NOT_RUN` and `ERRORED` are separate verdicts from `VERIFIED`, both
  route to a human, and the admin queue prints "Nothing was checked
  automatically. Read the whole document."
- **Byte-identical outranks any verdict.** A hash match sends a
  submission to the duplicate queue whatever the model thought.

The AI's job is catching the obvious — spam, a holiday photo, a manual
for a washing machine. It is not deciding what is good enough to
publish.

## Duplicates

Two signals, kept apart because they carry different weight:

- **Identical** — same SHA-256. Proof. Approving links the submission to
  the existing document instead of publishing a second copy.
- **Likely** — same manufacturer and same normalised model code. A
  suspicion only, and the reason string says so: a model legitimately
  has an install manual, a user manual, a parts list and several
  editions of each. It routes to a person, never to a rejection.

## Security

What is actually implemented:

- **The bytes decide the type, not the file name.** `sniffMime` reads
  magic bytes; the declared extension must agree or the upload is
  refused. A PNG named `.pdf` is rejected, and so is an executable
  named `.pdf`.
- **Size capped before buffering.** 25 MB, checked on the multipart
  size before the file is read into memory.
- **Storage keys are built, never accepted.** `submissionFileKey` uses
  the record id and the proven type, strips everything unsafe, and
  cannot escape its prefix. Tested against `../` ids.
- **Unapproved uploads are not public.** `manual-submissions/` is
  deliberately absent from `PUBLIC_PREFIXES`, so `resolveFileUrl`
  returns null for one. Admins open them through short-lived signed
  URLs minted per render. There is a test for this.
- **Authorisation on both sides.** `manual:submit` for uploading,
  `manual:review` for approving, and they are separate permissions —
  nothing holds both implicitly.
- **Word files download, never render.** `.doc`/`.docx` are containers
  that can carry macros. The queue labels them as such.

What is **not** implemented, and is recorded rather than implied:

- **No malware scanning.** There is no scanner connected. Every row
  carries `scanState: UNAVAILABLE` and the admin queue prints "Not
  virus-scanned — no scanner is connected. Treat it as untrusted."
  A `CLEAN` state exists in the schema for when one is wired in; nothing
  sets it today.
- **A ZIP signature cannot distinguish `.docx` from any other ZIP**,
  including a zip bomb. Noted in `sniffMime`. The mitigation is that
  these are never rendered, only downloaded.

## What needs configuring before this works

Both are checked at runtime and the UI says so rather than failing
oddly:

- **File storage.** `SUPABASE_SERVICE_ROLE_KEY` and
  `SUPABASE_STORAGE_BUCKET`. Without them `/manuals/submit` renders a
  `NotConnected` panel and accepts no file at all — it does not take an
  upload it cannot store.
- **The AI check.** `ANTHROPIC_API_KEY`. Without it every submission
  gets `NOT_RUN` and goes to a person, and the submit page says
  automated checking is unavailable so uploads may take longer.

`uploadFile` was previously a stub that threw unconditionally, so this
feature could not have worked even with Supabase configured. It is now
implemented against the Storage REST API, with `signedFileUrl` alongside
it for private reads.

## Re-running checks

`runChecks` is exported separately from `createSubmission` precisely so
that configuring an AI provider later does not mean asking people to
re-upload. Every `NOT_RUN` row is worth revisiting; the function takes a
submission id and its bytes and updates the verdict in place.
