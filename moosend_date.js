// Auto-update month/year for preview pages only
// Language: English (code/comments), UI content remains in French
(function () {
  function getFrenchMonthYear(date) {
    const month = date.toLocaleString('fr-FR', { month: 'long' });
    // Capitalize first letter to match existing style (e.g., "Juin")
    const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
    return `${capMonth} ${date.getFullYear()}`;
  }

  function replaceMonthYearInText(text, label) {
    if (typeof text !== 'string') return text;
    // Replace pattern like "— Juin 2025" with current label preserving the en dash
    return text.replace(/—\s+[A-Za-zÀ-ÿ]+\s+\d{4}/g, `— ${label}`);
  }

  function updateNodeText(selector, label) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = replaceMonthYearInText(el.textContent, label);
  }

  function updateAttribute(selector, attr, label) {
    const el = document.querySelector(selector);
    if (!el) return;
    const val = el.getAttribute(attr);
    if (!val) return;
    el.setAttribute(attr, replaceMonthYearInText(val, label));
  }

  function updateDocumentTitle(label) {
    if (document.title) {
      document.title = replaceMonthYearInText(document.title, label);
    }
  }

  function run() {
    const label = getFrenchMonthYear(new Date());

    // Update known spots in the preview template
    updateAttribute('img[alt*="—"]', 'alt', label); // hero image alt
    updateNodeText('div[style*="text-transform:uppercase"]', label); // "Newsletter — Mois Année"
    updateNodeText('h1', label); // heading containing month/year
    updateDocumentTitle(label);

    // Optional: update any other visible text nodes that strictly match the pattern
    // without touching dates with day numbers (e.g., "26 juin 2025").
    // Here we only target elements that contain an en dash already.
    document.querySelectorAll('*, *[alt]').forEach((node) => {
      if (node.childNodes) {
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const newVal = replaceMonthYearInText(child.nodeValue, label);
            if (newVal !== child.nodeValue) child.nodeValue = newVal;
          }
        });
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('alt')) {
        const alt = node.getAttribute('alt');
        const newAlt = replaceMonthYearInText(alt, label);
        if (newAlt !== alt) node.setAttribute('alt', newAlt);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
