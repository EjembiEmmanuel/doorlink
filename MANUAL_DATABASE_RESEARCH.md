# Manual database — research audit

Session of 20 September 2026. Covers the first pass at Doorlink's
manufacturer and documentation library.

## Read this first: what "verified" means here, and why nothing is

**No document in this dataset has been verified, and none claims to be.**

Verification means fetching a URL and confirming the document is there.
The environment this research ran in cannot reach manufacturer websites
— its egress proxy refuses every one:

```
$ curl -o /dev/null -w "%{http_code}" https://www.bnd.com.au/            → 000
$ curl -o /dev/null -w "%{http_code}" https://www.gliderol.com.au/       → 000
$ curl -o /dev/null -w "%{http_code}" https://www.ata-australia.com.au/  → 000
$ curl -o /dev/null -w "%{http_code}" https://www.merlin.com.au/         → 000
```

Web *search* was available. Web *fetching* was not. That distinction is
the single most important fact about this dataset:

- A search index returning a URL is evidence the URL existed when the
  index last crawled it.
- It is **not** evidence that the URL resolves today, that it serves the
  document the title claims, that it is not behind a login, or that the
  file is the edition stated.

Marking these `REACHABLE` would have been the exact fabrication the
brief forbids. So every record ships `UNVERIFIED`, the UI renders a
"Not yet checked" badge on all of them, and no document carries an
"Official" badge — not even the ones on a manufacturer's own domain.

**To fix this, run the checker where the network works:**

```bash
npm run manuals:verify
```

It fetches each URL, records the real HTTP status, and promotes records
to `REACHABLE`, `REDIRECTED`, `BROKEN` or `RESTRICTED` on the evidence.
Nothing is deleted on failure — it is flagged into the admin queue.

## What was searched

Search terms followed the brief's §1 vocabulary, in the manufacturer +
model + document-type form:

- `B&D Doors Australia Controll-A-Door roller door opener installation manual PDF`
- `Gliderol Australia garage roller door opener installation manual PDF GTS GRD`
- `Automatic Technology ATA Australia GDO-11v5 Easy Roller installation manual PDF official`
- `Merlin Australia garage door opener MT60 MT100EVO owner's manual PDF merlin.com.au support`
- `Steel-Line garage doors Australia opener installation manual PDF SD800 roller door`
- `Centurion Systems D5 Evo sliding gate motor installation manual PDF centsys official`
- `Elsema Australia remote control receiver manual PDF FMT KEY transmitter instructions`
- `Chamberlain LiftMaster Australia garage door opener owner's manual PDF official support downloads`
- `Nice Automation Robus sliding gate motor installation instructions PDF niceforyou official`

Australia first, per §4 and §27 Phase 1.

## Manufacturers researched

Seventeen manufacturers are now recorded. Rather than repeat per-
manufacturer counts here, where they go stale the moment anyone adds a
seed file, they are generated:

```bash
npm run manuals:report   # writes manual_coverage_report.json
```

Researched this session, Australia first per §4 and §27: **B&D**,
**Gliderol**, **Automatic Technology**, **Merlin**, **Steel-Line**,
**Centurion Systems**, **Elsema**, **Chamberlain**, **Rollease Acmeda**
(AU); **Dominator** (NZ); and **Nice**, **CAME**, **FAAC**, **BFT**,
**Somfy**, **Marantec**, **Hörmann**, **Benincà** internationally.

FAAC and BFT were already in the catalogue with real hosted manuals
from earlier work; both have been expanded rather than duplicated.

**Chamberlain is recorded with no documents.** Both its Australian
documents-and-downloads area and its global support portal were
surfaced, but no direct model-level PDF URL was. The portals are
recorded at manufacturer level so a technician has somewhere to go;
no document record is claimed.

### Regional editions are separate documents

Centurion publishes the same operator's manual per market, and the
editions are not interchangeable — different document codes, different
dates. The D5-Evo SMART carries `1410.D.01.0003` dated 19/12/2024 on
the Australian site and `1410.D.01.0001_1` dated 28/03/2024 on the
global one. These are stored as two documents, not one with two links,
and the finder ranks the Australian edition first for an Australian
reader. This is the case `region` exists for.

Live totals are generated, not transcribed — see
`manual_coverage_report.json`, regenerated with `npm run manuals:report`.

## Gaps, recorded rather than filled

**ATA GDO-11v5** was searched for explicitly and no documentation URL was
surfaced. It is recorded as a model with `documents: []` rather than
being given another version's manual. The importer reports it, and the
admin page lists it as a research item. That is the intended handling of
§6: a known gap beats a plausible substitute.

**Merlin has no manufacturer-hosted URL** in this dataset. Search
surfaced only reseller and aggregator copies, so `supportUrl` is `null`
rather than a guess at what merlin.com.au's support path might be.

**Gliderol's GRD manual** is recorded from a reseller. Gliderol's own
support page is recorded at manufacturer level, but search did not
expose a direct PDF URL on `gliderol.com.au`, so none was invented.

**A file size was discarded.** Search results mentioned the Merlin MT60
manual being 2.91 MB. That is not recorded, because it was not confirmed
by fetching the file.

## Copyright handling

Every document is `LINK_ONLY`. Doorlink stores the record — manufacturer,
model, title, type, source — and links to the publisher's own copy. No
manufacturer PDF is rehosted.

This required a schema change: `Document.fileKey` was **required**, so a
link-only document could not be expressed at all, and the only way to
list a manual was to copy it. It is now nullable, and
`src/lib/manual-access.ts` decides in one place whether a document is
served or linked. A stored file with `LINK_ONLY` rights is still linked,
not served — a file being present is not a licence.

Nothing was scraped. No paywall, login, CAPTCHA or robots restriction was
bypassed or attempted. Documents found to be behind a login are recorded
as `RESTRICTED` and left alone.

## Provenance: two separate questions

`origin` and `verification` are deliberately not collapsed:

- **`origin`** — who published it. `MANUFACTURER_ORIGINAL` for a URL on
  the manufacturer's own domain; `THIRD_PARTY_GUIDE` for a reseller or
  aggregator mirror.
- **`verification`** — has anyone confirmed the link resolves.

Most records here are `MANUFACTURER_ORIGINAL` **and** `UNVERIFIED` at
once. The UI shows an "Official" badge only when both hold, which today
is never.

## Duplicate handling

The same manual appears on many sites. One canonical `Document` keeps the
most authoritative source; the rest are `DocumentSource` rows with an
`authority` level. Ten alternate sources are recorded this way rather
than as six duplicate documents. The importer is idempotent on
`(model, sourceUrl)` — re-running it changed nothing and produced zero
duplicate URLs.

## Getting to thousands: the harvester

Searching model by model yields a handful of documents per query. A
manufacturer's own download index lists hundreds on one page. That
difference is the whole scaling story, and it is why the second half of
this work is a crawler rather than more searching.

`data/manuals/portals.json` holds **26 documentation portals** across 17
manufacturers — every one surfaced by a real search, none a guessed URL
pattern. `npm run manuals:harvest` walks them, extracts document links,
and writes candidates to `data/manuals/harvested/` for review.

Rough arithmetic for the target: aggregator listings seen during this
research report 98 Somfy and 151 BFT opener manuals for those two brands
alone. At even 100 documents per portal, 100 portals reaches five
figures. The registry is the thing to grow — each entry is worth
hundreds of records, where each search is worth two or three.

**What the harvester will not do**, by construction:

- Ignore `robots.txt`.
- Touch anything behind a login, paywall or CAPTCHA. A 401 or 403 is
  recorded and the URL is left alone.
- Request faster than one page at a time, spaced, under a user agent
  that identifies itself.
- Write to the database. Output is candidates for a person to review,
  because a crawler's guess at "which model is this manual for" is a
  guess, and guesses should not become catalogue records silently.

It collects URLs, link text and file names — metadata about where a
document lives. Never the document's contents.

### It has not successfully harvested anything yet

Run against all 19 portals in this environment, every one returned 403
from the egress proxy:

```
  403  restricted   0 docs  B&D — https://www.bnd.com.au/trade-resources/...
  403  restricted   0 docs  Somfy — https://www.somfy.co.uk/support/downloads
  ... 19 of 19
  0 candidate document(s) from 0/19 portal(s).
```

That is the harvester behaving correctly — it recorded the refusal,
did not retry, did not work around it, and wrote an honest empty
result. But it means the extraction path has been proven by unit tests
against fixture HTML, not against a real portal. **The first real run
should be treated as a shakedown**: portals that build their index in
JavaScript will return zero links, and the harvester reports that
distinctly (`no-documents`) rather than silently succeeding.

## What remains

Ordered by value, not by the brief's phase numbering — the network
constraint changed what is worth doing next.

1. **Run `npm run manuals:harvest` then `npm run manuals:verify`**
   somewhere with normal egress. Harvesting is what grows the library
   by orders of magnitude; verification is what makes any of it
   trustworthy. Until both run, this is a set of candidates, not a
   reference.
2. **Australian manufacturers not yet touched**: Boss, Danmar, Taurean,
   Ozroll, Rollease Acmeda, Dominator.
3. **International openers and gate automation**: LiftMaster, FAAC
   (beyond the 2 existing), BFT (beyond the 1), CAME, Somfy, Hörmann,
   Marantec, Beninca, Roger Technology, V2, DEA.
4. **Chamberlain model-level documents.** The portals are recorded; the
   individual model PDFs behind them are not, and finding them needs a
   session that can open the portal.
5. **Automatic pedestrian doors**: ASSA ABLOY, Dormakaba, GEZE, Record,
   Tormax, Gilgen, Entrematic.
6. **Motors, controllers, remotes**: Becker, Cherubini, Elero, Dooya,
   Rollease Acmeda.
7. **Body-text indexing.** `searchText` exists and search already reads
   it, but nothing populates it — that needs a PDF text extractor, and
   extraction has its own rights question per document.
8. **Photo identification** (§10) is not built. The finder says so
   rather than pretending.

Adding any of these is a JSON file in `data/manuals/` and a re-run of the
importer. No code change, per §34's requirement that the app not need
rebuilding for every new manufacturer.

## Honest limitations

- **Scale.** Seventeen manufacturers, not hundreds. Aggregator listings
  seen during this research report 840+ Benincà, 151 BFT and 98 Somfy
  manuals for those brands alone — which is the measure of how much of
  each range is still missing, and why the harvester matters more than
  further searching.
  §28 asks not to stop early; it also says accuracy beats fabricated
  completeness. Without the ability to fetch a single document, adding
  hundreds of unverifiable URLs would have made the library look
  comprehensive while being no more trustworthy than this.
- **Page counts, revisions and file sizes** are absent almost everywhere,
  because they can only be read from the file itself.
- **Region is asserted, not confirmed.** Records are marked `AU` from the
  manufacturer's market and the domain, not from reading the document.
- **The demo catalogue is excluded from all coverage figures.** Northgate,
  Veltrix and Harbrook are invented sample data; counting them as manual
  coverage would overstate the library. `manual_coverage_report.json`
  reports them separately under `demo_catalogue`.
