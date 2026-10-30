// Tier 2: authored fixtures, real local files and child processes only.
// No CLI execution or temporary directory creation occurs during collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const CLI = fileURLToPath(new URL('../bin/clero.mjs', import.meta.url));
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const CASE = { timeout: 20_000, concurrency: false };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function withFixture(body) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clero-cli-t2-')));
  const owner = fs.lstatSync(root);
  const marker = path.join(root, '.clero-test-owner');
  const token = randomUUID();
  fs.writeFileSync(marker, token, { flag: 'wx', mode: 0o600 });
  const markerOwner = fs.lstatSync(marker);
  try {
    return body(root);
  } finally {
    const current = fs.lstatSync(root);
    const currentMarker = fs.lstatSync(marker);
    assert.ok(current.isDirectory() && !current.isSymbolicLink()
      && current.dev === owner.dev && current.ino === owner.ino,
    'Refusing cleanup: the exact owned temporary directory changed');
    assert.ok(currentMarker.isFile() && !currentMarker.isSymbolicLink()
      && currentMarker.dev === markerOwner.dev && currentMarker.ino === markerOwner.ino
      && fs.readFileSync(marker, 'utf8') === token,
    'Refusing cleanup: the exact owned temporary marker changed');
    fs.rmSync(root, { recursive: true, force: false });
  }
}

function run(root, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: root, encoding: 'utf8', timeout: 3_000,
    killSignal: 'SIGKILL', maxBuffer: 256 * 1024,
  });
}

function successful(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function refused(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, `Unexpected exit status; stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Clero: .+\n$/);
}

function authoredPages() {
  return [
    { slug: 'introduction', title: 'Introduction', description: 'Start here.',
      group: 'Getting started', file: 'introduction.md',
      content: '# Introduction\n\n[Guide](guides/start.md) and [first steps](#first-steps).\n\n## First steps\n\nAuthored fixture.\n' },
    { slug: 'guides/start', title: 'Start guide', description: 'One useful task.',
      group: 'Getting started', file: 'guides/start.md',
      content: '# Start guide\n\n[Introduction](../introduction.md) and [first steps](../introduction.md#first-steps).\n\n```sh\nprintf fixture\n```\n' },
  ];
}

function createProject(root, name = 'source', pages = authoredPages()) {
  const input = path.join(root, name);
  fs.mkdirSync(input);
  const metadata = { name: 'Fixture documentation', description: 'Authored T2 CLI data.', accent: '#3556d8' };
  const config = { schemaVersion: 'clero.config.v1', ...metadata,
    pages: pages.map(({ content, ...page }) => page) };
  const project = { schemaVersion: 'clero.project.v1', ...metadata,
    pages: pages.map(({ file, ...page }) => page) };
  fs.writeFileSync(path.join(input, 'clero.json'), `${JSON.stringify(config, null, 2)}\n`);
  for (const page of pages) {
    const filename = path.join(input, page.file);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, page.content);
  }
  return { input, config, project };
}

function saveConfig(fixture) {
  fs.writeFileSync(path.join(fixture.input, 'clero.json'), `${JSON.stringify(fixture.config, null, 2)}\n`);
}

function snapshot(root) {
  const entries = [];
  function visit(filename, relative) {
    const stat = fs.lstatSync(filename);
    const entry = { path: relative, dev: stat.dev, ino: stat.ino, mode: stat.mode,
      size: stat.size, mtimeMs: stat.mtimeMs };
    if (stat.isSymbolicLink()) entries.push({ ...entry, type: 'symlink', target: fs.readlinkSync(filename) });
    else if (stat.isDirectory()) {
      entries.push({ ...entry, type: 'directory' });
      for (const child of fs.readdirSync(filename).sort()) visit(path.join(filename, child), relative ? `${relative}/${child}` : child);
    } else {
      assert.ok(stat.isFile(), 'Only authored regular files, directories and symlinks belong in fixtures');
      entries.push({ ...entry, type: 'file', sha256: digest(fs.readFileSync(filename)) });
    }
  }
  visit(root, '');
  return entries;
}

function rejectBuild(root, input, destination) {
  assert.equal(fs.existsSync(destination), false);
  const before = snapshot(root);
  refused(run(root, ['build', input, '--out', destination]));
  assert.equal(fs.existsSync(destination), false, 'Validation must finish before creating output');
  assert.deepEqual(snapshot(root), before, 'Rejected input must leave every fixture unchanged');
}

test('T2 CLI init creates a real Markdown project and declared files', CASE, () => withFixture(root => {
  const destination = path.join(root, 'initialized');
  const result = successful(run(root, ['init', destination]));
  assert.equal(result.output, destination);
  assert.equal(result.files, 3);
  const config = JSON.parse(fs.readFileSync(path.join(destination, 'clero.json'), 'utf8'));
  assert.equal(config.schemaVersion, 'clero.config.v1');
  assert.equal(config.pages.length, 2);
  assert.equal(new Set(config.pages.map(page => page.file)).size, 2);
  assert.deepEqual(fs.readdirSync(destination).sort(), ['clero.json', 'guide.md', 'introduction.md']);
  for (const page of config.pages) {
    const filename = path.join(destination, page.file);
    const stat = fs.lstatSync(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink());
    assert.match(fs.readFileSync(filename, 'utf8'), /^# .+\n/);
  }
}));

test('T2 CLI check validates a Markdown directory without changing it', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  const before = snapshot(root);
  const result = successful(run(root, ['check', fixture.input]));
  assert.deepEqual(result, { schemaVersion: 'clero.project.v1', name: fixture.project.name,
    pages: 2, headings: 3,
    contentBytes: fixture.project.pages.reduce((sum, page) => sum + Buffer.byteLength(page.content), 0) });
  assert.deepEqual(snapshot(root), before);
}));

test('T2 CLI build emits actual assets, exact sources and a verified hash manifest', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  const before = snapshot(fixture.input);
  const destination = path.join(root, 'site');
  const result = successful(run(root, ['build', fixture.input, '--out', destination]));
  assert.equal(result.output, destination);
  assert.equal(result.pages, 2);
  assert.deepEqual(snapshot(fixture.input), before);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'project.json'), 'utf8')), fixture.project);
  const assets = ['index.html', 'app.mjs', 'styles.css', 'favicon.svg', 'lib/model.mjs', 'lib/markdown.mjs'];
  for (const asset of assets) assert.deepEqual(fs.readFileSync(path.join(destination, asset)), fs.readFileSync(path.join(WEB, asset)));
  for (const page of fixture.project.pages) assert.equal(fs.readFileSync(path.join(destination, 'source', `${page.slug}.md`), 'utf8'), page.content);
  const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'clero-output.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 'clero.output.v1');
  assert.match(manifest.buildId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  const expectedFiles = [...assets, 'project.json', ...fixture.project.pages.map(page => `source/${page.slug}.md`)].sort();
  assert.deepEqual(manifest.files.map(file => file.path).sort(), expectedFiles);
  assert.equal(new Set(manifest.files.map(file => file.path)).size, expectedFiles.length);
  for (const file of manifest.files) assert.equal(file.sha256, digest(fs.readFileSync(path.join(destination, file.path))));
  assert.deepEqual(snapshot(destination).filter(entry => entry.type === 'file').map(entry => entry.path).sort(), [...expectedFiles, 'clero-output.json'].sort());
  assert.equal(result.files, expectedFiles.length + 1);
}));

test('T2 CLI build accepts an exported project bundle and preserves source bytes', CASE, () => withFixture(root => {
  const pages = authoredPages();
  pages[0].content += '\nLiteral <script>authored fixture</script> and café.\r\n';
  const fixture = createProject(root, 'authored', pages);
  const bundle = path.join(root, 'exported-project.json');
  fs.writeFileSync(bundle, `${JSON.stringify(fixture.project, null, 2)}\n`);
  const before = snapshot(bundle);
  const destination = path.join(root, 'bundle-site');
  successful(run(root, ['build', bundle, '--out', destination]));
  assert.deepEqual(snapshot(bundle), before);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'project.json'), 'utf8')), fixture.project);
  for (const page of fixture.project.pages) assert.equal(fs.readFileSync(path.join(destination, 'source', `${page.slug}.md`), 'utf8'), page.content);
}));

test('T2 CLI init refuses an existing destination and preserves its tree', CASE, () => withFixture(root => {
  const destination = path.join(root, 'user-directory');
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(destination, 'keep.txt'), 'An authored pre-existing fixture.\n');
  const before = snapshot(root);
  refused(run(root, ['init', destination]));
  assert.deepEqual(snapshot(root), before);
}));

test('T2 CLI build refuses an existing destination and preserves input and output', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  const destination = path.join(root, 'existing-site');
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(destination, 'index.html'), '<p>Keep this authored fixture.</p>\n');
  const before = snapshot(root);
  refused(run(root, ['build', fixture.input, '--out', destination]));
  assert.deepEqual(snapshot(root), before);
}));

test('T2 CLI refuses symlink project directory and bundle inputs before output', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  const bundle = path.join(root, 'bundle.json');
  fs.writeFileSync(bundle, JSON.stringify(fixture.project));
  for (const [name, target, type] of [['directory-link', fixture.input, 'dir'], ['bundle-link.json', bundle, 'file']]) {
    const alias = path.join(root, name);
    fs.symlinkSync(target, alias, type);
    rejectBuild(root, alias, path.join(root, `${name}-output`));
  }
}));

test('T2 CLI refuses nested declared-page traversal before output and preserves its owned sibling', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  fs.mkdirSync(path.join(fixture.input, 'nested'));
  fs.writeFileSync(path.join(root, 'escape.md'), fixture.project.pages[0].content);
  fixture.config.pages[0].file = 'nested/../../escape.md';
  saveConfig(fixture);
  rejectBuild(root, fixture.input, path.join(root, 'traversal-output'));
}));

test('T2 CLI refuses symlinked Markdown files and nested Markdown directories', CASE, () => withFixture(root => {
  for (const kind of ['file', 'directory']) {
    const fixture = createProject(root, `source-${kind}`);
    const target = path.join(root, `outside-${kind}`);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'owned.md'), fixture.project.pages[0].content);
    if (kind === 'file') {
      fs.symlinkSync(path.join(target, 'owned.md'), path.join(fixture.input, 'linked.md'), 'file');
      fixture.config.pages[0].file = 'linked.md';
    } else {
      fs.symlinkSync(target, path.join(fixture.input, 'linked'), 'dir');
      fixture.config.pages[0].file = 'linked/owned.md';
    }
    saveConfig(fixture);
    rejectBuild(root, fixture.input, path.join(root, `symlink-${kind}-output`));
  }
}));

test('T2 CLI rejects duplicate declared files and duplicate page slugs before output', CASE, () => withFixture(root => {
  for (const duplicate of ['file', 'slug']) {
    const fixture = createProject(root, `duplicate-${duplicate}`);
    for (const page of fixture.config.pages) fs.writeFileSync(path.join(fixture.input, page.file), '# Independent duplicate fixture\n');
    fixture.config.pages[1][duplicate] = fixture.config.pages[0][duplicate];
    saveConfig(fixture);
    rejectBuild(root, fixture.input, path.join(root, `duplicate-${duplicate}-output`));
  }
}));

test('T2 CLI refuses malformed UTF-8 in Markdown and exported bundles', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  fs.writeFileSync(path.join(fixture.input, 'introduction.md'), Buffer.concat([
    Buffer.from(fixture.project.pages[0].content), Buffer.from([0xc3, 0x28]),
  ]));
  rejectBuild(root, fixture.input, path.join(root, 'invalid-markdown-output'));
  const bundle = path.join(root, 'invalid-bundle.json');
  const text = JSON.stringify(fixture.project);
  const start = Buffer.byteLength(text.slice(0, text.indexOf(fixture.project.name)));
  const bytes = Buffer.from(text);
  fs.writeFileSync(bundle, Buffer.concat([
    bytes.subarray(0, start), Buffer.from([0xc3, 0x28]), bytes.subarray(start + Buffer.byteLength(fixture.project.name)),
  ]));
  rejectBuild(root, bundle, path.join(root, 'invalid-bundle-output'));
}));

test('T2 CLI refuses individual-page and aggregate Markdown byte-budget overflow', CASE, () => withFixture(root => {
  const page = createProject(root, 'oversized-page', [{ slug: 'large', title: 'Large page',
    description: '', group: 'Budget fixture', file: 'large.md', content: '# Large page\n' }]);
  fs.writeFileSync(path.join(page.input, 'large.md'), 'x'.repeat(128 * 1024 + 1));
  rejectBuild(root, page.input, path.join(root, 'oversized-page-output'));
  const pages = Array.from({ length: 33 }, (_, index) => ({ slug: `page-${index}`, title: `Page ${index}`,
    description: '', group: 'Budget fixture', file: `page-${index}.md`, content: 'x'.repeat(128 * 1024) }));
  const aggregate = createProject(root, 'oversized-project', pages);
  rejectBuild(root, aggregate.input, path.join(root, 'oversized-project-output'));
}));

test('T2 CLI rejects missing pages, same-page and cross-page headings, and dangerous links before output', CASE, () => withFixture(root => {
  for (const [name, content] of [['missing-page', '# Link fixture\n\n## First steps\n\n[Missing](missing.md)\n'],
    ['missing-same-heading', '# Link fixture\n\n## First steps\n\n[Missing](#missing)\n'],
    ['missing-cross-heading', '# Link fixture\n\n## First steps\n\n[Missing](guides/start.md#missing)\n'],
    ['dangerous', '# Link fixture\n\n## First steps\n\n[Unsafe](javascript:evil)\n']]) {
    const fixture = createProject(root, `links-${name}`);
    fs.writeFileSync(path.join(fixture.input, 'introduction.md'), content);
    rejectBuild(root, fixture.input, path.join(root, `${name}-link-output`));
  }
}));

test('T2 CLI argument errors have a failing exit status and perform no writes', CASE, () => withFixture(root => {
  const fixture = createProject(root);
  const destination = path.join(root, 'must-not-exist');
  const cases = [['init', destination, 'extra'], ['check', fixture.input, 'extra'],
    ['build', fixture.input, '--out', destination, 'extra'], ['build'], ['unknown', destination]];
  const before = snapshot(root);
  for (const args of cases) {
    refused(run(root, args));
    assert.deepEqual(snapshot(root), before);
  }
}));
