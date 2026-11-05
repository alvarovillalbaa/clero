# Clero

- This repository owns the standalone Clero documentation publisher. The Notion
  brief and implementation interpretation are recorded in docs/spec.md.
- web/lib/model.mjs and web/lib/markdown.mjs are shared browser/CLI contracts.
  Keep them dependency-free and do not fork validation or Markdown behavior.
- web/lib/routes.mjs owns pretty/legacy URL grammar; lib/publication.mjs owns
  validated static HTML, navigation and indexing metadata. Keep project data
  outside executable templates and reuse the shared renderer.
- Documentation is data. Never evaluate MDX, raw HTML, scripts or user-supplied
  template code. DOM labels use textContent; rendered HTML comes only from the
  closed shared renderer. Imports stay on the user's device until exported.
- The CLI reads only explicitly declared Markdown files beneath the chosen
  source directory and refuses symlinks. Publication writes a new destination;
  never overwrite an unrelated directory or delete existing user work.
- The portfolio goal authorizes initial personal GitHub publication and initial
  Vercel delivery. It does not authorize accounts, billing, provider/model calls,
  database/Auth policy, dependency additions or new CI execution.
- Follow the supplied AGENTS.md test gates: authored backend/domain and browser
  checks need their explicit execution approval. Syntax, JSON, import/link and
  whitespace inspection are safe. Run Storage Guard before builds/installs.
- Alvaro's standing approval and 5 November "Do all the work" continuation
  authorize the four focused workspace/reader scenarios and one temporary
  public CI job in docs/proposals/workspace-browser-checks.md, including its
  isolated browser tooling and publication. The existing 72 domain/CLI checks
  are closed; do not repeat them without a changed input or concrete concern.
- Do not claim full Mintlify parity, hosted collaboration, npm publication,
  browser acceptance or production security from a build. Persist proof limits
  and source/check/deployment evidence in docs/results/.
