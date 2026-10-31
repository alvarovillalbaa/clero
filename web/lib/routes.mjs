import { normalizeSlug } from './model.mjs';

const invalid = () => { throw new TypeError('route_input_invalid'); };

function text(value, spaces = false) {
  if (typeof value !== 'string' || (spaces ? /[\u0000-\u001f\u007f]/u : /[\u0000-\u0020\u007f]/u).test(value)) invalid();
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid();
    } else if (code >= 0xdc00 && code <= 0xdfff) invalid();
  }
  return value;
}

/** Inspect the authored path before URL can erase traversal or backslashes. */
function rawPath(value) {
  const location = value.split(/[?#]/u, 1)[0];
  if (location.includes('\\')) invalid();
  let pathname = location, authority = '';
  if (location.startsWith('//')) {
    const matched = /^\/\/([^/]*)(\/.*)?$/u.exec(location);
    authority = matched[1]; pathname = matched[2] ?? '';
  } else if (/^[a-z][a-z0-9+.-]*:/iu.test(location)) {
    const matched = /^https?:\/\/([^/]*)(\/.*)?$/iu.exec(location);
    if (!matched) invalid();
    authority = matched[1]; pathname = matched[2] ?? '';
  }
  if (authority.includes('@') || pathname.includes('%') || pathname.split('/').some(part => part === '.' || part === '..')) invalid();
  return pathname;
}

function base(value) {
  text(value);
  if (!/^https?:\/\//iu.test(value) || value.includes('?') || value.includes('#')) invalid();
  const pathname = rawPath(value), url = new URL(value);
  if (!pathname.startsWith('/') || !pathname.endsWith('/') || pathname.includes('//')
    || pathname !== url.pathname || url.username || url.password) invalid();
  return url;
}

export function pagePath(slug) { return `${normalizeSlug(slug)}/`; }

/** Inputs are strings; fragment is decoded text, with no heading-prefix rewrite. */
export function pageURL(slug, baseURL, fragment = '') {
  const url = new URL(pagePath(slug), base(baseURL));
  text(fragment, true);
  url.hash = fragment ? encodeURIComponent(fragment) : '';
  return url.href;
}

/** Recognize route shape only. The caller verifies membership in its project. */
export function parsePageURL(href, baseURL) {
  try {
    text(href); rawPath(href);
    const site = base(baseURL), url = new URL(href, site);
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname) || url.username || url.password) return null;
    const relative = url.pathname.slice(site.pathname.length);
    let slug = null;
    if (relative !== '' && relative !== 'index.html') {
      const candidate = relative.endsWith('/index.html') ? relative.slice(0, -11)
        : relative.endsWith('/') ? relative.slice(0, -1) : relative;
      slug = normalizeSlug(candidate);
    }
    const pages = url.searchParams.getAll('page');
    if (pages.length > 1) return null;
    const legacy = pages.length === 1;
    if (legacy) slug = normalizeSlug(pages[0]);
    const fragment = text(decodeURIComponent(url.hash.slice(1)), true);
    return Object.freeze({ slug, root: slug === null, legacy, fragment });
  } catch { return null; }
}
