/**
 * Consistency check for the documentation.
 *
 * Three ways the docs can be quietly broken, none of which the build catches:
 * a sidebar entry with no page behind it, a page nothing links to, and a
 * cross-reference pointing at a slug that does not exist. All three look fine
 * until a reader clicks.
 *
 * Deliberately imports only the plain-data modules, never blocks.jsx — this has
 * to run under bare node, and node cannot parse JSX.
 */
import { NAV, FLAT } from '../src/docs/nav.js';
import { PAGES } from '../src/docs/content/index.js';

const problems = [];
const navSlugs = new Set(FLAT.map((i) => i.slug));
const pageSlugs = new Set(Object.keys(PAGES));

for (const { slug, title } of FLAT) {
  if (!pageSlugs.has(slug)) problems.push(`nav entry "${title}" (${slug}) has no page`);
}
for (const slug of pageSlugs) {
  if (!navSlugs.has(slug)) problems.push(`page "${slug}" is not in the sidebar — unreachable`);
}

const LINK = /\[[^\]]+\]\(\/docs\/([a-z0-9-]+)\)/g;
let words = 0;

for (const [slug, page] of Object.entries(PAGES)) {
  const haystack = JSON.stringify(page);
  for (const m of haystack.matchAll(LINK)) {
    if (!navSlugs.has(m[1])) problems.push(`${slug}: links to /docs/${m[1]} which does not exist`);
  }
  if (!page.title) problems.push(`${slug}: missing title`);
  if (!page.description) problems.push(`${slug}: missing description`);
  if (!page.blocks?.length) problems.push(`${slug}: has no content blocks`);

  // Rough word count from every string value in the page tree.
  const walk = (node) => {
    if (typeof node === 'string') words += node.split(/\s+/).filter(Boolean).length;
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(page);
}

console.log(`groups:  ${NAV.length}`);
console.log(`pages:   ${Object.keys(PAGES).length}`);
console.log(`words:   ~${words.toLocaleString()}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\n✓ every nav entry has a page, every page is reachable, every link resolves');
