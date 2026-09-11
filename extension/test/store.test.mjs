// Smallest runnable check for the rule-based logic (no framework).
// node test/store.test.mjs
import assert from 'node:assert/strict';
import {
  domainOf,
  isSiftable,
  suggestName,
  groupByDomain,
  computeStats,
  formatMinutes,
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

assert.deepEqual(computeStats([]), { totalProjects: 0, totalTabs: 0, minutesSaved: 0 });
assert.deepEqual(computeStats([{ tabs: [1, 2, 3] }, { tabs: [1] }]), {
  totalProjects: 2,
  totalTabs: 4,
  minutesSaved: 8,
});

assert.equal(formatMinutes(45), '45m');
assert.equal(formatMinutes(120), '2h');
assert.equal(formatMinutes(125), '2h 5m');
assert.equal(formatAgo(Date.now()), 'just now');
assert.equal(formatAgo(Date.now() - 3 * 3600_000), '3h ago');

console.log('store.js ok');
