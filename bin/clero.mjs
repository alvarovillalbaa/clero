#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeProject } from '../web/lib/model.mjs';
import { createStaticFiles, normalizeSiteUrl, preparePublication } from '../lib/publication.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ASSETS = ['app.mjs', 'styles.css', 'favicon.svg', 'lib/model.mjs', 'lib/markdown.mjs', 'lib/routes.mjs'];
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

function record(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) fail(`${label}: unexpected fields or shape`);
  return value;
}

function readText(filename, maxBytes) {
  const before = fs.lstatSync(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maxBytes) fail('Expected a bounded regular UTF-8 file');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > maxBytes) fail('Input file changed while opening');
    const buffer = Buffer.alloc(Math.min(maxBytes + 1, opened.size + 1));
    let count = 0, read = 0;
    while (count < buffer.length && (read = fs.readSync(fd, buffer, count, buffer.length - count, null)) > 0) count += read;
    if (count !== opened.size) fail('Input file size changed while reading');
    return decoder.decode(buffer.subarray(0, count));
  } finally { fs.closeSync(fd); }
}

function readJson(filename) {
  try { return JSON.parse(readText(filename, 5 * 1024 * 1024)); }
  catch (error) { throw new Error(`Cannot read project JSON: ${error.message}`); }
}

function declaredFile(root, relative) {
  if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.length > 512
    || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)) fail('Page file must be a relative .md path');
  const segments = relative.split('/');
  if (segments.some(segment => !segment || segment.startsWith('.') || segment === '..' || segment.includes(':'))) fail('Page file contains a hidden or traversal segment');
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())) fail('Page file must remain inside the source without symlinks');
  }
  return current;
}

function loadProject(input) {
  const absolute = path.resolve(input), stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) fail('The project input cannot be a symlink');
  if (stat.isFile()) return normalizeProject(readJson(absolute));
  if (!stat.isDirectory()) fail('Expected a project bundle or Markdown project directory');
  const root = fs.realpathSync(absolute);
  const config = record(readJson(path.join(root, 'clero.json')), ['schemaVersion', 'name', 'description', 'accent', 'pages'], 'clero.json');
  if (config.schemaVersion !== 'clero.config.v1' || !Array.isArray(config.pages) || config.pages.length > 200) fail('Expected clero.config.v1 with at most 200 pages');
  const files = config.pages.map(page => {
    record(page, ['slug', 'title', 'description', 'group', 'file'], 'Page configuration');
    return page.file;
  });
  if (new Set(files).size !== files.length) fail('Each configured page must own a distinct Markdown file');
  const skeleton = normalizeProject({
    schemaVersion: 'clero.project.v1', name: config.name,
    ...(config.description === undefined ? {} : { description: config.description }),
    ...(config.accent === undefined ? {} : { accent: config.accent }),
    pages: config.pages.map(({ file, ...page }) => ({ ...page, content: '' })),
  });
  let totalBytes = 0;
  const pages = skeleton.pages.map((page, index) => {
    const filename = declaredFile(root, files[index]);
    const size = fs.lstatSync(filename).size;
    totalBytes += size;
    if (size > 128 * 1024 || totalBytes > 4 * 1024 * 1024) fail('Markdown exceeds the page or project byte budget');
    return { ...page, content: readText(filename, 128 * 1024) };
  });
  return normalizeProject({ ...skeleton, pages });
}

/** Exclusive directory ownership; a failed write removes only unchanged files we created. */
function writeNewDirectory(destination, files) {
  const requested = path.resolve(destination), parent = fs.realpathSync(path.dirname(requested));
  const basename = path.basename(requested);
  if (!basename || basename === '.' || basename === '..') fail('Choose a new output directory');
  const output = path.join(parent, basename);
  fs.mkdirSync(output, { mode: 0o755 }); // EEXIST is deliberately not recoverable by overwrite.
  const owner = fs.lstatSync(output), createdFiles = [], createdDirs = [];
  const ownsRoot = () => {
    const current = fs.lstatSync(output);
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== owner.dev || current.ino !== owner.ino) fail('Output directory ownership changed');
  };
  try {
    for (const [relative, value] of files) {
      ownsRoot();
      if (path.isAbsolute(relative) || relative.split('/').some(segment => !segment || segment === '.' || segment === '..')) fail('Invalid generated path');
      const parts = relative.split('/'); let directory = output;
      for (const segment of parts.slice(0, -1)) {
        directory = path.join(directory, segment);
        if (!createdDirs.some(item => item.path === directory)) {
          fs.mkdirSync(directory, { mode: 0o755 });
          const stat = fs.lstatSync(directory); createdDirs.push({ path: directory, dev: stat.dev, ino: stat.ino });
        }
        const expected = createdDirs.find(item => item.path === directory), actual = fs.lstatSync(directory);
        if (!actual.isDirectory() || actual.isSymbolicLink() || actual.dev !== expected.dev || actual.ino !== expected.ino) fail('Generated directory ownership changed');
      }
      const filename = path.join(output, ...parts), bytes = Buffer.from(value);
      const fd = fs.openSync(filename, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW ?? 0), 0o644);
      const stat = fs.fstatSync(fd);
      // Record ownership before writing, so a partial write is retained rather than mistaken for an unrelated file.
      const entry = { path: filename, dev: stat.dev, ino: stat.ino, expectedSize: bytes.length, expectedHash: sha(bytes), complete: false };
      createdFiles.push(entry);
      try { fs.writeFileSync(fd, bytes); entry.complete = true; } finally { fs.closeSync(fd); }
    }
    ownsRoot();
    return { output, files: createdFiles.length };
  } catch (error) {
    let preserved = false;
    try {
      ownsRoot();
      for (const entry of createdFiles.reverse()) {
        const current = fs.lstatSync(entry.path);
        if (entry.complete && current.isFile() && !current.isSymbolicLink() && current.dev === entry.dev && current.ino === entry.ino
          && current.size === entry.expectedSize && sha(Buffer.from(readText(entry.path, entry.expectedSize))) === entry.expectedHash) fs.unlinkSync(entry.path);
        else preserved = true;
      }
      for (const entry of createdDirs.reverse()) {
        const current = fs.lstatSync(entry.path);
        if (current.isDirectory() && !current.isSymbolicLink() && current.dev === entry.dev && current.ino === entry.ino) {
          try { fs.rmdirSync(entry.path); } catch { preserved = true; }
        } else preserved = true;
      }
      if (!preserved) { ownsRoot(); fs.rmdirSync(output); }
    } catch { preserved = true; }
    throw new Error(`${error.message}${preserved ? '; partial output retained because cleanup ownership could not be proven' : ''}`);
  }
}

function build(input, destination, siteUrl) {
  const publication = createStaticFiles(loadProject(input), readText(path.join(ROOT, 'web/index.html'), 512 * 1024),
    siteUrl === undefined ? {} : { siteUrl });
  const { project, summary } = publication;
  const files = ASSETS.map(asset => [asset, readText(path.join(ROOT, 'web', asset), 512 * 1024)]);
  files.push(...publication.files);
  files.push(['project.json', `${JSON.stringify(project, null, 2)}\n`]);
  for (const page of project.pages) files.push([`source/${page.slug}.md`, page.content]);
  const manifest = { schemaVersion: 'clero.output.v1', buildId: randomUUID(),
    files: files.map(([filename, text]) => ({ path: filename, sha256: sha(Buffer.from(text)) })) };
  files.push(['clero-output.json', `${JSON.stringify(manifest, null, 2)}\n`]);
  return { ...summary, htmlPages: publication.files.filter(([filename]) => filename.endsWith('.html')).length,
    ...writeNewDirectory(destination, files) };
}

function buildOptions(args) {
  let destination, siteUrl;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (!value || value.startsWith('--')) fail('Build options require values');
    if (flag === '--out' && destination === undefined) destination = value;
    else if (flag === '--site-url' && siteUrl === undefined) siteUrl = normalizeSiteUrl(value);
    else fail('Unknown or repeated build option');
  }
  if (!destination) fail('A new output directory is required with --out');
  return { destination, siteUrl };
}

function initialize(destination) {
  const config = { schemaVersion: 'clero.config.v1', name: 'My documentation', description: 'A place to make things clear.', accent: '#3556d8',
    pages: [{ slug: 'introduction', title: 'Introduction', description: 'Start here.', group: 'Get started', file: 'introduction.md' },
      { slug: 'guide', title: 'Your first guide', description: 'Turn a task into a useful page.', group: 'Get started', file: 'guide.md' }] };
  return writeNewDirectory(destination, [
    ['clero.json', `${JSON.stringify(config, null, 2)}\n`],
    ['introduction.md', '# Make something clear\n\nReplace this page with your product introduction. Then open [your first guide](guide.md).\n\n## A useful starting point\n\n- Explain who this is for.\n- Show a concrete task.\n- Link to the next step.\n'],
    ['guide.md', '# Your first guide\n\nDescribe the outcome before the steps.\n\n1. Choose one task.\n2. Write the smallest useful example.\n3. Review the result.\n\n```sh\nprintf "Hello, documentation\\n"\n```\n\nReturn to the [introduction](introduction.md).\n'],
  ]);
}

function main(args) {
  const [command, input, ...rest] = args;
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write('Clero\n\n  node bin/clero.mjs init <new-directory>\n  node bin/clero.mjs check <directory-or-project.json>\n  node bin/clero.mjs build <directory-or-project.json> --out <new-directory> [--site-url https://docs.example.com/]\n\nBuilds contain readable HTML pages. --site-url additionally emits canonical URLs, sitemap.xml and robots.txt.\nNo server, dependency installation, upload or account is started automatically.\n');
    return;
  }
  if (!input) fail('A project path is required');
  let result;
  if (command === 'init' && rest.length === 0) result = initialize(input);
  else if (command === 'check' && rest.length === 0) result = preparePublication(loadProject(input)).summary;
  else if (command === 'build') { const options = buildOptions(rest); result = build(input, options.destination, options.siteUrl); }
  else fail('Unknown command or arguments; use --help');
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try { main(process.argv.slice(2)); }
catch (error) { process.stderr.write(`Clero: ${error.message}\n`); process.exitCode = 1; }
