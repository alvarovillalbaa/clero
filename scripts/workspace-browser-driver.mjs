import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TITLES = [
  'imports, edits, previews, saves and restores an actual project download',
  'invalid imports and canceled replacements preserve saved and unapplied work',
  'a stale tab cannot overwrite or discard a newer saved workspace',
  'the narrow published reader supports routing, search, anchors and code copy',
];
const KEY = 'clero.workspace.v1', SENTINEL_KEY = 'clero.authored-unrelated', SENTINEL = 'authored-browser-sentinel';
const FILE_LIMIT = 5 * 1024 * 1024, workEnd = Date.now() + 240000;
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const copy = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').replace(/(?:https?:\/\/|file:\/\/)[^\s)]+/g, '[URL]').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 900);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const pagePath = value => value === '/' ? '/' : value.replace(/\/$/, '');
const report = { schemaVersion: 1, origin: process.env.CLERO_CHECK_ORIGIN ?? null, sourceCommit: process.env.SOURCE_COMMIT ?? null,
  expectedDeployment: process.env.CLERO_EXPECTED_DEPLOYMENT ?? null, browserVersion: null, status: 'failed',
  cases: TITLES.map((title, index) => ({ id: `C0${index + 1}`, title, accepted: false, error: 'unrun', observations: {} })), errors: [],
  boundaries: { pageErrors: 0, consoleErrors: 0, unexpectedRequests: 0, credentialRequests: 0, webSockets: 0,
    requestFailures: 0, responseErrors: 0, unexpectedDialogs: 0, expectedPrivate404: 0, events: [] },
  cleanup: { contextsCreated: 0, contextsClosed: 0, browserClosed: false, lateChecksComplete: false, fixtureCleanup: 'unverified', failures: [] },
  limits: { workSeconds: 240, cleanupSeconds: 45, stdoutSeconds: 2, fileBytes: FILE_LIMIT, reportBytes: 131072 },
  proofLimits: ['Four authored Chromium journeys; five fresh contexts including one real JavaScript-disabled narrow reader. No physical-device claim.',
    'Projects enter through actual file selection; downloads, native storage, confirmations and clipboard or its visible fallback are observed without API replacements.',
    'Private imported routes may receive the real generated 404 document before the saved local workspace restores; this is not public publication.',
    'No account, upload, backend, provider, model, CLI regression rerun or full Mintlify parity is established.',
    'Browser.close and settled driver operations are recorded here; the outer controller independently verifies owned process absence before removing its scratch.'] };
let origin, owned, ownedIdentity, parent, marker, published, browser, current, stage = 'preflight', cleanupEnd;
let interrupted = false, expired = false, counter = 0;
const contexts = [], jobs = new Set(), files = new Map(), expectedDialogs = new Map(), pageRecords = new WeakMap();
const signals = new Map();
function boundary(kind, detail) {
  report.boundaries[kind]++;
  if (report.boundaries.events.length < 16) report.boundaries.events.push({ kind, stage, detail: clean(detail).slice(0, 240) });
}
function critical() { return ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures', 'responseErrors', 'unexpectedDialogs'].reduce((sum, key) => sum + report.boundaries[key], 0); }
function track(action) {
  const job = Promise.resolve().then(action); jobs.add(job);
  job.then(() => jobs.delete(job), () => jobs.delete(job));
  return job;
}
async function within(action, milliseconds = 10000, label = 'operation', cleanup = false) {
  const end = Math.min(Date.now() + milliseconds, cleanup ? cleanupEnd : workEnd);
  assert(end > Date.now() && (cleanup || (!expired && !interrupted)), label + ': budget unavailable');
  let timer;
  try {
    const result = await Promise.race([track(action), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ': deadline')), end - Date.now()); })]);
    assert(Date.now() <= end, label + ': late completion'); return result;
  } finally { clearTimeout(timer); }
}
async function poll(action, label, milliseconds = 7000) {
  const end = Math.min(Date.now() + milliseconds, workEnd);
  while (Date.now() < end && !interrupted && !expired) {
    if (await within(action, Math.max(1, end - Date.now()), label)) return;
    await delay(25);
  }
  throw new Error(label + ': not observed');
}
function mark(value) { stage = value; if (current) current.observations.stage = value; }
function documentResponse(response, requested) {
  assert(response, 'document response missing');
  const finalRoute = new URL(response.url()).pathname;
  assert.equal(pagePath(finalRoute), pagePath(requested), 'unexpected final document path');
  if (current) {
    const rows = current.observations.documentResponses ??= []; assert(rows.length < 24, 'navigation report bound');
    rows.push({ requestedRoute: requested, finalRoute, status: response.status() });
  }
}
function readRegular(file, maximum = FILE_LIMIT) {
  const before = fs.lstatSync(file); assert(before.isFile() && !before.isSymbolicLink() && before.size <= maximum, 'file type/bound');
  const data = fs.readFileSync(file), after = fs.lstatSync(file);
  assert(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && data.length === before.size, 'file changed');
  return data;
}
function ownFile(file, data) {
  assert(path.dirname(file) === owned); const item = fs.lstatSync(file);
  assert(item.isFile() && !item.isSymbolicLink() && item.uid === process.getuid());
  files.set(file, { dev: item.dev, ino: item.ino, bytes: data.length, sha256: sha(data) });
}
function fixture(label, data) {
  const file = path.join(owned, `${++counter}-${label}.json`), bytes = Buffer.isBuffer(data) ? data : canonical(data);
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 }); ownFile(file, bytes); return file;
}
function ownedRoot() {
  const item = fs.lstatSync(owned);
  assert(path.dirname(owned) === parent && item.isDirectory() && !item.isSymbolicLink() && item.uid === process.getuid()
    && item.dev === ownedIdentity.dev && item.ino === ownedIdentity.ino && readRegular(path.join(owned, 'owner'), 100).toString() === marker, 'fixture ownership changed');
}
function projectFixture() {
  return { schemaVersion: 'clero.project.v1', name: 'Authored field guide', description: 'Private authored browser project — 文档.', accent: '#4455aa', pages: [
    { slug: 'introduction', title: 'Authored beginning', description: 'A real imported page.', group: 'Authored guide', content: '# First heading\n\nOriginal **Markdown** and café / 文档.\n\n[Notes](authored-notes.md)\n\n```js\nconst answer = "authored";\n```\n' },
    { slug: 'authored-notes', title: 'Authored notes', description: 'A page to remove through the UI.', group: 'Authored guide', content: '# Notes\n\nA separate original page.\n' },
  ] };
}
async function text(page, selector, expected, contains = false) {
  await poll(async () => { const value = await page.locator(selector).textContent(); return contains ? value?.includes(expected) : value === expected; }, selector + ' text');
}
async function value(page, selector, expected) { await poll(async () => await page.locator(selector).inputValue() === expected, selector + ' value'); }
async function click(page, selector) { await within(() => page.locator(selector).click(), 10000, 'click ' + selector); }
async function fill(page, selector, input) { await within(() => page.locator(selector).fill(input), 10000, 'fill ' + selector); }
async function rawSaved(page) { return within(() => page.evaluate(key => localStorage.getItem(key), KEY), 5000, 'read own draft'); }
async function sentinel(page) { assert.equal(await within(() => page.evaluate(key => localStorage.getItem(key), SENTINEL_KEY), 5000, 'read unrelated sentinel'), SENTINEL); }
async function seedSentinel(page) { await within(() => page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SENTINEL_KEY, value: SENTINEL }), 5000, 'write once-only unrelated sentinel'); }
async function interactive(page, previousReads = -1) {
  await poll(() => page.evaluate(() => !document.documentElement.classList.contains('no-js') && !document.querySelector('#workspace-columns').hidden), 'actual interactive project');
  const record = pageRecords.get(page);
  await poll(() => record.projectReads.length > previousReads && record.projectReads.length > 0, 'actual published project response');
  assert(record.projectReads.every(item => item.matchesExpected), 'published project bytes differ');
}
async function openWorkspace(page) { await click(page, '#workspace-toggle'); await within(() => page.locator('#workspace-view').waitFor({ state: 'visible' }), 5000, 'workspace visible'); }
async function withDialog(page, action, { accept = true, type = 'confirm', prefix }) {
  assert(!expectedDialogs.has(page));
  let resolve, reject;
  const observed = new Promise((yes, no) => { resolve = yes; reject = no; }); observed.catch(() => {});
  expectedDialogs.set(page, { accept, type, prefix, resolve, reject });
  try { const [, result] = await Promise.all([within(() => observed, 10000, 'native ' + type), within(action, 15000, 'dialog action')]); return result; }
  finally { expectedDialogs.delete(page); }
}
async function contextFor({ narrow = false, javaScriptEnabled = true } = {}) {
  const context = await within(() => browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, javaScriptEnabled,
    acceptDownloads: true, serviceWorkers: 'block' }), 10000, 'new context');
  const state = { context, closed: false, expected404: new Set(), expected404Requests: new Set(), expected404Console: new Set() };
  contexts.push(state); report.cleanup.contextsCreated++;
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
  const pages = new Set(['/', '/index.html', ...published.pages.flatMap(page => [`/${page.slug}/`, `/${page.slug}`])]);
  const assets = new Set(['/app.mjs', '/styles.css', '/favicon.svg', '/project.json', '/lib/model.mjs', '/lib/markdown.mjs', '/lib/routes.mjs']);
  await within(() => context.route('**/*', async route => {
    try {
      const request = route.request(), url = new URL(request.url()), headers = await request.allHeaders();
      if (headers.authorization || headers.cookie) { boundary('credentialRequests', url.pathname); await route.abort(); return; }
      if (url.protocol === 'blob:' && url.origin === origin && request.method() === 'GET') { await route.continue(); return; }
      const legacy = url.pathname === '/' && url.searchParams.size === 1 && url.searchParams.has('page') && published.pages.some(page => page.slug === url.searchParams.get('page'));
      const privateDocument = request.isNavigationRequest() && state.expected404.has(url.pathname);
      if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method()) || (url.search && !legacy)
        || (!pages.has(url.pathname) && !assets.has(url.pathname) && !privateDocument)) {
        boundary('unexpectedRequests', request.method() + ' ' + url.pathname); await route.abort(); return;
      }
      if (privateDocument) { state.expected404Requests.add(request); state.expected404Console.add(url.origin + url.pathname); }
      await route.continue();
    } catch (error) { boundary('unexpectedRequests', error.message); try { await route.abort(); } catch {} }
  }), 5000, 'request guard');
  await within(() => context.routeWebSocket('**/*', route => { boundary('webSockets', 'unexpected websocket'); route.close(); }), 5000, 'websocket guard');
  context.on('requestfailed', request => boundary('requestFailures', new URL(request.url()).pathname + ' ' + request.failure()?.errorText));
  context.on('response', response => {
    if (response.status() < 400) return;
    if (response.status() === 404 && state.expected404Requests.has(response.request())) {
      report.boundaries.expectedPrivate404++; if (current) (current.observations.privateRouteResponses ??= []).push({ route: new URL(response.url()).pathname, status: 404 });
    } else boundary('responseErrors', response.status() + ' ' + new URL(response.url()).pathname);
  });
  context.on('page', page => {
    const record = { projectReads: [] }; pageRecords.set(page, record);
    page.on('pageerror', error => boundary('pageErrors', error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (state.expected404Console.has(message.location().url) && /^Failed to load resource: the server responded with a status of 404\b/.test(message.text())) return;
      boundary('consoleErrors', message.text());
    });
    page.on('dialog', dialog => { void track(async () => {
      const expected = expectedDialogs.get(page);
      if (!expected) { boundary('unexpectedDialogs', dialog.type()); await dialog.dismiss(); return; }
      try {
        assert.equal(dialog.type(), expected.type); if (expected.prefix) assert(dialog.message().startsWith(expected.prefix), 'native dialog text');
        if (expected.accept) await dialog.accept(); else await dialog.dismiss(); expected.resolve(true);
      } catch (error) { expected.reject(error); try { await dialog.dismiss(); } catch {} }
    }).catch(error => { report.errors.push(clean(error.message)); }); });
    page.on('response', response => {
      if (new URL(response.url()).pathname !== '/project.json' || response.status() !== 200) return;
      void track(async () => {
        const bytes = await within(() => response.body(), 10000, 'read published project');
        assert(bytes.length <= FILE_LIMIT, 'published project body bound');
        record.projectReads.push({ bytes: bytes.length, sha256: sha(bytes), matchesExpected: bytes.equals(publishedBytes) });
      }).catch(error => { boundary('responseErrors', error.message); });
    });
  });
  return state;
}
async function visit(state, route, { private404 = false, javaScript = true } = {}) {
  const page = await within(() => state.context.newPage(), 10000, 'new page');
  if (private404) { state.expected404.add(route); state.expected404.add(pagePath(route)); }
  const response = await within(() => page.goto(origin + route, { waitUntil: 'load' }), 15000, 'document visit');
  assert.equal(response.status(), private404 ? 404 : 200); documentResponse(response, route); if (javaScript) await interactive(page); return page;
}
async function reload(state, page, { private404 = false, unsaved = false } = {}) {
  const route = new URL(page.url()).pathname, previous = pageRecords.get(page).projectReads.length;
  if (private404) { state.expected404.add(route); state.expected404.add(pagePath(route)); }
  const action = () => page.reload({ waitUntil: 'load' });
  const response = unsaved ? await withDialog(page, action, { type: 'beforeunload', accept: true }) : await within(action, 15000, 'reload');
  assert.equal(response.status(), private404 ? 404 : 200); documentResponse(response, route); await interactive(page, previous);
}
async function documentClick(page, selector, route, keyboard = false) {
  const previous = pageRecords.get(page).projectReads.length;
  const [response] = await within(() => Promise.all([page.waitForNavigation({ waitUntil: 'load' }), keyboard ? page.keyboard.press('Enter') : page.locator(selector).click()]), 15000, 'native reader navigation');
  assert(response && response.status() === 200); documentResponse(response, route); assert.equal(pagePath(new URL(page.url()).pathname), pagePath(route)); await interactive(page, previous);
}
async function choose(page, file, replacement = false) {
  const action = async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('label.file-button').click()]); await chooser.setFiles(file);
  };
  if (replacement) await withDialog(page, action, { prefix: 'Replace this working copy?', accept: false });
  else await within(action, 15000, 'actual project file chooser');
}
async function applied(page, expected) {
  const selected = await page.locator('#edit-slug').inputValue();
  await click(page, '#apply-preview'); await text(page, '#workspace-status', 'Preview applied.', true);
  await text(page, '#preview-title', expected.pages.find(item => item.slug === selected).title);
  assert.equal(await page.locator('#workspace-error').isVisible(), false);
}
async function save(page, expected, replacing = false) {
  if (replacing) await withDialog(page, () => page.locator('#save-device').click(), { prefix: "Replace Clero's saved workspace", accept: true });
  else await click(page, '#save-device');
  await text(page, '#workspace-status', 'Saved on this device and read back successfully.', true);
  const raw = await rawSaved(page), parsed = JSON.parse(raw);
  assert.equal(parsed.schemaVersion, 'clero.device.v1'); assert.equal(typeof parsed.savedAt, 'string'); assert.deepEqual(parsed.project, expected);
  await sentinel(page); return raw;
}
async function download(page, expected, label) {
  const [item] = await within(() => Promise.all([page.waitForEvent('download'), page.locator('#export-project').click()]), 10000, 'actual workspace download');
  assert.equal(await within(() => item.failure(), 10000, 'download completion'), null);
  assert.equal(item.suggestedFilename(), `${expected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'clero'}-workspace.json`);
  const file = path.join(owned, `${++counter}-${label}.json`); assert(!fs.existsSync(file));
  await within(() => item.saveAs(file), 10000, 'retain actual download');
  const bytes = readRegular(file); ownFile(file, bytes); assert.deepEqual(JSON.parse(bytes), expected); assert(bytes.equals(canonical(expected)), 'exact original Markdown export bytes');
  await within(() => item.delete(), 5000, 'remove browser temporary download');
  return { file, proof: { bytes: bytes.length, sha256: sha(bytes), exactProject: true } };
}
async function imported(page, expected) {
  await text(page, '#workspace-status', 'Project imported into this tab.', true);
  await value(page, '#edit-project-name', expected.name); assert.equal(await page.locator('#workspace-page-nav button').count(), expected.pages.length);
}
async function runCase(index, action) {
  current = report.cases[index]; mark('setup ' + current.id); const start = Date.now();
  try { Object.assign(current.observations, await action()); assert.equal(critical(), 0, 'unexpected browser/network boundary'); current.accepted = true; current.error = null; }
  catch (error) { current.error = clean(error.message); throw error; }
  finally { current.durationMs = Date.now() - start; }
}
let publishedBytes;
const abort = () => { interrupted = true; for (const { context } of contexts) void track(() => context.close()).catch(() => {}); };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) { signals.set(signal, abort); process.on(signal, abort); }
const workTimer = setTimeout(() => { expired = true; for (const { context } of contexts) void track(() => context.close()).catch(() => {}); }, Math.max(1, workEnd - Date.now()));
try {
  assert.equal(process.env.CI, 'true');
  const url = new URL(report.origin); assert(url.protocol === 'https:' && !url.username && !url.password && url.href === url.origin + '/', 'canonical HTTPS origin required'); origin = url.origin; report.origin = origin;
  parent = fs.realpathSync(process.env.CLERO_CHECK_ROOT ?? ''); assert(path.isAbsolute(parent)); const rootStat = fs.lstatSync(parent); assert(rootStat.isDirectory() && rootStat.uid === process.getuid());
  owned = fs.mkdtempSync(path.join(parent, 'clero-browser-')); fs.chmodSync(owned, 0o700); ownedIdentity = fs.lstatSync(owned); marker = randomUUID();
  fs.writeFileSync(path.join(owned, 'owner'), marker, { flag: 'wx', mode: 0o600 }); ownFile(path.join(owned, 'owner'), Buffer.from(marker));
  const expectedFile = process.env.CLERO_EXPECTED_PROJECT_JSON; assert(path.isAbsolute(expectedFile ?? '')); publishedBytes = readRegular(expectedFile); published = JSON.parse(publishedBytes);
  assert.equal(published.schemaVersion, 'clero.project.v1'); assert(Array.isArray(published.pages) && published.pages.length === 7);
  const moduleInput = process.env.CLERO_PLAYWRIGHT_MODULE ?? '', moduleFile = moduleInput.startsWith('file:') ? fileURLToPath(moduleInput) : moduleInput;
  assert(path.isAbsolute(moduleFile)); readRegular(moduleFile, 1048576);
  const { chromium } = await import(pathToFileURL(moduleFile).href);
  browser = await within(() => chromium.launch({ headless: true, timeout: 20000 }), 22000, 'Chromium launch'); report.browserVersion = browser.version();
  await runCase(0, async () => {
    const state = await contextFor(), page = await visit(state, '/introduction/'), expected = projectFixture();
    await seedSentinel(page); await openWorkspace(page); const input = fixture('authored-project', expected); await choose(page, input); await imported(page, expected);
    mark('edit real metadata and original Markdown');
    await click(page, '.project-settings > summary'); expected.name = 'Edited 文档 field guide'; expected.description = 'Edited private documentation, not a publication.';
    await fill(page, '#edit-project-name', expected.name); await fill(page, '#edit-project-description', expected.description);
    expected.pages[0] = { ...expected.pages[0], title: 'Edited beginning', description: 'Edited page description.', group: 'Edited guide', content: '# Edited heading\n\nActual **bold** text and café / 文档.\n\n<script>authored text only</script>\n\n```js\nconst edited = "kept exactly";\n```\n' };
    for (const [selector, field] of [['#edit-title', 'title'], ['#edit-description', 'description'], ['#edit-group', 'group'], ['#edit-content', 'content']]) await fill(page, selector, expected.pages[0][field]);
    assert.equal(await page.locator('#save-device').isDisabled(), true); assert.equal(await page.locator('#export-project').isDisabled(), true); await applied(page, expected);
    await text(page, '#editor-preview strong', 'bold'); assert.equal(await page.locator('#editor-preview script').count(), 0);
    await text(page, '#editor-preview', '<script>authored text only</script>', true); assert.equal(await rawSaved(page), null);
    await click(page, '#add-page');
    const added = { slug: 'authored-added', title: 'Added through the workspace', description: 'An actual added page.', group: 'Edited guide', content: '# Added heading\n\nA page created with the real Add control.\n' };
    expected.pages.push(added);
    for (const [selector, field] of [['#edit-slug', 'slug'], ['#edit-title', 'title'], ['#edit-description', 'description'], ['#edit-group', 'group'], ['#edit-content', 'content']]) await fill(page, selector, added[field]);
    await applied(page, expected); await click(page, '#workspace-page-nav [data-workspace-page="authored-notes"]');
    await withDialog(page, () => page.locator('#delete-page').click(), { prefix: 'Delete “Authored notes”', accept: true }); expected.pages.splice(1, 1);
    await click(page, '#workspace-page-nav [data-workspace-page="authored-added"]'); await save(page, expected);
    mark('reload actual saved private page through generated recovery document'); await reload(state, page, { private404: true });
    await text(page, '#page-title', added.title); await openWorkspace(page); await value(page, '#edit-content', added.content);
    const first = await download(page, expected, 'actual-export');
    await withDialog(page, () => page.locator('#discard-workspace').click(), { prefix: 'Discard the local working copy', accept: true });
    assert.equal(await rawSaved(page), null); await value(page, '#edit-project-name', published.name); await sentinel(page);
    await choose(page, first.file); await imported(page, expected); await save(page, expected);
    await click(page, '#workspace-page-nav [data-workspace-page="authored-added"]'); await reload(state, page, { private404: true });
    await openWorkspace(page); const second = await download(page, expected, 'roundtrip-export'); assert.deepEqual(second.proof, first.proof); await sentinel(page);
    return { profile: 'desktop1440x1000', inputChosen: true, metadataMarkdownAndPagesEdited: true, explicitSaveReload: true, downloadedBytesRestored: true,
      export: first.proof, roundtrip: second.proof, pages: expected.pages.length, savedProjectSha256: sha(canonical(JSON.parse(await rawSaved(page)).project)), unrelatedStoragePreserved: true };
  });
  await runCase(1, async () => {
    const state = await contextFor(), page = await visit(state, '/introduction/'), expected = projectFixture(); await seedSentinel(page); await openWorkspace(page);
    await choose(page, fixture('valid-baseline', expected)); await imported(page, expected); const before = await save(page, expected);
    const duplicate = copy(expected); duplicate.pages[1].slug = duplicate.pages[0].slug;
    const invalid = [fixture('malformed-json', Buffer.from('{"schemaVersion":')), fixture('invalid-utf8', Buffer.from([0xc3, 0x28])), fixture('duplicate-slug', duplicate)];
    mark('real invalid files leave the entire applied and saved project unchanged');
    for (const file of invalid) {
      await choose(page, file); await text(page, '#workspace-error', 'The project could not be imported:', true);
      assert.equal(await rawSaved(page), before); await value(page, '#edit-title', expected.pages[0].title); await download(page, expected, 'invalid-preserved');
    }
    await fill(page, '#edit-slug', expected.pages[1].slug); await click(page, '#apply-preview');
    await text(page, '#workspace-error', 'duplicate slug', true); await value(page, '#edit-slug', expected.pages[1].slug); await text(page, '#preview-title', expected.pages[0].title);
    assert.equal(await page.locator('#save-device').isDisabled(), true); assert.equal(await page.locator('#export-project').isDisabled(), true); assert.equal(await rawSaved(page), before);
    await withDialog(page, () => page.locator('#reset-page').click(), { prefix: 'Discard unapplied editor changes', accept: true });
    await fill(page, '#edit-title', 'Unapplied authored title retained'); const replacement = copy(expected); replacement.name = 'Replacement that must not activate';
    await choose(page, fixture('cancelled-replacement', replacement), true); await value(page, '#edit-title', 'Unapplied authored title retained');
    await text(page, '#preview-title', expected.pages[0].title); assert.equal(await rawSaved(page), before);
    await withDialog(page, () => page.locator('#reset-page').click(), { prefix: 'Discard unapplied editor changes', accept: true });
    const kept = await download(page, expected, 'cancel-preserved'); await sentinel(page);
    return { profile: 'desktop1440x1000', invalidFileKinds: ['malformed-json', 'invalid-utf8', 'duplicate-slug'], invalidApplyPreserved: true,
      nativeReplacementCancelled: true, unappliedFieldPreserved: true, savedBytesSha256: sha(before), unchangedExport: kept.proof, unrelatedStoragePreserved: true };
  });
  await runCase(2, async () => {
    const state = await contextFor(), first = await visit(state, '/introduction/'), baseline = projectFixture(); await seedSentinel(first); await openWorkspace(first);
    await choose(first, fixture('two-tab-baseline', baseline)); await imported(first, baseline); await save(first, baseline);
    const second = await visit(state, '/introduction/'); await openWorkspace(second); await value(second, '#edit-title', baseline.pages[0].title);
    const authoritative = copy(baseline); authoritative.pages[0].title = 'Newer authoritative tab';
    await fill(first, '#edit-title', authoritative.pages[0].title); await applied(first, authoritative); const saved = await save(first, authoritative, true);
    await text(second, '#global-status', 'The saved workspace changed in another tab.', true);
    const stale = copy(baseline); stale.pages[0].title = 'Stale working copy remains exportable';
    await fill(second, '#edit-title', stale.pages[0].title); await applied(second, stale); await click(second, '#save-device');
    await text(second, '#workspace-error', 'Another tab changed the saved workspace.', true); assert.equal(await rawSaved(second), saved);
    const retained = await download(second, stale, 'stale-working-copy');
    await withDialog(second, () => second.locator('#discard-workspace').click(), { prefix: 'Discard the local working copy', accept: true });
    await text(second, '#workspace-error', 'Another tab changed the saved workspace.', true); assert.equal(await rawSaved(second), saved); await value(second, '#edit-title', stale.pages[0].title);
    mark('native reload accepts leaving the stale unsaved tab'); await reload(state, second, { unsaved: true }); await text(second, '#page-title', authoritative.pages[0].title);
    await openWorkspace(second); const restored = await download(second, authoritative, 'newer-restored'); await sentinel(second);
    return { profile: 'desktop1440x1000', realTabs: 2, storageEventObserved: true, staleSaveRefused: true, staleDiscardRefused: true,
      staleWorkingCopy: retained.proof, newerSavedRawSha256: sha(saved), newerReloadedExport: restored.proof, unrelatedStoragePreserved: true };
  });
  await runCase(3, async () => {
    const writing = published.pages.find(page => page.slug === 'writing'), configuration = published.pages.find(page => page.slug === 'configuration'); assert(writing && configuration);
    const codeMatch = /^```js\r?\n([\s\S]*?)\r?\n```/m.exec(writing.content); assert(codeMatch); const expectedCode = codeMatch[1];
    const staticState = await contextFor({ narrow: true, javaScriptEnabled: false }), staticPage = await visit(staticState, '/writing/', { javaScript: false });
    mark('actual JavaScript-disabled narrow static document'); await text(staticPage, '#page-title', writing.title); await text(staticPage, '#document-content pre > code', expectedCode);
    assert.equal(await staticPage.locator('#page-nav a').count(), published.pages.length); assert.equal(await staticPage.locator('#workspace-toggle').isVisible(), false);
    const [staticResponse] = await within(() => Promise.all([staticPage.waitForNavigation({ waitUntil: 'load' }), staticPage.locator('#page-nav [data-page="quickstart"]').click()]), 15000, 'no-JS native page link');
    assert.equal(staticResponse.status(), 200); documentResponse(staticResponse, '/quickstart/'); assert.equal(pagePath(new URL(staticPage.url()).pathname), '/quickstart'); await text(staticPage, '#page-title', published.pages.find(page => page.slug === 'quickstart').title);
    const state = await contextFor({ narrow: true }), page = await visit(state, '/introduction/');
    await click(page, '#nav-toggle'); assert.equal(await page.locator('#nav-toggle').getAttribute('aria-expanded'), 'true');
    await documentClick(page, '#page-nav [data-page="writing"]', '/writing/'); await text(page, '#page-title', writing.title);
    await click(page, '#nav-toggle'); await within(() => page.keyboard.press('Escape'), 5000, 'narrow menu Escape');
    assert.equal(await page.locator('#nav-toggle').getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#nav-toggle').evaluate(element => element === document.activeElement), true);
    await click(page, '#open-search'); assert.equal(await page.locator('#search-dialog').evaluate(element => element.open && element.matches(':modal')), true);
    await within(() => page.keyboard.press('Escape'), 5000, 'search Escape'); assert.equal(await page.locator('#open-search').evaluate(element => element === document.activeElement), true);
    await click(page, '#open-search'); await fill(page, '#search-input', configuration.title); await text(page, '#search-status', '1 matching page.');
    await within(() => page.keyboard.press('Tab'), 5000, 'keyboard search result');
    assert.equal(await page.locator('#search-results a').evaluate(element => element === document.activeElement), true);
    await documentClick(page, '#search-results a', '/configuration/', true); await text(page, '#page-title', configuration.title);
    mark('legacy route migrates to actual pretty document and heading');
    await within(() => page.goto(origin + '/?page=writing#clero-h-code-people-can-use', { waitUntil: 'domcontentloaded' }), 15000, 'legacy URL visit');
    await within(() => page.waitForURL(url => pagePath(url.pathname) === '/writing' && url.hash === '#clero-h-code-people-can-use', { waitUntil: 'load' }), 15000, 'pretty legacy migration'); await interactive(page);
    await text(page, '#page-title', writing.title);
    await poll(() => page.locator('#clero-h-code-people-can-use').evaluate(element => { const rect = element.getBoundingClientRect(); return rect.top >= -1 && rect.top < innerHeight; }), 'real heading fragment position');
    const copied = { mode: null, sha256: sha(expectedCode), permissionGranted: false };
    try { await within(() => state.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin }), 5000, 'native clipboard permissions'); copied.permissionGranted = true; }
    catch { copied.permissionGranted = false; }
    await click(page, '#document-content button[data-code-index="0"]');
    await poll(async () => (await page.locator('#document-content button[data-code-index="0"]').textContent()) === 'Copied' || await page.locator('#document-content .copy-fallback textarea').isVisible(), 'real copy outcome');
    if (await page.locator('#document-content .copy-fallback textarea').isVisible()) {
      const field = page.locator('#document-content .copy-fallback textarea'); assert.equal(await field.inputValue(), expectedCode); assert.equal(await field.evaluate(element => element.readOnly), true); copied.mode = 'visible-selectable-fallback';
    } else {
      const actual = await within(() => page.evaluate(() => navigator.clipboard.readText()), 5000, 'actual clipboard readback'); assert.equal(actual, expectedCode); copied.mode = 'native-clipboard-exact-readback';
    }
    const layout = await within(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      controls: ['nav-toggle', 'open-search', 'workspace-toggle'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, x: r.x, right: r.right, width: r.width, height: r.height }; }) })), 5000, 'narrow layout');
    assert.equal(layout.width, 390); assert.equal(layout.height, 844); assert(layout.scrollWidth <= layout.width + 1);
    for (const control of layout.controls) assert(control.x >= 0 && control.right <= 391 && control.width >= 24 && control.height >= 32, 'narrow control bounds');
    return { profile: 'narrow390x844-no-touch-emulation', actualNoJavaScriptReadingAndNavigation: true, prettyDocumentNavigation: true, nativeLegacyMigration: true,
      headingFragmentObserved: true, nativeSearchModalAndEscapeFocus: true, keyboardSearchResultFocused: true, copy: copied, layout };
  });
} catch (error) { report.errors.push(clean(error.message)); }
finally {
  cleanupEnd = Math.min(Date.now() + 45000, workEnd + 45000); current = null;
  for (const state of [...contexts].reverse()) {
    try { await within(() => state.context.close(), 8000, 'context close', true); state.closed = true; report.cleanup.contextsClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  if (browser) {
    try { await within(() => browser.close(), 10000, 'browser close', true); report.cleanup.browserClosed = true; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  const settleEnd = Math.min(Date.now() + 5000, cleanupEnd);
  while (jobs.size && Date.now() < settleEnd) await delay(25);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  report.cleanup.lateChecksComplete = jobs.size === 0;
  if (owned && report.cleanup.browserClosed && contexts.every(state => state.closed) && jobs.size === 0) {
    try {
      ownedRoot(); assert.deepEqual(fs.readdirSync(owned).sort(), [...files.keys()].map(file => path.basename(file)).sort(), 'unexpected fixture files');
      for (const [file, expected] of files) { const item = fs.lstatSync(file), bytes = readRegular(file); assert(item.dev === expected.dev && item.ino === expected.ino && bytes.length === expected.bytes && sha(bytes) === expected.sha256, 'authored fixture identity changed'); }
      fs.rmSync(owned, { recursive: true }); assert(!fs.existsSync(owned)); report.cleanup.fixtureCleanup = 'passed';
    } catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  if (critical()) report.errors.push('unexpected browser or network error, including late observations');
  if (interrupted || expired || Date.now() > workEnd + 45000) report.errors.push(interrupted ? 'interrupted' : 'work or cleanup deadline');
  if (report.cleanup.contextsCreated !== report.cleanup.contextsClosed || !report.cleanup.browserClosed || !report.cleanup.lateChecksComplete || report.cleanup.fixtureCleanup !== 'passed' || report.cleanup.failures.length) report.errors.push('resource cleanup unverified');
  if (report.cases.every(item => item.accepted) && (report.cleanup.contextsCreated !== 5 || report.cleanup.contextsClosed !== 5)) report.errors.push('full context scope not observed');
  report.status = report.cases.every(item => item.accepted) && report.errors.length === 0 ? 'passed' : 'failed';
  let result = JSON.stringify(report);
  if (Buffer.byteLength(result) > 131072) { report.status = 'failed'; result = JSON.stringify({ schemaVersion: 1, origin: report.origin, cases: report.cases.map(({ id, title }) => ({ id, title, accepted: false, error: 'report limit', observations: {} })), errors: ['report limit'], cleanup: report.cleanup, status: 'failed' }); }
  const outputEnd = Math.min(Date.now() + 2000, workEnd + 47000);
  const outputTimer = setTimeout(() => process.exit(1), Math.max(1, outputEnd - Date.now()));
  process.stdout.write('CLERO_BROWSER_DRIVER=' + result + '\n', () => {
    clearTimeout(outputTimer); clearTimeout(workTimer); for (const [signal, handler] of signals) process.removeListener(signal, handler);
    process.exit(report.status === 'passed' && !interrupted && !expired && Date.now() <= outputEnd ? 0 : 1);
  });
}
