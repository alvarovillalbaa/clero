import { hrefForPage, normalizeSlug, validateMarkdownContent } from './model.mjs';

export function escapeHtml(text) {
  if (typeof text !== 'string') throw new TypeError('markdown_text_required');
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function renderMarkdown(content, options = {}) {
  validateMarkdownContent(content);
  if (!options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) throw new TypeError('markdown_options_invalid');
  for (const key of Reflect.ownKeys(options)) {
    const field = Object.getOwnPropertyDescriptor(options, key);
    if (!['knownSlugs', 'currentSlug'].includes(key) || !Object.hasOwn(field, 'value') || !field.enumerable) throw new TypeError('markdown_options_invalid');
  }
  const known = Object.hasOwn(options, 'knownSlugs') ? options.knownSlugs : [], current = Object.hasOwn(options, 'currentSlug') ? options.currentSlug : '';
  if (!Array.isArray(known) || Object.getPrototypeOf(known) !== Array.prototype || known.length > 200) throw new TypeError('markdown_options_invalid');
  for (const key of Reflect.ownKeys(known)) if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= known.length)) throw new TypeError('markdown_options_invalid');
  const knownSlugs = new Set();
  for (let index = 0; index < known.length; index++) {
    const field = Object.getOwnPropertyDescriptor(known, String(index));
    if (!field || !Object.hasOwn(field, 'value') || !field.enumerable) throw new TypeError('markdown_options_invalid');
    knownSlugs.add(normalizeSlug(field.value));
  }
  if (current !== '') normalizeSlug(current);
  const headings = [], warnings = [], plain = [], links = [], anchors = new Set(), nextAnchor = new Map(); let codeIndex = 0;
  const warn = message => { if (warnings.length < 20 && !warnings.includes(message)) warnings.push(message); };
  const fragment = value => {
    const decoded = decodeURIComponent(value);
    if (/[\u0000-\u0020\u007f]/u.test(decoded)) throw new Error();
    return decoded ? decoded.startsWith('clero-h-') ? decoded : `clero-h-${decoded}` : null;
  };
  const resolved = (target, metadata) => { links.push(Object.freeze(metadata)); return target; };
  function link(destination) {
    try {
      if (!destination || destination.length > 2048 || /[\s<>\\]/u.test(destination) || /%(?![0-9a-f]{2})/i.test(destination)) throw new Error();
      if (/^(?:https?|mailto):/i.test(destination)) {
        const url = new URL(destination);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || (url.protocol === 'mailto:' && !url.pathname)) throw new Error();
        return resolved({ href: url.href, newWindow: url.protocol !== 'mailto:' }, { slug: null, fragment: null, external: true });
      }
      if (destination.startsWith('#')) {
        const anchor = fragment(destination.slice(1));
        return resolved({ href: anchor ? `#${encodeURIComponent(anchor)}` : '#' }, { slug: current || null, fragment: anchor, external: false });
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(destination) || destination.startsWith('/') || destination.includes('?')) throw new Error();
      const hash = destination.indexOf('#'), page = hash < 0 ? destination : destination.slice(0, hash);
      const anchor = hash < 0 ? null : fragment(destination.slice(hash + 1));
      const decoded = decodeURIComponent(page).replace(/\.md$/, '');
      const parts = current ? current.split('/').slice(0, -1) : [];
      for (const segment of decoded.split('/')) {
        if (segment === '.') continue;
        if (segment === '..') { if (!parts.length) throw new Error(); parts.pop(); }
        else { if (!segment) throw new Error(); parts.push(segment); }
      }
      const slug = normalizeSlug(parts.join('/'));
      if (!knownSlugs.has(slug)) { warn(`Missing internal page: ${slug.slice(0, 160)}`); return null; }
      return resolved({ href: `${hrefForPage(slug)}${anchor ? `#${encodeURIComponent(anchor)}` : ''}` }, { slug, fragment: anchor, external: false });
    } catch { warn('A link has an unsafe or malformed URL.'); return null; }
  }

  function inline(text, depth = 0) {
    if (depth > 4) return { html: escapeHtml(text), text };
    const html = [], plainText = []; let index = 0, noMoreLinks = false;
    while (index < text.length) {
      const character = text[index];
      if (character === '\\' && index + 1 < text.length && /[\\`*_\[\]()!#>|]/.test(text[index + 1])) {
        html.push(escapeHtml(text[index + 1])); plainText.push(text[index + 1]); index += 2; continue;
      }
      if (character === '`') {
        const end = text.indexOf('`', index + 1);
        if (end > index + 1) { const code = text.slice(index + 1, end); html.push(`<code>${escapeHtml(code)}</code>`); plainText.push(code); index = end + 1; continue; }
      }
      const marker = text.startsWith('**', index) || text.startsWith('__', index) ? text.slice(index, index + 2) : character === '*' || character === '_' ? character : '';
      if (marker) {
        const end = text.indexOf(marker, index + marker.length);
        if (end > index + marker.length) { const body = inline(text.slice(index + marker.length, end), depth + 1), tag = marker.length === 2 ? 'strong' : 'em'; html.push(`<${tag}>${body.html}</${tag}>`); plainText.push(body.text); index = end + marker.length; continue; }
      }
      const image = character === '!' && text[index + 1] === '[';
      if (!noMoreLinks && (character === '[' || image)) {
        const start = index + (image ? 2 : 1), labelEnd = text.indexOf('](', start);
        if (labelEnd < 0) noMoreLinks = true;
        else {
          const end = text.indexOf(')', labelEnd + 2);
          if (end >= 0) {
            const rawLabel = text.slice(start, labelEnd), destination = text.slice(labelEnd + 2, end);
            const label = rawLabel.length <= 1024 ? inline(rawLabel, depth + 1) : { html: escapeHtml(rawLabel), text: rawLabel };
            const target = image ? null : link(destination);
            if (image) warn('Images are not rendered.');
            html.push(target ? `<a href="${escapeHtml(target.href)}"${target.newWindow ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label.html}</a>` : label.html);
            plainText.push(label.text); index = end + 1; continue;
          }
          noMoreLinks = true;
        }
      }
      html.push(escapeHtml(character)); plainText.push(character); index++;
    }
    return { html: html.join(''), text: plainText.join('') };
  }

  function headingId(text) {
    if (headings.length >= 2048) throw new RangeError('markdown_heading_budget');
    const stem = `clero-h-${[...text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')].slice(0, 120).join('') || 'section'}`;
    let number = nextAnchor.get(stem) ?? 1, id = number === 1 ? stem : `${stem}-${number}`;
    while (anchors.has(id)) { number = Math.max(number + 1, 2); id = `${stem}-${number}`; }
    nextAnchor.set(stem, number + 1); anchors.add(id); return id;
  }
  const fence = line => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  const heading = line => /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
  const listItem = line => /^ {0,3}(?:([-+*])|(\d{1,9})[.)])\s+(.+)$/.exec(line);
  const rule = line => /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
  const cells = line => { let text = line.trim(); if (text.startsWith('|')) text = text.slice(1); if (text.endsWith('|')) text = text.slice(0, -1); return text.split('|').map(cell => cell.trim()); };
  const table = (lines, index) => lines[index]?.includes('|') && cells(lines[index + 1] ?? '').length >= 2 && cells(lines[index + 1] ?? '').every(cell => /^:?-{3,}:?$/.test(cell));
  const blockStart = (lines, index) => fence(lines[index]) || heading(lines[index]) || listItem(lines[index]) || /^ {0,3}>/.test(lines[index]) || rule(lines[index]) || table(lines, index);

  function blocks(lines, depth = 0) {
    if (depth > 4) { const text = lines.join('\n'); plain.push(text); return `<p>${escapeHtml(text)}</p>`; }
    const html = []; let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index++; continue; }
      const opened = fence(line);
      if (opened) {
        const source = []; let closed = false; index++;
        while (index < lines.length) {
          const next = fence(lines[index]);
          if (next && next[1][0] === opened[1][0] && next[1].length >= opened[1].length && !next[2].trim()) { closed = true; index++; break; }
          source.push(lines[index++]);
        }
        if (!closed) warn('A code fence is not closed.');
        const language = opened[2].trim().slice(0, 64), code = source.join('\n');
        const className = /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(language) ? ` class="language-${escapeHtml(language)}"` : '';
        html.push(`<div class="code-block">${language ? `<span class="code-language">${escapeHtml(language)}</span>` : ''}<button type="button" data-code-index="${codeIndex++}" aria-label="Copy code">Copy code</button><pre><code${className}>${escapeHtml(code)}</code></pre></div>`);
        plain.push(code); continue;
      }
      const title = heading(line);
      if (title) {
        const rendered = inline(title[2].replace(/\s+#+\s*$/, '')), level = title[1].length, id = headingId(rendered.text);
        headings.push(Object.freeze({ id, text: rendered.text, level }));
        html.push(`<h${level} id="${escapeHtml(id)}">${rendered.html}</h${level}>`); plain.push(rendered.text); index++; continue;
      }
      if (rule(line)) { html.push('<hr>'); index++; continue; }
      if (/^ {0,3}>/.test(line)) {
        const quoted = []; while (index < lines.length && /^ {0,3}>/.test(lines[index])) quoted.push(lines[index++].replace(/^ {0,3}> ?/, ''));
        html.push(`<blockquote>${blocks(quoted, depth + 1)}</blockquote>`); continue;
      }
      const item = listItem(line);
      if (item) {
        const ordered = Boolean(item[2]), tag = ordered ? 'ol' : 'ul', items = [];
        while (index < lines.length) {
          const next = listItem(lines[index]); if (!next || Boolean(next[2]) !== ordered) break;
          const rendered = inline(next[3]); items.push(`<li>${rendered.html}</li>`); plain.push(rendered.text); index++;
        }
        html.push(`<${tag}${ordered && Number(item[2]) !== 1 ? ` start="${Number(item[2])}"` : ''}>${items.join('')}</${tag}>`); continue;
      }
      if (table(lines, index)) {
        const header = cells(line);
        if (header.length <= 32 && header.length === cells(lines[index + 1]).length) {
          const row = (values, tag) => `<tr>${values.map(value => { const rendered = inline(value); plain.push(rendered.text); return `<${tag}>${rendered.html}</${tag}>`; }).join('')}</tr>`;
          const headerHtml = row(header, 'th'), rows = []; index += 2;
          while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
            const values = cells(lines[index++]); if (values.length !== header.length) warn('A table row has a different number of cells.');
            rows.push(row(header.map((_, position) => values[position] ?? ''), 'td'));
          }
          html.push(`<div class="table-scroll"><table><thead>${headerHtml}</thead><tbody>${rows.join('')}</tbody></table></div>`); continue;
        }
      }
      const paragraph = [line]; index++;
      while (index < lines.length && lines[index].trim() && !blockStart(lines, index)) paragraph.push(lines[index++]);
      const rendered = inline(paragraph.join(' ')); html.push(`<p>${rendered.html}</p>`); plain.push(rendered.text);
    }
    return html.join('\n');
  }

  const html = blocks(content.replace(/\r\n?/g, '\n').split('\n'));
  return Object.freeze({ html, headings: Object.freeze(headings), plainText: plain.join('\n'), warnings: Object.freeze(warnings), links: Object.freeze(links) });
}
