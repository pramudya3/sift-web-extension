// Storage + pure helpers. No dependencies, no network.
// ponytail: chrome.storage.local instead of IndexedDB — same persistence, ~20 lines
// instead of ~150. Move to IndexedDB only if you start storing page snapshots.
const KEY = 'sift.projects';

export const newId = () => crypto.randomUUID();

export async function loadProjects() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] ?? [];
}

export async function saveProjects(projects) {
  await chrome.storage.local.set({ [KEY]: projects });
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const isSiftable = (tab) => /^https?:/i.test(tab.url ?? '');

export function tabFromChrome(tab) {
  const now = Date.now();
  return {
    url: tab.url,
    title: tab.title || tab.url,
    favicon: tab.favIconUrl,
    domain: domainOf(tab.url),
    lastActiveAt: tab.lastAccessed ?? now,
    createdAt: now,
  };
}

// ponytail: naive TLD strip — "docs.stripe.com" -> "stripe", but "x.co.uk" -> "co".
// Good enough for an editable suggestion.
export function suggestName(tabs) {
  const counts = new Map();
  for (const t of tabs) if (t.domain) counts.set(t.domain, (counts.get(t.domain) ?? 0) + 1);
  if (!counts.size) return 'Untitled research';

  const [top, count] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const label = top.split('.').slice(-2)[0] || top;
  const name = label[0].toUpperCase() + label.slice(1);
  return count / tabs.length >= 0.4 ? `${name} research` : `${name} + ${counts.size - 1} more`;
}

// order: 'size' (panel display) | 'first-seen' (resume order — Map keeps insertion order)
export function groupByDomain(tabs, order = 'size') {
  const groups = new Map();
  for (const t of tabs) {
    if (!groups.has(t.domain)) groups.set(t.domain, []);
    groups.get(t.domain).push(t);
  }
  const list = [...groups].map(([domain, tabs]) => ({ domain, tabs }));
  return order === 'first-seen'
    ? list
    : list.sort((a, b) => b.tabs.length - a.tabs.length || a.domain.localeCompare(b.domain));
}

const SETTINGS_KEY = 'sift.settings';

export async function loadSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { groupByDomain: false, theme: 'light', ...data[SETTINGS_KEY] };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function computeStats(projects) {
  const totalTabs = projects.reduce((n, p) => n + p.tabs.length, 0);
  return { totalProjects: projects.length, totalTabs, minutesSaved: totalTabs * 2 };
}

export function formatMinutes(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}
