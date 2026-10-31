import test from 'node:test';
import assert from 'node:assert/strict';
import { hrefForPage, limits, normalizeProject, normalizeSlug } from '../web/lib/model.mjs';

const page = (overrides = {}) => ({ slug: 'introduction', title: 'Introduction', content: '# Hello', ...overrides });
const project = (overrides = {}) => ({ schemaVersion: 'clero.project.v1', name: 'Authored docs', pages: [page()], ...overrides });

test('project normalization supplies exact defaults and detaches frozen data', () => {
  const source = project(), value = normalizeProject(source);
  assert.deepEqual(value, {
    schemaVersion: 'clero.project.v1', name: 'Authored docs', description: '', accent: '#3556d8',
    pages: [{ slug: 'introduction', title: 'Introduction', description: '', group: 'Documentation', content: '# Hello' }],
  });
  assert.notEqual(value, source); assert.notEqual(value.pages, source.pages); assert.notEqual(value.pages[0], source.pages[0]);
  for (const item of [value, value.pages, value.pages[0]]) assert.equal(Object.isFrozen(item), true);
  source.pages[0].content = 'Changed caller data';
  assert.equal(value.pages[0].content, '# Hello');
  assert.throws(() => { value.pages[0].content = 'Change frozen data'; }, TypeError);
});

test('project normalization accepts data-only null-prototype records and preserves page order', () => {
  const first = Object.assign(Object.create(null), page({ slug: 'guide/start', description: 'Start here', group: 'Guides' }));
  const source = Object.assign(Object.create(null), project({ description: 'Authored overview', accent: '#ABCDEF', pages: [first, page({ slug: 'reference' })] }));
  const value = normalizeProject(source);
  assert.deepEqual(value.pages.map(item => item.slug), ['guide/start', 'reference']);
  assert.equal(value.pages[0].description, 'Start here'); assert.equal(value.pages[0].group, 'Guides');
  assert.equal(value.description, 'Authored overview'); assert.equal(value.accent, '#abcdef');
});

test('project normalization rejects non-record roots and unsupported or missing schemas', () => {
  for (const value of [null, undefined, [], 'docs', new Date(), () => project()]) assert.throws(() => normalizeProject(value));
  for (const schemaVersion of [undefined, null, 'clero.project.v2', 1]) assert.throws(() => normalizeProject(project({ schemaVersion })));
  const missing = project(); delete missing.schemaVersion; assert.throws(() => normalizeProject(missing));
});

test('project normalization rejects extra hidden symbol and accessor root fields without reading getters', () => {
  for (const value of [project({ extra: true }), project({ constructor: 'polluted' }), { ...project(), [Symbol('extra')]: true }]) assert.throws(() => normalizeProject(value));
  const hidden = project(); Object.defineProperty(hidden, 'name', { value: 'hidden', enumerable: false }); assert.throws(() => normalizeProject(hidden));
  let reads = 0; const accessor = project();
  Object.defineProperty(accessor, 'pages', { enumerable: true, get() { reads++; return [page()]; } });
  assert.throws(() => normalizeProject(accessor)); assert.equal(reads, 0);
});

test('project pages reject inherited unknown hidden symbol and accessor fields', () => {
  const inherited = Object.create(page());
  const hidden = page(); Object.defineProperty(hidden, 'title', { value: 'hidden', enumerable: false });
  let reads = 0; const accessor = page(); Object.defineProperty(accessor, 'content', { enumerable: true, get() { reads++; return 'content'; } });
  for (const value of [inherited, hidden, accessor, page({ source: 'private.md' }), { ...page(), [Symbol('extra')]: true }]) assert.throws(() => normalizeProject(project({ pages: [value] })));
  assert.equal(reads, 0);
});

test('project page arrays must be dense bounded data without getters or extra fields', () => {
  const sparse = new Array(1), extra = [page()]; extra.extra = true;
  let reads = 0; const accessor = [page()]; Object.defineProperty(accessor, '0', { enumerable: true, get() { reads++; return page(); } });
  for (const pages of [[], sparse, extra, accessor, null, Array.from({ length: 201 }, (_, index) => page({ slug: `page-${index}` }))]) assert.throws(() => normalizeProject(project({ pages })));
  assert.equal(reads, 0);
  assert.equal(normalizeProject(project({ pages: Array.from({ length: 200 }, (_, index) => page({ slug: `page-${index}`, content: '' })) })).pages.length, 200);
});

test('project names and titles enforce nonblank single-line character boundaries', () => {
  assert.equal(normalizeProject(project({ name: 'n'.repeat(128), pages: [page({ title: '𠀀'.repeat(80) })] })).name.length, 128);
  for (const name of ['', '   ', 'n'.repeat(129), 'line\nbreak', 'line\rbreak', 'line\u2028break', 7]) assert.throws(() => normalizeProject(project({ name })));
  for (const title of ['', ' ', 'x'.repeat(161), '𠀀'.repeat(81), 'line\tbreak', null]) assert.throws(() => normalizeProject(project({ pages: [page({ title })] })));
});

test('project descriptions and groups retain defaults but reject invalid explicit values', () => {
  const value = normalizeProject(project({ description: 'd'.repeat(512), pages: [page({ description: 'p'.repeat(512), group: 'g'.repeat(80) })] }));
  assert.equal(value.description.length, 512); assert.equal(value.pages[0].group.length, 80);
  for (const description of [undefined, 'd'.repeat(513), 'line\nbreak', '\u0000']) assert.throws(() => normalizeProject(project({ description })));
  for (const group of [undefined, '', ' ', 'g'.repeat(81), 'line\nbreak']) assert.throws(() => normalizeProject(project({ pages: [page({ group })] })));
  assert.throws(() => normalizeProject(project({ pages: [page({ description: undefined })] })));
});

test('project accents accept only six hexadecimal digits and normalize case', () => {
  assert.equal(normalizeProject(project({ accent: '#09AaFf' })).accent, '#09aaff');
  for (const accent of [undefined, '#fff', 'red', '#12345678', '#zzzzzz', 'url(javascript:alert(1))', '#123456;display:none']) assert.throws(() => normalizeProject(project({ accent })));
});

test('slugs retain lowercase nested identities and page hrefs encode their path as query data', () => {
  assert.equal(normalizeSlug('guide/start-2'), 'guide/start-2');
  assert.equal(hrefForPage('guide/start-2'), '?page=guide%2Fstart-2');
  assert.equal(normalizeProject(project({ pages: [page({ slug: '0-start' })] })).pages[0].slug, '0-start');
  assert.equal(normalizeSlug('a'.repeat(252)), 'a'.repeat(252));
});

test('slugs reject traversal reserved runtime paths ambiguous encodings and excessive depth', () => {
  for (const slug of ['', 'Upper', '/start', 'start/', 'a//b', '.', '..', '../start', 'a/../b', 'a.md', 'a?x=1', 'a#part', 'a%2fb', '__proto__', 'a_b', 'café', 'a\\b', 'assets', 'a/assets/b', 'lib', 'a/lib', 'project.json', 'a'.repeat(513), Array(33).fill('a').join('/')]) assert.throws(() => normalizeSlug(slug));
  assert.throws(() => hrefForPage('bad?route'));
  assert.throws(() => normalizeSlug('a'.repeat(253)));
  assert.throws(() => normalizeSlug(`guide/${'a'.repeat(253)}`));
});

test('projects reject duplicate slug identities and absent required page fields', () => {
  assert.throws(() => normalizeProject(project({ pages: [page(), page()] })), /project_duplicate_slug/);
  for (const key of ['slug', 'title', 'content']) { const missing = page(); delete missing[key]; assert.throws(() => normalizeProject(project({ pages: [missing] }))); }
  const missingName = project(); delete missingName.name; assert.throws(() => normalizeProject(missingName));
});

test('projects preserve valid Unicode but reject NUL and isolated surrogate code units', () => {
  const content = 'Café 🌊 日本語\n<script>this is data</script>';
  assert.equal(normalizeProject(project({ name: 'Café 🌊', pages: [page({ title: '日本語', content })] })).pages[0].content, content);
  for (const invalid of ['a\u0000b', '\ud800', '\udc00', '\ud800x']) {
    assert.throws(() => normalizeProject(project({ pages: [page({ content: invalid })] })));
    assert.throws(() => normalizeProject(project({ name: invalid })));
  }
});

test('project page limits count UTF-8 bytes and accept the inclusive byte boundary', () => {
  assert.equal(normalizeProject(project({ pages: [page({ content: 'a'.repeat(limits.pageBytes) })] })).pages[0].content.length, limits.pageBytes);
  const unicode = '🌊'.repeat(limits.pageBytes / 4);
  assert.equal(normalizeProject(project({ pages: [page({ content: unicode })] })).pages[0].content, unicode);
  assert.throws(() => normalizeProject(project({ pages: [page({ content: `${unicode}a` })] })), /project_content_too_large/);
  assert.throws(() => normalizeProject(project({ pages: [page({ content: 'a'.repeat(limits.pageBytes + 1) })] })));
});

test('project aggregate content has an inclusive four MiB byte budget', () => {
  const content = 'x'.repeat(limits.pageBytes), pages = Array.from({ length: 32 }, (_, index) => page({ slug: `page-${index}`, content }));
  assert.equal(normalizeProject(project({ pages })).pages.length, 32);
  assert.throws(() => normalizeProject(project({ pages: [...pages, page({ slug: 'page-32', content: 'x' })] })), /project_content_budget/);
});

test('canonical pretty JSON stays within the five MiB browser import budget after escaping', () => {
  const content = '\u0001'.repeat(limits.pageBytes), pages = Array.from({ length: 6 }, (_, index) => page({ slug: `escaped-${index}`, content }));
  const value = normalizeProject(project({ pages }));
  assert.ok(new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`).length <= limits.bundleBytes);
  assert.throws(() => normalizeProject(project({ pages: [...pages, page({ slug: 'escaped-6', content })] })), /project_bundle_too_large/);
});
