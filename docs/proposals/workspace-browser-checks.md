# Workspace and published-reader browser checks

**Current status — 5 November 2026: partial; C04-only completion unrun.**
C01–C03 passed in the first run; C04 failed. The
[failure/completion record](#initial-failure-and-c04-only-completion) below
supersedes the original execution plan without claiming one four-case pass.

**Original preparation (then unrun) — 5 November 2026.** This proposal and its
[inactive workflow example](workspace-browser.workflow.yml.example) are source
preparation, not browser acceptance or an activated CI job. Alvaro's standing
“I approve everything” / “Do all the work” authorizes this focused packet,
isolated public CI tooling and source publication. The [72 domain/CLI checks](../results/2026/10-31/static-publication-checks.md)
are closed and are not repeated. The [product scope](../spec.md) still leaves
hosted collaboration, accounts and full reference-product parity unfinished.

## Four actual user journeys

The driver is `scripts/workspace-browser-driver.mjs`; the bounded outer
controller is `scripts/workspace-browser-controller.mjs`. Exact case identities:

| ID | Title / scope |
| --- | --- |
| C01 | imports, edits, previews, saves and restores an actual project download |
| C02 | invalid imports and canceled replacements preserve saved and unapplied work |
| C03 | a stale tab cannot overwrite or discard a newer saved workspace |
| C04 | the narrow published reader supports routing, search, anchors and code copy |

C01 uses the actual file chooser with an authored `clero.project.v1` bundle.
Real controls change project/page metadata and original Markdown, add/delete
pages, Apply the preview and explicitly save. Reload must restore that saved
project. A real browser download is read as JSON, then the local workspace is
explicitly discarded. Importing the downloaded file, saving and reloading must
retain complete project equality, including page order, metadata and Markdown;
a download acknowledgement alone is insufficient.

C02 supplies malformed JSON, malformed UTF-8 bytes and duplicate page identities
through the chooser. Rejected imports and invalid Apply must preserve the last
valid preview/saved project and retain unapplied editor input. Canceling the
real replacement confirmation must preserve that same work. This is actual
validation/UI evidence, not a mocked validator or a direct storage injection.

C03 uses two real pages in one fresh context. One tab saves newer data; the
stale tab must refuse both overwrite and discard while retaining its own
working copy for an actual export. This checks the ordinary cross-tab conflict,
not an atomic compare-and-swap guarantee against every possible interleaving.

C04 uses the actual public root/pretty/direct/legacy reader URLs, local search,
heading anchors, Escape/focus restoration and code-copy controls at 390×844.
Clipboard permission is scoped to the fresh context and public origin; successful
native copying requires actual clipboard readback. A genuine write failure may
exercise the visible selectable fallback and must be reported as fallback, not
clipboard success. No Clipboard API is replaced. A separate fresh context with
JavaScript disabled checks the generated article/navigation; it does not claim
interactive search/workspace behavior without JavaScript. Horizontal overflow
is checked at the authored narrow states, not all devices or content.

The first three cases use desktop 1440×1000; the narrow profile does not emulate
touch. There are four interactive contexts plus the separate no-JavaScript
context, five total; C03's two pages share storage. Actual handles/counts and
teardown belong in the receipt. No application globals, renderer, localStorage
or private APIs are replaced to manufacture results. Any unrelated sentinel
is authored setup in its own namespace, not a seeded saved Clero project.

## Published bytes, source and process ownership

The sole application origin is `https://clero-alvaro.vercel.app`. Before QA
activation, publish a clean preparation commit and verify its exact READY
deployment. Pin both identities; deployment metadata is distinct from HTTP
bytes and browser behavior. The controller builds `docs-site/` once with the
existing dependency-free CLI into an absent, identity-owned scratch directory:

```sh
node bin/clero.mjs build docs-site --out <owned-absent-output> --site-url https://clero-alvaro.vercel.app/
```

This is a necessary output-manifest build, not a rerun of the 72 checks. Public
payload paths/bytes are checked before and after browser work against that
output. `clero-output.json` contains a fresh random `buildId`: its actual served
bytes/hash are recorded separately, while its closed file-path/hash manifest is
compared semantically. A matching manifest is not byte identity of two random
build IDs. Browser responses must retain the appropriate generated route/status;
the controller/driver must not accept arbitrary HTML merely because it is 200.

Only enumerated same-origin publication reads are permitted. Private imports,
edits and exports remain in fresh browser storage/downloads: no uploads, account
forms, mutations, WebSockets, analytics/provider calls or arbitrary external
reads. Unexpected page/console/network errors fail the packet. Authored negative
validation and genuine clipboard fallback are classified explicitly, never
blanket error suppression. Public URLs contain no credentials or private data.

Five complete source guards bind pinned HEAD/tree, index paths/modes/blobs and
working bytes, with no unexplained untracked or ignored output. CLI output,
tooling, browser profiles and downloads live outside the checkout. Cancellation,
deadlines, stdout/stderr caps, EOF/reaping and owned process-group cleanup must
remain explicit. Detached browser processes require attributable identity and
absence proof; uncertain ownership forbids recursive scratch deletion. No
global process/cache cleanup or deletion of an existing output directory.

## Bounded execution and proof limits

The inactive example targets only `qa/clero-workspace-20261105` in the public
`alvarovillalbaa/clero` repository, Ubuntu 24.04, Node 24.21.0 and one 20-minute job.
Playwright 1.64.1 and its Chromium are installed only into owned external runner
storage; no app dependency/lockfile changes. Controller work is bounded to 1020 s,
cleanup 90 s and final stdout 2 s. Inside that work window, tooling install 150 s,
Chromium install 240 s, the one CLI build 60 s and driver 300 s have bounded children;
their sums do not create independent extensions of the outer deadline.

Acceptance requires exactly C01–C04 once, all passed, actual child exit 0, no
unexpected/global error, matching source/public-byte checks and verified current
owned cleanup. No retry, skipped case, partial report or trimmed diagnostic can
become a pass. Preserve bounded complete compressed raw streams, actual
observations, hashes and cleanup independently of summary status. Failures are
retained before any repair; a later edition does not erase their limits.

Local Storage Guard reports 17.8 GiB free against 34 GiB required. That reserve
blocks local build/browser/install/database work; approved execution uses remote
CI. Local verification is source inspection, syntax/link and whitespace only.
The confirmed-discard repair increments `importSequence` and clears the chooser
input so an earlier file read cannot reopen afterward. Ordinary discard coverage
does not claim a deterministic reproduction of that asynchronous race.

This packet proves only its actual fixture/profile journeys. Device storage
durability outside the checked reloads, Safari/physical touch, assistive
technology, hosted synchronization/Auth, provider/model behavior, accounts,
billing, npm publication and full-product/portfolio acceptance remain open.
There is no new backend, private corpus, account or paid/model call.

## Initial failure and C04-only completion

The [first receipt](../results/2026/11-05/workspace-browser-attempt-1.json),
run `42031491247` / job `127258790348`, records C01–C03 passed and C04 failed,
12:57:20–12:58:10 UTC. Its one-match expectation for “Project reference” ignored
group-text matching. Source supports three ordered slugs: `configuration`,
`publishing`, `limits`. The failed DOM status was not captured; this diagnosis
is source inference until corrected C04 verifies those exact results.

All 58 raw streams, four source guards, 26 preflight assets and owned cleanup
passed; no first-run postflight-asset check is claimed. Accepted C01–C03 remain
pinned, not rerun. The unfinished completion runs only C04 in two fresh contexts,
carrying the first three with immutable source/result checks. Current full
pre/post assets and cleanup remain required. Its 18-minute job plus the first
50 seconds totals at most 1130 seconds, below the original 1200-second ceiling:
900-second work, 90-second cleanup, unchanged install bounds, driver 240/45/2
inside outer 300. No accepted four-case outcome exists yet.
