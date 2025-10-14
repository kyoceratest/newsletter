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

  // Initialize blurred backdrops and smart-fit for existing base tiles in index.html
  try {
    const baseTileImgs = document.querySelectorAll('.cards-grid.kyo-tiles:not(.dynamic-articles) .kyo-tile-media img');
    baseTileImgs.forEach(img => {
      const link = img.closest('.kyo-tile-media');
      if (!link) return;
      const apply = () => {
        try {
          const src = img.currentSrc || img.src || '';
          if (src) link.style.setProperty('--tile-bg', `url("${src}")`);
          const nw = img.naturalWidth || 0;
          const nh = img.naturalHeight || 0;
          if (nw && nh) {
            const ratio = nw / nh;
            const target = 16 / 9;
            const diff = Math.abs(ratio - target);
            if (diff < 0.1) {
              link.classList.remove('fit-contain');
              link.classList.add('fit-cover');
            } else {
              link.classList.remove('fit-cover');
              link.classList.add('fit-contain');
            }
          }
        } catch (_) { /* ignore */ }
      };
      if (img.complete) {
        // If the image is already loaded, apply immediately
        apply();
      } else {
        img.addEventListener('load', apply, { once: true });
      }
    });
  } catch (_) { /* no-op */ }

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
  // Configure the starting synced content (video or article)
  // Example values:
  //   'TypeNews/edito/video1.html' (video)
  //   'TypeNews/animation/article1.html' (article)
  const START_SOURCE = 'TypeNews/edito/video1.html';
  const contentConfig = [
    {
      source: START_SOURCE,
      titleSelector: 'h1, h2, h3',
      imageSelector: 'img',
      // Hero résumé follows the 22px "Résumé" style from the editor
      descSelector: 'p span[style*="font-size: 22px"]',
      targetTitle: '.title-accent',
      targetImage: '.newsletter-hero img', // hero image now synced with edito/article1.html
      targetDesc: '.lead',
      errorMsg: 'Hero (TypeNews/edito/video1)'
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

  // Resolve relative URL against a base
  function resolveUrl(rel, baseHref) {
    try { return new URL(rel, baseHref).href; } catch { return rel; }
  }

  // Capture a frame from a same-origin video as data URL
  async function captureFrameFromVideo(videoUrl, seekTime = 0.1, width = 800) {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        // crossOrigin only if same-origin or server allows it; otherwise omit to avoid tainting
        // video.crossOrigin = 'anonymous';

        const onError = () => resolve('');
        video.addEventListener('error', onError, { once: true });
        video.addEventListener('loadeddata', () => {
          try {
            // Set target size
            const ratio = video.videoWidth / (video.videoHeight || 1);
            const targetW = width;
            const targetH = Math.max(1, Math.round(width / (ratio || 1)));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;

            const seekAndDraw = () => {
              try {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, targetW, targetH);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
                resolve(dataUrl || '');
              } catch {
                resolve('');
              }
            };

            // Try to seek slightly into the video for a non-black frame
            if (!isNaN(seekTime) && video.seekable && video.seekable.length > 0) {
              try {
                video.currentTime = Math.min(seekTime, video.seekable.end(0) || seekTime);
                video.addEventListener('seeked', seekAndDraw, { once: true });
              } catch {
                // Fallback: draw immediately
                seekAndDraw();
              }
            } else {
              seekAndDraw();
            }
          } catch {
            resolve('');
          }
        }, { once: true });

        // Safety timeout
        setTimeout(() => resolve(''), 2000);
      } catch {
        resolve('');
      }
    });
  }

  // Extract best thumbnail/image from a document (img > video poster > YouTube > Vimeo)
  async function getBestImageFromDoc(doc, sourceUrl) {
    const baseUrl = new URL(sourceUrl, window.location.href);
    // 1) First <img>
    const imgEl = doc.querySelector('img');
    if (imgEl) {
      const src = imgEl.getAttribute('src') || imgEl.src;
      if (src) return resolveUrl(src, baseUrl);
    }
    // 2) <video poster="...">
    const videoEl = doc.querySelector('video[poster]');
    if (videoEl) {
      const poster = videoEl.getAttribute('poster');
      if (poster) return resolveUrl(poster, baseUrl);
    }
    // 2b) <video src="..."> without poster: try capture a frame (same-origin only)
    const videoNoPoster = doc.querySelector('video[src]');
    if (videoNoPoster) {
      const vSrc = videoNoPoster.getAttribute('src');
      if (vSrc) {
        if (/^blob:/i.test(vSrc)) {
          console.debug('[index.js] Skipping blob: video src; rely on poster generated at save time.');
        } else {
          const abs = resolveUrl(vSrc, baseUrl);
          const frame = await captureFrameFromVideo(abs);
          if (frame) return frame;
        }
      }
    }
    // 2c) <video><source src="..."></video> without poster
    const videoSource = doc.querySelector('video source[src]');
    if (videoSource) {
      const sSrc = videoSource.getAttribute('src');
      if (sSrc) {
        // Ignore blob: URLs (not resolvable across documents)
        if (/^blob:/i.test(sSrc)) {
          console.debug('[index.js] Skipping blob: video source; please add a poster attribute for hero/grid thumbnail.');
        } else {
          const abs = resolveUrl(sSrc, baseUrl);
          const frame = await captureFrameFromVideo(abs);
          if (frame) return frame;
        }
      }
    }
    // 3) YouTube (iframe or link)
    const ytIframe = doc.querySelector('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    const ytLink = doc.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]');
    let ytUrl = ytIframe ? ytIframe.getAttribute('src') : (ytLink ? ytLink.getAttribute('href') : '');
    if (ytUrl) {
      try {
        const u = new URL(ytUrl, baseUrl);
        // Extract ID from common formats
        // https://www.youtube.com/watch?v=ID or youtu.be/ID or /embed/ID
        let id = u.searchParams.get('v');
        if (!id) {
          const m = u.pathname.match(/(?:\/embed\/|\/shorts\/|\/)([A-Za-z0-9_-]{6,})/);
          if (m && m[1]) id = m[1];
        }
        if (id) {
          // Try maxres, clients fall back visually if 404; we keep single URL
          return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
        }
      } catch { /* ignore */ }
    }
    // 4) Vimeo (iframe or link) via public oEmbed
    const viIframe = doc.querySelector('iframe[src*="vimeo.com"]');
    const viLink = doc.querySelector('a[href*="vimeo.com"]');
    let viUrl = viIframe ? viIframe.getAttribute('src') : (viLink ? viLink.getAttribute('href') : '');
    if (viUrl) {
      try {
        const absolute = new URL(viUrl, baseUrl).href;
        const oembed = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(absolute)}`);
        if (oembed.ok) {
          const data = await oembed.json();
          if (data.thumbnail_url) return data.thumbnail_url;
        }
      } catch { /* ignore */ }
    }
    return '';
  }

  async function updateContent(config) {
    try {
      const response = await fetch(`${config.source}?t=${Date.now()}`);
      // If the source file does not exist, disable future sync attempts for this config
      if (!response.ok) {
        if (response.status === 404) {
          // Mark this config as disabled to stop further retries/interval syncs
          config._disabled = true;
          console.debug(`[index.js] Source not found (404). Disabling sync for: ${config.errorMsg} -> ${config.source}`);
          return true; // treat as non-fatal so retry loop won't re-run
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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

      // Image (with video/URL fallbacks)
      const targetImage = document.querySelector(config.targetImage);
      if (targetImage) {
        const best = await getBestImageFromDoc(doc, config.source);
        if (best) {
          targetImage.src = best;
          // Try to set alt from first img if available
          const imgEl = doc.querySelector('img');
          targetImage.alt = (imgEl && (imgEl.getAttribute('alt') || '')) || '';
          // Make hero image load eagerly with higher priority
          try {
            targetImage.removeAttribute('loading');
            targetImage.decoding = 'async';
            targetImage.setAttribute('fetchpriority', 'high');
          } catch (_) { /* no-op */ }
          console.debug(`[index.js] Synced hero media for ${config.errorMsg}:`, best);
          // Also sync the hero anchor to newsletter page with article param (short code)
          const heroAnchor = targetImage.closest('a');
          if (heroAnchor) {
            // Build short code like "article1_animation" or "video1_edito" from path
            try {
              const srcPath = config.source || '';
              // Expecting pattern TypeNews/<folder>/<file>.html
              const m = srcPath.match(/^\s*TypeNews\/([^\/]+)\/([^\/?#]+)\.(html?)\s*$/i);
              let shortCode = '';
              if (m) {
                const folder = m[1];
                const filename = m[2];
                shortCode = `${filename}_${folder}`;
              } else {
                // Fallback to encoding full path if pattern doesn't match
                shortCode = srcPath;
              }
              const param = encodeURIComponent(shortCode);
              heroAnchor.href = `newsletter.html?article=${param}`;
            } catch (_) {
              const param = encodeURIComponent(config.source || '');
              heroAnchor.href = `newsletter.html?article=${param}`;
            }
          }
        } else {
          console.debug(`[index.js] No media found for ${config.errorMsg}`);
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
      // Downgrade to debug to reduce console noise; retry loop will handle transient issues
      console.debug(`Error syncing ${config.errorMsg}:`, error);
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
    // Initial run
    contentConfig.forEach(config => { syncContentWithRetry(config); });
    // Periodic re-sync only for active (not disabled) configs
    const syncInterval = setInterval(() => {
      contentConfig
        .filter(cfg => !cfg._disabled)
        .forEach(cfg => { syncContentWithRetry(cfg); });
    }, 5000);
    window.addEventListener('beforeunload', () => { clearInterval(syncInterval); });
  }

  initRealTimeSync();

  // =============================
  // Dynamic articles from TypeNews
  // =============================
  // Discover pages named article*.html under each TypeNews category and append
  // them as additional tiles to the existing grid. This keeps the hero and the
  // initial three tiles intact while adding more content below.
  // Include all existing TypeNews categories found in the repo
  const categories = [
    'animation',
    'branding',
    'com_actus',
    'edito',
    'formations',
    'outils_astuces',
    'solutions_insights',
    'zoom_matériel'
  ];

  function buildTile({ href, imgSrc, imgAlt, title, desc }) {
    const article = document.createElement('article');
    article.className = 'kyo-tile';

    const link = document.createElement('a');
    link.className = 'kyo-tile-media';
    // Prefer routing through newsletter page using short code
    try {
      if (href && /^\s*TypeNews\//i.test(href)) {
        // Expect TypeNews/<folder>/<file>.html
        const m = href.match(/^\s*TypeNews\/([^\/]+)\/([^\/?#]+)\.(html?)\s*$/i);
        if (m) {
          const folder = m[1];
          const filename = m[2];
          const shortCode = `${filename}_${folder}`;
          link.href = `newsletter.html?article=${encodeURIComponent(shortCode)}`;
        } else {
          link.href = href;
        }
      } else {
        link.href = href || '#';
      }
    } catch (_) {
      link.href = href || '#';
    }

    const img = document.createElement('img');
    if (imgSrc) img.src = imgSrc;
    if (imgAlt) img.alt = imgAlt;
    // Provide the blurred backdrop image via CSS variable
    if (imgSrc) {
      try { link.style.setProperty('--tile-bg', `url("${imgSrc}")`); } catch (_) { /* no-op */ }
    }
    // Performance hints for grid images
    try {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('fetchpriority', 'low');
      // Provide intrinsic dimensions to reduce layout shifts (16:9)
      img.width = 1280; // intrinsic, not CSS size
      img.height = 720;
      // Responsive sizes hint; browser will pick appropriate resource even without srcset
      img.sizes = '(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 100vw';
    } catch (_) { /* no-op */ }

    // Smart-fit: if the intrinsic ratio is close to 16:9, use cover (no bars); otherwise keep contain
    img.addEventListener('load', () => {
      try {
        // Ensure backdrop uses the final resolved src
        try { link.style.setProperty('--tile-bg', `url("${img.currentSrc || img.src}")`); } catch (_) {}
        const nw = img.naturalWidth || 0;
        const nh = img.naturalHeight || 0;
        if (!nw || !nh) return;
        const ratio = nw / nh;
        const target = 16 / 9;
        const diff = Math.abs(ratio - target);
        // Tolerance ~6% difference
        if (diff < 0.1) {
          link.classList.remove('fit-contain');
          link.classList.add('fit-cover');
        } else {
          link.classList.remove('fit-cover');
          link.classList.add('fit-contain');
        }
      } catch (_) { /* ignore */ }
    });
    link.appendChild(img);


    const body = document.createElement('div');
    body.className = 'kyo-tile-body';
    const h3 = document.createElement('h3');
    h3.textContent = title || '';
    const p = document.createElement('p');
    p.textContent = desc || '';
    body.appendChild(h3);
    body.appendChild(p);

    article.appendChild(link);
    article.appendChild(body);
    return article;
  }

  function extractResumeFromDoc(doc) {
    // 1) Any element with inline 22px (not limited to <p>), excluding headers and elements under 52px title
    const candidates22 = doc.querySelectorAll('[style*="font-size: 22px"], [style*="font-size:22px"]');
    for (const el of candidates22) {
      if (el.closest('[style*="font-size: 52px"], [style*="font-size:52px"], h1, h2, h3')) continue;
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    // 2) Any inline font-size span
    const anyFs = doc.querySelectorAll('[style*="font-size:"]');
    for (const el of anyFs) {
      if (el.closest('[style*="font-size: 52px"], [style*="font-size:52px"], h1, h2, h3')) continue;
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    // 3) First non-empty paragraph
    const p = Array.from(doc.querySelectorAll('p')).find(x => ((x.innerText || x.textContent || '').replace(/\s+/g, ' ').trim().length > 0));
    return p ? (p.innerText || p.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  async function probeArticle(url) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (!res.ok) return null;
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const title = extractTitleFromDoc(doc, 'h1, h2, h3');
      const descText = extractResumeFromDoc(doc);
      // Grid tiles must use an actual <img>. If none, skip this article (prevents video-only pages in grid)
      const imgEl = doc.querySelector('img');
      if (!imgEl) return null;
      const baseUrl = new URL(url, window.location.href);
      const rawSrc = imgEl.getAttribute('src') || imgEl.src || '';
      const imgSrc = rawSrc ? new URL(rawSrc, baseUrl).href : '';
      const imgAlt = (imgEl.getAttribute && imgEl.getAttribute('alt')) || '';
      const desc = descText || '';
      return { title, imgSrc, imgAlt, desc };
    } catch (e) {
      return null;
    }
  }

  async function loadTypeNewsArticles(maxPerCategory = 5) {
    const baseGrid = document.querySelector('.cards-grid.kyo-tiles');
    if (!baseGrid) return;
    // Create a separate centered section for dynamic articles ("second column/section")
    let dynGrid = document.querySelector('.cards-grid.kyo-tiles.dynamic-articles');
    if (!dynGrid) {
      dynGrid = document.createElement('section');
      dynGrid.className = 'cards-grid kyo-tiles dynamic-articles';
      // Insert right after the existing grid
      baseGrid.parentNode.insertBefore(dynGrid, baseGrid.nextSibling);
    }
    for (const cat of categories) {
      // Allow gaps in numbering: skip missing ones, and stop only after consecutive misses
      let consecutiveMisses = 0;
      // edito/article1.html is known to be absent in this repo; start at 2 for 'edito' to avoid 404
      const startIndex = (cat === 'edito') ? 2 : 1;
      for (let i = startIndex; i <= maxPerCategory; i++) {
        const url = `TypeNews/${cat}/article${i}.html`;
        // Skip the hero source to avoid duplication in the grid
        if (url === 'TypeNews/edito/video1.html') { continue; }
        const data = await probeArticle(url);
        if (data) {
          const tile = buildTile({ href: url, imgSrc: data.imgSrc, imgAlt: data.imgAlt, title: data.title, desc: data.desc });
          dynGrid.appendChild(tile);
          consecutiveMisses = 0; // reset on success
        } else {
          // Skip this number but don't stop the whole category unless repeated misses
          consecutiveMisses++;
          if (consecutiveMisses >= 2) {
            break;
          }
          continue;
        }
      }
    }
  }

  loadTypeNewsArticles();
});
