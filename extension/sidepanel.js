import {
  loadProjects,
  saveProjects,
  newId,
  isSiftable,
  tabFromChrome,
  suggestName,
  groupByDomain,
  planGroups,
  defaultPick,
  formatAgo,
  domainOf,
  loadSettings,
  saveSettings,
  mergeTabs,
} from './lib/store.js';

const $ = (id) => document.getElementById(id);

let projects = [];
let settings = { groupByDomain: false, theme: 'light' };
let candidate = null; // chrome tabs offered by the save form's picker
let pickedIds = new Set(); // which of them are checked
let selectionCount = 0; // how many tabs are multi-selected in this window (0 = none)
let confirmDeleteId = null;
let addingToId = null; // project id currently showing the "add tabs" picker
let addCandidate = null; // chrome tabs offered to the add picker
let addPicked = new Set();
const expanded = new Set(); // ephemeral UI state, fine to lose on panel reload

// apply the default theme synchronously so the panel never flashes the wrong one
document.documentElement.dataset.theme = settings.theme;

init();

async function init() {
  projects = await loadProjects();
  settings = await loadSettings();
  // stamped so you can always tell which build the panel is running
  const version = chrome.runtime.getManifest().version;
  $('version').textContent = `v${version}`;
  console.log(`Tabrary v${version} — ${location.href}`);
  applyTheme();
  $('group-toggle').checked = settings.groupByDomain;
  $('group-toggle').addEventListener('change', onGroupToggle);

  $('save-btn').addEventListener('click', beginSave);
  $('save-cancel').addEventListener('click', cancelSave);
  $('save-keep').addEventListener('click', () => commitSave(false));
  $('save-close').addEventListener('click', () => commitSave(true));
  $('theme').addEventListener('click', toggleTheme);
  $('close').addEventListener('click', () => window.close());
  $('search').addEventListener('input', renderProjects);
  $('export').addEventListener('click', exportAll);
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importAll);
  $('projects').addEventListener('click', onProjectClick);
  $('project-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitSave(true); // primary action = save + close
    if (e.key === 'Escape') cancelSave();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && addingToId) {
      cancelAdd();
      return;
    }
    if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    $('search').focus();
  });

  for (const event of ['onCreated', 'onRemoved', 'onUpdated', 'onActivated', 'onHighlighted', 'onMoved']) {
    chrome.tabs[event].addListener(scheduleRefresh);
  }

  render();
}

async function render() {
  // await the counts: the "add tabs" label on an expanded card reads them
  await refreshSaveButton();
  renderProjects();
}

/* ---------- theme ---------- */

function applyTheme() {
  const dark = settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';

  const button = $('theme');
  button.textContent = dark ? '☾' : '☀';
  button.title = `Switch to ${dark ? 'light' : 'dark'} theme`;
  button.setAttribute('aria-label', button.title);
}

async function toggleTheme() {
  settings = { ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' };
  applyTheme();
  await saveSettings(settings);
}

/* ---------- save ---------- */

async function siftableTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter(isSiftable);
}

// Chrome's own tab multi-select (⌘/Ctrl-click, Shift-click a range). One highlighted
// tab is just the active tab, so only 2+ counts as a deliberate selection — that way
// selective capture needs no picker UI and the button label teaches it.
async function selectedSiftableTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
  const siftable = tabs.filter(isSiftable);
  return siftable.length > 1 ? siftable : [];
}

async function tabsToCapture() {
  const selected = await selectedSiftableTabs();
  return selected.length ? selected : siftableTabs();
}

async function refreshSaveButton() {
  if (candidate) return;

  const selected = await selectedSiftableTabs();
  const count = selected.length || (await siftableTabs()).length;
  selectionCount = selected.length;

  const key = `${selected.length ? 'selected' : 'window'}:${count}`;
  if (key === lastButtonKey) return; // label only depends on this
  lastButtonKey = key;

  const btn = $('save-btn');
  btn.textContent = !count
    ? 'Nothing to save in this window'
    : selected.length
      ? `Save ${count} selected tabs`
      : `Save this window (${count} tabs)`;
  btn.disabled = count === 0;
}

// onUpdated fires several times per page load (status, title, favicon), so a burst of
// 20 loading tabs would otherwise mean 60-100 tabs.query round trips.
let refreshTimer;
let lastButtonKey = '';
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshSaveButton, 150);
}

async function beginSave() {
  const tabs = await siftableTabs();
  if (!tabs.length) return;

  candidate = tabs;
  pickedIds = defaultPick(tabs, (await selectedSiftableTabs()).map((t) => t.id));

  $('save-btn').hidden = true;
  $('save-form').hidden = false;
  $('project-name').value = suggestName(tabs.map((t) => tabFromChrome(t)));
  $('save-tabs-label').textContent = `Tabs to keep (${tabs.length})`;
  renderPicker($('save-tabs'), tabs, pickedIds, updateSaveLabels);
  updateSaveLabels();
  $('project-name').focus();
  $('project-name').select();
}

function updateSaveLabels() {
  $('save-close').textContent = `Save + close ${pickedIds.size} tabs`;
  $('save-close').disabled = pickedIds.size === 0;
}

/* ---------- tab picker (shared by "new project" and "add to project") ---------- */

function renderPicker(container, tabs, picked, onChange) {
  container.textContent = '';

  const count = el('span', {
    className: 'picker-count',
    textContent: `${picked.size} of ${tabs.length} selected`,
  });
  const head = el('div', { className: 'picker-head' });
  const all = el('button', { className: 'picker-mini', type: 'button', textContent: 'All' });
  const none = el('button', { className: 'picker-mini', type: 'button', textContent: 'None' });
  head.append(count, all, none);

  const list = el('div', { className: 'picker-list' });
  for (const tab of tabs) {
    const box = el('input', { type: 'checkbox', checked: picked.has(tab.id) });
    box.addEventListener('change', () => {
      if (box.checked) picked.add(tab.id);
      else picked.delete(tab.id);
      count.textContent = `${picked.size} of ${tabs.length} selected`;
      onChange?.();
    });

    const row = el('label', { className: 'picker-row' });
    row.append(
      box,
      el('img', { src: faviconUrl(tab.url ?? tab.pendingUrl ?? ''), alt: '', loading: 'lazy' }),
      el('span', { textContent: tab.title || tab.url }),
    );
    list.append(row);
  }

  all.addEventListener('click', () => {
    tabs.forEach((t) => picked.add(t.id));
    renderPicker(container, tabs, picked, onChange);
    onChange?.();
  });
  none.addEventListener('click', () => {
    picked.clear();
    renderPicker(container, tabs, picked, onChange);
    onChange?.();
  });

  container.append(head, list);
}

function cancelSave() {
  candidate = null;
  pickedIds = new Set();
  $('save-tabs').textContent = '';
  $('save-form').hidden = true;
  $('save-btn').hidden = false;
  $('after-save').hidden = true;
  refreshSaveButton();
}

// Reads the tab groups once, then stamps each tab with the group it belonged to.
async function captureTabs(chromeTabs) {
  const groupIds = new Set(
    chromeTabs.map((t) => t.groupId).filter((id) => id !== undefined && id >= 0),
  );
  const groups = new Map();
  for (const id of groupIds) {
    try {
      groups.set(id, await chrome.tabGroups.get(id));
    } catch {
      // group was closed between the tab query and this read
    }
  }
  return chromeTabs.map((t) => tabFromChrome(t, groups.get(t.groupId)));
}

async function commitSave(closeTabs) {
  if (!candidate) return;

  const chosen = candidate.filter((t) => pickedIds.has(t.id));
  if (!chosen.length) {
    status('Pick at least one tab to save.');
    return;
  }

  const tabs = await captureTabs(chosen);
  const ids = chosen.map((t) => t.id);
  const name = $('project-name').value.trim() || suggestName(tabs);

  projects = [
    { id: newId(), name, createdAt: Date.now(), lastActiveAt: Date.now(), tabs },
    ...projects,
  ];
  await saveProjects(projects);
  candidate = null;

  let closed = 0;
  if (closeTabs) {
    // Only close tabs that are still open, so a stale id can't kill the wrong tab.
    const live = new Set((await chrome.tabs.query({ currentWindow: true })).map((t) => t.id));
    const toClose = ids.filter((id) => live.has(id));
    if (toClose.length) {
      await chrome.tabs.remove(toClose);
      closed = toClose.length;
    }
  }

  cancelSave();
  render();
  status(`Saved “${name}”${closed ? ` and closed ${closed} tabs` : ''}.`);
}

let statusTimer;
function status(message) {
  const toast = $('after-save');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (toast.hidden = true), 4200);
}

/* ---------- add to existing project ---------- */

function updateAddLabels() {
  const btn = document.querySelector('[data-action="add-save"]');
  if (btn) {
    btn.textContent = `Save ${addPicked.size} tabs`;
    btn.disabled = addPicked.size === 0;
  }
}

async function beginAdd(projectId) {
  const tabs = await siftableTabs();
  if (!tabs.length) {
    status('Nothing to add — no tabs in this window.');
    return;
  }
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  const selectedIds = (await selectedSiftableTabs()).map((t) => t.id);
  addCandidate = tabs;
  addPicked = defaultPick(tabs, selectedIds);
  // deselect tabs already in the project so the default isn't "already saved"
  const existing = new Set(project.tabs.map((t) => t.url));
  for (const t of tabs) if (existing.has(t.url)) addPicked.delete(t.id);

  addingToId = projectId;
  expanded.add(projectId);
  renderProjects();
}

function cancelAdd() {
  addingToId = null;
  addCandidate = null;
  addPicked = new Set();
  renderProjects();
}

async function commitAdd() {
  if (!addingToId || !addCandidate) return;
  const project = projects.find((p) => p.id === addingToId);
  if (!project) {
    cancelAdd();
    return;
  }
  const chosenChromeTabs = addCandidate.filter((t) => addPicked.has(t.id));
  if (!chosenChromeTabs.length) {
    status('Pick at least one tab to add.');
    return;
  }
  const incoming = await captureTabs(chosenChromeTabs);
  const { tabs: merged, added, skipped } = mergeTabs(project.tabs, incoming);
  if (added === 0) {
    status('All selected tabs are already in that project.');
    return;
  }

  project.tabs = merged;
  project.lastActiveAt = Date.now();
  await saveProjects(projects);

  const name = project.name;
  addingToId = null;
  addCandidate = null;
  addPicked = new Set();
  render();
  status(`Added ${added} tab${added === 1 ? '' : 's'} to “${name}”${skipped ? ` (${skipped} already there)` : ''}.`);
}

/* ---------- projects ---------- */

function visibleProjects() {
  const query = $('search').value.trim().toLowerCase();
  if (!query) return projects;
  return projects.filter(
    (p) => p.name.toLowerCase().includes(query) || p.tabs.some((t) => t.domain.toLowerCase().includes(query)),
  );
}

function renderProjects() {
  const list = $('projects');
  list.textContent = '';
  const items = visibleProjects();

  if (!items.length) {
    $('empty').hidden = false;
    $('empty').textContent = projects.length
      ? 'No projects match that search.'
      : 'No projects yet. Save your first window above.';
    return;
  }

  $('empty').hidden = true;
  for (const project of items) list.append(projectCard(project));
}

function projectCard(project) {
  const card = el('article', { className: 'card' });
  const head = el('div', { className: 'card-head' });

  const text = el('div', { className: 'card-text' });
  text.append(
    el('button', {
      className: 'card-title',
      textContent: project.name,
      dataset: { action: 'toggle', id: project.id },
    }),
    el('span', {
      className: 'meta',
      textContent: `${project.tabs.length} tabs · ${formatAgo(project.lastActiveAt)}`,
    }),
  );

  const armed = confirmDeleteId === project.id;
  const actions = el('div', { className: 'card-actions' });
  actions.append(
    el('button', {
      className: 'small cyan',
      textContent: 'Resume',
      dataset: { action: 'resume', id: project.id },
    }),
    el('button', {
      className: 'small',
      textContent: 'Add tabs',
      dataset: { action: 'add', id: project.id },
    }),
    el('button', {
      className: armed ? 'small armed' : 'small delete',
      textContent: armed ? 'Delete?' : 'Delete',
      dataset: { action: 'delete', id: project.id },
    }),
  );

  head.append(text, actions);
  card.append(head);

  if (expanded.has(project.id)) {
    const body = el('div', { className: 'card-body' });

    // add-to-project takes over the body when active for this card
    if (addingToId === project.id && addCandidate) {
      const pickerEl = el('div', { className: 'picker' });
      renderPicker(pickerEl, addCandidate, addPicked, updateAddLabels);
      const row = el('div', { className: 'row' });
      const btnSave = el('button', {
        className: 'primary',
        textContent: `Save ${addPicked.size} tabs`,
        dataset: { action: 'add-save', id: project.id },
      });
      btnSave.disabled = addPicked.size === 0;
      const btnCancel = el('button', {
        textContent: 'Cancel',
        dataset: { action: 'add-cancel', id: project.id },
      });
      row.append(btnSave, btnCancel);
      body.append(pickerEl, row);
    } else {
      for (const group of groupByDomain(project.tabs)) {
        const section = el('div', { className: 'domain-group' });
        section.append(
          el('div', { className: 'domain', textContent: `${group.domain} · ${group.tabs.length}` }),
        );
        for (const tab of group.tabs) {
          const row = el('button', {
            className: 'tab',
            title: tab.url,
            dataset: { action: 'open', url: tab.url },
          });
          row.append(el('img', { src: faviconUrl(tab.url), alt: '', loading: 'lazy' }));
          row.append(el('span', { textContent: tab.title }));
          section.append(row);
        }
        body.append(section);
      }
    }
    card.append(body);
  }

  return card;
}

async function onProjectClick(event) {
  const target = event.target.closest('[data-action]');
  const action = target?.dataset.action;

  // clicking anywhere else disarms a pending delete
  if (confirmDeleteId && action !== 'delete') {
    confirmDeleteId = null;
    if (!target) renderProjects();
  }

  if (!target) return;

  const { id, url } = target.dataset;

  if (action === 'toggle') {
    const wasExpanded = expanded.has(id);
    if (wasExpanded) {
      expanded.delete(id);
      if (addingToId === id) {
        addingToId = null;
        addCandidate = null;
        addPicked = new Set();
      }
    } else {
      expanded.add(id);
    }
    renderProjects();
    return;
  }

  if (action === 'add') {
    await beginAdd(id);
    return;
  }
  if (action === 'add-cancel') {
    cancelAdd();
    return;
  }
  if (action === 'add-save') {
    await commitAdd();
    return;
  }

  if (action === 'open') {
    const windowId = await currentWindowId();
    const all = await chrome.tabs.query({});
    const matches = all.filter((t) => t.url === url);
    // prefer the copy already in this window so the panel doesn't fling you elsewhere
    const existing = matches.find((t) => t.windowId === windowId) ?? matches[0];

    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
      status('Already open — jumped to that tab.');
    } else {
      await chrome.tabs.create({ url, active: true });
      status('Opened in a new tab.');
    }
    return;
  }

  if (action === 'resume') {
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    const urls = project.tabs.map((t) => t.url);
    // always a NEW window: one project = one window, closable as a unit
    const win = await chrome.windows.create({ url: urls, focused: true });
    if (win?.id === undefined) {
      status('Resume failed: Chrome did not report the new window.');
      return;
    }

    const grouped = settings.groupByDomain
      ? await applyGroups(win.id, project.tabs)
      : { made: 0, errors: [] };

    const placed = await chrome.tabs.query({ windowId: win.id });
    console.info(
      `Tabrary resume: newWindow=${win.id} urls=${urls.length} tabsInWindow=${placed.length} groups=${grouped.made}` +
        (grouped.errors.length ? ` errors=${grouped.errors.join('; ')}` : ''),
    );

    project.lastActiveAt = Date.now();
    await saveProjects(projects);
    render();

    const problems = [...grouped.errors];
    if (placed.length !== urls.length) {
      problems.push(`${placed.length} of ${urls.length} tabs landed in the new window`);
    }
    status(
      problems.length
        ? `Resumed “${project.name}” in a new window — ${problems[0]}`
        : `Resumed “${project.name}” in a new window${grouped.made ? `, ${grouped.made} tab groups` : ''}.`,
    );
    return;
  }

  if (action === 'delete') {
    if (confirmDeleteId !== id) {
      confirmDeleteId = id;
      renderProjects();
      return;
    }
    projects = projects.filter((p) => p.id !== id);
    confirmDeleteId = null;
    // if deleted project was being added to, clear add state
    if (addingToId === id) {
      addingToId = null;
      addCandidate = null;
      addPicked = new Set();
    }
    await saveProjects(projects);
    render();
  }
}

/* ---------- native chrome.tabGroups: real tabs, real order ---------- */

const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // "Tabs cannot be edited right now (user may be dragging a tab)" is transient —
      // it is the normal failure right after a window full of tabs starts loading.
      if (attempt >= attempts) throw error;
      await sleep(120 * attempt);
    }
  }
}

// A freshly created window reports tabs before their urls land; grouping them too
// early silently produces zero groups.
async function waitForUrls(windowId, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  let tabs = await chrome.tabs.query({ windowId });
  while (Date.now() < deadline && !tabs.every((t) => t.url || t.pendingUrl)) {
    await sleep(80);
    tabs = await chrome.tabs.query({ windowId });
  }
  return tabs;
}

// groups: [{ title, color?, tabIds }] — returns what actually happened, never throws.
// windowId is passed explicitly: without it Chrome infers the window from the tabs,
// which is how a resume could quietly group tabs somewhere other than the new window.
async function groupTabs(windowId, groups) {
  let made = 0;
  const errors = [];

  // Pinned tabs are intentional and Chrome refuses to mix pinned with unpinned in
  // one group, so they are never touched — this was why grouping used to fail.
  const groupable = new Set(
    (await chrome.tabs.query({ windowId })).filter((t) => !t.pinned).map((t) => t.id),
  );

  for (const [index, group] of groups.entries()) {
    const tabIds = group.tabIds.filter((id) => id !== undefined && groupable.has(id));
    if (!tabIds.length) continue;
    try {
      const groupId = await withRetry(() =>
        chrome.tabs.group({ tabIds, createProperties: { windowId } }),
      );
      await chrome.tabGroups.update(groupId, {
        title: group.title,
        color: group.color ?? GROUP_COLORS[index % GROUP_COLORS.length],
      });
      made++;
    } catch (error) {
      errors.push(`${group.title}: ${error.message}`);
    }
  }

  return { made, errors };
}

// Current window → one group per domain (used by the toggle).
async function groupWindowByDomain(windowId) {
  const live = await chrome.tabs.query({ windowId });
  const shaped = live
    .filter((t) => !t.pinned) // leave pinned tabs exactly where they are
    .map((t) => ({ id: t.id, domain: domainOf(t.url ?? t.pendingUrl ?? '') }));
  const groups = groupByDomain(
    shaped.filter((t) => t.domain),
    'first-seen',
  ).map((group) => ({ title: group.domain, tabIds: group.tabs.map((t) => t.id) }));

  if (groups.length < 2) return { made: 0, errors: [] }; // one domain: nothing to group
  return groupTabs(windowId, groups);
}

// Resumed window → rebuild the groups the project was saved with.
async function applyGroups(windowId, savedTabs) {
  const live = await waitForUrls(windowId);
  if (!live.length) return { made: 0, errors: ['the new window reported no tabs'] };

  // a mismatch means indices may not line up — still group best effort, but say so
  const notes =
    live.length === savedTabs.length
      ? []
      : [`new window holds ${live.length} of ${savedTabs.length} tabs`];

  const groups = planGroups(savedTabs)
    .map((group) => ({
      ...group,
      tabIds: group.indices.map((index) => live[index]?.id).filter((id) => id !== undefined),
    }))
    .filter((group) => group.tabIds.length);

  if (groups.length < 2) return { made: 0, errors: notes };
  const result = await groupTabs(windowId, groups);
  return { made: result.made, errors: [...notes, ...result.errors] };
}

async function currentWindowId() {
  const [tab] = await chrome.tabs.query({ currentWindow: true });
  return tab?.windowId;
}

// One control for grouping: it applies to this window now, and to every resume after.
async function onGroupToggle(event) {
  const on = event.target.checked;
  settings = { ...settings, groupByDomain: on };
  await saveSettings(settings);

  const windowId = await currentWindowId();
  if (windowId === undefined) return;

  if (on) {
    const { made, errors } = await groupWindowByDomain(windowId);
    status(
      errors.length
        ? `Grouping failed: ${errors[0]}`
        : made
          ? `Grouped this window into ${made} domains.`
          : 'Single domain here — grouping will apply on resume.',
    );
    return;
  }

  const ungrouped = await ungroupWindow(windowId);
  status(ungrouped ? 'Ungrouped this window.' : 'Nothing was grouped.');
}

async function ungroupWindow(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const grouped = tabs.filter((t) => t.groupId >= 0).map((t) => t.id);
  if (!grouped.length) return 0;

  await chrome.tabs.ungroup(grouped);
  return grouped.length;
}

/* ---------- export / import (free on purpose: backup is trust, not an upsell) ---------- */

function exportAll() {
  const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tabrary-projects-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importAll(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error('not an array');
    const known = new Set(projects.map((p) => p.id));
    const added = incoming.filter((p) => p?.id && Array.isArray(p.tabs) && !known.has(p.id));
    projects = [...added, ...projects];
    await saveProjects(projects);
    render();
    status(`Imported ${added.length} project${added.length === 1 ? '' : 's'}.`);
  } catch {
    status('Import failed — that is not a Tabrary export file.');
  }
}

/* ---------- rendering helpers ---------- */

// Chrome's own favicon cache — local, no request to the site, no third party.
// ponytail: favicon permission + a cached lookup beats storing (and re-fetching) icon urls.
function faviconUrl(pageUrl) {
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`);
}

/* ---------- tiny DOM helper (textContent only, never innerHTML: titles are untrusted) ---------- */

function el(tag, props = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  return node;
}
