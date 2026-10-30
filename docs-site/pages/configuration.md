# A project you can inspect

Clero supports two inputs: a directory of declared Markdown files, or an
exported JSON workspace. Both produce the same reader bundle.

## Markdown directory

The directory has a **clero.json** file:

```json
{
  "schemaVersion": "clero.config.v1",
  "name": "My product",
  "description": "Useful guides for a useful product.",
  "accent": "#3556d8",
  "pages": [
    {
      "slug": "introduction",
      "title": "Introduction",
      "description": "Begin here.",
      "group": "Get started",
      "file": "pages/introduction.md"
    }
  ]
}
```

Page order is navigation order. Groups preserve their first appearance. Slugs
use lowercase letters, numbers and hyphens, with slashes for nested paths.
Files must be relative Markdown paths inside the chosen project. Final source
inputs and declared page path segments cannot be symlinks. Parent directory
aliases supplied as part of a source path are resolved normally.

## Portable workspace

A **clero.project.v1** bundle replaces each page's file field with a **content**
string containing the exact Markdown. Import/export does not strip the source
down to rendered text. Unknown fields and duplicate page identities are errors.

## Bounded documents

| Budget | Limit |
| --- | --- |
| Pages | 200 |
| Markdown per page | 128 KiB in UTF-8 |
| Total Markdown | 4 MiB in UTF-8 |
| Canonical serialized bundle | 5 MiB in UTF-8 |

Browser storage may fit less than a valid exported project. A failed local save
does not confirm persistence; keep an exported copy.

See [publishing](publishing.md) for the generated files.
