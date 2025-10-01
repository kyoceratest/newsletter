// newsletter.js
// Extracted from newsletter.html to keep JS separate and match hosted/local behavior.
// On-screen text remains French; code and comments are in English.

// Minimal JS to keep menu/search behavior consistent with index.html
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

// Loader for content1-4 into main content area
document.addEventListener('DOMContentLoaded', function () {
    const selectEl = document.getElementById('contentSelect');
    const statusEl = document.getElementById('contentStatus');
    const targetEl = document.getElementById('loadedContent');
    
    // Helper to read URL query parameters
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // Extract a title, prioritizing an element styled with font-size: 52px
    function extractTitleFromDoc(doc) {
        const getText = (node) => (node && (node.innerText || node.textContent) || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();

        // Helper: determine if a node is media-only or contains media fallback text we should ignore
        const isMediaLike = (el, txt) => {
            if (!el) return false;
            // If it directly contains media, we ignore it as a title candidate
            if (el.querySelector && el.querySelector('video, audio, iframe, img')) return true;
            const low = (txt || '').toLowerCase();
            // Common browser fallback for <video>
            if (low.includes('votre navigateur ne supporte pas la vidéo')) return true;
            return false;
        };

        // 1) Prefer any element with inline 52px style (case/spacing tolerant).
        //    Choose the FIRST valid candidate in document order, not the longest text.
        const styleCandidates = Array.from(
            doc.querySelectorAll('[style*="font-size:52px" i], [style*="font-size: 52px" i]')
        );
        for (const n of styleCandidates) {
            const t = getText(n);
            if (t && t.length >= 3 && !isMediaLike(n, t)) {
                return t;
            }
        }

        // 2) Elements marked by class names used in our CSS/editor
        const classEl = doc.querySelector('.sujette-title, .font-size-52');
        const classTxt = getText(classEl);
        if (classTxt && !isMediaLike(classEl, classTxt)) return classTxt;

        // 3) Legacy <font size="7">
        const fontEl = doc.querySelector('font[size="7"]');
        const fontTxt = getText(fontEl);
        if (fontTxt && !isMediaLike(fontEl, fontTxt)) return fontTxt;

        // 4) Fallback to the first headline
        const hEl = doc.querySelector('h1, h2, h3');
        const hTxt = getText(hEl);
        if (hTxt && !isMediaLike(hEl, hTxt)) return hTxt;

        return '';
    }

    // Sync dropdown option labels with extracted titles from content files
    async function syncDropdownLabels() {
        if (!selectEl) return;
        const opts = Array.from(selectEl.options).filter(o => o.value && o.value.endsWith('.html'));
        const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const extractFromRawHtml = (raw) => {
            // Look for any tag with inline style containing font-size: 52px and capture inner HTML
            const rx = /<([a-z0-9]+)[^>]*style[^>]*font-size\s*:\s*52px[^>]*>([\s\S]*?)<\/\1>/i;
            const m = raw.match(rx);
            if (m && m[2]) {
                // If the 52px block contains media tags, ignore it
                if (!/<\s*(video|audio|iframe|img)[\s>]/i.test(m[2])) {
                    const txt = stripHtml(m[2]);
                    const low = (txt || '').toLowerCase();
                    if (txt && txt.length >= 3 && !low.includes('votre navigateur ne supporte pas la vidéo')) return txt;
                }
            }
            // Fallback to first h1/h2/h3 in raw
            const h = raw.match(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/i);
            if (h && h[2]) {
                const txt = stripHtml(h[2]);
                if (txt && txt.length >= 3) return txt;
            }
            return '';
        };
        for (const opt of opts) {
            try {
                let syncFile = opt.value;
                if (syncFile === 'contenuDeGauche.html' || syncFile === 'teteSuperieure.html' || syncFile === 'contenuCentral.html' || syncFile === 'contenuDeDroite.html') {
                    const res = await fetch(`${syncFile}?t=${Date.now()}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const html = await res.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    let title = extractTitleFromDoc(doc);
                    if (!title) title = extractFromRawHtml(html);
                    if (title) opt.textContent = title;
                }
            } catch (e) {
                console.warn('Label sync failed for', opt.value, e);
            }
        }
    }

    // 1) Load content immediately based on URL parameter (so links from index.html show content directly)
    if (selectEl) {
        const page = getUrlParameter('page');
        let contentFile = '';
        if (page) {
            switch(page) {
                case '1':
                    contentFile = 'teteSuperieure.html'; // Tête supérieure
                    break;
                case '2':
                    contentFile = 'contenuDeGauche.html'; // Contenu de gauche
                    break;
                case '3':
                    contentFile = 'contenuCentral.html'; // Contenu central
                    break;
                case '4':
                    contentFile = 'contenuDeDroite.html'; // Contenu de droite
                    break;
                default:
                    contentFile = '';
            }
            if (contentFile) {
                // Set the dropdown to the selected file and load immediately
                selectEl.value = contentFile;
                loadSelected(contentFile);
            }
        }
    }

    // 2) Run label sync in parallel (no need to block initial load)
    syncDropdownLabels().then(() => {
        // After labels sync, keep the dropdown selection consistent if a page was preselected
        if (selectEl) {
            const current = selectEl.value;
            if (current) selectEl.value = current;
        }
    });

    // 2b) Periodically re-sync dropdown labels so they stay up-to-date with content titles
    // This ensures that when an editor updates a section title (e.g., applying 52px style),
    // the dropdown reflects the latest title without a manual refresh.
    let dropdownLabelSyncInterval = null;
    try {
        dropdownLabelSyncInterval = setInterval(() => {
            const current = selectEl ? selectEl.value : '';
            syncDropdownLabels().then(() => {
                // Preserve the current selection after labels update
                if (selectEl && current) selectEl.value = current;
            });
        }, 5000);
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (dropdownLabelSyncInterval) clearInterval(dropdownLabelSyncInterval);
        });
    } catch (_) { /* no-op */ }

    async function loadSelected(path) {
        if (!path) { targetEl.innerHTML = ''; statusEl.textContent = ''; return; }
        statusEl.textContent = 'Chargement...';
        try {
            const res = await fetch(`${path}?t=${Date.now()}`); // cache-buster
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Prefer .newsletter-content if present; otherwise fall back to <body>
            const content = doc.querySelector('.newsletter-content') || doc.body;

            // Build a fragment to sanitize to read-only before injecting
            const wrapper = document.createElement('div');
            wrapper.innerHTML = content ? content.innerHTML : html;

            // Remove any contenteditable capability
            wrapper.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
                el.contentEditable = 'false';
            });

            // Disable form controls so they cannot be changed
            ['input','textarea','select','button'].forEach(sel => {
                wrapper.querySelectorAll(sel).forEach(ctrl => {
                    ctrl.setAttribute('disabled', '');
                    ctrl.setAttribute('tabindex', '-1');
                });
            });

            // Inject sanitized content
            targetEl.innerHTML = '';
            while (wrapper.firstChild) {
                targetEl.appendChild(wrapper.firstChild);
            }

            // Update the page accent title and document title from the loaded document
            try {
                const extracted = extractTitleFromDoc(doc) || '';
                const titleHost = document.querySelector('.title-accent');
                if (titleHost && extracted) {
                    titleHost.textContent = extracted;
                }
                // Keep the browser/tab title in sync for systems that read <title>
                if (extracted) {
                    document.title = extracted;
                }
            } catch (_) {}

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

// Dynamic sync (tiles + hero) for newsletter page
document.addEventListener('DOMContentLoaded', function () {
    // Configuration for content files and their target elements
    const contentConfig = [
        {
            source: 'teteSuperieure.html',
            titleSelector: 'h1, h2, h3',
            imageSelector: 'img',
            targetTitle: '.title-accent',
            targetImage: '.newsletter-hero img',
            errorMsg: 'teteSuperieure (Main Title)'
        },
        {
            source: 'contenuDeGauche.html',
            titleSelector: 'h2, h3',
            imageSelector: 'img',
            targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) h3',
            targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(1) img',
            errorMsg: 'contenuDeGauche (First Tile)'
        },
        {
            source: 'contenuCentral.html',
            titleSelector: 'h2, h3',
            imageSelector: 'img',
            targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) h3',
            targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(2) img',
            errorMsg: 'contenuCentral (Second Tile)'
        },
        {
            source: 'contenuDeDroite.html',
            titleSelector: 'h2, h3',
            imageSelector: 'img',
            targetTitle: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) h3',
            targetImage: '.cards-grid.kyo-tiles .kyo-tile:nth-child(3) img',
            errorMsg: 'contenuDeDroite (Third Tile)'
        }
    ];

    // Function to fetch and update content
    async function updateContent(config) {
        try {
            const response = await fetch(`${config.source}?t=${Date.now()}`); // Cache buster
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Update title if selector exists
            const titleElement = doc.querySelector(config.titleSelector);
            const targetTitle = document.querySelector(config.targetTitle);
            
            if (titleElement && targetTitle) {
                const titleText = titleElement.innerText || titleElement.textContent || '';
                const trimmedText = titleText.trim();
                if (trimmedText) {
                    targetTitle.textContent = trimmedText;
                }
            }
            
            // Update image if selector exists
            const imageElement = doc.querySelector(config.imageSelector);
            const targetImage = document.querySelector(config.targetImage);
            
            if (imageElement && targetImage) {
                const imageSrc = imageElement.src || imageElement.getAttribute('src');
                if (imageSrc) {
                    targetImage.src = imageSrc;
                    targetImage.alt = imageElement.alt || '';
                }
            }
            
            return true;
        } catch (error) {
            console.error(`Error syncing ${config.errorMsg}:`, error);
            return false;
        }
    }

    // Main sync function with retry logic
    async function syncContentWithRetry(config, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            const success = await updateContent(config);
            if (success) return true;
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false;
    }

    // Initialize real-time syncing
    function initRealTimeSync() {
        // Initial sync
        contentConfig.forEach(config => {
            syncContentWithRetry(config);
        });

        // Periodic sync (every 5 seconds)
        const syncInterval = setInterval(() => {
            contentConfig.forEach(config => {
                syncContentWithRetry(config);
            });
        }, 5000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            clearInterval(syncInterval);
        });
    }

    // Start the synchronization
    initRealTimeSync();
});
