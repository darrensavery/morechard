import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = 'E:\\Web-Video Design\\Claude\\Apps\\Pocket Money\\worker\\scripts';
const parentArticles = JSON.parse(readFileSync(join(root, 'kb-articles-full.json'), 'utf-8'));
const childArticles = [
  ...JSON.parse(readFileSync(join(root, 'kb-articles-child.json'), 'utf-8')),
  ...JSON.parse(readFileSync(join(root, 'kb-articles-child-2.json'), 'utf-8')),
];

const docsDir = 'E:\\Web-Video Design\\Claude\\Apps\\Pocket Money\\docs-site\\docs';
rmSync(join(docsDir, 'tutorial-basics'), { recursive: true, force: true });
rmSync(join(docsDir, 'tutorial-extras'), { recursive: true, force: true });
rmSync(join(docsDir, 'intro.mdx'), { force: true });

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/\[for kids\]\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const STILL_NEED_HELP = `
---

### Still need help?

Email [support@morechard.com](mailto:support@morechard.com) and we'll pick it up from here.
`;

function toMdx(article) {
  const body = article.content;
  const title = article.title.replace(/"/g, '\\"');
  return `---
title: "${title}"
---

${body}
${STILL_NEED_HELP}`;
}

function writeCategory(dirPath, label, position) {
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(
    join(dirPath, '_category_.json'),
    JSON.stringify({ label, position, link: { type: 'generated-index' } }, null, 2)
  );
}

// ---- Parent categories, in the order the articles were authored ----
const parentCategories = [
  { key: 'chores-and-approvals', label: 'Chores & Approvals', count: 6 },
  { key: 'goals-and-saving', label: 'Goals & Saving', count: 5 },
  { key: 'separated-families', label: 'Separated Families', count: 6 },
  { key: 'billing-and-plans', label: 'Billing & Plans', count: 5 },
  { key: 'account-and-security', label: 'Account & Security', count: 5 },
  { key: 'ai-mentor-and-learning-lab', label: 'AI Mentor & Learning Lab', count: 4 },
];

writeCategory(join(docsDir, 'for-parents'), 'For Parents', 1);

let idx = 0;
parentCategories.forEach((cat, catPos) => {
  const dir = join(docsDir, 'for-parents', cat.key);
  writeCategory(dir, cat.label, catPos + 1);
  for (let i = 0; i < cat.count; i++) {
    const article = parentArticles[idx];
    const filename = `${String(i + 1).padStart(2, '0')}-${slugify(article.title)}.mdx`;
    writeFileSync(join(dir, filename), toMdx(article));
    idx++;
  }
});

if (idx !== parentArticles.length) {
  throw new Error(`Category counts (${idx}) don't match parent article total (${parentArticles.length})`);
}

// ---- Child articles: one flat "For Kids" category ----
const kidsDir = join(docsDir, 'for-kids');
writeCategory(kidsDir, 'For Kids', 2);
childArticles.forEach((article, i) => {
  const filename = `${String(i + 1).padStart(2, '0')}-${slugify(article.title)}.mdx`;
  writeFileSync(join(kidsDir, filename), toMdx(article));
});

console.log(`Converted ${parentArticles.length} parent articles + ${childArticles.length} child articles.`);
