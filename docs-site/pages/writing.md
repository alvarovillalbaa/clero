# Write for the next useful step

Lead with the outcome. Give the reader one task to finish, show a concrete
example, then link to what comes next.

## Supported Markdown

| Element | Syntax |
| --- | --- |
| Headings | One to six leading hash marks |
| Emphasis | Asterisks or underscores around text |
| Inline code | Backticks around a literal value |
| Code blocks | Matching fences of backticks or tildes |
| Lists | Dashes, asterisks or numbered items |
| Quotes | A leading greater-than character |
| Tables | Pipe-separated cells with a divider row |

Raw HTML is displayed as text. Markdown never executes JavaScript or MDX.
Images and richer component syntax are outside the current renderer.

## Code people can use

Include the language after the opening fence. Readers can copy the exact code
using the button on its block:

```js
const project = {
  name: "A clear beginning",
  pages: ["introduction", "quickstart"],
};
```

## Links that survive editing

Link to a page's slug with an optional **.md** extension. A link from a nested
page resolves relative to that page's slug directory. The CLI checks internal
page and heading targets before it creates output. External links are checked
for supported URL syntax, not network availability.

For a heading link, use its heading slug after a hash. The reader adds a
reserved prefix to keep document anchors separate from interface controls.
For example, [the project files](configuration.md) explain source ownership.

## Keep the structure simple

- Use meaningful headings instead of decorative labels.
- Put long literal values in fenced code blocks.
- Add tables when readers need to compare parallel information.

Read about [workspace editing](workspace.md).
