// index.js
// Extracted from index.html to keep JS separate. On-screen text remains French; code/comments in English.

// Header hamburger toggle
document.addEventListener('DOMContentLoaded', function () {
  // Auto-update month/year text in index page meta and title
  try {
    const now = new Date();
    const monthsFr = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const mois = monthsFr[now.getMonth()];
    const annee = now.getFullYear();

    // Update the small meta line: "Newsletter — Mois AAAA"
    const metaEl = document.querySelector('.kyo-meta .meta');
    if (metaEl) {
      const base = 'Newsletter — ';
      metaEl.textContent = base + (mois.charAt(0).toUpperCase() + mois.slice(1)) + ' ' + annee;
    }

    // Update the main title if it follows the pattern "Comptez sur nous — Mois AAAA"
    const titleEl = document.querySelector('h1.title-accent');
    if (titleEl) {
      const txt = titleEl.textContent || '';
      const parts = txt.split('—');
      if (parts.length >= 1) {
        const prefix = parts[0].trim();
        titleEl.textContent = `${prefix} — ${mois.charAt(0).toUpperCase() + mois.slice(1)} ${annee}`;
      }
    }
  } catch (e) { /* no-op */ }

  const hamburger = document.getElementById('hamburger');
  const headerNav = document.querySelector('.header-nav');
  if (hamburger && headerNav) {
    hamburger.addEventListener('click', function () {
      headerNav.classList.toggle('active');
      const spans = hamburger.querySelectorAll('span');
      if (headerNav.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });
  }
});

// Dynamic content syncing for tiles and hero
document.addEventListener('DOMContentLoaded', function () {
  const contentConfig = [
    {
      source: 'teteSuperieure.html',
      titleSelector: 'h1, h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.title-accent',
      targetImage: null, // locked: hero image fixed to Image/page1.png
      targetDesc: '.lead',
      errorMsg: 'teteSuperieure (Main Title)'
    },
    {
      source: 'contenuDeGauche.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) h3',
      targetImage: null, // locked: tile 1 image fixed to Image/page2.png
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) p',
      errorMsg: 'contenuDeGauche (First Tile)'
    },
    {
      source: 'contenuCentral.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) h3',
      targetImage: null, // locked: tile 2 image fixed to Image/page3.png
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) p',
      errorMsg: 'contenuCentral (Second Tile)'
    },
    {
      source: 'contenuDeDroite.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) h3',
      targetImage: null, // locked: tile 3 image fixed to Image/page4.png
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) p',
      errorMsg: 'contenuDeDroite (Third Tile)'
    }
  ];

  // Helper: extract a meaningful title from a fetched HTML document
  // Priority: inline style font-size:52px > font[size="7"] > first h1/h2/h3
  function extractTitleFromDoc(doc, fallbackSelector) {
    // 1) Scan for any element explicitly styled with font-size:52px and return first non-empty text
    const fsCandidates = doc.querySelectorAll('span[style*="font-size: 52px"], span[style*="font-size:52px"], [style*="font-size: 52px"], [style*="font-size:52px"]');
    for (const el of fsCandidates) {
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }

    // 2) Scan for <font size="7"> with non-empty text
    const fontCandidates = doc.querySelectorAll('font[size="7"]');
    for (const el of fontCandidates) {
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }

    // 3) Fallback: scan provided selector or generic headings and pick first non-empty
    const sel = fallbackSelector || 'h1, h2, h3';
    const headCandidates = doc.querySelectorAll(sel);
    for (const el of headCandidates) {
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    return '';
  }

  async function updateContent(config) {
    try {
      const response = await fetch(`${config.source}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Title (robust extraction to avoid empty headings)
      const targetTitle = document.querySelector(config.targetTitle);
      if (targetTitle) {
        const extracted = extractTitleFromDoc(doc, config.titleSelector);
        if (extracted) {
          targetTitle.textContent = extracted;
          console.debug(`[index.js] Synced title for ${config.errorMsg}:`, extracted);
        } else {
          console.debug(`[index.js] No title extracted for ${config.errorMsg}`);
        }
      }

      // Image
      const imageElement = doc.querySelector(config.imageSelector);
      const targetImage = document.querySelector(config.targetImage);
      if (imageElement && targetImage) {
        const imageSrc = imageElement.src || imageElement.getAttribute('src');
        if (imageSrc) {
          targetImage.src = imageSrc;
          targetImage.alt = imageElement.alt || '';
          console.debug(`[index.js] Synced image for ${config.errorMsg}:`, imageSrc);
        } else {
          console.debug(`[index.js] No image src found for ${config.errorMsg}`);
        }
      }

      // Description
      if (config.descSelector && config.targetDesc) {
        let descElement = doc.querySelector(config.descSelector);
        if (!descElement) descElement = doc.querySelector('p span[style*="font-size:"]');
        if (!descElement) descElement = Array.from(doc.querySelectorAll('p')).find(p => (p.innerText || p.textContent || '').trim().length > 0);
        const targetDesc = document.querySelector(config.targetDesc);
        if (descElement && targetDesc) {
          const descText = descElement.innerText || descElement.textContent || '';
          const trimmedDesc = descText.trim();
          if (trimmedDesc) targetDesc.textContent = trimmedDesc;
          console.debug(`[index.js] Synced desc for ${config.errorMsg}:`, trimmedDesc);
        } else {
          console.debug(`[index.js] No description found for ${config.errorMsg}`);
        }
      }
      return true;
    } catch (error) {
      console.error(`Error syncing ${config.errorMsg}:`, error);
      return false;
    }
  }

  async function syncContentWithRetry(config, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      const success = await updateContent(config);
      if (success) return true;
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false;
  }

  function initRealTimeSync() {
    contentConfig.forEach(config => { syncContentWithRetry(config); });
    const syncInterval = setInterval(() => {
      contentConfig.forEach(config => { syncContentWithRetry(config); });
    }, 5000);
    window.addEventListener('beforeunload', () => { clearInterval(syncInterval); });
  }

  initRealTimeSync();
});
