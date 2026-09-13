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

// Strip HTML down to clean plain text — used for both the meta description
// and the FAQPage JSON-LD answer text (which must match what's on the page).
function htmlToPlainText(html) {
  return html
    .replace(/<\/(p|li|h[1-6])>/gi, '$&\n') // paragraph/list-item/heading breaks -> newlines
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function truncateForDescription(text, maxLen = 155) {
  const singleLine = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  const cut = singleLine.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

// YAML-safe double-quoted string escaping.
function yamlEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const STILL_NEED_HELP = `
---

### Still need help?

Email [support@morechard.com](mailto:support@morechard.com) and we'll pick it up from here.
`;

function toMdx(article, category) {
  const title = article.title.replace(/^\[for kids\]\s*/i, '').trim();
  const plainAnswer = htmlToPlainText(article.content);
  const description = truncateForDescription(plainAnswer);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: title,
        acceptedAnswer: {
          '@type': 'Answer',
          text: plainAnswer,
        },
      },
    ],
  };
  // Rendered as a template-literal JSX child (`{`...`}`) — dangerouslySetInnerHTML
  // silently fails to render inside Docusaurus doc MDX, verified by isolated test.
  //
  // This string gets embedded as literal source text inside a template literal
  // in the generated .mdx file, which is then evaluated by the JS engine at
  // build time. That means every backslash JSON.stringify produces (\n, \", \\)
  // must be doubled FIRST so the template-literal evaluation "unescapes" it back
  // to a single backslash — otherwise \n becomes a real newline, which is an
  // unescaped control character and invalid inside a JSON string. "<" is also
  // replaced with the unicode escape < so a literal "</script>" in content
  // can never break out of the tag (this must happen before backslash-doubling
  // since it introduces its own backslash).
  const schemaJson = JSON.stringify(faqSchema)
    .replace(/</g, '\\u003c')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  return `---
title: "${yamlEscape(title)}"
description: "${yamlEscape(description)}"
keywords: [${(category ? [category] : []).map((k) => `"${yamlEscape(k)}"`).join(', ')}]
---

import Head from '@docusaurus/Head';

<Head>
  <script type="application/ld+json">{\`${schemaJson}\`}</script>
</Head>

${article.content}
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
    writeFileSync(join(dir, filename), toMdx(article, cat.label));
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
  writeFileSync(join(kidsDir, filename), toMdx(article, 'For Kids'));
});

console.log(`Converted ${parentArticles.length} parent articles + ${childArticles.length} child articles.`);
