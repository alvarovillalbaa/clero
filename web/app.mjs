import { normalizeProject, normalizeSlug, hrefForPage } from "./lib/model.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";

const $ = id => document.getElementById(id);
const MAX_FILE = 5 * 1024 * 1024;
const MAX_SAVED = 2 * 1024 * 1024;
const WORKSPACE_KEY = "clero.workspace.v1";
const THEME_KEY = "clero.theme.v1";
const encoder = new TextEncoder();
let project = null, published = null, selected = null, source = "published";
let appliedDirty = false, editorDirty = false, workspaceOpen = false, menuOpen = false;
let savedRaw = null, historyStep = Number.isSafeInteger(history.state?.cleroStep) && history.state.cleroStep >= 0 ? history.state.cleroStep : 0, restoringHistory = false;
let currentURL = location.href, searchReturnFocus = null, importSequence = 0;
let renderCache = new Map();
const downloads = new Set();

function node(tag, className = "", value = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value) element.textContent = value;
  return element;
}
function status(message) { $("workspace-status").textContent = message; }
function globalStatus(message) { $("global-status").textContent = message; $("global-status").hidden = !message; }
function error(message) {
  $("workspace-error").textContent = message;
  $("workspace-error").hidden = !message;
  if (message && workspaceOpen) $("workspace-error").focus();
}
function explain(failure, prefix) {
  if (typeof failure?.message === "string" && /^markdown_[a-z0-9_]+$/.test(failure.message)) return `${prefix}: a Markdown page exceeds the supported rendering limits. Your current input has been kept.`;
  const code = typeof failure?.message === "string" && /^project_[a-z0-9_]+$/.test(failure.message) ? failure.message.replace(/^project_/, "").replaceAll("_", " ") : "check the JSON, page identities and supported project version";
  return `${prefix}: ${code}. Your current input has been kept.`;
}
function pageBySlug(slug) { return project?.pages.find(page => page.slug === slug); }
function currentPage() { return pageBySlug(selected); }
function prepareRendering(value) {
  const cache = new Map(), knownSlugs = value.pages.map(page => page.slug);
  for (const page of value.pages) cache.set(page.slug, renderMarkdown(page.content, { knownSlugs, currentSlug: page.slug }));
  return cache;
}
function rendered(page) {
  if (!renderCache.has(page.slug)) renderCache.set(page.slug, renderMarkdown(page.content, { knownSlugs: project.pages.map(item => item.slug), currentSlug: page.slug }));
  return renderCache.get(page.slug);
}
function projectURL(slug, hash = "") { return `${hrefForPage(slug)}${hash ? `#${encodeURIComponent(hash)}` : ""}`; }
function requestedPage() {
  const value = new URL(location.href).searchParams.get("page");
  if (value === null) return project.pages[0].slug;
  try { return normalizeSlug(value); } catch { return null; }
}
function writeURL(slug, hash = "", replace = false) {
  if (!replace) historyStep += 1;
  history[replace ? "replaceState" : "pushState"]({ cleroStep: historyStep }, "", projectURL(slug, hash));
  currentURL = location.href;
}
function confirmUnapplied() {
  return !editorDirty || window.confirm("Discard unapplied editor changes and continue? Use Apply to preview first to keep them in your working copy.");
}
function confirmWorkingCopy() {
  return (!editorDirty && !appliedDirty) || window.confirm("Replace this working copy? Unapplied and unsaved changes in this tab will be discarded. Export or save them first to keep a copy.");
}

function activate(value, kind, dirty, preferred = null, updateURL = true) {
  const prepared = prepareRendering(value);
  project = value; source = kind; appliedDirty = dirty; editorDirty = false;
  renderCache = prepared;
  selected = preferred && pageBySlug(preferred) ? preferred : project.pages[0].slug;
  if (updateURL) writeURL(selected, "", true);
  renderAll(); fillEditor(); error("");
}
function renderAll() {
  if (!project) return;
  $("project-name").textContent = project.name;
  $("project-description").textContent = project.description;
  document.documentElement.style.setProperty("--project-accent", project.accent);
  $("home-link").href = hrefForPage(project.pages[0].slug);
  renderNavigation(); renderReader(); renderWorkspacePages(); updateWorkspaceState();
}
function renderNavigation() {
  const navigation = $("page-nav"), groups = new Map();
  navigation.replaceChildren();
  for (const page of project.pages) {
    const name = page.group || "Pages";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(page);
  }
  for (const [name, pages] of groups) {
    const section = node("section", "nav-group"), heading = node("h2", "nav-group-title", name), list = node("ul");
    for (const page of pages) {
      const item = node("li"), link = node("a", "page-link", page.title);
      link.href = hrefForPage(page.slug); link.dataset.page = page.slug;
      if (page.slug === selected) link.setAttribute("aria-current", "page");
      item.append(link); list.append(item);
    }
    section.append(heading, list); navigation.append(section);
  }
}
function showWarnings(target, warnings) {
  target.replaceChildren(); target.hidden = warnings.length === 0;
  if (warnings.length) {
    target.append(node("p", "", "Review these Markdown notes before publishing:"));
    const list = node("ul");
    for (const warning of warnings) list.append(node("li", "", warning));
    target.append(list);
  }
}
function renderReader() {
  const page = currentPage(), content = $("document-content"), contents = $("heading-nav"), neighbours = $("page-neighbours");
  content.replaceChildren(); contents.replaceChildren(); neighbours.replaceChildren();
  content.setAttribute("aria-busy", "false");
  $("render-warnings").hidden = true;
  if (!page) {
    $("page-title").textContent = "This page isn't in the project.";
    $("page-description").textContent = "Choose a page from the contents, or search this documentation.";
    $("page-description").hidden = false;
    $("page-group").textContent = "PAGE NOT FOUND";
    document.title = `Page not found · ${project.name}`; return;
  }
  const result = rendered(page);
  $("page-title").textContent = page.title; $("page-description").textContent = page.description;
  $("page-description").hidden = !page.description;
  $("page-group").textContent = page.group || "DOCUMENTATION";
  document.title = `${page.title} · ${project.name}`;
  // Keep only one rendered Markdown body in the DOM, so preview and reader IDs never duplicate.
  if (!workspaceOpen) content.innerHTML = result.html;
  for (const heading of result.headings) {
    const link = node("a", `heading-link level-${heading.level}`, heading.text);
    link.href = projectURL(page.slug, heading.id); contents.append(link);
  }
  if (!result.headings.length) contents.append(node("p", "subtle", "A short page, all in one place."));
  showWarnings($("render-warnings"), result.warnings);
  const index = project.pages.findIndex(item => item.slug === selected);
  for (const [direction, neighbour] of [["Previous", project.pages[index - 1]], ["Next", project.pages[index + 1]]]) {
    if (!neighbour) { neighbours.append(node("span")); continue; }
    const link = node("a", "neighbour-link"); link.href = hrefForPage(neighbour.slug);
    link.append(node("span", "eyebrow", direction), node("span", "neighbour-title", neighbour.title)); neighbours.append(link);
  }
}
function scrollToHeading(hash, focus = false) {
  let id = ""; try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch {}
  const heading = id && [...$("document-content").querySelectorAll("[id]")].find(item => item.id === id);
  if (heading) { heading.scrollIntoView({ block: "start" }); if (focus) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
  else { if (focus) $("main").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "auto" }); }
}
function navigate(slug, hash = "", push = true) {
  if (!project || !pageBySlug(slug)) return;
  if (slug !== selected && !confirmUnapplied()) return;
  const changed = slug !== selected;
  selected = slug;
  if (changed) { editorDirty = false; renderAll(); fillEditor(); }
  if (push) writeURL(slug, hash);
  setMenu(false);
  if (workspaceOpen) setWorkspace(false);
  requestAnimationFrame(() => scrollToHeading(hash, true));
}

function setMenu(open) {
  menuOpen = open; document.body.classList.toggle("menu-open", open);
  $("nav-toggle").setAttribute("aria-expanded", String(open));
}
function setWorkspace(open) {
  if (open && project && !currentPage()) { selected = project.pages[0].slug; writeURL(selected, "", true); renderAll(); fillEditor(); }
  workspaceOpen = open;
  $("workspace-view").hidden = !open; $("reader-view").hidden = open;
  $("workspace-toggle").setAttribute("aria-expanded", String(open));
  $("nav-toggle").hidden = open; setMenu(false);
  if (project) { renderReader(); renderPreview(); updateWorkspaceState(); }
  if (open) $("workspace-title").focus();
  else { $("workspace-toggle").focus(); requestAnimationFrame(() => scrollToHeading(location.hash)); }
}
function renderWorkspacePages() {
  const list = $("workspace-page-nav"); list.replaceChildren();
  for (const page of project.pages) {
    const button = node("button", "workspace-page", page.title); button.type = "button";
    button.dataset.workspacePage = page.slug; button.setAttribute("aria-pressed", String(page.slug === selected)); list.append(button);
  }
}
function fillEditor() {
  const page = currentPage(); if (!page) return;
  for (const [id, value] of [["edit-project-name", project.name], ["edit-project-description", project.description], ["edit-accent", project.accent], ["edit-title", page.title], ["edit-slug", page.slug], ["edit-group", page.group], ["edit-description", page.description], ["edit-content", page.content]]) $(id).value = value;
  editorDirty = false; renderWorkspacePages(); renderPreview(); updateWorkspaceState();
}
function renderPreview() {
  $("editor-preview").replaceChildren();
  const page = currentPage(); if (!page || !workspaceOpen) return;
  const result = rendered(page);
  $("preview-title").textContent = page.title; $("preview-description").textContent = page.description;
  $("editor-preview").innerHTML = result.html;
  showWarnings($("preview-warnings"), result.warnings);
}
function updateWorkspaceState() {
  const ready = Boolean(project);
  $("workspace-columns").hidden = !ready;
  $("export-project").disabled = !ready || editorDirty;
  $("save-device").disabled = !ready || editorDirty;
  $("discard-workspace").disabled = !published && savedRaw === null && !project;
  $("delete-page").disabled = !ready || project.pages.length < 2;
  $("edit-state").textContent = editorDirty ? "Unapplied edits. Apply the preview before saving or exporting." : appliedDirty ? "Applied in this tab; not yet saved on this device." : "No unapplied edits.";
  $("reset-page").disabled = !editorDirty;
  const onDevice = source === "device" && !appliedDirty;
  $("workspace-source").textContent = !ready ? "Import a project JSON file to begin. Your file stays on this device." : onDevice ? "On this device · restored from your explicitly saved workspace." : source === "published" && !appliedDirty ? "Published documentation · edits will create a private working copy in this tab." : "Working copy in this tab · save on this device or export JSON to keep it.";
  $("device-banner").hidden = !ready || (source === "published" && !appliedDirty);
  $("device-banner-text").textContent = onDevice ? "On this device: you're reading your saved workspace." : "Private working copy: changes have not been published.";
}
function applyEditor() {
  if (!project || !currentPage()) return false;
  try {
    const slug = normalizeSlug($("edit-slug").value);
    const next = normalizeProject({ ...project, name: $("edit-project-name").value, description: $("edit-project-description").value, accent: $("edit-accent").value,
      pages: project.pages.map(page => page.slug === selected ? { ...page, slug, title: $("edit-title").value, description: $("edit-description").value, group: $("edit-group").value, content: $("edit-content").value } : page) });
    activate(next, "edited", true, slug); status("Preview applied. Your original Markdown is kept; save or export this working copy to retain it."); return true;
  } catch (failure) { error(explain(failure, "The preview could not be applied")); return false; }
}

function restoreSaved() {
  try {
    savedRaw = localStorage.getItem(WORKSPACE_KEY);
    if (savedRaw === null) return;
    if (savedRaw.length > MAX_SAVED || encoder.encode(savedRaw).length > MAX_SAVED) throw new Error("saved_workspace_size");
    const saved = JSON.parse(savedRaw);
    if (saved.schemaVersion !== "clero.device.v1" || typeof saved.savedAt !== "string") throw new Error("saved_workspace_version");
    const restored = normalizeProject(saved.project);
    const prepared = prepareRendering(restored);
    project = restored; source = "device"; appliedDirty = false; selected = requestedPage();
    renderCache = prepared; renderAll(); fillEditor(); requestAnimationFrame(() => scrollToHeading(location.hash));
    status("Restored the saved workspace from this device. It has not been published.");
  } catch {
    globalStatus("The saved workspace could not be restored. Published docs will still open. Import an export, or explicitly discard the saved copy in Workspace.");
    updateWorkspaceState();
  }
}
function saveWorkspace() {
  if (!project || editorDirty) return;
  try {
    const current = localStorage.getItem(WORKSPACE_KEY);
    if (current !== savedRaw) { error("Another tab changed the saved workspace. Export this working copy, then reload before replacing that saved copy."); return; }
    const serialized = JSON.stringify({ schemaVersion: "clero.device.v1", savedAt: new Date().toISOString(), project });
    if (encoder.encode(serialized).length > MAX_SAVED) { error("This workspace is larger than the 2 MiB on-device storage limit. Export its JSON file to keep the full project instead."); return; }
    if (current && !window.confirm("Replace Clero's saved workspace on this device with this working copy? Other browser data will not be changed.")) return;
    localStorage.setItem(WORKSPACE_KEY, serialized);
    if (localStorage.getItem(WORKSPACE_KEY) !== serialized) throw new Error("storage_readback_failed");
    savedRaw = serialized; source = "device"; appliedDirty = false;
    error(""); status("Saved on this device and read back successfully. This does not publish or upload the workspace."); updateWorkspaceState();
  } catch { error("The on-device save could not be confirmed. Your working copy is still open. Export JSON to keep it, or retry after checking browser storage."); }
}
function discardWorkspace() {
  const message = published ? "Discard the local working copy and remove Clero's saved workspace on this device? The published documentation and all other browser data will be kept." : "Remove Clero's saved workspace on this device? Published docs are unavailable, so this tab's current working copy and unapplied edits will be retained for export.";
  if (!window.confirm(message)) return;
  try {
    if (localStorage.getItem(WORKSPACE_KEY) !== savedRaw) { error("Another tab changed the saved workspace. Export this working copy and reload before discarding the saved copy."); return; }
    localStorage.removeItem(WORKSPACE_KEY);
    if (localStorage.getItem(WORKSPACE_KEY) !== null) throw new Error("storage_clear_failed");
    savedRaw = null;
    if (published) { activate(published, "published", false); status("Local workspace discarded. You are reading the published project again."); globalStatus(""); }
    else {
      if (project) { source = "edited"; appliedDirty = true; }
      updateWorkspaceState(); status(project ? "The saved on-device copy was removed. This tab's working copy and unapplied edits were retained; apply and export them to keep a file." : "The saved on-device copy was removed. Import a project JSON file to begin.");
      globalStatus("Published docs are unavailable. No saved on-device workspace remains.");
    }
  } catch { error("The saved copy could not be removed. Your working copy has been retained; no confirmed discard is claimed."); }
}
function exportWorkspace() {
  if (!project || editorDirty) return;
  const serialized = JSON.stringify(project, null, 2) + "\n";
  const url = URL.createObjectURL(new Blob([serialized], { type: "application/json;charset=utf-8" })); downloads.add(url);
  const anchor = node("a"); anchor.href = url;
  anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "clero"}-workspace.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(url); }, 60_000);
  status("Workspace JSON download requested, including the original Markdown. A download does not save or publish this tab's working copy.");
}
async function importWorkspace(file) {
  if (!file) return;
  const sequence = ++importSequence;
  try {
    if (file.size > MAX_FILE) { error("Choose a project JSON file of at most 5 MiB. The current workspace has not changed."); return; }
    const bytes = await file.arrayBuffer(); if (sequence !== importSequence) return;
    if (bytes.byteLength > MAX_FILE) throw new Error("project_file_size");
    const next = normalizeProject(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!confirmWorkingCopy()) return;
    activate(next, "imported", true, selected); status("Project imported into this tab. Nothing was uploaded. Review it, then save on this device or export a JSON copy.");
  } catch (failure) { if (sequence === importSequence) error(explain(failure, "The project could not be imported")); }
  finally { if (sequence === importSequence) $("project-file").value = ""; }
}

function openSearch() {
  if (!project) { globalStatus("Import a project or wait for the published documentation before searching."); return; }
  searchReturnFocus = document.activeElement;
  if (!$("search-dialog").open) $("search-dialog").showModal();
  $("search-input").value = ""; renderSearch(); $("search-input").focus();
}
function closeSearch(restoreFocus = true) {
  $("search-dialog").close();
  if (restoreFocus && searchReturnFocus?.isConnected) searchReturnFocus.focus();
}
function renderSearch() {
  const query = $("search-input").value.trim().toLowerCase(), list = $("search-results"); list.replaceChildren();
  if (!query) { $("search-status").textContent = "Type to search this project."; return; }
  const terms = query.split(/\s+/).slice(0, 20), matches = [];
  for (const page of project.pages) {
    const plain = rendered(page).plainText, combined = `${page.title}\n${page.description}\n${page.group}\n${plain}`.toLowerCase();
    if (terms.every(term => combined.includes(term))) matches.push({ page, plain, score: page.title.toLowerCase().includes(query) ? 2 : page.description.toLowerCase().includes(query) ? 1 : 0 });
  }
  matches.sort((a, b) => b.score - a.score);
  $("search-status").textContent = matches.length ? `${matches.length} matching ${matches.length === 1 ? "page" : "pages"}${matches.length > 30 ? "; showing the first 30" : ""}.` : "No matching pages. Try a different word.";
  for (const { page, plain } of matches.slice(0, 30)) {
    const item = node("li"), link = node("a", "search-result"); link.href = hrefForPage(page.slug);
    const first = Math.max(0, plain.toLowerCase().indexOf(terms[0]) - 40);
    link.append(node("span", "eyebrow", page.group || "Page"), node("strong", "", page.title), node("span", "result-excerpt", page.description || plain.slice(first, first + 180)));
    item.append(link); list.append(item);
  }
}
async function copyCode(button) {
  const code = button.closest(".code-block")?.querySelector("pre > code"); if (!code) return;
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(code.textContent);
    if (button.isConnected) { button.textContent = "Copied"; button.setAttribute("aria-label", "Code copied"); }
  } catch {
    if (!button.isConnected) return;
    const container = button.closest(".code-block");
    container.querySelector(".copy-fallback")?.remove();
    const fallback = node("div", "copy-fallback"), label = node("label", "", "Automatic copy is unavailable. Select and copy this code:");
    const field = node("textarea"); field.readOnly = true; field.value = code.textContent; field.rows = Math.min(8, code.textContent.split("\n").length + 1); label.append(field); fallback.append(label); container.append(fallback); field.focus(); field.select();
    button.textContent = "Copy code";
  } finally {
    if (button.isConnected) button.disabled = false;
    setTimeout(() => { if (button.isConnected) { button.textContent = "Copy code"; button.setAttribute("aria-label", "Copy code"); } }, 2_000);
  }
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("theme-toggle").setAttribute("aria-label", theme === "dark" ? "Use light theme" : "Use dark theme");
}
function restoreTheme() {
  try { const saved = localStorage.getItem(THEME_KEY); applyTheme(saved === "dark" || saved === "light" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
  catch { applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
}
async function loadPublished() {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL("./project.json", import.meta.url);
    if (url.origin !== location.origin) throw new Error("project_origin");
    const response = await fetch(url, { signal: controller.signal, redirect: "error", credentials: "same-origin", cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("project_unavailable");
    const declared = response.headers.get("content-length");
    if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_FILE) throw new Error("project_file_size");
    const reader = response.body.getReader(), chunks = []; let total = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_FILE) { await reader.cancel(); throw new Error("project_file_size"); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const loaded = normalizeProject(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))), prepared = prepareRendering(loaded);
    published = loaded;
    if (!project) {
      project = published; renderCache = prepared; selected = requestedPage();
      if (!new URL(location.href).searchParams.has("page")) writeURL(project.pages[0].slug, "", true);
      renderAll(); fillEditor(); requestAnimationFrame(() => scrollToHeading(location.hash));
    }
    updateWorkspaceState();
  } catch {
    globalStatus(project ? "The published project could not be loaded. Your local working copy remains available." : "The published project could not be opened. Use Workspace to import a local project JSON file.");
    if (!project) { $("page-title").textContent = "Bring your own words."; $("page-description").textContent = "Import a project JSON file in Workspace to begin locally."; $("document-content").replaceChildren(); $("document-content").setAttribute("aria-busy", "false"); $("page-nav").replaceChildren(node("p", "subtle", "No published project is available.")); }
  } finally { clearTimeout(timer); controller.abort(); }
}

$("workspace-toggle").addEventListener("click", () => setWorkspace(!workspaceOpen));
$("device-workspace").addEventListener("click", () => setWorkspace(true));
$("close-workspace").addEventListener("click", () => setWorkspace(false));
$("nav-toggle").addEventListener("click", () => setMenu(!menuOpen));
$("open-search").addEventListener("click", openSearch);
$("close-search").addEventListener("click", () => closeSearch());
$("search-dialog").addEventListener("cancel", event => { event.preventDefault(); closeSearch(); });
$("search-input").addEventListener("input", renderSearch);
$("editor-form").addEventListener("input", () => { editorDirty = true; error(""); updateWorkspaceState(); });
$("editor-form").addEventListener("submit", event => { event.preventDefault(); applyEditor(); });
$("reset-page").addEventListener("click", () => { if (confirmUnapplied()) { fillEditor(); error(""); status("Unapplied edits discarded. Your last applied working copy is unchanged."); } });
$("project-file").addEventListener("change", event => void importWorkspace(event.target.files?.[0]));
$("export-project").addEventListener("click", exportWorkspace);
$("save-device").addEventListener("click", saveWorkspace);
$("discard-workspace").addEventListener("click", discardWorkspace);
$("add-page").addEventListener("click", () => {
  if (!project || !confirmUnapplied()) return;
  try {
    let number = 1, slug = "new-page"; while (pageBySlug(slug)) slug = `new-page-${++number}`;
    const next = normalizeProject({ ...project, pages: [...project.pages, { slug, title: "A new page", description: "", group: currentPage()?.group || "Documentation", content: "Write your first paragraph here.\n" }] });
    activate(next, "edited", true, slug); status("Page added to this working copy. Apply edits, then save or export to retain it."); $("edit-title").focus();
  } catch (failure) { error(explain(failure, "A page could not be added")); }
});
$("delete-page").addEventListener("click", () => {
  if (!project || project.pages.length < 2 || !currentPage() || !window.confirm(`Delete “${currentPage().title}” from this working copy, including any unapplied edits? The published project and your previous export are unchanged.`)) return;
  try { const next = normalizeProject({ ...project, pages: project.pages.filter(page => page.slug !== selected) }); activate(next, "edited", true); status("Page removed from this working copy. Check links to the old page before publishing."); }
  catch (failure) { error(explain(failure, "The page could not be removed")); }
});
$("theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); if (localStorage.getItem(THEME_KEY) !== theme) throw new Error("theme_readback"); }
  catch { globalStatus("The theme changed for this visit. This browser could not save the theme preference."); }
});
document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target : null;
  const copy = target?.closest("button[data-code-index]"); if (copy) { void copyCode(copy); return; }
  const pageButton = target?.closest("button[data-workspace-page]");
  if (pageButton) { if (pageButton.dataset.workspacePage !== selected && confirmUnapplied()) { selected = pageButton.dataset.workspacePage; writeURL(selected); editorDirty = false; renderAll(); fillEditor(); error(""); } return; }
  const link = target?.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || (!url.searchParams.has("page") && !url.hash)) return;
  const slug = url.searchParams.get("page") || selected; if (!pageBySlug(slug)) return;
  event.preventDefault(); if ($("search-dialog").open) closeSearch(false);
  let hash = ""; try { hash = decodeURIComponent(url.hash.slice(1)); } catch {}
  navigate(slug, hash);
});
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if ($("search-dialog").open) closeSearch(); else openSearch(); }
  if (event.key === "Escape" && menuOpen) { setMenu(false); $("nav-toggle").focus(); }
});
window.addEventListener("popstate", event => {
  if (!project) return;
  if (restoringHistory) { restoringHistory = false; return; }
  const requested = requestedPage(), targetStep = event.state?.cleroStep, changed = requested !== selected;
  if (changed && !confirmUnapplied()) {
    if (Number.isSafeInteger(targetStep) && targetStep >= 0 && targetStep !== historyStep) { restoringHistory = true; history.go(historyStep - targetStep); }
    else history.replaceState({ cleroStep: historyStep }, "", currentURL);
    return;
  }
  if (Number.isSafeInteger(targetStep) && targetStep >= 0) historyStep = targetStep;
  currentURL = location.href; selected = requested; if (changed) editorDirty = false; renderAll();
  if (workspaceOpen && !currentPage()) setWorkspace(false);
  else if (workspaceOpen && changed) fillEditor();
  else if (!workspaceOpen) requestAnimationFrame(() => scrollToHeading(location.hash));
});
window.addEventListener("beforeunload", event => { if (editorDirty || appliedDirty) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("storage", event => { if (event.key === WORKSPACE_KEY && event.newValue !== savedRaw) globalStatus("The saved workspace changed in another tab. This tab's working copy was kept; export it before reloading."); });
window.addEventListener("pagehide", () => { for (const url of downloads) URL.revokeObjectURL(url); downloads.clear(); });

history.replaceState({ cleroStep: historyStep }, "", location.href);
restoreTheme(); restoreSaved(); void loadPublished();
