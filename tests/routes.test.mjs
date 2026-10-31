// Tier 1: authored strings only; no filesystem, browser, network or clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pagePath, pageURL, parsePageURL } from '../web/lib/routes.mjs';

const BASE = 'https://docs.example.test/team/docs/';

test('page paths retain safe nested slug identities without a leading root', () => {
  assert.equal(pagePath('introduction'), 'introduction/');
  assert.equal(pagePath('guides/start-2'), 'guides/start-2/');
  for (const slug of ['', '/guide', 'guide/', '../guide', 'guide/../start', 'guide.md', 'guide%2fstart', 'guide\\start', 'lib', 'Upper']) assert.throws(() => pagePath(slug), TypeError);
});

test('page URLs stay under explicit root or nested bases and emit canonical trailing slashes', () => {
  assert.equal(pageURL('guides/start', BASE), 'https://docs.example.test/team/docs/guides/start/');
  assert.equal(pageURL('introduction', 'https://docs.example.test/'), 'https://docs.example.test/introduction/');
  assert.equal(pageURL('guide', 'http://localhost:8080/preview/docs/'), 'http://localhost:8080/preview/docs/guide/');
  assert.equal(pageURL('index', BASE), 'https://docs.example.test/team/docs/index/');
});

test('route parsing recognizes root pretty index and slashless paths as frozen values', () => {
  const root = { slug: null, root: true, legacy: false, fragment: '' };
  for (const href of [BASE, `${BASE}index.html`, '']) assert.deepEqual(parsePageURL(href, BASE), root);
  assert.equal(parsePageURL('./index.html', BASE), null);
  for (const href of [`${BASE}guides/start/`, `${BASE}guides/start/index.html`, `${BASE}guides/start`, 'guides/start/', 'guides/start', '/team/docs/guides/start/']) {
    const route = parsePageURL(href, BASE);
    assert.deepEqual(route, { slug: 'guides/start', root: false, legacy: false, fragment: '' });
    assert.equal(Object.isFrozen(route), true);
    assert.throws(() => { route.slug = 'changed'; }, TypeError);
  }
  assert.deepEqual(parsePageURL(`${BASE}index/index.html`, BASE), { slug: 'index', root: false, legacy: false, fragment: '' });
});

test('legacy page queries accept recognized in-base shapes and reject duplicates or invalid identity', () => {
  for (const href of [`${BASE}?page=guides%2Fstart&private=ignored`, `${BASE}index.html?page=guides%2Fstart`, `${BASE}other/?page=guides%2Fstart`]) {
    assert.deepEqual(parsePageURL(href, BASE), { slug: 'guides/start', root: false, legacy: true, fragment: '' });
  }
  assert.deepEqual(parsePageURL(`${BASE}?private=ignored`, BASE), { slug: null, root: true, legacy: false, fragment: '' });
  for (const query of ['page=guide&page=guide', 'page=guide&%70age=other', 'page=', 'page=../guide', 'page=guide%252Fstart', 'page=%FF']) assert.equal(parsePageURL(`${BASE}?${query}`, BASE), null);
  assert.equal(parsePageURL(`${BASE}unknown.json?page=guide`, BASE), null);
});

test('route parsing refuses external origins credentials and paths outside the declared base', () => {
  for (const href of ['https://elsewhere.example/team/docs/guide/', 'http://docs.example.test/team/docs/guide/',
    'https://docs.example.test:444/team/docs/guide/', 'https://docs.example.test/team/guide/',
    'https://docs.example.test/team/docs-other/guide/', '/guide/', 'https://user@docs.example.test/team/docs/guide/',
    'https://@docs.example.test/team/docs/guide/', '//elsewhere.example/team/docs/guide/', 'javascript:evil', 'file:///team/docs/guide/']) assert.equal(parsePageURL(href, BASE), null);
});

test('route parsing rejects traversal escaped paths ambiguous separators dots and invalid Unicode', () => {
  for (const suffix of ['guide/../start/', './guide/', '%2e/guide/', '%2e%2e/guide/', '%67uide/',
    'guide%2fstart/', 'guide%5cstart/', '%252e/guide/', 'guide//start/', 'guide.html', 'guide\\start/',
    'guide/index.html/extra/', 'café/', '\ud800/', 'guide\u0000/']) assert.equal(parsePageURL(`${BASE}${suffix}`, BASE), null);
  for (const href of ['../guide/', 'guide/../../docs/start/', 'https:guide/', ' https://docs.example.test/team/docs/guide/']) assert.equal(parsePageURL(href, BASE), null);
});

test('decoded Unicode fragments round trip exactly while malformed UTF-8 and controls are refused', () => {
  const fragment = 'clero-h-café 日本語 100% #';
  const href = pageURL('guide', BASE, fragment);
  assert.equal(href, 'https://docs.example.test/team/docs/guide/#clero-h-caf%C3%A9%20%E6%97%A5%E6%9C%AC%E8%AA%9E%20100%25%20%23');
  assert.deepEqual(parsePageURL(href, BASE), { slug: 'guide', root: false, legacy: false, fragment });
  assert.equal(pageURL('guide', BASE, ''), `${BASE}guide/`);
  assert.deepEqual(parsePageURL(`${BASE}#clero-h-start`, BASE), { slug: null, root: true, legacy: false, fragment: 'clero-h-start' });
  for (const hash of ['%', '%FF', '%E0%A4', '%ED%A0%80', '%00', '%0A']) assert.equal(parsePageURL(`${BASE}guide/#${hash}`, BASE), null);
  for (const invalid of ['\ud800', '\udc00', '\u0000', '\n']) assert.throws(() => pageURL('guide', BASE, invalid), TypeError);
});

test('routing rejects invalid types and unsafe bases without coercing arbitrary objects', () => {
  let coercions = 0;
  const object = { toString() { coercions++; throw new Error('Do not coerce'); } };
  for (const value of [undefined, null, 1, [], object, new URL(BASE)]) {
    assert.equal(parsePageURL(value, BASE), null);
    assert.equal(parsePageURL('guide/', value), null);
    assert.throws(() => pageURL('guide', value), TypeError);
    assert.throws(() => pagePath(value), TypeError);
  }
  for (const value of [null, 1, [], object, new URL(BASE)]) assert.throws(() => pageURL('guide', BASE, value), TypeError);
  for (const value of ['https://docs.example.test', 'https://docs.example.test/team/docs', `${BASE}?x=1`, `${BASE}#part`,
    'https://user:pass@docs.example.test/team/docs/', '/team/docs/', 'file:///team/docs/',
    'https://docs.example.test/team/../docs/', 'https://docs.example.test/team/%64ocs/', `${BASE}/`]) {
    assert.equal(parsePageURL('guide/', value), null); assert.throws(() => pageURL('guide', value), TypeError);
  }
  assert.equal(coercions, 0);
});
