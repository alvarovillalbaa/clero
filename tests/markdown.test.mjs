import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderMarkdown } from '../web/lib/markdown.mjs';

test('HTML escaping protects text and both attribute quote styles', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapeHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
  assert.throws(() => escapeHtml({ toString() { throw new Error('must not coerce'); } }));
});

test('headings expose deterministic namespaced unique Unicode anchors and plain labels', () => {
  const value = renderMarkdown('# Café **guide**\n## Café guide\n### Café guide-2\n#### 日本語\n##### Fifth\n###### Sixth');
  assert.deepEqual(value.headings, [
    { id: 'clero-h-cafe-guide', text: 'Café guide', level: 1 },
    { id: 'clero-h-cafe-guide-2', text: 'Café guide', level: 2 },
    { id: 'clero-h-cafe-guide-2-2', text: 'Café guide-2', level: 3 },
    { id: 'clero-h-日本語', text: '日本語', level: 4 },
    { id: 'clero-h-fifth', text: 'Fifth', level: 5 },
    { id: 'clero-h-sixth', text: 'Sixth', level: 6 },
  ]);
  assert.match(value.html, /<h1 id="clero-h-cafe-guide">Café <strong>guide<\/strong><\/h1>/);
  assert.ok(!value.plainText.includes('**'));
});

test('paragraphs blockquotes and horizontal rules render a closed block vocabulary', () => {
  const value = renderMarkdown('A first line\ncontinues here.\n\n> A quote\n> with **weight**\n\n---\n\nFinal paragraph.');
  assert.match(value.html, /<p>A first line continues here\.<\/p>/);
  assert.match(value.html, /<blockquote><p>A quote with <strong>weight<\/strong><\/p><\/blockquote>/);
  assert.match(value.html, /<hr>/); assert.match(value.html, /<p>Final paragraph\.<\/p>/);
  assert.equal(value.plainText, 'A first line continues here.\nA quote with weight\nFinal paragraph.');
});

test('ordered and unordered lists preserve item order with escaped item text', () => {
  const value = renderMarkdown('- First\n- <second>\n\n3. Third\n4. Fourth');
  assert.match(value.html, /<ul><li>First<\/li><li>&lt;second&gt;<\/li><\/ul>/);
  assert.match(value.html, /<ol start="3"><li>Third<\/li><li>Fourth<\/li><\/ol>/);
  assert.equal(value.plainText, 'First\n<second>\nThird\nFourth');
});

test('fenced code escapes source and language while assigning copy controls to code blocks', () => {
  const source = '```js\nconst value = "<script>&";\n```\n\n~~~"><svg/onload=alert(1)>\n<img src=x onerror=alert(1)>\n~~~';
  const value = renderMarkdown(source);
  assert.match(value.html, /<pre><code class="language-js">const value = &quot;&lt;script&gt;&amp;&quot;;<\/code><\/pre>/);
  assert.match(value.html, /data-code-index="0" aria-label="Copy code"/);
  assert.match(value.html, /data-code-index="1" aria-label="Copy code"/);
  assert.match(value.html, /&quot;&gt;&lt;svg\/onload=alert\(1\)&gt;/);
  assert.ok(!value.html.includes('<svg')); assert.ok(!value.html.includes('<img'));
  assert.ok(value.plainText.includes('<img src=x onerror=alert(1)>'));
});

test('inline code strong emphasis and escaped punctuation retain searchable text', () => {
  const value = renderMarkdown('Use `a < b` with **strong** and *emphasis*, __also strong__, _also emphasis_, and \\*literal\\*.');
  assert.match(value.html, /<code>a &lt; b<\/code>/);
  assert.match(value.html, /<strong>strong<\/strong>/); assert.match(value.html, /<em>emphasis<\/em>/);
  assert.match(value.html, /<strong>also strong<\/strong>/); assert.match(value.html, /<em>also emphasis<\/em>/);
  assert.ok(value.html.includes('*literal*'));
  assert.equal(value.plainText, 'Use a < b with strong and emphasis, also strong, also emphasis, and *literal*.');
});

test('external HTTP HTTPS and mailto links use validated URLs and safe attributes', () => {
  const value = renderMarkdown('[HTTP](http://example.test/a) [HTTPS](https://example.test/?a=1&b=2) [Mail](mailto:docs@example.test)');
  assert.match(value.html, /href="http:\/\/example\.test\/a" target="_blank" rel="noopener noreferrer"/);
  assert.ok(value.html.includes('href="https://example.test/?a=1&amp;b=2"'));
  assert.match(value.html, /<a href="mailto:docs@example\.test">Mail<\/a>/);
  assert.equal(value.warnings.length, 0);
});

test('relative known Markdown pages and local fragments resolve from the current directory', () => {
  const value = renderMarkdown('[Next](next.md#details) [Overview](../overview.md) [Here](#details) [Existing](#clero-h-details)', { currentSlug: 'guide/start', knownSlugs: ['guide/start', 'guide/next', 'overview'] });
  assert.ok(value.html.includes('href="?page=guide%2Fnext#clero-h-details"'));
  assert.ok(value.html.includes('href="?page=overview"'));
  assert.equal((value.html.match(/href="#clero-h-details"/g) ?? []).length, 2);
  assert.equal(value.warnings.length, 0);
});

test('missing internal pages remain escaped labels with an actionable warning', () => {
  const value = renderMarkdown('[<missing>](missing.md)', { currentSlug: 'guide/start', knownSlugs: ['guide/start'] });
  assert.equal(value.html, '<p>&lt;missing&gt;</p>');
  assert.deepEqual(value.warnings, ['Missing internal page: guide/missing']);
  assert.deepEqual(value.links, []);
});

test('dangerous malformed and escaping link destinations never become anchors', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,evil', 'vbscript:evil', 'file:///tmp/secret', '//example.test', '/absolute', '../outside.md', 'guide.md?mode=raw', '%zz', '%6aavascript%3aevil', 'https://example.test/<tag>']) {
    const value = renderMarkdown(`[safe label](${url})`, { knownSlugs: ['guide'] });
    assert.ok(!value.html.includes('<a '), url); assert.ok(value.html.includes('safe label'), url);
    assert.ok(value.warnings.length > 0, url);
  }
});

test('raw HTML MDX scripts and event-bearing tags remain source text', () => {
  const value = renderMarkdown('<script>alert(1)</script>\n\n<Widget onClick={run()} />\n\n<img src=x onerror="alert(1)">\n\n<style>body{display:none}</style>');
  for (const tag of ['<script', '<Widget', '<img', '<style']) assert.ok(!value.html.includes(tag));
  assert.ok(value.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(value.html.includes('&lt;Widget onClick={run()} /&gt;'));
  assert.ok(value.plainText.includes('<img src=x onerror="alert(1)">'));
});

test('image syntax produces only its label and never loads local or remote resources', () => {
  const value = renderMarkdown('![Remote <image>](https://example.test/private.png) ![Local](asset.png)');
  assert.equal(value.html, '<p>Remote &lt;image&gt; Local</p>');
  assert.ok(!value.html.includes('<img')); assert.ok(!value.html.includes('href='));
  assert.deepEqual(value.warnings, ['Images are not rendered.']); assert.deepEqual(value.links, []);
});

test('simple tables escape cells preserve reading order and warn on uneven rows', () => {
  const value = renderMarkdown('| Name | Value |\n| :--- | ---: |\n| <key> | **value** |\n| last |');
  assert.match(value.html, /<thead><tr><th>Name<\/th><th>Value<\/th><\/tr><\/thead>/);
  assert.match(value.html, /<td>&lt;key&gt;<\/td><td><strong>value<\/strong><\/td>/);
  assert.match(value.html, /<td>last<\/td><td><\/td>/);
  assert.equal(value.plainText, 'Name\nValue\n<key>\nvalue\nlast\n');
  assert.deepEqual(value.warnings, ['A table row has a different number of cells.']);
});

test('renderer metadata and collections are detached frozen values', () => {
  const options = { currentSlug: 'start', knownSlugs: ['start', 'next'] };
  const value = renderMarkdown('# Start\n\n[Next](next.md#details)', options);
  for (const item of [value, value.headings, value.headings[0], value.warnings, value.links, value.links[0]]) assert.equal(Object.isFrozen(item), true);
  options.knownSlugs[1] = 'changed';
  assert.equal(value.links[0].slug, 'next');
  assert.throws(() => { value.headings[0].id = 'main'; }, TypeError);
});

test('renderer limits warnings and rejects invalid Unicode oversized content and accessor options', () => {
  const value = renderMarkdown(Array.from({ length: 30 }, (_, index) => `[missing](missing-${index})`).join(' '));
  assert.equal(value.warnings.length, 20);
  for (const content of ['\u0000', '\ud800', 'x'.repeat(128 * 1024 + 1)]) assert.throws(() => renderMarkdown(content));
  for (const options of [null, [], { currentSlug: null }, { knownSlugs: null }, { extra: true }, { knownSlugs: new Array(1) }]) assert.throws(() => renderMarkdown('text', options));
  let reads = 0; const options = {};
  Object.defineProperty(options, 'knownSlugs', { enumerable: true, get() { reads++; return []; } });
  assert.throws(() => renderMarkdown('text', options)); assert.equal(reads, 0);
});

test('unclosed code and malformed inline syntax remain deterministic escaped data', () => {
  const content = 'Unclosed [label and `code\n\n```html\n<script>alert(1)</script>';
  const first = renderMarkdown(content), second = renderMarkdown(content);
  assert.deepEqual(first, second);
  assert.ok(first.html.includes('Unclosed [label and `code'));
  assert.match(first.html, /<pre><code class="language-html">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.deepEqual(first.warnings, ['A code fence is not closed.']);
});

test('resolved link metadata binds page fragments without retaining source destinations', () => {
  const value = renderMarkdown('[Here](#part) [Next](next.md#part) [External](https://example.test/) [Email](mailto:docs@example.test)', { currentSlug: 'guide/start', knownSlugs: ['guide/next'] });
  assert.deepEqual(value.links, [
    { slug: 'guide/start', fragment: 'clero-h-part', external: false },
    { slug: 'guide/next', fragment: 'clero-h-part', external: false },
    { slug: null, fragment: null, external: true },
    { slug: null, fragment: null, external: true },
  ]);
  assert.deepEqual(Object.keys(value.links[0]).sort(), ['external', 'fragment', 'slug']);
});

test('heading allocation is bounded and never collides with reader DOM identities', () => {
  const value = renderMarkdown('# main\n# search-dialog\n# 𠀀'.concat('𠀀'.repeat(120)));
  assert.equal(value.headings[0].id, 'clero-h-main'); assert.equal(value.headings[1].id, 'clero-h-search-dialog');
  assert.doesNotThrow(() => encodeURIComponent(value.headings[2].id));
  const many = renderMarkdown('# Repeated\n'.repeat(2048));
  assert.equal(many.headings.length, 2048); assert.equal(new Set(many.headings.map(heading => heading.id)).size, 2048);
  assert.equal(many.headings[2047].id, 'clero-h-repeated-2048');
  assert.throws(() => renderMarkdown('# Repeated\n'.repeat(2049)), /markdown_heading_budget/);
});
