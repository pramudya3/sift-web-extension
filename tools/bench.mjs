// Performance sanity check for the panel's hot paths.
// Runs the real pure helpers from extension/lib/store.js against synthetic libraries
// in Node, so numbers are measured, not guessed: node tools/bench.mjs
import { performance } from 'node:perf_hooks';
import { domainOf, groupByDomain, planGroups, suggestName } from '../extension/lib/store.js';

const HOSTS = [
  'github.com', 'stackoverflow.com', 'stripe.com', 'docs.stripe.com', 'developer.chrome.com',
  'news.ycombinator.com', 'supabase.com', 'linear.app', 'figma.com', 'notion.so',
];

const makeTab = (i) => {
  const host = HOSTS[i % HOSTS.length];
  const url = `https://${host}/path/${i}?q=${i}`;
  return { url, title: `${host} page ${i}`, domain: domainOf(url), createdAt: 0 };
};

function makeLibrary(projectCount, tabsPerProject) {
  return Array.from({ length: projectCount }, (_, p) => ({
    id: `p${p}`,
    name: `Project ${p}`,
    createdAt: 0,
    lastActiveAt: Date.now() - p * 60_000,
    tabs: Array.from({ length: tabsPerProject }, (_, t) => makeTab(t)),
  }));
}

// what visibleProjects() does on every keystroke
function search(library, query) {
  const q = query.toLowerCase();
  return library.filter(
    (p) => p.name.toLowerCase().includes(q) || p.tabs.some((t) => t.domain.toLowerCase().includes(q)),
  );
}

function time(label, fn, iterations = 200) {
  fn(); // warm up
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const per = (performance.now() - start) / iterations;
  console.log(`  ${label.padEnd(46)} ${per < 1 ? per.toFixed(3) : per.toFixed(1)} ms`);
  return per;
}

for (const [projects, tabsPer] of [
  [50, 25],
  [200, 25],
  [1000, 30],
]) {
  const library = makeLibrary(projects, tabsPer);
  const totalTabs = projects * tabsPer;
  const json = JSON.stringify(library);
  console.log(`\n${projects} projects · ${totalTabs} tabs  (stored JSON ${(json.length / 1024 / 1024).toFixed(2)} MB)`);
  time('search keystroke (filter projects)', () => search(library, 'docs.str'), 100);
  time('group one project (groupByDomain, panel)', () => groupByDomain(library[0].tabs), 200);
  time('resume plan (planGroups, one project)', () => planGroups(library[0].tabs), 200);
  time('name suggestion (suggestName)', () => suggestName(library[0].tabs), 200);
  time('chrome.storage write (JSON.stringify)', () => JSON.stringify(library), 20);
  time('load (JSON.parse)', () => JSON.parse(json), 20);
}

console.log('\nper-tab costs (single tab, 100k iterations)');
const tab = makeTab(7);
time('domainOf(url)', () => domainOf(tab.url), 100_000);
