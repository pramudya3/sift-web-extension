// Smallest runnable check for the rule-based logic (no framework).
// node test/store.test.mjs
import assert from 'node:assert/strict';
import {
  domainOf,
  isSiftable,
  suggestName,
  groupByDomain,
  planGroups,
  defaultPick,
  tabFromChrome,
  formatAgo,
} from '../lib/store.js';

const tabs = (urls) => urls.map((url, i) => ({ url, domain: domainOf(url), title: `t${i}` }));

assert.equal(domainOf('https://www.github.com/a/b?x=1#h'), 'github.com');
assert.equal(domainOf('not a url'), '');
assert.equal(isSiftable({ url: 'chrome://extensions' }), false);
assert.equal(isSiftable({ url: 'http://localhost:3000' }), true);

// dominant domain (>=40%) names the project; mixed piles say "+ N more"
assert.equal(suggestName(tabs(['https://docs.stripe.com/a', 'https://stripe.com/b'])), 'Stripe research');
assert.equal(
  suggestName(tabs(['https://a.com/1', 'https://b.com/2', 'https://c.com/3', 'https://d.com/4'])),
  'A + 3 more',
);
assert.equal(suggestName([]), 'Untitled research');

// grouping: sorted by size, stable order inside a group
const grouped = groupByDomain(tabs(['https://b.com/1', 'https://a.com/1', 'https://b.com/2']));
assert.deepEqual(
  grouped.map((g) => [g.domain, g.tabs.length]),
  [['b.com', 2], ['a.com', 1]],
);

// 'first-seen' keeps resume order (order the tabs appeared), not size order
const ordered = groupByDomain(tabs(['https://b.com/1', 'https://a.com/1', 'https://b.com/2']), 'first-seen');
assert.deepEqual(ordered.map((g) => g.domain), ['b.com', 'a.com']);

assert.equal(formatAgo(Date.now()), 'just now');
assert.equal(formatAgo(Date.now() - 3 * 3600_000), '3h ago');

// planGroups: saved groups win even across domains; bare tabs fall back to domain
const saved = [
  { url: 'https://a.com/1', domain: 'a.com', group: { title: 'Research', color: 'blue' } },
  { url: 'https://b.com/1', domain: 'b.com', group: { title: 'Research', color: 'blue' } },
  { url: 'https://c.com/1', domain: 'c.com' },
  { url: 'https://c.com/2', domain: 'c.com' },
];
const plan = planGroups(saved);
assert.deepEqual(plan.map((g) => [g.title, g.indices]), [
  ['Research', [0, 1]],
  ['c.com', [2, 3]],
]);
assert.equal(plan[0].color, 'blue');
assert.equal(plan[1].color, undefined);

// tabFromChrome keeps the group it was given, and drops it when there is none
const kept = tabFromChrome({ url: 'https://a.com/x', title: 'A' }, { title: 'Research', color: 'blue' });
assert.deepEqual(kept.group, { title: 'Research', color: 'blue' });
assert.equal(kept.domain, 'a.com');
assert.equal('favicon' in kept, false, 'favicons come from chrome\'s cache, not storage');
assert.equal('group' in tabFromChrome({ url: 'https://a.com/x', title: 'A' }), false);

// defaultPick: pinned tabs are left out unless the user deliberately selected them
const window1 = [
  { id: 1, pinned: true },
  { id: 2, pinned: false },
  { id: 3, pinned: false },
];
assert.deepEqual([...defaultPick(window1)], [2, 3]);
assert.deepEqual([...defaultPick(window1, [1, 3])], [1, 3], 'explicit multi-select wins');
assert.deepEqual([...defaultPick(window1, [3])], [2, 3], 'one tab is just the active tab');
assert.deepEqual([...defaultPick(window1, [99])], [2, 3], 'unknown ids ignored');

console.log('store.js ok');
