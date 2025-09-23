// webinars.js
// Extracted from webinars.html; preserves exact behavior without UI changes.

// Mobile menu toggle
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

// Content loader + label sync (dropdown)
document.addEventListener('DOMContentLoaded', function () {
  const selectEl = document.getElementById('contentSelect');
  const statusEl = document.getElementById('contentStatus');
  const targetEl = document.getElementById('loadedContent');

  function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  function extractTitleFromDoc(doc) {
    let el = doc.querySelector('span[style*="font-size: 52px"], span[style*="font-size:52px"], [style*="font-size: 52px"], [style*="font-size:52px"]');
    if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
    el = doc.querySelector('font[size="7"]');
    if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
    el = doc.querySelector('h1, h2, h3');
    if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
    return '';
  }

  async function syncDropdownLabels() {
    if (!selectEl) return;
    const opts = Array.from(selectEl.options).filter(o => o.value && o.value.endsWith('.html'));
    for (const opt of opts) {
      try {
        let syncFile = opt.value;
        if (syncFile === 'contenuDeGauche.html' || syncFile === 'teteSuperieure.html' || syncFile === 'contenuCentral.html' || syncFile === 'contenuDeDroite.html') {
          const res = await fetch(`${syncFile}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const title = extractTitleFromDoc(doc);
          if (title) opt.textContent = title;
        }
      } catch (e) {
        console.warn('Label sync failed for', opt.value, e);
      }
    }
  }

  // Start sync then load
  syncDropdownLabels().then(() => {
    if (selectEl) {
      const page = getUrlParameter('page');
      let contentFile = '';
      if (page) {
        switch (page) {
          case '1': contentFile = 'teteSuperieure.html'; break;
          case '2': contentFile = 'contenuDeGauche.html'; break;
          case '3': contentFile = 'contenuCentral.html'; break;
          case '4': contentFile = 'contenuDeDroite.html'; break;
          default: contentFile = '';
        }
        if (contentFile) {
          selectEl.value = contentFile;
          loadSelected(contentFile);
        }
      }
    }
  });

  async function loadSelected(path) {
    if (!path) { targetEl.innerHTML = ''; statusEl.textContent = ''; return; }
    statusEl.textContent = 'Chargement...';
    try {
      const res = await fetch(`${path}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const content = doc.querySelector('.newsletter-content') || doc.body;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content ? content.innerHTML : html;
      wrapper.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.contentEditable = 'false';
      });
      ['input','textarea','select','button'].forEach(sel => {
        wrapper.querySelectorAll(sel).forEach(ctrl => {
          ctrl.setAttribute('disabled', '');
          ctrl.setAttribute('tabindex', '-1');
        });
      });
      targetEl.innerHTML = '';
      while (wrapper.firstChild) targetEl.appendChild(wrapper.firstChild);
      statusEl.textContent = '';
    } catch (e) {
      console.error('Load failed:', e);
      statusEl.textContent = 'Erreur de chargement';
    }
  }

  if (selectEl) {
    selectEl.addEventListener('change', (e) => loadSelected(e.target.value));
  }
});

// Dynamic sync of tiles and hero
document.addEventListener('DOMContentLoaded', function () {
  const contentConfig = [
    { source: 'teteSuperieure.html', titleSelector: 'h1, h2, h3', imageSelector: 'img', targetTitle: '.title-accent', targetImage: '.newsletter-hero img', errorMsg: 'teteSuperieure (Main Title)' },
    { source: 'contenuDeGauche.html', titleSelector: 'h2, h3', imageSelector: 'img', targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) h3', targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) img', errorMsg: 'contenuDeGauche (First Tile)' },
    { source: 'contenuCentral.html', titleSelector: 'h2, h3', imageSelector: 'img', targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) h3', targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) img', errorMsg: 'contenuCentral (Second Tile)' },
    { source: 'contenuDeDroite.html', titleSelector: 'h2, h3', imageSelector: 'img', targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) h3', targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) img', errorMsg: 'contenuDeDroite (Third Tile)' }
  ];

  async function updateContent(config) {
    try {
      const response = await fetch(`${config.source}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const titleElement = doc.querySelector(config.titleSelector);
      const targetTitle = document.querySelector(config.targetTitle);
      if (titleElement && targetTitle) {
        const text = (titleElement.innerText || titleElement.textContent || '').trim();
        if (text) targetTitle.textContent = text;
      }
      const imageElement = doc.querySelector(config.imageSelector);
      const targetImage = document.querySelector(config.targetImage);
      if (imageElement && targetImage) {
        const imageSrc = imageElement.src || imageElement.getAttribute('src');
        if (imageSrc) { targetImage.src = imageSrc; targetImage.alt = imageElement.alt || ''; }
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
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
    return false;
  }

  function initRealTimeSync() {
    contentConfig.forEach(config => { syncContentWithRetry(config); });
    const syncInterval = setInterval(() => { contentConfig.forEach(config => { syncContentWithRetry(config); }); }, 5000);
    window.addEventListener('beforeunload', () => { clearInterval(syncInterval); });
  }

  initRealTimeSync();
});
