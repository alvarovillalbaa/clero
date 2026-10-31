import { normalizeProject } from '../web/lib/model.mjs';
import { escapeHtml, renderMarkdown } from '../web/lib/markdown.mjs';
import { pagePath, pageURL } from '../web/lib/routes.mjs';

const encoder = new TextEncoder();
const markerNames = ['head', 'brand', 'description', 'navigation', 'article', 'neighbours', 'contents'];
const fail = code => { throw new TypeError(code); };

export function normalizeSiteUrl(value) {
  if (value === undefined) return null;
  try {
    if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\u0000-\u001f\u007f-\u009f\\?#]/u.test(value)) throw new Error();
    const raw = /^https:\/\/[^/]+(\/.*)?$/i.exec(value);
    if (!raw) throw new Error();
    const rawPath = raw[1] ?? '/', segments = rawPath.split('/');
    for (const [index, segment] of segments.entries()) {
      if (!segment) { if (index > 0 && index < segments.length - 1) throw new Error(); continue; }
      if (/%(?![a-f0-9]{2})/i.test(segment)) throw new Error();
      const decoded = decodeURIComponent(segment);
      if (decoded === '.' || decoded === '..' || /[\s\u0000-\u001f\u007f-\u009f\\/%?#]/u.test(decoded)) throw new Error();
    }
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname.includes('%')) throw new Error();
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    if (url.href.length > 2048) throw new Error();
    return url.href;
  } catch { fail('publication_site_url_invalid'); }
}

/** No output is generated until every page and same/cross-page fragment is valid. */
export function preparePublication(value) {
  const project = normalizeProject(value), knownSlugs = project.pages.map(page => page.slug);
  const rendered = project.pages.map(page => Object.freeze({ slug: page.slug, ...renderMarkdown(page.content, { knownSlugs, currentSlug: page.slug }) }));
  const anchors = new Map(rendered.map(page => [page.slug, new Set(page.headings.map(heading => heading.id))]));
  for (const page of rendered) {
    if (page.warnings.length) fail(`publication_markdown_warning:${page.slug}:${page.warnings[0]}`);
    for (const link of page.links) {
      if (link.external) continue;
      if (!anchors.has(link.slug)) fail(`publication_link_page_missing:${page.slug}`);
      if (link.fragment && !anchors.get(link.slug).has(link.fragment)) fail(`publication_link_heading_missing:${page.slug}:${link.slug}`);
    }
  }
  const summary = Object.freeze({
    schemaVersion: project.schemaVersion, name: project.name, pages: project.pages.length,
    headings: rendered.reduce((total, page) => total + page.headings.length, 0),
    contentBytes: project.pages.reduce((total, page) => total + encoder.encode(page.content).length, 0),
  });
  return Object.freeze({ project, rendered: Object.freeze(rendered), summary });
}

function templateFields(template) {
  if (typeof template !== 'string' || template.length > 512 * 1024) fail('publication_template_invalid');
  const spans = markerNames.map(name => {
    const start = `<!-- clero:${name}:start -->`, end = `<!-- clero:${name}:end -->`;
    if (template.split(start).length !== 2 || template.split(end).length !== 2) fail('publication_template_marker_invalid');
    const from = template.indexOf(start), until = template.indexOf(end);
    if (until < from + start.length) fail('publication_template_marker_invalid');
    return { name, from, until: until + end.length, contentFrom: from + start.length, contentUntil: until };
  }).sort((left, right) => left.from - right.from);
  for (let index = 1; index < spans.length; index++) if (spans[index - 1].until > spans[index].from) fail('publication_template_marker_overlap');
  if (template.split('__CLERO_BASE__').length !== 4 || template.split('data-clero-page=""').length !== 2) fail('publication_template_assets_invalid');
  return spans;
}

function fillTemplate(template, values, base, slug) {
  let html = template.split('__CLERO_BASE__').join(base).replace('data-clero-page=""', `data-clero-page="${escapeHtml(slug)}"`);
  const spans = markerNames.map(name => {
    const start = `<!-- clero:${name}:start -->`, end = `<!-- clero:${name}:end -->`;
    return { name, from: html.indexOf(start) + start.length, until: html.indexOf(end) };
  }).sort((left, right) => right.from - left.from);
  for (const span of spans) html = `${html.slice(0, span.from)}${values[span.name]}${html.slice(span.until)}`;
  for (const id of ['home-link', 'project-name', 'project-description', 'page-nav', 'document', 'page-group', 'page-title', 'page-description', 'document-content', 'render-warnings', 'page-neighbours', 'heading-nav']) {
    if (html.split(`id="${id}"`).length !== 2) fail('publication_template_semantic_ids_invalid');
  }
  return html;
}

function navigation(project, selected, base) {
  const groups = new Map();
  for (const page of project.pages) {
    if (!groups.has(page.group)) groups.set(page.group, []);
    groups.get(page.group).push(page);
  }
  return [...groups].map(([name, pages]) => `<section class="nav-group"><h2 class="nav-group-title">${escapeHtml(name)}</h2><ul>${pages.map(page => `<li><a class="page-link" href="${escapeHtml(base + pagePath(page.slug))}" data-page="${escapeHtml(page.slug)}"${page.slug === selected ? ' aria-current="page"' : ''}>${escapeHtml(page.title)}</a></li>`).join('')}</ul></section>`).join('');
}

function rewriteLinks(html, base, slugs) {
  return html.replace(/href="\?page=([^"#]+)(#[^"]*)?"/g, (_, encoded, fragment = '') => {
    let slug;
    try { slug = decodeURIComponent(encoded); } catch { fail('publication_renderer_link_invalid'); }
    if (!slugs.has(slug)) fail('publication_renderer_link_invalid');
    return `href="${escapeHtml(base + pagePath(slug))}${fragment}"`;
  });
}

function pageHead(project, page, canonical, notFound) {
  const title = `${notFound ? 'Page not found' : page.title} · ${project.name}`;
  const description = notFound ? 'Choose an available page from this documentation.' : page.description || project.description;
  return `<meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title>`
    + `<meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">`
    + (notFound ? '<meta name="robots" content="noindex, follow">' : canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}">` : '');
}

export function createStaticFiles(value, template, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('publication_options_invalid');
  for (const key of Reflect.ownKeys(options)) {
    const field = Object.getOwnPropertyDescriptor(options, key);
    if (key !== 'siteUrl' || !Object.hasOwn(field, 'value') || !field.enumerable) fail('publication_options_invalid');
  }
  const siteUrl = normalizeSiteUrl(Object.hasOwn(options, 'siteUrl') ? options.siteUrl : undefined);
  templateFields(template);
  const prepared = preparePublication(value), { project, summary } = prepared, slugs = new Set(project.pages.map(page => page.slug));
  const bySlug = new Map(prepared.rendered.map(page => [page.slug, page]));
  const render = (page, base, notFound = false) => {
    const rendered = page && bySlug.get(page.slug), canonical = siteUrl && page ? pageURL(page.slug, siteUrl) : null;
    const first = project.pages[0], index = page ? project.pages.indexOf(page) : -1;
    const article = notFound
      ? '<header class="document-header"><p id="page-group" class="eyebrow">PAGE NOT FOUND</p><h1 id="page-title">This page is not in the project.</h1><p id="page-description" class="document-description">Choose a page from the documentation navigation.</p></header><div id="document-content" class="prose" aria-busy="false"><p>The available pages are listed in the navigation.</p></div><div id="render-warnings" class="render-warnings" hidden></div>'
      : `<header class="document-header"><p id="page-group" class="eyebrow">${escapeHtml(page.group)}</p><h1 id="page-title">${escapeHtml(page.title)}</h1><p id="page-description" class="document-description"${page.description ? '' : ' hidden'}>${escapeHtml(page.description)}</p></header><div id="document-content" class="prose" aria-busy="false">${rewriteLinks(rendered.html, base, slugs)}</div><div id="render-warnings" class="render-warnings" hidden></div>`;
    const neighbours = notFound ? '' : [['Previous', project.pages[index - 1]], ['Next', project.pages[index + 1]]].map(([label, neighbour]) => neighbour ? `<a class="neighbour-link" href="${escapeHtml(base + pagePath(neighbour.slug))}"><span class="eyebrow">${label}</span><span class="neighbour-title">${escapeHtml(neighbour.title)}</span></a>` : '<span></span>').join('');
    return fillTemplate(template, {
      head: pageHead(project, page, canonical, notFound),
      brand: `<a id="home-link" class="brand" href="${escapeHtml(base + pagePath(first.slug))}" aria-label="Documentation home"><span class="brand-mark" aria-hidden="true">c.</span><span id="project-name">${escapeHtml(project.name)}</span></a>`,
      description: `<p id="project-description" class="project-description">${escapeHtml(project.description)}</p>`,
      navigation: navigation(project, page?.slug, base), article, neighbours,
      contents: notFound ? '' : rendered.headings.map(heading => `<a class="heading-link level-${heading.level}" href="#${encodeURIComponent(heading.id)}">${escapeHtml(heading.text)}</a>`).join(''),
    }, base, notFound ? 'not-found' : page.slug);
  };
  const files = [['index.html', render(project.pages[0], './')]];
  for (const page of project.pages) files.push([`${pagePath(page.slug)}index.html`, render(page, '../'.repeat(page.slug.split('/').length))]);
  files.push(['404.html', render(null, siteUrl ? new URL(siteUrl).pathname : '/', true)]);
  if (siteUrl) {
    const sitemap = new URL('sitemap.xml', siteUrl).href, notFound = new URL('404.html', siteUrl).pathname;
    files.push(['robots.txt', `User-agent: *\nAllow: /\nDisallow: ${notFound}\nSitemap: ${sitemap}\n`]);
    files.push(['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${project.pages.map(page => `<url><loc>${escapeHtml(pageURL(page.slug, siteUrl))}</loc></url>`).join('')}</urlset>\n`]);
  }
  const paths = new Set();
  for (const pair of files) {
    if (paths.has(pair[0]) || pair[0].startsWith('/') || pair[0].split('/').some(part => part === '.' || part === '..')) fail('publication_output_path_collision');
    paths.add(pair[0]); Object.freeze(pair);
  }
  return Object.freeze({ project, summary, files: Object.freeze(files) });
}
