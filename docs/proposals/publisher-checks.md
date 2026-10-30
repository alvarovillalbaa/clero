# Focused publisher checks

Last updated: 2026-10-31

Status: authored, **UNRUN**. Execution requires separate approval under the
supplied AGENTS.md §§7 and 14. This proposal does not authorize a test run. The
[product contract](../spec.md) owns the initial publisher scope.

## Proposed scope

One temporary public GitHub Actions job on Ubuntu 24.04, capped at five minutes,
uses Node 24.21.0 and its native `node:test` runner, serially with a 120-second
total test-process stop. No dependency installation, build outside disposable
CLI fixtures, server, browser, database, real account, provider/model call or
paid enrollment is included. Browser acceptance is unverified and outside this
scope. Storage Guard measured 18.6 GiB free versus 34 GiB required; no local
build/install environment is created or reserve bypassed.

The [workflow example](publisher-checks.workflow.yml.example) is inactive and
has no cache or artifact upload. It requires the reviewed exact source commit
and checks its complete tracked source path/mode/blob set before and after
execution. The seal, exact names and selected hashes are in
[publisher-source.json](../results/2026/10-31/publisher-source.json).

The authored scope contains **48** unique literal cases: 16 in
[model.test.mjs](../../tests/model.test.mjs), 18 in
[markdown.test.mjs](../../tests/markdown.test.mjs), and 14 in
[cli.test.mjs](../../tests/cli.test.mjs). Final immutable source hashes will be
recorded before approval. All 48 cases remain unrun.

After approval, the focused command is:

```sh
node --test --test-concurrency=1 --test-reporter=tap --test-timeout=120000 tests/model.test.mjs tests/markdown.test.mjs tests/cli.test.mjs
```

The inactive outer execution controller enforces the 120-second total stop; the Node
flag also sets a per-test ceiling, not a total suite deadline.

## CLI/filesystem cases

[tests/cli.test.mjs](../../tests/cli.test.mjs) uses Tier 2 authored documents and
real local filesystem/child-process boundaries. It does not import product
modules or mock their internals. The 14 named cases cover:

1. Init produces real configuration and declared Markdown files.
2. Check validates a directory without changing it.
3. Build copies actual reader assets and exact Markdown sources, with a
   project bundle and independently verified SHA-256 manifest.
4. Build accepts an exported project bundle and preserves source bytes.
5. Init refuses an existing destination without changing it.
6. Build refuses an existing destination without changing input or output.
7. Symlink directory and bundle inputs are refused before output.
8. A nested declared-page traversal is refused before output.
9. Symlink Markdown files and nested directories are refused before output.
10. Duplicate declared files and page slugs are rejected before output.
11. Malformed UTF-8 Markdown and bundle inputs are refused.
12. Per-page and aggregate Markdown byte budgets are enforced.
13. Missing pages, absent same-page/cross-page headings and dangerous links are
    rejected before output; successful fixtures include valid heading links.
14. Argument errors return failure and perform no writes.

The 26 child invocations have a three-second timeout, `SIGKILL` on timeout and
a 256 KiB `maxBuffer`. Assertions inspect actual exit status, signal, standard
output/error and filesystem results. The approved runner must stop the complete
test scope at 120 seconds; a timeout is a failed check, never a passing refusal.

Each case creates its own temporary directory inside the test body. Cleanup in
`finally` requires the same directory device/inode and the same exclusive
marker file device/inode/content, then removes only that exact owned tree.
Sibling traversal/symlink targets are authored fixtures inside that tree.
No user directory or existing publication is a fixture or cleanup target.

## Evidence and limits

Authoring may run syntax, literal-case inventory, link and whitespace checks;
these do not execute tests, create test fixtures or invoke the CLI. A later
approved run must record the exact source hashes, command, Node version,
individual case outcomes, elapsed time and fixture-cleanup outcome in the
owning `docs/results/` receipt.

Before activation, explicitly approve these 48 cases and the temporary CI scope.
Replace the example's approval SHA placeholder with the immutable reviewed
commit, activate it temporarily, then dispatch that exact source. Retire the
workflow after recording actual results and cleanup. All 48 cases remain unrun.

These checks would establish the named parser and disposable filesystem outcomes.
They do not establish browser/device behavior, accessibility, clipboard or
storage acceptance, concurrent hostile filesystem-race protection, hosted
deployment, npm publication or full Mintlify parity. A successful fixture
build does not authorize overwriting an existing destination.
