#!/usr/bin/env node
// Public workspace acceptance; publication/tools/browser live only in owned CI scratch.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
const REPOSITORY = 'alvarovillalbaa/clero';
const BRANCH = 'refs/heads/qa/clero-workspace-20261105';
const ACTIVE = '.github/workflows/workspace-browser.yml';
const SPEC = 'scripts/workspace-browser-driver.mjs';
const SPEC_SHA = '1623f4ad7907564a9c2b6708c15f96a5804947f9702354d03ed27ff2eb8a4e75';
const CARRY = 'docs/results/2026/11-05/workspace-browser-attempt-1.json';
const CARRY_SHA = '0078b1bff44475afdf5d47e03e6095bdeb841e8b212835c8ed091e556e3729dd';
const ORIGIN = 'https://clero-alvaro.vercel.app';
const TITLES = [
  'imports, edits, previews, saves and restores an actual project download',
  'invalid imports and canceled replacements preserve saved and unapplied work',
  'a stale tab cannot overwrite or discard a newer saved workspace',
  'the narrow published reader supports routing, search, anchors and code copy',
];
const STREAM_LIMIT = 524288, REPORT_LIMIT = 1048576, BROWSER_LIMIT = 262144;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const need = (condition, code) => { if (!condition) throw new Error(code); };
const finite = error => /^[a-z0-9_]+$/.test(error?.message ?? '') ? error.message : 'controller_error';
const sourceCommit = process.argv[3], deployment = process.env.CLERO_EXPECTED_DEPLOYMENT;
need(process.argv.length === 4 && process.argv[2] === '--source-commit' && /^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'source_pin_required');
need(/^dpl_[A-Za-z0-9]{1,100}$/.test(deployment ?? ''), 'deployment_pin_required');
need(process.version === 'v24.21.0' && process.platform === 'linux' && process.env.CI === 'true'
  && process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY === REPOSITORY
  && process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === BRANCH
  && process.env.CLERO_PUBLIC_REPOSITORY === 'true', 'approved_public_ci_required');
const repo = fs.realpathSync(process.cwd()), parent = fs.realpathSync(process.env.RUNNER_TEMP ?? '');
need(path.isAbsolute(parent) && fs.statSync(parent).isDirectory(), 'runner_temp_invalid');
const root = fs.mkdtempSync(path.join(parent, 'clero-workspace-'));
fs.chmodSync(root, 0o700);
const identity = fs.lstatSync(root), nonce = randomUUID();
need(identity.uid === process.getuid(), 'scratch_owner_invalid');
fs.writeFileSync(path.join(root, 'owner'), nonce, { flag: 'wx', mode: 0o600 });
for (const name of ['tools', 'tmp', 'cache', 'config', 'browsers']) fs.mkdirSync(path.join(root, name), { mode: 0o700 });
for (const name of ['npm-user', 'npm-global']) fs.writeFileSync(path.join(root, name), '', { flag: 'wx', mode: 0o600 });
const tools = path.join(root, 'tools'), specFile = path.join(tools, 'workspace-browser-driver.mjs');
const published = path.join(root, 'published');
let publicationIdentity, publicationFiles, manifestDocument;
const env = {
  PATH: `${path.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', CI: 'true', NO_COLOR: '1',
  TMPDIR: path.join(root, 'tmp'), TMP: path.join(root, 'tmp'), TEMP: path.join(root, 'tmp'),
  XDG_CACHE_HOME: path.join(root, 'cache'), XDG_CONFIG_HOME: path.join(root, 'config'),
  NODE_COMPILE_CACHE: path.join(root, 'cache', 'node'),
  npm_config_userconfig: path.join(root, 'npm-user'), npm_config_globalconfig: path.join(root, 'npm-global'),
  npm_config_cache: path.join(root, 'cache', 'npm'), npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
  PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'browsers'), PLAYWRIGHT_HTML_OPEN: 'never',
  CLERO_EXPECTED_DEPLOYMENT: deployment, CLERO_CHECK_ORIGIN: ORIGIN, CLERO_CHECK_ROOT: root,
  CLERO_EXPECTED_PROJECT_JSON: path.join(published, 'project.json'),
  CLERO_PLAYWRIGHT_MODULE: path.join(tools, 'node_modules/playwright/index.mjs'), SOURCE_COMMIT: sourceCommit,
  CLERO_CASE_IDS: 'C04',
};
const report = {
  schemaVersion: 'clero.workspace-browser.v1', sourceCommit, expectedDeployment: deployment, origin: ORIGIN,
  status: 'failed', startedAtUtc: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  scope: { scenarios: [TITLES[3]], cases: 1, carriedCases: ['C01', 'C02', 'C03'], retries: 0, workers: 1, appBuild: 'actual CLI, owned scratch only',
    appDependencies: false, accounts: false, backend: false, models: false, physicalDevice: false,
    profiles: ['narrow Chromium', 'narrow JavaScript disabled'], old72CasesRepeated: false, acceptedJourneysRepeated: 0 },
  limits: { workSeconds: 900, cleanupSeconds: 90, browserSeconds: 300, jobMinutes: 18,
    streamBytes: STREAM_LIMIT, streamGzipBytes: 131072, allStreamsGzipBytes: 524288,
    browserJsonBytes: BROWSER_LIMIT, reportBytes: REPORT_LIMIT, assetFetchSeconds: 8,
    publicationFiles: 512, publicationBytes: 16777216, assetBytes: 5242880, sameOriginCanonicalRedirects: 1 },
  commands: [], guards: [], errors: [], sourceFiles: [],
  proofLimits: [
    'C01-C03 retain their accepted first-run evidence; only C04 runs now. Combined acceptance is not a single four-pass invocation.',
    'Actual public workspace/reader browser flows are separate from the previously accepted 72 domain/CLI cases, which are not repeated.',
    'The actual source CLI builds a new owned publication in CI; no app dependency, local build or local browser is used.',
    'All emitted payload files are compared with anonymous served responses before/after. The output manifest has a random buildId: only its closed schema and file/path hashes match semantically.',
    'The provider deployment ID is a metadata label supplied by the parent; byte comparisons do not independently fetch deployment metadata or prove an internal backend identity.',
    'At most one same-origin canonical-path redirect is followed and retained; a direct 404.html response may be 200 or 404 only with exact expected bytes.',
    'Only Playwright1.64.1 is installed in owned runner storage. Chromium Linux packages belong to the disposable runner.',
    'Exit/close/EOF/groups and same-UID owned browser paths plus Linux starttime prove scoped cleanup, not a host-wide inventory.',
    'Narrow Chromium and observed clipboard/storage/download behavior do not establish physical devices, hosted collaboration, npm publication or full reference-product parity.',
  ],
};
const workEnd = Date.now() + 900000;
let cleanupEnd, interrupted = false, globalExpired = false, baseline, allGzip = 0, browserAttempted = false, assetManifest;
let browserScanUncertain = false, lastBrowserScan = 0;
const browserProcesses = new Map();
const active = new Set(), activeHttp = new Set(), handlers = new Map();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const handler = () => { interrupted = true; for (const child of active) child.stop('interrupted'); for (const request of activeHttp) request.abort(); };
  handlers.set(signal, handler); process.on(signal, handler);
}
const globalTimer = setTimeout(() => { globalExpired = true; for (const child of active) child.stop('global_deadline'); for (const request of activeHttp) request.abort(); }, Math.max(1, workEnd + 90000 - Date.now()));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function owner() {
  const current = fs.lstatSync(root), marker = path.join(root, 'owner');
  need(path.dirname(root) === parent && current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
    && current.uid === process.getuid() && fs.lstatSync(marker).uid === process.getuid()
    && !fs.lstatSync(marker).isSymbolicLink() && fs.readFileSync(marker, 'utf8') === nonce, 'scratch_identity_changed');
}
function read(file, maximum = 16777216) {
  const before = fs.lstatSync(file); need(before.isFile() && !before.isSymbolicLink() && before.size <= maximum, 'file_type_or_bound');
  const bytes = fs.readFileSync(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
    && before.ctimeMs === after.ctimeMs && bytes.length === before.size, 'file_changed'); return bytes;
}
function scrub(value, maximum = 700) {
  let text = String(value ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  for (const [from, to] of [[root, '[scratch]'], [repo, '[repository]'], [process.env.HOME, '[runner-home]']]) if (from) text = text.split(from).join(to);
  return Buffer.from(text).subarray(0, maximum).toString('utf8');
}
function compressed(bytes, maximum = 131072) {
  const zip = gzipSync(bytes); need(zip.length <= maximum, 'raw_gzip_limit');
  return { encoding: 'gzip-base64', bytes: bytes.length, sha256: sha(bytes), compressedBytes: zip.length, data: zip.toString('base64') };
}
function groupAbsent(pid) { try { process.kill(-pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : null; } }
function proc(pid) {
  const base = `/proc/${pid}`, item = fs.statSync(base);
  if (item.uid !== process.getuid()) return null;
  const before = readProc(path.join(base, 'stat'), 8192).toString(), close = before.lastIndexOf(')');
  need(close > 0, 'proc_stat_shape');
  const fields = before.slice(close + 2).trim().split(/\s+/);
  need(fields.length >= 20 && /^\d+$/.test(fields[19]), 'proc_stat_shape');
  const args = readProc(path.join(base, 'cmdline'), 65536).toString().split('\0').filter(Boolean);
  const after = readProc(path.join(base, 'stat'), 8192).toString(), afterClose = after.lastIndexOf(')');
  need(afterClose > 0 && after.slice(afterClose + 2).trim().split(/\s+/)[19] === fields[19], 'proc_identity_changed');
  const owned = args.some(arg => arg === root || arg.startsWith(root + '/') || arg.includes('=' + root + '/'))
    || browserProcesses.has(pid + ':' + fields[19]);
  return { pid, ppid: Number(fields[1]), pgid: Number(fields[2]), session: Number(fields[3]), state: fields[0],
    starttime: fields[19], owned, executable: args.length ? path.basename(args[0].trim().split(/\s+/)[0]).slice(0, 80) : '' };
}
function readProc(file, maximum) {
  const fd = fs.openSync(file, 'r');
  try { const buffer = Buffer.alloc(maximum + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0); need(length <= maximum, 'proc_read_bound'); return buffer.subarray(0, length); }
  finally { fs.closeSync(fd); }
}
function scanBrowsers(force = false) {
  if (!browserAttempted || (!force && Date.now() - lastBrowserScan < 500)) return [];
  lastBrowserScan = Date.now(); const names = fs.readdirSync('/proc').filter(name => /^\d+$/.test(name));
  need(names.length <= 8192, 'proc_inventory_bound'); const present = [];
  for (const name of names) {
    const pid = Number(name); if (pid === process.pid) continue;
    try {
      const item = proc(pid); if (!item?.owned) continue;
      // The command supervisor owns its own process group; this supplementary
      // inventory records detached browser descendants without logging argv.
      const key = item.pid + ':' + item.starttime;
      if (!browserProcesses.has(key)) browserProcesses.set(key, { ...item, firstSeenAtUtc: new Date().toISOString() });
      need(browserProcesses.size <= 256, 'browser_process_inventory_bound');
      present.push(item);
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true;
    }
  }
  return present;
}
async function cleanupBrowsers() {
  owner(); const started = Date.now(); let present = scanBrowsers(true), termSent = 0, killSent = 0;
  while (present.length && Date.now() - started < 6500 && Date.now() < cleanupEnd - 10000) {
    for (const item of present) {
      try {
        const current = proc(item.pid);
        need(current?.owned && current.starttime === item.starttime, 'browser_pid_identity_changed');
        const signal = Date.now() - started >= 3000 ? 'SIGKILL' : 'SIGTERM';
        process.kill(item.pid, signal); if (signal === 'SIGKILL') killSent++; else termSent++;
      } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true; }
    }
    await pause(100); present = scanBrowsers(true);
  }
  const stillPresent = scanBrowsers(true);
  report.browserProcessCleanup = { passed: !browserScanUncertain && stillPresent.length === 0 && termSent === 0 && killSent === 0,
    basis: 'Same UID, unique owned-root argv attribution and revalidated Linux kernel PID starttime; no argv/env output.',
    observed: [...browserProcesses.values()], remaining: stillPresent, termSent, killSent, scanUncertain: browserScanUncertain };
  need(report.browserProcessCleanup.passed, 'browser_process_cleanup_unverified');
}
async function run(label, executable, args, seconds, { cleanup = false, retainFailure = false, cwd = repo, postScratch = false } = {}) {
  if (postScratch) need(cleanup && report.scratchCleanup === 'passed' && !fs.existsSync(root), 'scratch_postguard_invalid'); else owner();
  need(cleanup || (!interrupted && !globalExpired), 'interrupted_before_command');
  const end = cleanup ? cleanupEnd : workEnd, remaining = end - Date.now() - 6500;
  need(remaining > 0, 'command_budget_exhausted');
  const commandEnv = postScratch ? { PATH: env.PATH, HOME: env.HOME, LANG: env.LANG, TZ: env.TZ,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } : env;
  const started = Date.now(), child = spawn(executable, args, { cwd, env: commandEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [[], []], count = [0, 0], size = [0, 0], digest = [createHash('sha256'), createHash('sha256')], eof = [false, false];
  let exitCode = null, signal = null, exited = false, closed = false, reason = null, stopAt = null, termSent = false, killSent = false, forcedDrain = false, captureFinished = false;
  const control = { stop(why) {
    if (!reason) { reason = why; stopAt = Date.now(); }
    if (!termSent && child.pid) { termSent = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  } };
  active.add(control);
  child.once('error', () => { control.stop('spawn_failed'); });
  child.once('exit', (code, received) => { exited = true; exitCode = code; signal = received; });
  child.once('close', () => { closed = true; });
  [child.stdout, child.stderr].forEach((stream, index) => {
    stream.once('end', () => { eof[index] = true; });
    stream.on('data', bytes => {
      if (captureFinished) return;
      count[index] += bytes.length; digest[index].update(bytes);
      const kept = bytes.subarray(0, Math.max(0, STREAM_LIMIT - size[index])); chunks[index].push(kept); size[index] += kept.length;
      if (count[index] > STREAM_LIMIT) control.stop('output_limit');
    });
  });
  let leaderClosedAt = null;
  while (true) {
    if (label === 'browser_cases') { try { scanBrowsers(); } catch { browserScanUncertain = true; } }
    const now = Date.now(), absent = child.pid ? groupAbsent(child.pid) : true;
    if (closed && leaderClosedAt === null) leaderClosedAt = now;
    if (interrupted && !cleanup) control.stop('interrupted');
    if (now - started >= Math.min(seconds * 1000, remaining)) control.stop('timeout');
    if (closed && exited && eof.every(Boolean) && absent === true) break;
    if (closed && !child.pid) break;
    if (leaderClosedAt !== null && absent !== true && now - leaderClosedAt >= 1500) control.stop('process_group_remaining');
    if (stopAt !== null && now - stopAt >= 3000 && !killSent && child.pid && absent !== true) {
      killSent = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    if (stopAt !== null && now - stopAt >= 6000) {
      forcedDrain = !closed || !eof.every(Boolean);
      if (forcedDrain) { child.stdout.destroy(); child.stderr.destroy(); }
      break;
    }
    await pause(25);
  }
  captureFinished = true; const output = chunks.map(parts => Buffer.concat(parts));
  const row = { label, args: [executable === process.execPath ? '[node]' : scrub(executable, 250), ...args.map(value => scrub(value, 250))],
    exitCode, signal, stopReason: reason, exitObservedAndReaped: exited, closeObserved: closed, pipesEOF: [...eof],
    forcedDrain, originalProcessGroupAbsent: child.pid ? groupAbsent(child.pid) : true, termSent, killSent, durationMs: Date.now() - started,
    streams: output.map((bytes, index) => {
      const raw = compressed(bytes); allGzip += raw.compressedBytes;
      return { name: index ? 'stderr' : 'stdout', observedBytes: count[index], observedSha256: digest[index].digest('hex'),
        complete: closed && eof[index] && count[index] === bytes.length && !forcedDrain, raw, head: scrub(bytes.toString(), 500), tail: scrub(bytes.subarray(Math.max(0, bytes.length - 700)).toString(), 700) };
    }) };
  row.released = exited && closed && eof.every(Boolean) && !forcedDrain && row.originalProcessGroupAbsent === true;
  report.commands.push(row); active.delete(control);
  need(allGzip <= 524288, 'all_streams_gzip_limit');
  const accepted = row.exitCode === 0 && row.signal === null && row.stopReason === null && row.released && row.streams.every(stream => stream.complete);
  if (!retainFailure) need(accepted, label + '_failed');
  return { output, row, accepted };
}
function parseGit(bytes, index) {
  const rows = new Map();
  for (const record of bytes.toString().split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t'), header = record.slice(0, tab).split(' '), name = record.slice(tab + 1);
    need(tab > 0 && name && !path.isAbsolute(name) && !name.split('/').some(part => !part || part === '.' || part === '..') && !rows.has(name), 'git_entry_invalid');
    need(index ? header[2] === '0' : header[1] === 'blob', 'git_entry_type'); rows.set(name, { mode: header[0], gitBlob: header[index ? 1 : 2] });
  }
  return rows;
}
function fileVector(name) {
  const file = path.join(repo, name);
  for (let current = path.dirname(file); current !== repo; current = path.dirname(current)) {
    const item = fs.lstatSync(current); need(item.isDirectory() && !item.isSymbolicLink(), 'tracked_ancestor_changed');
  }
  const before = fs.lstatSync(file), mode = before.isSymbolicLink() ? '120000' : before.isFile() ? (before.mode & 0o111 ? '100755' : '100644') : null;
  need(mode, 'tracked_type_invalid');
  const bytes = before.isSymbolicLink() ? fs.readlinkSync(file, { encoding: 'buffer' }) : read(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'tracked_file_changed');
  return { path: name, mode, gitBlob: gitBlob(bytes), bytes: bytes.length, sha256: sha(bytes) };
}
async function guard(label, cleanup = false, postScratch = false) {
  const result = { label, passed: false }; report.guards.push(result); const options = { cleanup, postScratch };
  need((await run(label + '_head', 'git', ['rev-parse', 'HEAD'], 10, options)).output[0].toString().trim() === sourceCommit, 'head_changed');
  need(!fs.existsSync(path.join(repo, ACTIVE)), 'active_workflow_in_source');
  const tree = parseGit((await run(label + '_tree', 'git', ['ls-tree', '-r', '-z', 'HEAD'], 10, options)).output[0], false);
  const index = parseGit((await run(label + '_index', 'git', ['ls-files', '--stage', '-z'], 10, options)).output[0], true);
  need(tree.size > 0 && index.size === tree.size, 'tracked_count_changed');
  const vector = [];
  for (const [name, item] of tree) {
    const value = fileVector(name); need(index.get(name)?.mode === item.mode && index.get(name)?.gitBlob === item.gitBlob
      && value.mode === item.mode && value.gitBlob === item.gitBlob, 'full_tracked_source_changed'); vector.push(value);
  }
  need((await run(label + '_status', 'git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 10, options)).output[0].length === 0, 'worktree_not_clean');
  await run(label + '_diff', 'git', ['-c', 'core.filemode=true', 'diff', '--no-ext-diff', '--no-textconv', '--quiet', '--exit-code', 'HEAD', '--'], 10, options);
  const ignored = (await run(label + '_ignored', 'git', ['status', '--porcelain=v1', '-z', '--ignored=matching', '--untracked-files=normal'], 10, options)).output[0];
  need(ignored.length === 0, 'repository_generated_output');
  if (!baseline) { baseline = vector; report.sourceFiles = vector; }
  need(JSON.stringify(vector) === JSON.stringify(baseline), 'source_vector_changed');
  Object.assign(result, { passed: true, trackedFiles: vector.length, sourceBytes: vector.reduce((sum, file) => sum + file.bytes, 0),
    vectorSha256: sha(JSON.stringify(vector)), fullHeadIndexModesAndBytes: true, noUntrackedOrIgnoredOutput: true });
}
function absent(file) {
  try { fs.lstatSync(file); throw new Error('publication_destination_exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function publicationVector() {
  owner(); const current = fs.lstatSync(published);
  need(current.isDirectory() && !current.isSymbolicLink() && current.uid === process.getuid(), 'publication_directory_type');
  if (publicationIdentity) need(current.dev === publicationIdentity.dev && current.ino === publicationIdentity.ino, 'publication_directory_changed');
  const vector = []; let bytes = 0;
  function walk(directory, prefix = '') {
    const names = fs.readdirSync(directory).sort();
    need(names.length <= 512, 'publication_entry_bound');
    for (const name of names) {
      need(name && !['.', '..'].includes(name) && !name.includes('\\') && !/[\x00-\x1f\x7f]/.test(name), 'publication_path');
      const relative = prefix + name, file = path.join(directory, name), item = fs.lstatSync(file);
      need(!item.isSymbolicLink() && item.uid === process.getuid(), 'publication_entry_owner');
      if (item.isDirectory()) walk(file, relative + '/');
      else {
        const raw = read(file, 5242880); bytes += raw.length;
        need(vector.length < 512 && bytes <= 16777216, 'publication_size_bound');
        vector.push({ path: relative, bytes: raw.length, sha256: sha(raw), mode: item.mode & 0o111 ? '100755' : '100644' });
      }
    }
  }
  walk(published); need(vector.length > 0, 'publication_empty'); return vector;
}
function sameKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}
function checkManifest(value, expected) {
  need(sameKeys(value, ['schemaVersion', 'buildId', 'files']) && value.schemaVersion === 'clero.output.v1'
    && typeof value.buildId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.buildId)
    && Array.isArray(value.files) && value.files.length === expected.length, 'output_manifest_shape');
  const seen = new Set();
  for (const file of value.files) {
    need(sameKeys(file, ['path', 'sha256']) && typeof file.path === 'string' && !seen.has(file.path), 'output_manifest_file');
    seen.add(file.path);
    const match = expected.find(item => item.path === file.path);
    need(match && match.sha256 === file.sha256, 'output_manifest_source_mismatch');
  }
}
function prepareManifest() {
  publicationIdentity = fs.lstatSync(published);
  publicationFiles = publicationVector();
  const expected = publicationFiles.filter(item => item.path !== 'clero-output.json');
  manifestDocument = JSON.parse(read(path.join(published, 'clero-output.json'), 131072));
  checkManifest(manifestDocument, expected);
  assetManifest = publicationFiles.map(item => ({ ...item,
    route: item.path === 'index.html' ? '/' : item.path.endsWith('/index.html') ? '/' + item.path.slice(0, -'index.html'.length) : '/' + item.path,
    comparison: item.path === 'clero-output.json' ? 'closed-manifest-file-hashes' : 'exact-bytes' }));
  need(new Set(assetManifest.map(item => item.route)).size === assetManifest.length, 'publication_route_collision');
  report.publication = { files: publicationFiles, fileCount: publicationFiles.length,
    totalBytes: publicationFiles.reduce((n, item) => n + item.bytes, 0), randomBuildId: manifestDocument.buildId,
    manifestQualification: 'buildId is random per build; the served manifest file list and hashes must match, not the random ID or full bytes.' };
  report.expectedAssets = assetManifest;
}
function verifyPublication(label) {
  if (!publicationFiles) return;
  need(JSON.stringify(publicationVector()) === JSON.stringify(publicationFiles), 'owned_publication_changed');
  report.publication.guards ??= []; report.publication.guards.push({ label, passed: true });
}
function carryAccepted() {
  const bytes = read(path.join(repo, CARRY), 262144);
  need(bytes.length === 110992 && sha(bytes) === CARRY_SHA, 'carry_receipt_identity');
  const old = JSON.parse(bytes);
  need(old.schemaVersion === 'clero.workspace-browser.v1' && old.status === 'failed'
    && old.sourceCommit === '07c30a1ee97194c196ae96618968f3e4fa19fc29'
    && old.expectedDeployment === 'dpl_Ee8HJUqZ6L4jKM8QHxsrn2JhkkUu'
    && old.generated?.sourceSha256 === '54c9f6d3eb4505b7a4c4736c92e1e0165eaae429346796987ef988cdebc5ca47'
    && old.generated.copiedByteExact === true && old.commands?.length === 29, 'carry_source_scope');
  let verifiedStreams = 0;
  const browserOutputs = [];
  for (const command of old.commands) {
    const isBrowser = command.label === 'browser_cases';
    need(command.exitCode === (isBrowser ? 1 : 0) && command.signal === null && command.stopReason === null
      && command.released && command.exitObservedAndReaped && command.closeObserved
      && command.pipesEOF?.length === 2 && command.pipesEOF.every(value => value === true)
      && command.originalProcessGroupAbsent === true && !command.forcedDrain && !command.termSent && !command.killSent
      && command.streams?.length === 2, 'carry_command_cleanup');
    for (const [index, stream] of command.streams.entries()) {
      const raw = stream.raw, zipped = Buffer.from(raw.data, 'base64');
      need(stream.name === (index ? 'stderr' : 'stdout') && raw.encoding === 'gzip-base64'
        && zipped.length === raw.compressedBytes && zipped.length <= 131072, 'carry_stream_shape');
      const decoded = gunzipSync(zipped, { maxOutputLength: STREAM_LIMIT });
      need(stream.complete && decoded.length === raw.bytes && decoded.length === stream.observedBytes
        && sha(decoded) === raw.sha256 && sha(decoded) === stream.observedSha256, 'carry_stream_identity');
      verifiedStreams++;
      if (isBrowser && stream.name === 'stdout') browserOutputs.push(decoded);
    }
  }
  need(verifiedStreams === 58 && browserOutputs.length === 1, 'carry_browser_stdout_count');
  const browserBytes = browserOutputs[0], result = old.browser?.result;
  need(browserBytes.length === old.browser.rawBytes && sha(browserBytes) === old.browser.rawSha256, 'carry_browser_raw_identity');
  const lines = browserBytes.toString().split('\n').filter(line => line.startsWith('CLERO_BROWSER_DRIVER='));
  need(lines.length === 1 && JSON.stringify(JSON.parse(lines[0].slice('CLERO_BROWSER_DRIVER='.length))) === JSON.stringify(result), 'carry_browser_wrapper_identity');
  need(result.schemaVersion === 1 && result.origin === ORIGIN && result.sourceCommit === old.sourceCommit
    && result.expectedDeployment === old.expectedDeployment && result.status === 'failed'
    && result.errors?.length === 1 && result.cases?.length === 4, 'carry_browser_scope');
  for (const [index, item] of result.cases.entries()) {
    need(item.id === `C0${index + 1}` && item.title === TITLES[index]
      && item.accepted === (index < 3) && (index < 3 ? item.error === null : typeof item.error === 'string' && item.error.length > 0), 'carry_case_identity');
  }
  for (const key of ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures', 'responseErrors', 'unexpectedDialogs'])
    need(result.boundaries?.[key] === 0, 'carry_browser_boundary');
  const cleanup = result.cleanup;
  need(cleanup?.contextsCreated === 5 && cleanup.contextsClosed === 5 && cleanup.browserClosed === true
    && cleanup.lateChecksComplete === true && cleanup.fixtureCleanup === 'passed' && cleanup.failures?.length === 0
    && old.processCleanup?.passed === true && old.processCleanup.started === 29 && old.networkCleanup?.passed === true
    && old.browserProcessCleanup?.passed === true && old.browserProcessCleanup.remaining?.length === 0
    && old.browserProcessCleanup.termSent === 0 && old.browserProcessCleanup.killSent === 0
    && old.browserProcessCleanup.scanUncertain === false && old.scratchCleanup === 'passed', 'carry_cleanup');
  need(old.sourceFiles?.length === 49 && old.sourceFiles.reduce((sum, item) => sum + item.bytes, 0) === 385821
    && new Set(old.sourceFiles.map(item => item.path)).size === 49, 'carry_source_vector');
  const oldVectorSha = sha(JSON.stringify(old.sourceFiles));
  need(old.guards?.length === 4 && JSON.stringify(old.guards.map(item => item.label)) === JSON.stringify(['before', 'before_browser', 'after', 'after_cleanup'])
    && old.guards.every(item => item.passed && item.trackedFiles === 49 && item.sourceBytes === 385821
      && item.vectorSha256 === oldVectorSha && item.fullHeadIndexModesAndBytes && item.noUntrackedOrIgnoredOutput), 'carry_source_guards');
  const allowed = new Set(['AGENTS.md', 'docs/proposals/workspace-browser-checks.md', SPEC, 'scripts/workspace-browser-controller.mjs']);
  const protectedFiles = [], changed = [];
  for (const expected of old.sourceFiles) {
    const actual = fileVector(expected.path);
    need(actual.mode === expected.mode, 'carry_source_mode_changed');
    if (allowed.has(expected.path)) changed.push({ path: expected.path, historicalSha256: expected.sha256, currentSha256: actual.sha256 });
    else { need(JSON.stringify(actual) === JSON.stringify(expected), 'carry_protected_source_changed'); protectedFiles.push(actual); }
  }
  need(protectedFiles.length === 45 && changed.length === 4, 'carry_source_closure');
  const driver = read(path.join(repo, SPEC), 131072).toString();
  const start = driver.indexOf('  await runCase(0,'), end = driver.indexOf('  await runCase(3,');
  need(start >= 0 && end > start && sha(driver.slice(start, end)) === 'f194c298a966218840eed53f8c69d47247af431f3f5ea54ed34a885399f2b1b8', 'carry_case_bodies_changed');
  const payloads = publicationFiles.filter(item => item.path !== 'clero-output.json');
  need(old.publication?.fileCount === 26 && old.publication.files?.length === 26 && payloads.length === 25
    && JSON.stringify(payloads) === JSON.stringify(old.publication.files.filter(item => item.path !== 'clero-output.json')), 'carry_publication_payloads');
  need(old.servedAssets?.length === 26 && old.servedAssets.every(item => item.phase === 'before_browser'
    && item.matchesExpected && item.complete && item.readerReleased)
    && old.servedAssets.filter(item => item.comparison === 'exact-bytes' && item.byteExact).length === 25
    && old.servedAssets.filter(item => item.comparison === 'closed-manifest-file-hashes').length === 1, 'carry_pre_asset_scope');
  report.carriedEvidence = { receipt: CARRY, bytes: bytes.length, sha256: CARRY_SHA,
    sourceCommit: old.sourceCommit, runId: 42031491247, jobId: 127258790348,
    acceptedCases: result.cases.slice(0, 3).map(({ id, title }) => ({ id, title, accepted: true })),
    failedCase: { id: 'C04', error: result.cases[3].error, actualSearchTextCaptured: false },
    verifiedStreams, commandCount: 29, sourceGuards: 4, protectedSourceInputs: 45,
    protectedSourceVectorSha256: sha(JSON.stringify(protectedFiles)), allowedSourceChanges: changed,
    publicationPayloadsByteExact: 25, manifestComparison: 'Closed file paths and hashes; random buildId is not byte-compared.',
    preAssetObservations: 26, postAssetObservations: 0, acceptedCasesRepeated: 0,
    qualification: 'The first run failed overall. Its three accepted journeys remain historical; only C04 executes now. Search mismatch is source-inferred; the first actual search text was not retained.' };
}
function retainSecondFailure() {
  const receipt = 'docs/results/2026/11-05/workspace-browser-attempt-2.json';
  const expectedSha = 'ccce2f9eda0a2888a343f4fc9aa14a943944c104d69a1b2a814455fd2022ff9c';
  const bytes = read(path.join(repo, receipt), 262144);
  need(bytes.length === 111142 && sha(bytes) === expectedSha, 'second_receipt_identity');
  const old = JSON.parse(bytes), result = old.browser?.result;
  need(old.schemaVersion === 'clero.workspace-browser.v1' && old.status === 'failed'
    && old.sourceCommit === '2c0daff0af7a50cd935ae4f39c98a06c346c074d'
    && old.expectedDeployment === 'dpl_GXfN3rieN5YHvYTx1pJkiu18axCb'
    && old.generated?.sourceSha256 === '95d6748b7107b53691912bf39dcde6816ed2910439ab3d68304262be8a21bb28'
    && old.generated.copiedByteExact === true && old.commands?.length === 29, 'second_source_scope');
  let verifiedStreams = 0;
  const browserOutputs = [];
  for (const command of old.commands) {
    const isBrowser = command.label === 'browser_cases';
    need(command.exitCode === (isBrowser ? 1 : 0) && command.signal === null && command.stopReason === null
      && command.released && command.exitObservedAndReaped && command.closeObserved
      && command.pipesEOF?.length === 2 && command.pipesEOF.every(value => value === true)
      && command.originalProcessGroupAbsent === true && !command.forcedDrain && !command.termSent && !command.killSent
      && command.streams?.length === 2, 'second_command_cleanup');
    for (const [index, stream] of command.streams.entries()) {
      const raw = stream.raw, zipped = Buffer.from(raw.data, 'base64');
      need(stream.name === (index ? 'stderr' : 'stdout') && raw.encoding === 'gzip-base64'
        && zipped.length === raw.compressedBytes && zipped.length <= 131072, 'second_stream_shape');
      const decoded = gunzipSync(zipped, { maxOutputLength: STREAM_LIMIT });
      need(stream.complete && decoded.length === raw.bytes && decoded.length === stream.observedBytes
        && sha(decoded) === raw.sha256 && sha(decoded) === stream.observedSha256, 'second_stream_identity');
      verifiedStreams++;
      if (isBrowser && stream.name === 'stdout') browserOutputs.push(decoded);
    }
  }
  need(verifiedStreams === 58 && browserOutputs.length === 1, 'second_browser_stdout_count');
  const stdout = browserOutputs[0], lines = stdout.toString().split('\n').filter(line => line.startsWith('CLERO_BROWSER_DRIVER='));
  need(stdout.length === old.browser.rawBytes && sha(stdout) === old.browser.rawSha256 && lines.length === 1
    && JSON.stringify(JSON.parse(lines[0].slice('CLERO_BROWSER_DRIVER='.length))) === JSON.stringify(result), 'second_browser_wrapper_identity');
  need(result.schemaVersion === 1 && result.origin === ORIGIN && result.sourceCommit === old.sourceCommit
    && result.expectedDeployment === old.expectedDeployment && result.status === 'failed'
    && JSON.stringify(result.caseIds) === '["C04"]' && result.cases?.length === 1
    && result.cases[0].id === 'C04' && result.cases[0].title === TITLES[3]
    && result.cases[0].accepted === false && typeof result.cases[0].error === 'string'
    && result.errors?.length === 2 && result.boundaries?.responseErrors === 1, 'second_failed_case_scope');
  for (const key of ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures', 'unexpectedDialogs'])
    need(result.boundaries?.[key] === 0, 'second_unexpected_boundary');
  const cleanup = result.cleanup;
  need(cleanup?.contextsCreated === 2 && cleanup.contextsClosed === 2 && cleanup.browserClosed === true
    && cleanup.lateChecksComplete === true && cleanup.fixtureCleanup === 'passed' && cleanup.failures?.length === 0
    && old.processCleanup?.passed === true && old.processCleanup.started === 29 && old.networkCleanup?.passed === true
    && old.browserProcessCleanup?.passed === true && old.browserProcessCleanup.remaining?.length === 0
    && old.browserProcessCleanup.termSent === 0 && old.browserProcessCleanup.killSent === 0
    && old.browserProcessCleanup.scanUncertain === false && old.scratchCleanup === 'passed', 'second_cleanup');
  need(old.sourceFiles?.length === 50 && old.sourceFiles.reduce((sum, item) => sum + item.bytes, 0) === 507594
    && new Set(old.sourceFiles.map(item => item.path)).size === 50, 'second_source_vector');
  const vectorSha = sha(JSON.stringify(old.sourceFiles));
  need(old.guards?.length === 4 && JSON.stringify(old.guards.map(item => item.label)) === JSON.stringify(['before', 'before_browser', 'after', 'after_cleanup'])
    && old.guards.every(item => item.passed && item.trackedFiles === 50 && item.sourceBytes === 507594
      && item.vectorSha256 === vectorSha && item.fullHeadIndexModesAndBytes && item.noUntrackedOrIgnoredOutput), 'second_source_guards');
  const allowed = new Set(['AGENTS.md', 'docs/proposals/workspace-browser-checks.md', SPEC, 'scripts/workspace-browser-controller.mjs']);
  const protectedFiles = [], changed = [];
  for (const expected of old.sourceFiles) {
    const actual = fileVector(expected.path);
    need(actual.mode === expected.mode, 'second_source_mode_changed');
    if (allowed.has(expected.path)) changed.push({ path: expected.path, historicalSha256: expected.sha256, currentSha256: actual.sha256 });
    else { need(JSON.stringify(actual) === JSON.stringify(expected), 'second_protected_source_changed'); protectedFiles.push(actual); }
  }
  need(protectedFiles.length === 46 && changed.length === 4, 'second_source_closure');
  const payloads = publicationFiles.filter(item => item.path !== 'clero-output.json');
  need(old.publication?.fileCount === 26 && old.publication.files?.length === 26 && payloads.length === 25
    && JSON.stringify(payloads) === JSON.stringify(old.publication.files.filter(item => item.path !== 'clero-output.json'))
    && old.servedAssets?.length === 26 && old.servedAssets.every(item => item.phase === 'before_browser'
      && item.matchesExpected && item.complete && item.readerReleased)
    && old.servedAssets.filter(item => item.comparison === 'exact-bytes' && item.byteExact).length === 25
    && old.servedAssets.filter(item => item.comparison === 'closed-manifest-file-hashes').length === 1, 'second_publication_scope');
  report.diagnosticAttempts = [{ receipt, bytes: bytes.length, sha256: expectedSha, sourceCommit: old.sourceCommit,
    runId: 42033242306, jobId: 127264704762, acceptedCases: [], failedCase: 'C04', verifiedStreams,
    browserStdoutBytes: stdout.length, browserStdoutSha256: sha(stdout), commandCount: 29, sourceGuards: 4,
    protectedSourceInputs: 46, protectedSourceVectorSha256: sha(JSON.stringify(protectedFiles)), allowedSourceChanges: changed,
    publicationPayloadsByteExact: 25, preAssetObservations: 26, postAssetObservations: 0,
    qualification: 'Failed overall on one transient-document body observer error. Its functional observations are diagnostic only; no C04 acceptance is carried.' }];
}
function canonicalVariant(route) {
  const result = new Set([route]);
  if (route !== '/' && route.endsWith('/')) result.add(route.slice(0, -1));
  if (route.endsWith('.html')) result.add(route.slice(0, -5));
  return result;
}
async function verifyServedAssets(phase) {
  report.servedAssets ??= [];
  for (const expected of assetManifest) {
    owner(); need(!interrupted && !globalExpired && workEnd - Date.now() > 9000, 'asset_budget_exhausted');
    const abort = new AbortController(), row = { phase, route: expected.route, file: expected.path,
      comparison: expected.comparison, expectedBytes: expected.bytes, expectedSha256: expected.sha256,
      status: null, sameOrigin: false, redirectChain: [], complete: false, bytes: 0, sha256: null,
      matchesExpected: false, byteExact: false, credentials: 'omit', readerReleased: false, aborted: false };
    report.servedAssets.push(row); activeHttp.add(abort);
    let reader, timedOut = false; const digest = createHash('sha256'), chunks = [], deadline = Date.now() + 8000;
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, 8000);
    try {
      let target = ORIGIN + expected.route, response;
      for (let redirects = 0; ; redirects++) {
        response = await fetch(target, { method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store',
          signal: abort.signal, headers: { accept: '*/*', 'user-agent': 'CleroWorkspaceChecks/1' } });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        need(redirects === 0 && response.headers.get('location'), 'asset_redirect_bound');
        const next = new URL(response.headers.get('location'), target);
        need(next.origin === ORIGIN && !next.username && !next.password && !next.search && !next.hash
          && canonicalVariant(expected.route).has(next.pathname) && next.href !== target, 'asset_redirect_identity');
        row.redirectChain.push({ from: new URL(target).pathname, status: response.status, to: next.pathname });
        const cancelled = await Promise.race([response.body?.cancel().then(() => true, () => false) ?? true, pause(500).then(() => false)]);
        need(cancelled, 'redirect_body_cleanup'); target = next.href;
      }
      row.status = response.status; row.sameOrigin = new URL(response.url).origin === ORIGIN;
      row.finalRoute = new URL(response.url).pathname;
      need(row.sameOrigin && response.url === target && (response.status === 200 || (expected.path === '404.html' && response.status === 404)), 'asset_response_identity');
      const length = response.headers.get('content-length');
      need(length === null || (/^\d+$/.test(length) && Number(length) <= 5242880), 'asset_declared_limit');
      need(response.body, 'asset_body_missing'); reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        need(!interrupted && !globalExpired, 'asset_interrupted'); need(!timedOut && Date.now() <= deadline, 'asset_timeout');
        if (chunk.done) { row.complete = true; break; }
        row.bytes += chunk.value.byteLength; need(row.bytes <= 5242880, 'asset_body_limit'); digest.update(chunk.value);
        if (expected.comparison !== 'exact-bytes') { need(row.bytes <= 131072, 'manifest_body_bound'); chunks.push(chunk.value); }
      }
      row.sha256 = digest.digest('hex'); row.byteExact = row.bytes === expected.bytes && row.sha256 === expected.sha256;
      if (expected.comparison === 'exact-bytes') row.matchesExpected = row.byteExact;
      else {
        checkManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')), publicationFiles.filter(item => item.path !== 'clero-output.json'));
        row.matchesExpected = true; row.randomBuildIdCompared = false;
      }
      need(row.matchesExpected, 'served_asset_source_mismatch');
    } catch (error) { row.error = timedOut ? 'asset_timeout' : finite(error); throw new Error(row.error); }
    finally {
      clearTimeout(timer); abort.abort(); row.aborted = true;
      if (row.sha256 === null) row.sha256 = digest.digest('hex');
      if (reader) {
        let cancelled = false;
        try { cancelled = await Promise.race([reader.cancel().then(() => true, () => false), pause(1000).then(() => false)]); }
        finally { try { reader.releaseLock(); row.readerReleased = cancelled; } catch { row.readerReleased = false; } }
      } else row.readerReleased = true;
      activeHttp.delete(abort);
    }
    need(row.readerReleased && !timedOut, 'asset_stream_cleanup_unverified');
  }
}

function generate() {
  const bytes = read(path.join(repo, SPEC), 131072); need(sha(bytes) === SPEC_SHA, 'browser_source_hash');
  fs.writeFileSync(specFile, bytes, { flag: 'wx', mode: 0o600 });
  report.generated = { sourceSpec: SPEC, sourceSha256: SPEC_SHA, generatedSha256: sha(read(specFile, 131072)),
    copiedByteExact: read(specFile, 131072).equals(bytes) };
  need(report.generated.copiedByteExact, 'generated_spec_changed');
}
function browserResults(bytes) {
  need(bytes.length <= BROWSER_LIMIT, 'browser_output_limit');
  const lines = bytes.toString().split('\n').filter(line => line.startsWith('CLERO_BROWSER_DRIVER='));
  need(lines.length === 1, 'browser_receipt_count');
  const value = JSON.parse(lines[0].slice('CLERO_BROWSER_DRIVER='.length));
  report.browser = { accepted: false, result: value, rawSha256: sha(bytes), rawBytes: bytes.length };
  need(value.schemaVersion === 1 && value.origin === ORIGIN && value.sourceCommit === sourceCommit
    && value.expectedDeployment === deployment && typeof value.browserVersion === 'string'
    && Array.isArray(value.caseIds) && JSON.stringify(value.caseIds) === '["C04"]'
    && Array.isArray(value.cases) && value.cases.length === 1 && value.status === 'passed'
    && Array.isArray(value.errors) && value.errors.length === 0, 'browser_receipt_shape');
  const seen = new Set();
  for (const item of value.cases) {
    need(item.id === 'C04' && !seen.has(item.id), 'browser_case_identity'); seen.add(item.id);
    need(item.title === TITLES[Number(item.id.slice(1)) - 1] && item.accepted === true && item.error === null
      && item.observations && typeof item.observations === 'object', 'browser_case_failure');
  }
  for (const key of ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures', 'responseErrors', 'unexpectedDialogs'])
    need(value.boundaries?.[key] === 0, 'browser_boundary');
  const c = value.cleanup;
  need(c && c.contextsCreated === 2 && c.contextsClosed === 2 && c.browserClosed === true
    && c.fixtureCleanup === 'passed' && c.lateChecksComplete === true
    && c.cdpSessionsCreated === 1 && c.cdpSessionsDetached === 1 && c.cdpSessionsRemaining === 0
    && c.cdpPendingResponses === 0 && Array.isArray(c.cdpFailures) && c.cdpFailures.length === 0
    && Array.isArray(c.failures) && c.failures.length === 0, 'browser_resource_cleanup');
  const observer = value.projectObserver, project = publicationFiles.find(item => item.path === 'project.json');
  need(observer?.kind === 'chromium-durable-network' && observer.maxTotalBufferBytes === 8388608
    && observer.maxResourceBufferBytes === 5242880 && Number.isSafeInteger(observer.requests) && observer.requests > 0
    && observer.requests === observer.responses && observer.requests === observer.completedBodies
    && Array.isArray(observer.reads) && observer.reads.length === observer.requests && observer.reads.length <= 128, 'browser_project_observer_scope');
  const documentRoutes = new Set(assetManifest.filter(item => item.path.endsWith('index.html')).flatMap(item => [...canonicalVariant(item.route)]));
  const ordinals = new Set();
  for (const read of observer.reads) {
    need(read.session === 1 && Number.isSafeInteger(read.requestOrdinal) && read.requestOrdinal > 0 && !ordinals.has(read.requestOrdinal)
      && documentRoutes.has(read.documentRoute) && read.loadingFinished === true && read.matchesExpected === true
      && read.bytes === project.bytes && read.sha256 === project.sha256, 'browser_project_body_identity');
    ordinals.add(read.requestOrdinal);
  }
  need(observer.reads.some(item => item.documentRoute === '/')
    && observer.reads.some(item => canonicalVariant('/writing/').has(item.documentRoute)), 'browser_transient_project_body_missing');
  report.browser.accepted = true;
}
try {
  await guard('before');
  need(JSON.parse(read(path.join(repo, 'package.json'), 32768)).name === 'clero', 'package_identity');
  absent(published);
  const built = await run('build_publication', process.execPath, [path.join(repo, 'bin/clero.mjs'), 'build',
    path.join(repo, 'docs-site'), '--out', published, '--site-url', ORIGIN + '/'], 60);
  const summary = JSON.parse(built.output[0].toString());
  need(summary.schemaVersion === 'clero.project.v1' && summary.pages === 7 && summary.htmlPages === 9
    && summary.output === published, 'publication_build_shape');
  report.build = summary; prepareManifest(); carryAccepted(); retainSecondFailure();
  report.runtime.nodeSha256 = sha(read(process.execPath, 268435456));
  const npm = fs.realpathSync(path.join(path.dirname(process.execPath), 'npm'));
  need(fs.statSync(npm).isFile(), 'npm_cli_missing'); report.runtime.npmCliSha256 = sha(read(npm, 1048576));
  report.runtime.npm = (await run('npm_version', process.execPath, [npm, '--version'], 15, { cwd: tools })).output[0].toString().trim();
  await run('install_playwright', process.execPath, [npm, 'install', '--prefix', tools, '--no-save', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', 'playwright@1.64.1'], 150, { cwd: tools });
  report.runtime.toolPackages = ['playwright', 'playwright-core'].map(name => {
    const bytes = read(path.join(tools, 'node_modules', name, 'package.json'), 32768), value = JSON.parse(bytes);
    need(value.name === name && value.version === '1.64.1', 'playwright_version');
    return { name, version: value.version, packageJsonSha256: sha(bytes) };
  });
  const cli = path.join(tools, 'node_modules/playwright/cli.js'); report.runtime.playwright = '1.64.1';
  report.runtime.playwrightCliSha256 = sha(read(cli, 1048576));
  await run('install_chromium_and_runner_libraries', process.execPath, [cli, 'install', '--with-deps', 'chromium'], 240, { cwd: tools });
  generate();
  verifyPublication('before_browser');
  await verifyServedAssets('before_browser');
  await guard('before_browser');
  need(workEnd - Date.now() >= 306500, 'browser_window_unavailable'); browserAttempted = true;
  const browser = await run('browser_cases', process.execPath, [specFile], 300, { cwd: tools, retainFailure: true });
  browserResults(browser.output[0]); need(browser.accepted, 'browser_cli_failed');
  await verifyServedAssets('after_browser');
  await guard('after_browser');
  verifyPublication('after_browser');
} catch (error) { report.errors.push(finite(error)); }
finally {
  cleanupEnd = Math.min(Date.now() + 90000, workEnd + 90000);
  try { verifyPublication('after'); } catch (error) { report.errors.push(finite(error)); }
  try { await guard('after', true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  for (const request of activeHttp) request.abort();
  report.networkCleanup = { passed: activeHttp.size === 0 && (report.servedAssets ?? []).every(row => row.readerReleased),
    basis: 'Public response bodies cancelled and reader locks released; no host-wide socket inventory.' };
  try { await cleanupBrowsers(); } catch (error) { report.errors.push(finite(error)); }
  try {
    owner(); need(report.processCleanup.passed && report.browserProcessCleanup?.passed === true && report.networkCleanup.passed, 'process_cleanup_unverified');
    fs.rmSync(root, { recursive: true }); need(!fs.existsSync(root), 'scratch_still_present'); report.scratchCleanup = 'passed';
  } catch (error) { report.scratchCleanup = 'unverified'; report.errors.push(finite(error)); }
  try { if (report.scratchCleanup === 'passed') await guard('after_cleanup', true, true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  if (interrupted) report.errors.push('interrupted');
  if (globalExpired || Date.now() > workEnd + 90000) report.errors.push('global_deadline');
  report.interrupted = interrupted; report.completedAtUtc = new Date().toISOString();
  report.status = !report.errors.length && report.carriedEvidence?.acceptedCases.length === 3 && report.browser?.accepted === true && report.processCleanup.passed && report.browserProcessCleanup?.passed === true
    && report.networkCleanup.passed && report.servedAssets?.length === assetManifest?.length * 2 && report.servedAssets.every(row => row.matchesExpected && row.complete)
    && report.scratchCleanup === 'passed' ? 'passed' : 'failed';
  let text = JSON.stringify(report);
  if (Buffer.byteLength(text) > REPORT_LIMIT) { text = JSON.stringify({ schemaVersion: report.schemaVersion, sourceCommit, expectedDeployment: deployment, status: 'failed', errors: ['report_limit'] }); report.status = 'failed'; }
  const outputTimer = setTimeout(() => { process.stderr.write('controller_stdout_deadline\n'); process.exit(1); }, Math.max(1, Math.min(2000, workEnd + 92000 - Date.now())));
  process.stdout.write('CLERO_BROWSER_REPORT=' + text + '\n', () => {
    clearTimeout(outputTimer); clearTimeout(globalTimer);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    process.exitCode = report.status === 'passed' && !interrupted && !globalExpired && Date.now() <= workEnd + 92000 ? 0 : 1;
  });
}
