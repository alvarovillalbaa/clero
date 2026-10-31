# Source ownership

## Inputs and shared contracts

`web/lib/model.mjs` owns the strict `clero.project.v1` bundle: ordered unique
slugs, metadata, original Markdown and explicit budgets. It copies and freezes
accepted data. Canonical two-space JSON plus its final newline must fit 5 MiB.
The browser, portable exports and CLI use this same producer contract.

`web/lib/markdown.mjs` owns the closed renderer and metadata. Source HTML is
escaped, never evaluated. It returns safe HTML, text, contents, warnings and
resolved link metadata. Heading IDs use a reserved prefix and a linear duplicate
counter; a page has at most 2,048 headings. It supports a documented Markdown
subset, without image loading, MDX evaluation or a CommonMark parity claim.

## Browser

`web/app.mjs` loads the actual published `project.json`. Reader navigation uses
`web/lib/routes.mjs` for pretty page URLs, independent heading fragments and
legacy query links. Static HTML stays readable if project-data loading fails.
Clean public-reader page changes use native document navigation, keeping the
generated head, canonical URL and asset base aligned with the article. Public
legacy query links replace the document at its pretty URL. Returning from an
unmodified published workspace reloads when its selected page differs from the
original static article. Private/device/imported/edited copies remain in-tab.
User labels are DOM text; only the shared renderer produces inserted article
HTML, with its known-page hrefs rewritten to pretty URLs. Search stays local.

The workspace edits a copied project, applies normalized previews and exports
the original Markdown in portable JSON. Saving a draft is explicit and scoped
to Clero's own browser storage key. Acknowledgement requires a matching
readback; quota/availability failures do not become successful-save messages.
There is no upload, account, hosted collaboration or backend persistence.

## CLI and output

`bin/clero.mjs` accepts either a `clero.config.v1` directory with explicitly
declared Markdown files, or an exported `clero.project.v1` bundle. Reads have
allocation/UTF-8 bounds; the final input and declared page path segments reject
symlinks. Parent aliases supplied with an input resolve normally. The tool does
not claim protection against a hostile process racing every filesystem call.

Before writing, `lib/publication.mjs` validates all page and heading links using
renderer metadata. It never fetches an external URL. It fills explicit trusted
template markers with escaped metadata, navigation and actual Markdown HTML.
Page assets and links are relative to their depth; 404 recovery uses the
configured site-root path or defaults to host root. Assets replace placeholders
before document data is inserted, preserving identical strings in user data.
Canonical URLs, robots and a sitemap are emitted only for an explicit validated
HTTPS site root; there are no invented hostnames, timestamps or organization
claims. Query links remain a browser compatibility path.

Output is a new exclusively claimed
directory. Assets, the normalized project, source Markdown and an unsigned hash
manifest are written with exclusive file creation. Error cleanup checks owned
directory/file identities and content; unexpected changes are preserved.
Existing destinations are refused, including previous generated destinations.

`docs-site/` contains authored Clero documentation. The initial Vercel build runs
the CLI on it to create `public/`; it installs no packages. That necessary hosted
build is separate from authored domain/filesystem cases. The initial 48-check
scope remains pinned to its original source. Static publication adds separately
proposed routing/publication cases and adapts the model boundary and CLI output assertions.
All authored tests and browser acceptance remain approval-gated and unrun.

## Boundaries

All configured pages become public output. Private browser imports are not sent
to a server. Source/output ownership is not Auth, reputation checking or a
security certification. Full hosted-product parity, services and acceptance
remain unfinished as recorded in [the product scope](spec.md).
