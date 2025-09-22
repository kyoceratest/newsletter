// index.js
// Extracted from index.html to keep JS separate. On-screen text remains French; code/comments in English.

// Header hamburger toggle
document.addEventListener('DOMContentLoaded', function () {
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
      targetImage: '.newsletter-hero img',
      targetDesc: '.lead',
      errorMsg: 'teteSuperieure (Main Title)'
    },
    {
      source: 'contenuDeGauche.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) h3',
      targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) img',
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) p',
      errorMsg: 'contenuDeGauche (First Tile)'
    },
    {
      source: 'contenuCentral.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) h3',
      targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) img',
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) p',
      errorMsg: 'contenuCentral (Second Tile)'
    },
    {
      source: 'contenuDeDroite.html',
      titleSelector: 'h2, h3',
      imageSelector: 'img',
      descSelector: 'p span[style*="font-size: 14px"]',
      targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) h3',
      targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) img',
      targetDesc: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) p',
      errorMsg: 'contenuDeDroite (Third Tile)'
    }
  ];

  async function updateContent(config) {
    try {
      const response = await fetch(`${config.source}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Title
      const titleElement = doc.querySelector(config.titleSelector);
      const targetTitle = document.querySelector(config.targetTitle);
      if (titleElement && targetTitle) {
        const titleText = titleElement.innerText || titleElement.textContent || '';
        const trimmedText = titleText.trim();
        if (trimmedText) targetTitle.textContent = trimmedText;
      }

      // Image
      const imageElement = doc.querySelector(config.imageSelector);
      const targetImage = document.querySelector(config.targetImage);
      if (imageElement && targetImage) {
        const imageSrc = imageElement.src || imageElement.getAttribute('src');
        if (imageSrc) {
          targetImage.src = imageSrc;
          targetImage.alt = imageElement.alt || '';
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
