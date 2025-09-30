// sync_moosend.js
// Purpose: Sync subject (H1) and resume (lead paragraph) from index.html
// into moosend_template.html: <title>, hidden preheader, <h1>, and first intro <p>.
// No external dependencies. Works with current project structure.

const fs = require('fs');
const path = require('path');

// Files
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');
const TEMPLATE = path.join(ROOT, 'moosend_template.html');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

function extractBetween(source, startRe, endRe) {
  const start = source.search(startRe);
  if (start === -1) return null;
  const after = source.slice(start);
  const endMatch = after.search(endRe);
  if (endMatch === -1) return null;
  const block = after.slice(0, endMatch);
  return { start, end: start + endMatch, block };
}

function extractTextFromTag(html, tagRe) {
  const m = html.match(tagRe);
  if (!m) return null;
  // Capture group 1 is inner text
  return m[1].replace(/\s+/g, ' ').trim();
}

function currentFrenchMonthYear() {
  const d = new Date();
  const month = d.toLocaleString('fr-FR', { month: 'long' });
  const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capMonth} ${d.getFullYear()}`;
}

function main() {
  // 1) Read source index.html
  const indexHtml = readFile(INDEX);

  // 2) Extract subject (H1) and resume (lead paragraph)
  const subject = extractTextFromTag(
    indexHtml,
    /<h1[^>]*class=["'][^"']*title-accent[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
  );
  const resume = extractTextFromTag(
    indexHtml,
    /<p[^>]*class=["'][^"']*lead[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
  );

  if (!subject) {
    console.warn('[sync_moosend] Could not find subject in index.html (h1.title-accent).');
  }
  if (!resume) {
    console.warn('[sync_moosend] Could not find resume in index.html (p.lead).');
  }

  // 3) Read target moosend_template.html
  let tpl = readFile(TEMPLATE);

  // 4) Update <title>
  if (subject) {
    tpl = tpl.replace(/(<title>)([\s\S]*?)(<\/title>)/i, (m, a, _b, c) => `${a}${subject}${c}`);
  }

  // 5) Update hidden preheader (first hidden preview div at top)
  if (resume) {
    tpl = tpl.replace(
      /(<div\s+style=\"display:none;[^\"]*\"[^>]*>)([\s\S]*?)(<\/div>)/i,
      (m, a, _b, c) => `${a}${resume}${c}`
    );
  }

  // 6) Update first <h1> in template (the hero title)
  if (subject) {
    tpl = tpl.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i, (m, a, _b, c) => `${a}${subject}${c}`);
  }

  // 7) Update first intro paragraph after hero (first <p> occurrence)
  if (resume) {
    tpl = tpl.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/i, (m, a, _b, c) => `${a}${resume}${c}`);
  }

  // 7bis) Auto-update month/year labels (email-safe text replacement)
  // Replace occurrences of an en dash followed by a French month name and a 4-digit year.
  // Avoid dates that start with a day number (e.g., "— 26 juin 2025").
  const label = currentFrenchMonthYear();
  // Actual en dash character
  tpl = tpl.replace(/—\s+[A-Za-zÀ-ÿ]+\s+\d{4}/g, `— ${label}`);
  // HTML entity &#8212;
  tpl = tpl.replace(/&#8212;\s+[A-Za-zÀ-ÿ]+\s+\d{4}/g, `&#8212; ${label}`);

  // 8) Write back
  writeFile(TEMPLATE, tpl);

  console.log('[sync_moosend] Sync completed.');
  if (subject) console.log('  - Subject updated to:', subject);
  if (resume) console.log('  - Resume updated to:', resume);
}

main();
