export const limits = Object.freeze({ pages: 200, pageBytes: 128 * 1024, contentBytes: 4 * 1024 * 1024, bundleBytes: 5 * 1024 * 1024 });
const encoder = new TextEncoder();
const own = (value, key) => Object.hasOwn(value, key);
const fail = code => { throw new TypeError(code); };

function record(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('project_record_required');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !fields.includes(key)) fail('project_unknown_field');
    if (!own(descriptor, 'value') || !descriptor.enumerable) fail('project_data_fields_required');
  }
  return value;
}

function required(value, key) {
  if (!own(value, key)) fail('project_required_field');
  return value[key];
}

function unicode(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 0) fail('project_invalid_unicode');
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('project_invalid_unicode');
    } else if (code >= 0xdc00 && code <= 0xdfff) fail('project_invalid_unicode');
  }
  return value;
}

function label(value, maximum, empty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim()) || /[\u0000-\u001f\u007f\u2028\u2029]/u.test(value)) fail('project_label_invalid');
  return unicode(value);
}

export function normalizeSlug(value) {
  if (typeof value !== 'string' || !value || value.length > 512 || !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(value)) fail('project_slug_invalid');
  const segments = value.split('/');
  if (segments.length > 32 || segments.some(part => ['assets', 'lib', 'project.json'].includes(part))) fail('project_slug_reserved');
  return value;
}

export function hrefForPage(slug) { return `?page=${encodeURIComponent(normalizeSlug(slug))}`; }

/** Shared by the project producer and renderer; it never normalizes source bytes. */
export function validateMarkdownContent(value) {
  if (typeof value !== 'string' || value.length > limits.pageBytes) fail('project_content_too_large');
  unicode(value);
  if (encoder.encode(value).length > limits.pageBytes) fail('project_content_too_large');
  return value;
}

export function normalizeProject(value) {
  const source = record(value, ['schemaVersion', 'name', 'description', 'accent', 'pages']);
  if (required(source, 'schemaVersion') !== 'clero.project.v1') fail('project_schema_unsupported');
  const name = label(required(source, 'name'), 128);
  const description = label(own(source, 'description') ? source.description : '', 512, true);
  const accent = own(source, 'accent') ? source.accent : '#3556d8';
  if (typeof accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(accent)) fail('project_accent_invalid');
  const pages = required(source, 'pages');
  if (!Array.isArray(pages) || Object.getPrototypeOf(pages) !== Array.prototype || !pages.length || pages.length > limits.pages) fail('project_pages_invalid');
  for (const key of Reflect.ownKeys(pages)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= pages.length) fail('project_pages_invalid');
  }
  const slugs = new Set(); let bytes = 0;
  const normalizedPages = [];
  for (let index = 0; index < pages.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(pages, String(index));
    if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) fail('project_data_fields_required');
    const page = record(descriptor.value, ['slug', 'title', 'description', 'group', 'content']);
    const slug = normalizeSlug(required(page, 'slug'));
    if (slugs.has(slug)) fail('project_duplicate_slug');
    slugs.add(slug);
    const content = validateMarkdownContent(required(page, 'content'));
    bytes += encoder.encode(content).length;
    if (bytes > limits.contentBytes) fail('project_content_budget');
    normalizedPages.push({
      slug, title: label(required(page, 'title'), 160),
      description: label(own(page, 'description') ? page.description : '', 512, true),
      group: label(own(page, 'group') ? page.group : 'Documentation', 80), content,
    });
  }
  const result = { schemaVersion: 'clero.project.v1', name, description, accent: accent.toLowerCase(), pages: normalizedPages };
  if (encoder.encode(`${JSON.stringify(result, null, 2)}\n`).length > limits.bundleBytes) fail('project_bundle_too_large');
  for (const page of normalizedPages) Object.freeze(page);
  Object.freeze(normalizedPages);
  return Object.freeze(result);
}
