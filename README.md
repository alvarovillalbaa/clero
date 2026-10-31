# Clero

An owned Markdown documentation publisher with a reader, an on-device workspace
and a dependency-free Node CLI. Source is published; behavioral acceptance
and the wider product remain unfinished. See [the brief and scope](docs/spec.md).

```sh
node bin/clero.mjs init ./my-docs
node bin/clero.mjs check ./my-docs
node bin/clero.mjs build ./my-docs --out ./my-docs-site
```

Node 24.21.0 or newer. No dependency installation is needed for these commands.
The input may also be an actual project JSON exported from the browser workspace.
The destination must be new; existing directories are never overwritten.
Serve the output over HTTP using your static server, or publish it to your host.

Builds contain readable HTML at each page's stable directory URL, with navigation
and contents available before JavaScript. Search and the local workspace enhance
those pages. Older `?page=` links remain supported by the interactive reader.
For canonical URLs, a sitemap and robots file, declare your actual public base:

```sh
node bin/clero.mjs build ./my-docs --out ./release-1 --site-url https://docs.example.com/
```

Use an HTTPS base ending at the intended site root. If hosted beneath a path,
include that path so 404 recovery links/assets target the correct mount. Without
`--site-url`, normal pages remain portable and 404 recovery assumes host root.

`docs-site/` is Clero's authored documentation project. `npm run build` publishes
it into a fresh `public/` directory. Vercel uses that command; no database/Auth,
model provider or paid enrollment is required. The source CLI is not an npm
registry release and no npx/npm installation claim is made.

The workspace imports, edits and exports real versioned project data. Draft
saving is explicit and device-local; failed storage must remain visible. It does
not upload private documents or fabricate publishing/account synchronization.

Shared validation and rendering live in `web/lib/`. Markdown source is never
executed as HTML/MDX/JavaScript. Internal page/heading targets, UTF-8 budgets,
file paths and source symlinks are checked. External URLs are not fetched or
claimed safe by reputation. Input parent directory aliases resolve normally.

Hosted team workspaces, Git sync, API tooling, richer Markdown/components, AI,
analytics and full reference-product parity remain separate unfinished work.
New domain/CLI and browser checks require their supplied explicit approvals;
no authored case has been run during source preparation. The initial 48-check
proposal stays pinned to its original source; the static-publication increment
has a separate proposed scope and source seal.
