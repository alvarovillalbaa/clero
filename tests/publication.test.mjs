import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticFiles, normalizeSiteUrl, preparePublication } from '../lib/publication.mjs';

const template = `<!doctype html><html class="no-js"><head>
<!-- clero:head:start --><title>Loading title</title><!-- clero:head:end -->
<link rel="icon" href="__CLERO_BASE__favicon.svg"><link rel="stylesheet" href="__CLERO_BASE__styles.css"><script type="module" src="__CLERO_BASE__app.mjs"></script>
</head><body data-clero-page=""><header><!-- clero:brand:start --><!-- clero:brand:end --></header>
<aside><!-- clero:description:start --><!-- clero:description:end --><nav id="page-nav"><!-- clero:navigation:start -->Loading navigation<!-- clero:navigation:end --></nav></aside>
<main><article id="document"><!-- clero:article:start -->Loading article<!-- clero:article:end --></article><nav id="page-neighbours"><!-- clero:neighbours:start --><!-- clero:neighbours:end --></nav></main>
<nav id="heading-nav"><!-- clero:contents:start --><!-- clero:contents:end --></nav></body></html>`;
const project = (overrides = {}) => ({
  schemaVersion: 'clero.project.v1', name: 'Authored guide', description: 'Docs & details',
  pages: [
    { slug: 'introduction', title: 'Introduction', description: 'Begin here', group: 'Start', content: '# Welcome\n\nThe actual first article.\n\n[Setup](guides/setup.md#install) [Here](#welcome)' },
    { slug: 'guides/setup', title: 'Setup', description: 'Install the authored example', group: 'Guides', content: '## Install\n\nThe actual nested article.\n\n[Start](../introduction.md#clero-h-welcome)' },
  ], ...overrides,
});
const files = result => new Map(result.files);

test('site URLs normalize explicit HTTPS origins and plain nested bases with trailing slashes', () => {
  assert.equal(normalizeSiteUrl(undefined), null);
  assert.equal(normalizeSiteUrl('https://EXAMPLE.test:443'), 'https://example.test/');
  assert.equal(normalizeSiteUrl('https://example.test/docs/v1'), 'https://example.test/docs/v1/');
  assert.equal(normalizeSiteUrl('https://example.test/docs/'), 'https://example.test/docs/');
});

test('site URLs reject implicit hosts credentials ambiguity and raw or encoded traversal', () => {
  for (const value of [null, 7, {}, '', 'http://example.test', '//example.test', 'example.test', 'https://user:secret@example.test', 'https://example.test/?query=1', 'https://example.test/#part', 'https://example.test/?', 'https://example.test/#', ' https://example.test', 'https://example.test/a b', 'https://example.test/a\\b', 'https://example.test/a/../b', 'https://example.test/./a', 'https://example.test/%2e%2e/a', 'https://example.test/%252e%252e/a', 'https://example.test/a%2fb', 'https://example.test/a%5cb', 'https://example.test/%00', 'https://example.test/a//b', 'https://example.test/%zz', 'https://example.test/日本語', `https://example.test/${'a'.repeat(2048)}`]) assert.throws(() => normalizeSiteUrl(value), /publication_site_url_invalid/);
});

test('publication preparation returns detached deeply frozen rendered data and byte counters', () => {
  const source = project(), before = JSON.stringify(source), prepared = preparePublication(source);
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(prepared.project, source);
  assert.deepEqual(prepared.summary, { schemaVersion: 'clero.project.v1', name: source.name, pages: 2, headings: 2, contentBytes: source.pages.reduce((total, page) => total + new TextEncoder().encode(page.content).length, 0) });
  for (const item of [prepared, prepared.project, prepared.project.pages, prepared.rendered, prepared.rendered[0], prepared.rendered[0].headings, prepared.rendered[0].links, prepared.summary]) assert.equal(Object.isFrozen(item), true);
  source.pages[0].content = 'Caller changed'; assert.ok(prepared.rendered[0].html.includes('The actual first article.'));
});

test('publication preparation rejects Markdown warnings before producing a usable publication', () => {
  for (const content of ['[Missing](missing.md)', '```js\nUnclosed code', '![Image](https://example.test/image.png)', '| One | Two |\n| --- | --- |\n| Uneven |']) {
    assert.throws(() => preparePublication(project({ pages: [{ slug: 'start', title: 'Start', content }] })), /publication_markdown_warning/);
  }
});

test('publication preparation validates same-page and cross-page namespaced heading targets', () => {
  const prepared = preparePublication(project());
  assert.equal(prepared.rendered[0].links[0].fragment, 'clero-h-install');
  assert.equal(prepared.rendered[1].links[0].fragment, 'clero-h-welcome');
  for (const content of ['# Welcome\n\n[Bad](#missing)', '# Welcome\n\n[Bad](guides/setup.md#missing)']) {
    const source = project(); source.pages[0].content = content;
    assert.throws(() => preparePublication(source), /publication_link_heading_missing/);
  }
});

test('static publication emits actual first and nested articles without waiting for JavaScript', () => {
  const output = files(createStaticFiles(project(), template));
  assert.deepEqual([...output.keys()], ['index.html', 'introduction/index.html', 'guides/setup/index.html', '404.html']);
  assert.ok(output.get('index.html').includes('<p>The actual first article.</p>'));
  assert.ok(output.get('guides/setup/index.html').includes('<p>The actual nested article.</p>'));
  assert.ok(output.get('guides/setup/index.html').includes('aria-busy="false"'));
  assert.ok(output.get('guides/setup/index.html').includes('data-clero-page="guides/setup"'));
  assert.ok(output.get('index.html').includes('data-clero-page="introduction"'));
  for (const html of output.values()) assert.ok(!html.includes('Loading article') && !html.includes('Loading navigation') && !html.includes('Loading title'));
});

test('static asset and page references remain relative at every pretty-path depth', () => {
  const output = files(createStaticFiles(project(), template));
  assert.ok(output.get('index.html').includes('href="./styles.css"'));
  assert.ok(output.get('introduction/index.html').includes('src="../app.mjs"'));
  assert.ok(output.get('guides/setup/index.html').includes('href="../../favicon.svg"'));
  assert.ok(output.get('guides/setup/index.html').includes('href="../../introduction/"'));
  assert.ok(output.get('index.html').includes('href="./guides/setup/"'));
  assert.ok(output.get('404.html').includes('src="/app.mjs"'));
});

test('static pages contain grouped navigation contents neighbours and semantic IDs exactly once', () => {
  const output = files(createStaticFiles(project(), template)), first = output.get('introduction/index.html');
  assert.ok(first.includes('<h2 class="nav-group-title">Start</h2>'));
  assert.ok(first.includes('<h2 class="nav-group-title">Guides</h2>'));
  assert.ok(first.includes('data-page="introduction" aria-current="page"'));
  assert.ok(first.includes('href="#clero-h-welcome">Welcome</a>'));
  assert.ok(first.includes('<span class="eyebrow">Next</span><span class="neighbour-title">Setup</span>'));
  for (const id of ['home-link', 'project-name', 'project-description', 'page-nav', 'document', 'page-group', 'page-title', 'page-description', 'document-content', 'render-warnings', 'page-neighbours', 'heading-nav']) assert.equal(first.split(`id="${id}"`).length - 1, 1);
});

test('static publication escapes metadata navigation labels and arbitrary source HTML', () => {
  const source = project({ name: '<img src=x onerror=run()>', description: 'A "quoted" & <description>', pages: [{ slug: 'safe', title: '<script>Title</script>', group: '<Group>', description: 'Page "description" & detail', content: '# Trusted\n\n<script>source()</script>\n\n<Widget onClick={run()} />' }] });
  const html = files(createStaticFiles(source, template)).get('safe/index.html');
  assert.ok(html.includes('&lt;script&gt;Title&lt;/script&gt;'));
  assert.ok(html.includes('content="Page &quot;description&quot; &amp; detail"'));
  assert.ok(html.includes('&lt;img src=x onerror=run()&gt;'));
  assert.ok(html.includes('&lt;script&gt;source()&lt;/script&gt;'));
  assert.ok(!html.includes('<script>source()'));
  assert.ok(!/<[^>]+\son(?:click|error|load)=/i.test(html));
  assert.ok(!/<[^>]+\sstyle=/i.test(html));
});

test('only renderer-owned internal page hrefs are rewritten while anchors external links and code stay data', () => {
  const source = project(); source.pages[0].content += '\n\n[External](https://example.test/docs)\n\n`href="?page=guides%2Fsetup"`';
  const html = files(createStaticFiles(source, template)).get('introduction/index.html');
  assert.ok(html.includes('href="../guides/setup/#clero-h-install"'));
  assert.ok(html.includes('href="#clero-h-welcome"'));
  assert.ok(html.includes('href="https://example.test/docs" target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('<code>href=&quot;?page=guides%2Fsetup&quot;</code>'));
  assert.ok(!html.includes('href="?page='));
});

test('canonical and Open Graph URLs use explicit site configuration and first-page pretty identity', () => {
  const output = files(createStaticFiles(project(), template, { siteUrl: 'https://example.test/docs' }));
  for (const name of ['index.html', 'introduction/index.html']) {
    assert.ok(output.get(name).includes('<link rel="canonical" href="https://example.test/docs/introduction/">'));
    assert.ok(output.get(name).includes('<meta property="og:url" content="https://example.test/docs/introduction/">'));
  }
  assert.ok(output.get('guides/setup/index.html').includes('<link rel="canonical" href="https://example.test/docs/guides/setup/">'));
  assert.ok(!output.get('index.html').includes('application/ld+json'));
});

test('sitemap and robots list only configured page identities and exclude the noindex recovery page', () => {
  const output = files(createStaticFiles(project(), template, { siteUrl: 'https://example.test/docs/' }));
  assert.equal(output.get('robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /docs/404.html\nSitemap: https://example.test/docs/sitemap.xml\n');
  const sitemap = output.get('sitemap.xml');
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 2);
  assert.ok(sitemap.includes('<loc>https://example.test/docs/introduction/</loc>'));
  assert.ok(sitemap.includes('<loc>https://example.test/docs/guides/setup/</loc>'));
  assert.ok(!sitemap.includes('404.html') && !sitemap.includes('<lastmod>') && !sitemap.includes('/index.html'));
  const escaped = files(createStaticFiles(project(), template, { siteUrl: 'https://example.test/docs&tips/' })).get('sitemap.xml');
  assert.ok(escaped.includes('<loc>https://example.test/docs&amp;tips/introduction/</loc>'));
});

test('404 output offers declared navigation and is noindex without an invented canonical', () => {
  const html = files(createStaticFiles(project(), template, { siteUrl: 'https://example.test/' })).get('404.html');
  assert.ok(html.includes('data-clero-page="not-found"'));
  assert.ok(html.includes('This page is not in the project.'));
  assert.ok(html.includes('href="/introduction/"'));
  assert.ok(html.includes('href="/guides/setup/"'));
  assert.ok(html.includes('<meta name="robots" content="noindex, follow">'));
  assert.ok(!html.includes('rel="canonical"') && !html.includes('aria-current="page"'));
  const mounted = files(createStaticFiles(project(), template, { siteUrl: 'https://example.test/handbook/' })).get('404.html');
  assert.ok(mounted.includes('src="/handbook/app.mjs"'));
  assert.ok(mounted.includes('href="/handbook/guides/setup/"'));
});

test('unconfigured publication creates no guessed host canonical sitemap or robots files', () => {
  const result = createStaticFiles(project(), template), output = files(result);
  assert.ok(!output.has('robots.txt') && !output.has('sitemap.xml'));
  for (const html of output.values()) assert.ok(!html.includes('rel="canonical"') && !html.includes('property="og:url"'));
  assert.throws(() => { result.files.push(['extra', 'unsafe']); }, TypeError);
  assert.throws(() => { result.files[0][1] = 'changed'; }, TypeError);
  for (const item of [result, result.project, result.summary, result.files, result.files[0]]) assert.equal(Object.isFrozen(item), true);
});

test('static publication rejects missing duplicated overlapping or miswired trusted template markers', () => {
  for (const invalid of [null, template.replace('<!-- clero:article:start -->', ''), `${template}<!-- clero:head:start -->`, template.replace('<!-- clero:head:end -->', '').replace('<!-- clero:brand:end -->', '<!-- clero:brand:end --><!-- clero:head:end -->'), template.replace('__CLERO_BASE__favicon.svg', './favicon.svg'), template.replace('data-clero-page=""', ''), template.replace('id="page-nav"', 'id="wrong-nav"'), template.replace('id="page-nav"', 'id="page-nav" data-extra="x"><i id="page-nav"></i><nav')]) assert.throws(() => createStaticFiles(project(), invalid), /publication_template_/);
});

test('publication preserves placeholder-shaped user data and rejects option getters and unsafe identities', () => {
  const source = project({ name: '__CLERO_BASE__', pages: [{ slug: 'start', title: 'Literal __CLERO_BASE__', content: 'The token __CLERO_BASE__ is source data.' }] });
  const result = createStaticFiles(source, template);
  assert.ok(files(result).get('start/index.html').includes('Literal __CLERO_BASE__'));
  assert.equal(new Set(result.files.map(([name]) => name)).size, result.files.length);
  let reads = 0; const options = {};
  Object.defineProperty(options, 'siteUrl', { enumerable: true, get() { reads++; return 'https://example.test/'; } });
  assert.throws(() => createStaticFiles(source, template, options), /publication_options_invalid/); assert.equal(reads, 0);
  assert.throws(() => createStaticFiles(source, template, { extra: true }), /publication_options_invalid/);
  for (const slug of ['assets', 'lib', '../outside']) assert.throws(() => createStaticFiles(project({ pages: [{ slug, title: 'Unsafe', content: 'Data' }] }), template));
});
