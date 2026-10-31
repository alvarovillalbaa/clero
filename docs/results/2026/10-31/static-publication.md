# Static publication source

31 October 2026 (Europe/Rome). Reference main:
`c09c1b84303d40880b51d989ee3b11a58c9bb27f`.

## Problem and behavior

The initial publisher put loading placeholders in its HTML and waited for
JavaScript to supply the article. This increment produces readable document
HTML, navigation, contents and neighbouring pages at each stable directory URL.
The site root aliases the first article. An explicit HTTPS `--site-url` supplies
canonical/Open Graph URLs, a sitemap and robots file; no host or indexing
outcome is invented when it is absent. A noindex recovery page supplies actual
navigation, with root-relative assets/links for the configured mount.

Shared routing retains old query links and rejects ambiguous/out-of-base paths.
Clean public-reader page changes load their generated HTML so the full head and
asset base match the article. Private, imported, device and edited workspace
navigation retains its in-tab behavior. Published HTML remains readable if the
project-data fetch fails. Hydrated article page links retain pretty URLs.

The shared model also limits each ASCII slug component to 252 bytes: the raw
Markdown filename adds `.md` under the usual 255-byte filesystem component
limit. Total slug length/depth budgets remain in place. Existing exclusive
destination ownership, symlink refusal, bounded reads and guarded cleanup are
preserved.

## Scope and verification

The owning [architecture](../../../architecture.md) and
[product interpretation](../../../spec.md) describe the source boundaries and
the official reference. This is a publishing increment toward that product;
hosted collaboration, Git synchronization and full reference-product parity
remain unfinished.

Static inspection covers 11 JavaScript modules with Node syntax checks and
TypeScript 5.9.3 AST parsing, 14 relative import targets, 72 globally unique
literal case names, three JSON inputs, seven template marker pairs, 63 unique
template IDs, 55 script ID targets, 12 ARIA/label references and three local
assets. The inactive workflow is parsed with Ruby Psych; its Bash steps and
embedded Node controller pass syntax checks. Python's default environment has
no PyYAML, so no package was installed. No product module was imported by these
checks. Whitespace and local documentation targets are checked before commit.

The new [72-case proposal](../../../proposals/static-publication-checks.md) and
[complete source seal](static-publication-source.json) are separate from the
unanswered initial 48-case proposal pinned to `79813554c1449d6c48775fbd3d65626a45634f7b`.
All 72 current cases remain **UNRUN**; no workflow is active. The new scope
requires explicit approval under supplied AGENTS.md sections 7 and 14.

Storage Guard measured **18.4 GiB free versus 34 GiB required**. No local build,
installation, test, server, browser, database, model/provider call, account,
paid enrollment or Auth setting change was performed. Existing automatic
Vercel Git builds are recorded separately in the publication receipt; their
success cannot establish these unrun cases or browser acceptance.

The preceding source-preparation work made concrete implementation progress.
This turn resumes its preserved dirty checkout rather than replacing it or
repeating non-priority portfolio work. La Porra, Dearweek, The Known World and
Agent Library remain excluded from routine follow-through.

## Publication and remaining evidence

Source publication and exact hosted build readback are recorded in the
separate static-publication deployment receipt after this commit. No public
HTTP, JavaScript-disabled rendered interaction, browser history, clipboard,
device-storage or crawler-indexing result is claimed here. Configured accent
colour is applied by the interactive reader; static HTML uses the stylesheet's
default accent until hydration. Private workspace state is not a public SEO
projection. The overall product and portfolio goal remain active.
