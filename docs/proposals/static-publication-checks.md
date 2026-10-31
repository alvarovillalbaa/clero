# Static publication checks

31 October 2026. Alvaro approved this 72-case temporary-CI scope with
“I approve. You choose.” See the [execution receipt](../results/2026/10-31/static-publication-checks.md)
for actual attempts and the same-scope assertion repair. Browser execution is
outside this approval.

## Source and proposed execution

The publisher now generates complete document HTML, pretty directory URLs,
navigation, contents, a recovery page and optional canonical/sitemap/robots
metadata. The reader retains legacy query links and private workspace behavior.
This changes publication behavior; a successful hosted build does not prove
the new domain, filesystem or browser paths.

The scope is **72 unique native Node cases**:

| File | Cases | Contract |
| --- | ---: | --- |
| `tests/model.test.mjs` | 16 | Project validation, ownership, byte budgets and publishable filename segments |
| `tests/markdown.test.mjs` | 18 | Existing closed renderer, links, escaping and resource limits |
| `tests/routes.test.mjs` | 8 | Pretty/root/index/legacy paths, nested bases and URL refusal |
| `tests/publication.test.mjs` | 16 | Actual static content, page assets, metadata, sitemap/robots, 404 and template safety |
| `tests/cli.test.mjs` | 14 | Actual CLI filesystem behavior, with output assertions adapted to generated HTML |

These include the 48 named regression cases from the initial publisher scope,
with model filename-boundary and CLI output assertions adapted, plus 24 new routing/publication cases.
The original unanswered 48-case question remains bound to immutable source
`79813554c1449d6c48775fbd3d65626a45634f7b`. It does not authorize this expanded
source or replace this new approval. The original 48-case source was not run
separately; its named regression cases are included in the approved 72-case run.

One temporary public `ubuntu-24.04` GitHub Actions job, capped at five minutes,
uses pinned official checkout/setup-node Actions and Node 24.21.0. There is no
dependency installation, cache or artifact upload. The [inactive example](static-publication-checks.workflow.yml.example)
must remain outside `.github/workflows/` until separately approved. Replace its
approval placeholder with the reviewed exact source commit only after approval.

The exact command is:

```sh
node --test --test-concurrency=1 --test-reporter=tap --test-timeout=120000 tests/model.test.mjs tests/markdown.test.mjs tests/routes.test.mjs tests/publication.test.mjs tests/cli.test.mjs
```

The controller caps the complete detached process group at 120 seconds, sends
TERM then KILL if needed, bounds TAP/stdout at 2 MiB and stderr at 256 KiB, and
requires actual successful exit plus all 72 exact names/plan/totals, with zero
failures, cancellations, skips or TODOs. It records bounded case/outcome metadata.
The Node per-test flag is an additional ceiling, not the total deadline.

## Source and fixture ownership

[The repaired source seal](../results/2026/10-31/static-publication-checks-source.json) lists every
tracked source path/mode/blob except results, exact case names and selected
byte hashes. The controller verifies its own manifest bytes against the pinned
Git object and all source/index/working bytes before and after outcomes. It
does not relax a failed guard to make tests pass.

Only authored documents and disposable filesystem trees are used. CLI cases
execute real child processes, never product mocks, and own their temporary
directory/marker identities. Existing destinations and unexpected changes are
preserved. The runner owns its temp root, redirects fixture TMPDIR into it,
checks that fixtures were removed, then removes only that verified owned root.
Fixture builds do not become a real publication or overwrite a user directory.

No local build/install is proposed: the last Storage Guard preflight measured
18.4 GiB free versus 34 GiB required. No reserve bypass is requested.
There is no server, browser, database, production data, real account, model or
provider call, paid enrollment, Auth policy or hosting configuration change.

## Proof limits

These cases can establish only their named parser, HTML producer, route and
disposable filesystem outcomes. They do not establish browser rendering,
JavaScript-disabled interaction, history/clipboard/device storage behavior,
anonymous HTTP access, crawler indexing/ranking, hostile filesystem-race
protection, hosted collaboration or full reference-product parity. Browser
acceptance remains unverified and outside this proposal.

After an approved run, record exact source/commands/statuses and cleanup in the
owning results, and retire the temporary workflow. Approval delivery is not
approval, and this document does not activate any job.
