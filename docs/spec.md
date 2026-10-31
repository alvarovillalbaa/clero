# Clero

31 October 2026 (Europe/Rome).

## Source and interpretation

The personal [project parent](https://app.notion.com/p/311a1ee8bd06805caa21c5306dd315ac)
contains the standalone heading **Clero (alternative to Mintlify)**. The returned
parent is unverified/provider-truncated, edited 30 October 2026 at
09:28:44.974Z. This heading has no child brief or explicit prerequisite. Three
unread embedded sources occur in other sections. Their content is not inferred.
Bounded SIDE directory and personal GitHub name/description searches found no
matching Clero/Mintlify repository; this is not a global absence claim.

The heading supplies the product category, not a feature checklist. The initial
implementation interprets it as a documentation publisher: author Markdown,
organize pages, preview them, search them and publish an owned static website.
This interpretation is an implementation decision under the all-project goal.
It is not a claim that the owner requested every feature listed below or that
a smaller publisher completes the full Mintlify-alternative outcome.

Official references inspected: [Mintlify quickstart](https://www.mintlify.com/docs/quickstart)
and [navigation](https://www.mintlify.com/docs/organize/navigation). These establish
the docs-as-code publishing and navigation category. No code, branding, assets,
configuration compatibility or hosted-service parity is borrowed or implied.

The initial output deferred its actual document to browser JavaScript. The
publication increment generates each readable page and navigation in HTML,
with pretty directory URLs and optional page metadata/sitemap/robots output.
This is another implementation step toward a usable documentation publisher,
grounded in [the reference's current SEO documentation](https://www.mintlify.com/docs/optimize/seo),
not a claim of search ranking, indexing, full parity or new owner requirements.

## Initial product contract

- A project has ordered Markdown pages, titles, descriptions, groups and stable
  slugs. One strict versioned bundle is shared by browser and CLI.
- A real reader has page navigation, URL/reload selection, heading anchors,
  contents, full-text search, code copy, light/dark preference and a narrow view.
- Published page content, navigation and contents exist in static HTML. Each
  slug has a directory URL; JavaScript preserves earlier query-link selection
  and adds search/editing. Optional declared HTTPS site roots supply canonical
  metadata, a sitemap and robots file. 404 recovery uses that mount path; without
  it, recovery assumes the host root. No indexing/ranking outcome is promised.
- A workspace lets users import/export actual project JSON, edit content and
  metadata, add/remove pages, preview changes, and explicitly save drafts on
  this device. Storage failures remain visible. Nothing uploads automatically.
- A dependency-free CLI initializes Markdown files and configuration, validates
  a project, and builds a portable static site into an absent output directory.
  Final source inputs and declared page paths reject symlinks; supplied parent
  directory aliases are resolved normally. Sizes and duplicate identities are
  checked. Internal page/heading links are checked; external availability is not.
- The same renderer escapes arbitrary source HTML and only emits its closed
  Markdown vocabulary. It never evaluates JavaScript/MDX or loads remote code.
- Initial personal GitHub source and Vercel documentation deployment are part
  of delivery. The default site documents Clero itself with authored content.

## Acceptance and unfinished scope

Source and build evidence cannot establish browser/device storage, keyboard
and clipboard behavior, CLI filesystem safety or rendered accessibility. New
authored checks require the separate supplied execution approvals.

The full product remains unfinished beyond this first publisher: hosted team
workspaces, authentication, Git-provider synchronization, deployments for other
users, API specification tooling, MDX/component compatibility, AI assistants,
analytics, domain ownership and richer collaboration are not implemented or
silently promised. They need concrete owner requirements and the applicable
service/security/resource decisions. No new account, paid plan, database,
credential, npm release, model/provider call or CI job is authorized here.
