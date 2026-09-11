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

export function tabFromChrome(tab, group) {
  const now = Date.now();
  return {
    url: tab.url,
    title: tab.title || tab.url,
    domain: domainOf(tab.url),
    // remember the tab group the user actually had, so a resume can rebuild it
    ...(group?.title ? { group: { title: group.title, color: group.color } } : {}),
    lastActiveAt: tab.lastAccessed ?? now,
    createdAt: now,
  };
}

// Resume plan from saved tabs: a stored group wins even across domains, and tabs with
// no stored group fall back to their domain. Returns [{title, color, indices}] in
// first-seen order, so the rebuilt window keeps the order the user left it in.
export function planGroups(tabs) {
  const groups = new Map();
  tabs.forEach((tab, index) => {
    const title = tab.group?.title || tab.domain || 'other';
    const found = groups.get(title);
    if (found) {
      found.indices.push(index);
      return;
    }
    groups.set(title, { title, color: tab.group?.color, indices: [index] });
  });
  return [...groups.values()];
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

export function formatAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}
