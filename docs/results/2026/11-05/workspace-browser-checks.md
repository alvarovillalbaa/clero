# Workspace and published-reader acceptance

5 November 2026. **Four authored journeys are accepted across three executions:**
C01–C03 from the first run, C04 from the third. No single four-pass invocation is
claimed. The existing 72 domain/CLI cases were not repeated.

The product change cancels a pending file import when discard is confirmed and
clears the chooser so the same file can be selected again. Ordinary discard and
roundtrip behavior passed; the asynchronous pending-read race itself was reviewed
from source, not deterministically reproduced.

| Attempt | Exact preparation | Actions run / job | Actual job UTC | Outcome |
| --- | --- | --- | --- | --- |
| 1 | `07c30a1ee97194c196ae96618968f3e4fa19fc29` | [42031491247](https://github.com/alvarovillalbaa/clero/actions/runs/42031491247) / `127258790348` | 12:57:20–12:58:10 | C01–C03 passed; C04 failed on the one-result search fixture. |
| 2 | `2c0daff0af7a50cd935ae4f39c98a06c346c074d` | [42033242306](https://github.com/alvarovillalbaa/clero/actions/runs/42033242306) / `127264704762` | 13:09:21–13:10:05 | C04's functional assertions completed, but its response-body observer failed during native navigation. No acceptance. |
| 3 | `55f802dba149b53220bb59e2f422f94170ee65ad` | [42035490419](https://github.com/alvarovillalbaa/clero/actions/runs/42035490419) / `127272425888` | 13:24:36–13:25:15 | C04 passed; C01–C03 carried with immutable-input checks. |

The three jobs used **133 seconds**, below the original twenty-minute aggregate
ceiling. Their activation commits are respectively `5189c0f9779af64923c2a742df842704da3ac825`,
`899e88a16a96b63a4f7f4f19e4cb9ff4ac8c9e3f` and
`f4b4af04909a6fc21a68e8eb3deecee34456c97d`; each checked out its pinned clean
preparation. Ubuntu 24.04, Node 24.21.0, Playwright 1.64.1 and Chromium
156.0.8078.4 were used. Tooling lived only in disposable runner storage.

## Actual journeys

- **C01:** real chooser import; metadata/Markdown edits; add/delete; Apply;
  explicit save/readback; reload; actual download; discard; import that download;
  save/reload/export with full project equality. Both exports were 767 bytes,
  SHA256 `52d502bd8a9db3c7d81243abe15fb9a9d7e3b3087b706ee052572c48a911a3ed`.
  Two private `/authored-added/` reloads used the real generated **404** recovery
  document and restored local data; they are not public project publication.
- **C02:** malformed JSON, invalid UTF-8 and duplicate identities, invalid Apply
  and canceled native replacement preserved saved/applied/unapplied work.
- **C03:** two real tabs observed the storage conflict. Stale save and discard
  refused to replace newer bytes; the stale copy remained exportable, and reload
  restored the newer copy. Unrelated authored storage survived all three cases.
- **C04:** actual no-JavaScript reading/navigation and 390×844 interactive
  navigation, Escape/focus, keyboard search, legacy migration, heading scroll and
  native clipboard readback passed. Search matches title/content/group: the exact
  result order is `configuration`, `publishing`, `limits`. Scroll width was 390;
  checked controls stayed inside the viewport. No touch emulation was used.

## Repairs and evidence

The first fixture incorrectly expected one search result; the original DOM text
was not captured. The later exact three-result assertion confirmed the
source-derived diagnosis. The second failure was DevTools body eviction after
legacy navigation, not a product exception. The repair uses an owned Chromium
[CDP session](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session)
and bounded [durable Network observation](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Network.pdl).
It retains every original byte assertion without mocking responses or delaying
product navigation. Five real project bodies, including the transient root
response, each matched 12,600 bytes / SHA256
`b3921bcbcfcb8e4026682cc54b271d5f60b9d145844d63a58a6699601d5fdaa7`.
One session detached, zero responses remained pending, both contexts closed,
eight attributed processes disappeared without signals, and scratch cleanup passed.

[Current raw receipt](workspace-browser-checks.json) is **140,681 bytes**, SHA256
`65e0e2bb9ba1a6db439af337935a4af97d63bddb02375d0502e75634d50500c9`.
All 35 current commands exited zero; 70 current and 116 historical compressed
streams decoded with exact lengths, hashes, EOF and reaped process groups.
Five complete current guards bound all 51 source leaves / 634,417 bytes.
Fifty-two pre/post HTTP observations matched 25 emitted payloads byte-for-byte
per phase plus one closed manifest comparison per phase. The manifest's random
`buildId` is not claimed byte-identical. All 25 deterministic payloads stayed
identical across the three preparations.

[Attempt 1](workspace-browser-attempt-1.json) and
[attempt 2](workspace-browser-attempt-2.json) retain their complete failed reports,
58 streams and four full source guards each. Each has 26 **preflight-only** asset
observations; no historical postflight check is fabricated. The current controller
verified 45/46 protected historical inputs and the unchanged C01–C03 body region.
The first staged whitespace check also caught a trailing runner EOF line; it was
corrected before any CI execution. Syntax and corrected staged whitespace passed.

The HTTP/browser edition was production `dpl_DnBAzsz2gxUG69R2ALeQyEwvdGM7`, exact
`55f802d…`, at `https://clero-alvaro.vercel.app`. Later status documents/receipts
are outside that tested source. Publication metadata for a later documentation
commit does not become a fresh HTTP/browser run. Workflow `408154153` is verified
`disabled_manually`; its active file is removed with this result publication.

## Limits

This is bounded Linux Chromium evidence. Safari/physical devices, touch,
assistive technology, storage quotas/durability beyond these reloads, all
cross-tab interleavings, deterministic pending-import timing, hosted
collaboration/Auth, npm distribution, security certification and full
reference-product/portfolio acceptance remain open. No account, backend,
production user data, model call, paid enrollment or local build/install/browser
was used. Storage Guard's 17.8 GiB versus 34 GiB reserve kept execution remote.
