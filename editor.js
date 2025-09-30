class NewsletterEditor {
    constructor() {
        this.history = [];
        this.currentHistoryIndex = -1;
        this.maxHistorySize = 50;
        this.currentEditingImage = null;
        this.currentImageWrapper = null;
        this.cropOverlay = null;
        this.cropEventHandlers = null;
        this.resizeEventHandlers = null;
        this.imageToolbarInitialized = false;
        this.originalImageWidth = 0;
        this.originalImageHeight = 0;
        this.originalImageSrc = null;
        this.currentTargetContainer = null;
        this.savedSelection = null;
        this.currentEditingSection = null;
        this.currentEditingVideo = null;
        this.currentEditingTable = null;
        this.lastMousePosition = { x: 0, y: 0 };
        this.lastHoveredTableCell = null;
        this.lastClickedTableCell = null;
        // Increment this when autosave schema/behavior changes to avoid restoring stale content
        this.storageVersion = '2';
        // Track last user action for history subtitle
        this.lastAction = 'Contenu modifié';
        this.init();
    }

    init() {
        console.log('NewsletterEditor initializing...');
        this.setupEventListeners();
        this.restoreFromLocalStorage(); // Restore previous content if available
        this.saveState(); // Save initial state
        this.updateLastModified();
        console.log('NewsletterEditor initialized successfully');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Track caret/range within the editor so insertions follow the user's pointer/caret
        const editableHost = document.getElementById('editableContent');
        if (editableHost) {
            const updateRangeFromSelection = () => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const r = sel.getRangeAt(0);
                    // Only persist ranges inside the editor
                    const node = r.startContainer;
                    const host = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
                    if (host && host.closest && host.closest('#editableContent')) {
                        this.lastMouseRange = r.cloneRange();
                    }
                }
            };
            // Update on mouse/key interactions
            editableHost.addEventListener('mouseup', updateRangeFromSelection);
            editableHost.addEventListener('keyup', updateRangeFromSelection);
            editableHost.addEventListener('click', updateRangeFromSelection);

            // Event delegation to re-enable image selection after restore/history load
            editableHost.addEventListener('click', (e) => {
                // Case 1: wrapped image
                const wrapper = e.target && (e.target.closest && e.target.closest('.image-wrapper'));
                if (wrapper) {
                    const img = wrapper.querySelector('img') || wrapper;
                    try { this.selectImage(img); } catch (_) {}
                    return;
                }
                // Case 2: plain <img> without wrapper (e.g., from history or paste)
                const el = e.target;
                if (el && el.tagName === 'IMG') {
                    try { this.selectImage(el); } catch (_) {}
                }
            });
        }

        // Column image placeholder click handler - using gallery section logic
        const columnImagePlaceholder = document.getElementById('columnImagePlaceholder');
        if (columnImagePlaceholder) {
            console.log('Column image placeholder found, adding click handler');
            columnImagePlaceholder.addEventListener('click', (event) => {
                // Prevent parent click handlers from interpreting this as a section click
                try { event.stopPropagation(); } catch (_) {}
                console.log('Column image placeholder clicked');
                // Create hidden file input like gallery section
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                
                // Handle file selection like gallery
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        this.addImageToColumn(file, columnImagePlaceholder);
                    }
                    fileInput.value = '';
                });
                
                fileInput.click();
            });
        } else {
            // Optional placeholder; not an error if missing on this page
            console.debug('columnImagePlaceholder not present on this page');
        }
        
        // Insert Image button
        const insertImageBtn = document.getElementById('insertImageBtn');
        if (insertImageBtn) {
            insertImageBtn.addEventListener('click', () => {
                const options = document.getElementById('imageOptions');
                options.style.display = options.style.display === 'none' ? 'block' : 'none';
            });
        } else {
            console.error('insertImageBtn not found');
        }

        // Local image button
        document.getElementById('localImageBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => this.insertImage(ev.target.result, file.name);
                    reader.readAsDataURL(file);
                }
            };
            input.click();
            document.getElementById('imageOptions').style.display = 'none';
        });

        // URL image button
        document.getElementById('urlImageBtn').addEventListener('click', (e) => {
            // Store the current mouse position when the button is clicked
            this.lastMousePosition = { x: e.clientX, y: e.clientY };
            
            const url = prompt('Entrez l\'URL de l\'image:');
            if (url) {
                this.insertImage(url, 'Image URL');
            }
            document.getElementById('imageOptions').style.display = 'none';
        });

        // Insert Video button
        document.getElementById('insertVideoBtn').addEventListener('click', () => {
            const options = document.getElementById('videoOptions');
            options.style.display = options.style.display === 'none' ? 'block' : 'none';
        });

        // URL video button
        document.getElementById('urlVideoBtn').addEventListener('click', () => {
            // Persist current caret range so insertion follows the caret after prompt
            try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) this.lastMouseRange = sel.getRangeAt(0).cloneRange();
            } catch (_) {}
            const url = prompt('Entrez l\'URL de la vidéo (YouTube, Vimeo, etc.):');
            if (url) {
                this.insertVideo(url);
            }
            document.getElementById('videoOptions').style.display = 'none';
        });

        // Local video button
        document.getElementById('localVideoBtn').addEventListener('click', () => {
            // Persist current caret range so insertion follows the caret after file dialog
            try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) this.lastMouseRange = sel.getRangeAt(0).cloneRange();
            } catch (_) {}
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Use a blob URL to avoid creating massive data URLs that can freeze the page
                    const objectUrl = URL.createObjectURL(file);
                    this.insertLocalVideo(objectUrl, file.name);
                }
            };
            input.click();
            document.getElementById('videoOptions').style.display = 'none';
        });

        // Standardize videos button (apply 70% centered sizing on demand)
        const standardizeBtn = document.getElementById('standardizeVideosBtn');
        if (standardizeBtn) {
            standardizeBtn.addEventListener('click', () => {
                try { this.normalizeVideoStyles(); } catch (_) {}
                const opts = document.getElementById('videoOptions');
                if (opts) opts.style.display = 'none';
            });
        }

        // Insert Table button
        document.getElementById('insertTableBtn').addEventListener('click', () => {
            this.insertTable();
        });

        // Insert Section button
        document.getElementById('insertSectionBtn').addEventListener('click', () => {
            const options = document.getElementById('sectionOptions');
            options.style.display = options.style.display === 'none' ? 'block' : 'none';
        });

        // Section options
        document.getElementById('articleSectionBtn').addEventListener('click', () => {
            this.insertArticleSection();
        });

        document.getElementById('gallerySectionBtn').addEventListener('click', () => {
            this.insertGallerySection();
        });

        document.getElementById('quoteSectionBtn').addEventListener('click', () => {
            this.insertQuoteSection();
        });

        document.getElementById('ctaSectionBtn').addEventListener('click', () => {
            this.insertCTASection();
        });

        document.getElementById('contactSectionBtn').addEventListener('click', () => {
            this.insertContactSection();
        });

        document.getElementById('twoColumnSectionBtn').addEventListener('click', () => {
            this.insertTwoColumnSection();
        });

        // Action buttons
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.redo();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clear();
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.save();
        });

        // History button
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            if (window.__useInlineHistoryModal) {
                console.log('Using inline History modal on this page; editor.js will not wire its own history handler.');
            } else {
                console.log('History button found, adding event listener');
                historyBtn.addEventListener('click', () => {
                    console.log('History button clicked');
                    try {
                        this.showHistory();
                    } catch (error) {
                        console.error('Error in showHistory:', error);
                        alert('Erreur lors de l\'affichage de l\'historique: ' + error.message);
                    }
                });
            }
        } else {
            console.error('historyBtn not found');
        }

        // Rich text toolbar events
        this.setupRichTextToolbar();

        // Table toolbar events
        this.setupTableToolbar();

        // Content change detection
        document.getElementById('editableContent').addEventListener('input', () => {
            this.saveState();
            this.updateLastModified();
            this.autoSaveToLocalStorage(); // Auto-save to localStorage
            // Update last action for history subtitle
            this.lastAction = 'Texte modifié';
            // Re-apply any persisted section background colors to withstand inner HTML rewrites
            try {
                const sectionsWithBg = document.querySelectorAll('.newsletter-section[data-section-bg]');
                sectionsWithBg.forEach(sec => this.reapplySectionBackground(sec));
            } catch (_) { /* no-op */ }
        });

        // Track selection inside editable content to keep toolbar actions working
        const editable = document.getElementById('editableContent');
        editable.addEventListener('mouseup', () => this.saveSelection());
        editable.addEventListener('keyup', () => this.saveSelection());

        // Show Video/Table toolbars on click; Section toolbar shows on Ctrl+Click
        editable.addEventListener('click', (e) => {
            // If clicking the dedicated column image placeholder, do not show the section toolbar.
            // Let the placeholder's own click handler open the file picker.
            try {
                if (e.target && e.target.closest && e.target.closest('#columnImagePlaceholder')) {
                    this.hideSectionToolbar();
                    if (!e.target.closest('#videoToolbar')) this.hideVideoToolbar();
                    if (!e.target.closest('#tableToolbar')) this.hideTableToolbar();
                    return;
                }
            } catch (_) { /* no-op */ }

            // Ctrl+Click to show Section toolbar directly on the clicked section
            // This is an additive shortcut; existing behaviors remain unchanged.
            if (e.ctrlKey) {
                const sectionElCtrl = e.target.closest('.newsletter-section, .gallery-section, .two-column-layout, .syc-item');
                if (sectionElCtrl) {
                    e.preventDefault();
                    this.showSectionToolbar(sectionElCtrl);
                    return;
                }
            }

            // If there is an active text selection (non-collapsed), do NOT show the section toolbar.
            // This avoids the section floating tools appearing while selecting text.
            try {
                const sel = window.getSelection && window.getSelection();
                const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;
                if (hasSelection) {
                    this.hideSectionToolbar();
                    // Also hide other non-text toolbars to reduce interference during selection
                    if (!e.target.closest('#videoToolbar')) this.hideVideoToolbar();
                    if (!e.target.closest('#tableToolbar')) this.hideTableToolbar();
                    return;
                }
            } catch (_) { /* no-op */ }

            const sectionEl = e.target.closest('.newsletter-section, .gallery-section, .two-column-layout, .syc-item');
            const videoEl = e.target.closest('video, iframe');
            const tableEl = e.target.closest('table');

            // Do not show section toolbar on single click anymore; hide if clicking outside any section
            if (!sectionEl) {
                this.hideSectionToolbar();
            }

            if (videoEl) {
                this.showVideoToolbar(videoEl);
            } else if (!e.target.closest('#videoToolbar')) {
                this.hideVideoToolbar();
            }

            if (tableEl) {
                this.showTableToolbar(tableEl);
            } else if (!e.target.closest('#tableToolbar')) {
                this.hideTableToolbar();
            }
        });

        // Removed: double-click to show Section toolbar (replaced by Ctrl+Click shortcut)

        // Track mouse position to insert sections at the pointer
        this.lastMouseRange = null;
        const getRangeFromPoint = (x, y) => {
            const editableEl = document.getElementById('editableContent');
            if (!editableEl) return null;
            const containerRect = editableEl.getBoundingClientRect();
            if (x < containerRect.left || x > containerRect.right || y < containerRect.top || y > containerRect.bottom) {
                return null;
            }

            // Helper to snap a generic (possibly inside child) range to before/after the nearest direct child
            const snapRangeToBlockBoundary = (node) => {
                if (!node) return null;
                let child = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                while (child && child.parentElement !== editableEl) {
                    child = child.parentElement;
                }
                const range = document.createRange();
                if (!child || child === editableEl) {
                    const last = editableEl.lastChild;
                    if (last) range.setStartAfter(last); else range.setStart(editableEl, editableEl.childNodes.length);
                    range.collapse(true);
                    return range;
                }
                const childRect = child.getBoundingClientRect();
                const placeAfter = y > (childRect.top + childRect.height / 2);
                if (placeAfter) range.setStartAfter(child); else range.setStartBefore(child);
                range.collapse(true);
                return range;
            };

            // Try standard caret APIs first, but snap to top-level section boundary
            if (document.caretRangeFromPoint) {
                const r = document.caretRangeFromPoint(x, y);
                if (r) return snapRangeToBlockBoundary(r.startContainer);
            }
            if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(x, y);
                if (pos && pos.offsetNode != null) {
                    return snapRangeToBlockBoundary(pos.offsetNode);
                }
            }

            // Fallback using elementFromPoint
            const target = document.elementFromPoint(x, y);
            if (!target) return null;
            const container = target.closest('#editableContent');
            if (!container) return null;
            return snapRangeToBlockBoundary(target);
        };

        const updateMouseRange = (e) => {
            const r = getRangeFromPoint(e.clientX, e.clientY);
            if (r) {
                this.lastMouseRange = r.cloneRange();
            } else {
                // Fallback: caret at end
                const editableEl = document.getElementById('editableContent');
                const endRange = document.createRange();
                if (editableEl.lastChild) {
                    endRange.setStartAfter(editableEl.lastChild);
                } else {
                    endRange.setStart(editableEl, editableEl.childNodes.length);
                }
                endRange.collapse(true);
                this.lastMouseRange = endRange;
            }
        };

        editable.addEventListener('mousemove', updateMouseRange);
        editable.addEventListener('click', updateMouseRange);
        
        // Track mouse position for table color picker
        document.addEventListener('mousemove', (e) => {
            this.lastMousePosition = { x: e.clientX, y: e.clientY };
            
            // Store the current table cell if hovering over one
            const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            if (elementUnderMouse) {
                const cell = elementUnderMouse.closest('td, th');
                if (cell && cell.closest('table')) {
                    this.lastHoveredTableCell = cell;
                }
            }
        });
        
        // Also capture cell on click for more precision
        document.addEventListener('click', (e) => {
            const elementUnderClick = document.elementFromPoint(e.clientX, e.clientY);
            if (elementUnderClick) {
                const cell = elementUnderClick.closest('td, th');
                if (cell && cell.closest('table')) {
                    this.lastClickedTableCell = cell;
                }
            }
        });
        // While starting a new drag selection inside the editor, hide the toolbar to avoid interference
        editable.addEventListener('mousedown', () => {
            const toolbar = document.getElementById('richTextToolbar');
            if (toolbar) toolbar.style.display = 'none';
            this.hideSectionToolbar();
            this.hideVideoToolbar();
            this.hideTableToolbar();
        });

        // Add keyboard support for deleting selected images
        document.getElementById('editableContent').addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectedElement = range.commonAncestorContainer;
                    
                    // Check if an image or image wrapper is selected
                    let imageWrapper = null;
                    if (selectedElement.nodeType === Node.ELEMENT_NODE) {
                        if (selectedElement.classList && selectedElement.classList.contains('image-wrapper')) {
                            imageWrapper = selectedElement;
                        } else if (selectedElement.tagName === 'IMG') {
                            imageWrapper = selectedElement.closest('.image-wrapper');
                        }
                    } else if (selectedElement.parentElement) {
                        const parent = selectedElement.parentElement;
                        if (parent.classList && parent.classList.contains('image-wrapper')) {
                            imageWrapper = parent;
                        } else if (parent.tagName === 'IMG') {
                            imageWrapper = parent.closest('.image-wrapper');
                        }
                    }
                    
                    if (imageWrapper) {
                        e.preventDefault();
                        if (confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
                            imageWrapper.remove();
                            this.saveState();
                            this.updateLastModified();
                            this.autoSaveToLocalStorage();
                        }
                    }
                }
            }
        });


        // Close modal events
        const closeHistoryModal = document.getElementById('closeHistoryModal');
        if (closeHistoryModal) {
            closeHistoryModal.addEventListener('click', () => {
                const modal = document.getElementById('historyModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        } else {
            console.error('closeHistoryModal not found');
        }

        // Sidebar (mobile) overlay toggle — non-intrusive wiring
        const sidebarHamburger = document.getElementById('sidebarHamburger');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const editorSidebar = document.querySelector('.editor-sidebar');
        if (sidebarHamburger && sidebarOverlay && editorSidebar) {
            const openSidebar = () => {
                editorSidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.classList.add('sidebar-open');
            };
            const closeSidebar = () => {
                editorSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            };

            sidebarHamburger.addEventListener('click', () => {
                // Toggle to allow open/close
                if (editorSidebar.classList.contains('active')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
            sidebarOverlay.addEventListener('click', () => {
                closeSidebar();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeSidebar();
            });
            // On resize to desktop, ensure closed state
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    closeSidebar();
                }
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                document.getElementById('historyModal').style.display = 'none';
            }
            
            // Hide image toolbar when clicking outside of an image or the toolbar
            if (!e.target.closest('#imageToolbar') && 
                e.target.tagName !== 'IMG' && 
                !e.target.closest('.crop-overlay')) {
                this.hideImageEditingTools();
            }

            // Hide section toolbar when clicking outside
            if (!e.target.closest('#sectionToolbar')) {
                if (!e.target.closest('.newsletter-section') && !e.target.closest('.gallery-section') && !e.target.closest('.two-column-layout') && !e.target.closest('.syc-item')) {
                    this.hideSectionToolbar();
                }
            }

            // Webinar toolbar visibility
            const webinarSection = e.target.closest('.cta-section');
            if (webinarSection) {
                this.showWebinarToolbar(webinarSection);
            } else if (!e.target.closest('#webinarToolbar')) {
                this.hideWebinarToolbar();
            }

            // Hide video toolbar when clicking outside
            if (!e.target.closest('#videoToolbar')) {
                if (!e.target.closest('video') && !e.target.closest('iframe')) {
                    this.hideVideoToolbar();
                }
            }

            // Hide table toolbar when clicking outside
            if (!e.target.closest('#tableToolbar')) {
                if (!e.target.closest('table')) {
                    this.hideTableToolbar();
                }
            }

            // Close dropdowns when clicking outside
            const videoDD = document.getElementById('videoSizeOptions');
            const videoBtn = document.getElementById('videoSizeBtn');
            if (videoDD && videoDD.style.display === 'block' && !videoDD.contains(e.target) && !videoBtn.contains(e.target)) {
                videoDD.style.display = 'none';
            }
            const sectionDD = document.getElementById('sectionWidthOptions');
            const sectionBtn = document.getElementById('sectionWidthBtn');
            if (sectionDD && sectionDD.style.display === 'block' && !sectionDD.contains(e.target) && !sectionBtn.contains(e.target)) {
                sectionDD.style.display = 'none';
            }
            const tableBgDD = document.getElementById('tableBgColorDropdownContent');
            const tableBgBtn = document.getElementById('tableBgColorDropdownBtn');
            if (tableBgDD && tableBgDD.style.display === 'block' && !tableBgDD.contains(e.target) && !tableBgBtn.contains(e.target)) {
                tableBgDD.style.display = 'none';
            }
            // Close section background dropdown when clicking outside
            const sectionBgDD = document.getElementById('sectionBgColorDropdownContent');
            const sectionBgBtn = document.getElementById('sectionBgColorDropdownBtn');
            if (sectionBgDD && sectionBgDD.style.display === 'block' && !sectionBgDD.contains(e.target) && !sectionBgBtn.contains(e.target)) {
                sectionBgDD.style.display = 'none';
            }
        });
    }
    
    // Apply image positioning modes from the image toolbar
    setImagePosition(mode) {
        if (!this.currentEditingImage) return;
        // Ensure we have a wrapper around the image, consistent with other tools
        let wrapper = this.currentEditingImage.closest('.image-wrapper');
        if (!wrapper) {
            // Reuse the logic from addResizeHandlesToImage to create a wrapper if missing
            wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            wrapper.style.cssText = 'position: relative; display: inline-block; margin: 10px 0;';
            const img = this.currentEditingImage;
            if (img.parentNode) {
                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            } else {
                // Fallback: append to editable area
                const host = document.getElementById('editableContent');
                if (host) { host.appendChild(wrapper); wrapper.appendChild(img); }
            }
        }
        
        // Remove previous positioning classes
        ['position-absolute', 'float-left', 'float-right', 'position-inline'].forEach(cls => {
            wrapper.classList.remove(cls);
        });
        
        // Reset inline positioning styles when switching modes
        wrapper.style.position = wrapper.style.position || 'relative';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.right = '';
        wrapper.style.bottom = '';
        wrapper.style.margin = wrapper.style.margin || '10px 0';
        
        const img = this.currentEditingImage;

        if (mode === 'absolute') {
            // Absolute positioning relative to the nearest positioned ancestor
            wrapper.classList.add('position-absolute');
            // Keep image filling the wrapper bounds for absolute drag sizing
            img.style.display = 'block';
            img.style.position = 'static';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.objectFit = '';
            // Choose positioning container: gallery image square or the main editable area
            let container = wrapper.parentElement;
            if (container) {
                const candidate = container.closest('.gallery-image-container');
                if (candidate) container = candidate; else container = document.getElementById('editableContent') || container;
            } else {
                container = document.getElementById('editableContent');
            }
            try {
                const crect = container.getBoundingClientRect();
                const mx = (this.lastMousePosition && this.lastMousePosition.x) || crect.left + 10;
                const my = (this.lastMousePosition && this.lastMousePosition.y) || crect.top + 10;
                const left = Math.max(0, mx - crect.left - (wrapper.offsetWidth / 2));
                const top = Math.max(0, my - crect.top - (wrapper.offsetHeight / 2));
                wrapper.style.left = left + 'px';
                wrapper.style.top = top + 'px';
            } catch (_) { /* no-op */ }
            // Enable bounded dragging within the container
            this.enableAbsoluteDrag(wrapper);
        } else if (mode === 'float-left') {
            wrapper.classList.add('float-left');
            // Ensure normal flow
            wrapper.style.position = 'relative';
            // Reset gallery absolute image styles so float takes effect
            img.style.display = '';
            img.style.position = '';
            img.style.width = '';
            img.style.height = '';
            img.style.objectFit = '';
        } else if (mode === 'float-right') {
            wrapper.classList.add('float-right');
            wrapper.style.position = 'relative';
            img.style.display = '';
            img.style.position = '';
            img.style.width = '';
            img.style.height = '';
            img.style.objectFit = '';
        } else {
            // Default to inline (centered block)
            wrapper.classList.add('position-inline');
            wrapper.style.position = 'relative';
            img.style.display = 'block';
            img.style.position = '';
            img.style.width = '';
            img.style.height = '';
            img.style.objectFit = '';
        }
        
        // Update state and keep handles in sync
        this.removeResizeHandles();
        this.addResizeHandlesToImage(this.currentEditingImage);
        this.saveState();
        this.lastAction = 'Position de l\'image modifiée';
    }

    // Make an absolutely positioned image wrapper draggable within its parent container bounds
    enableAbsoluteDrag(wrapper) {
        try {
            const container = wrapper.parentElement && (wrapper.parentElement.closest('.gallery-image-container') || wrapper.parentElement.closest('#editableContent') || wrapper.parentElement);
            if (!container) return;
            const onMouseDown = (e) => {
                if (!wrapper.classList.contains('position-absolute')) return;
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const rect = wrapper.getBoundingClientRect();
                const contRect = container.getBoundingClientRect();
                const offsetLeft = rect.left - contRect.left;
                const offsetTop = rect.top - contRect.top;
                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    let newLeft = offsetLeft + dx;
                    let newTop = offsetTop + dy;
                    // Constrain within container
                    newLeft = Math.max(0, Math.min(newLeft, contRect.width - rect.width));
                    newTop = Math.max(0, Math.min(newTop, contRect.height - rect.height));
                    wrapper.style.left = newLeft + 'px';
                    wrapper.style.top = newTop + 'px';
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    // Persist move
                    try { this.saveState(); this.lastAction = 'Image déplacée'; } catch (_) {}
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            // Avoid stacking multiple listeners
            wrapper.removeEventListener('mousedown', wrapper.__absDragHandler);
            wrapper.__absDragHandler = onMouseDown;
            wrapper.addEventListener('mousedown', onMouseDown);
        } catch (_) { /* no-op */ }
    }

    setupRichTextToolbar() {
        const toolbar = document.getElementById('richTextToolbar');
        const editable = document.getElementById('editableContent');

        const isSelectionInEditable = () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;
            const container = sel.getRangeAt(0).commonAncestorContainer;
            const node = container.nodeType === Node.ELEMENT_NODE ? container : container.parentNode;
            return editable.contains(node);
        };
        const isActiveInToolbar = () => {
            const active = document.activeElement;
            return active && toolbar.contains(active);
        };
        let isInteractingWithToolbar = false;

        const execWithRestore = (command, showUi = false, value = null) => {
            // Ensure the editable retains focus so execCommand targets it
            if (editable) {
                editable.focus();
            }
            this.restoreSelection();
            document.execCommand(command, showUi, value);
            this.saveSelection();
        };

        // Prefer styling with CSS spans instead of deprecated <font>
        try {
            document.execCommand('styleWithCSS', false, true);
        } catch (_) {}
        
        // Keep selection when interacting with toolbar UI, but allow native controls (select/input)
        toolbar.addEventListener('mousedown', (e) => {
            // Guard window selectionchange race when clicking toolbar controls
            isInteractingWithToolbar = true;
            setTimeout(() => { isInteractingWithToolbar = false; }, 300);
            const target = e.target;
            const tag = target.tagName;
            const isFormControl = tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' ||
                target.closest('select') || target.closest('input') || target.closest('textarea');
            if (isFormControl) {
                // Keep focus on the select so the dropdown stays open
                target.focus();
                return; // allow native dropdowns like font size to open
            }
            // Prevent focus shift for non-form controls to preserve selection
            e.preventDefault();
        });

        // Don’t steal focus on toolbar click; just restore selection before executing actions in handlers
        toolbar.addEventListener('click', (e) => {
            // If clicking within toolbar but not a form control, keep editor selection
            const target = e.target;
            if (!(target.tagName === 'SELECT' || target.closest('select'))) {
                this.restoreSelection();
            }
        });

        // Font family
        document.getElementById('fontFamily').addEventListener('change', (e) => {
            execWithRestore('fontName', false, e.target.value);
        });

        // Font size handlers — apply on both change and click (when value may not change)
        const applyFontSize = (fontSize) => {
            if (editable) editable.focus();
            this.restoreSelection();
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);

            // If collapsed selection, apply to the nearest block so one click works
            if (selection.isCollapsed) {
                let node = range.startContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                const targetEl = node && node.closest && node.closest('h1,h2,h3,h4,h5,h6,p,div,span');
                if (targetEl) {
                    if (fontSize === '52') {
                        targetEl.style.fontSize = '52px';
                        targetEl.style.lineHeight = '1.2';
                        targetEl.style.fontWeight = 'bold';
                    } else {
                        targetEl.style.fontSize = fontSize + 'px';
                    }
                    this.saveSelection();
                    this.saveState();
                    return;
                }
            }

            if (fontSize === '52') {
                try {
                    document.execCommand('removeFormat');
                    const span = document.createElement('span');
                    span.style.fontSize = '52px';
                    span.style.lineHeight = '1.2';
                    span.style.fontWeight = 'bold';
                    span.appendChild(range.extractContents());
                    range.insertNode(span);
                    const newRange = document.createRange();
                    newRange.selectNodeContents(span);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    this.saveSelection();
                    this.saveState();
                } catch (ex) {
                    console.error('Error applying Sujette style:', ex);
                }
            } else {
                try {
                    const span = document.createElement('span');
                    span.style.fontSize = fontSize + 'px';
                    span.appendChild(range.extractContents());
                    range.insertNode(span);
                    const newRange = document.createRange();
                    newRange.selectNodeContents(span);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    this.saveSelection();
                    this.saveState();
                } catch (ex) {
                    console.error('Error applying font size:', ex);
                }
            }
        };

        const fontSizeSelect = document.getElementById('fontSize');
        // Apply size on change and on mouseup (so users who click-and-hold then release still apply)
        fontSizeSelect.addEventListener('change', (e) => applyFontSize(e.target.value));
        fontSizeSelect.addEventListener('mouseup', (e) => applyFontSize(e.target.value));

        // Line height handlers — similar behavior to font size
        const applyLineHeight = (lh) => {
            if (!lh) return; // ignore placeholder option
            if (editable) editable.focus();
            this.restoreSelection();
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);

            // If collapsed, apply to nearest block element
            if (selection.isCollapsed) {
                let node = range.startContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                const targetEl = node && node.closest && node.closest('h1,h2,h3,h4,h5,h6,p,div,span,li');
                if (targetEl) {
                    targetEl.style.lineHeight = lh;
                    this.saveSelection();
                    this.saveState();
                    return;
                }
            }

            // Non-collapsed: wrap selection in span to apply line-height
            try {
                const span = document.createElement('span');
                span.style.lineHeight = lh;
                span.appendChild(range.extractContents());
                range.insertNode(span);
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.removeAllRanges();
                selection.addRange(newRange);
                this.saveSelection();
                this.saveState();
            } catch (ex) {
                console.error('Error applying line height:', ex);
            }
        };

        const lineHeightSelect = document.getElementById('lineHeight');
        if (lineHeightSelect) {
            lineHeightSelect.addEventListener('change', (e) => applyLineHeight(e.target.value));
            lineHeightSelect.addEventListener('mouseup', (e) => applyLineHeight(e.target.value));
        }

        // Text formatting buttons
        document.getElementById('boldBtn').addEventListener('click', () => {
            execWithRestore('bold');
        });

        document.getElementById('italicBtn').addEventListener('click', () => {
            execWithRestore('italic');
        });

        document.getElementById('underlineBtn').addEventListener('click', () => {
            execWithRestore('underline');
        });

        document.getElementById('strikeBtn').addEventListener('click', () => {
            execWithRestore('strikeThrough');
        });

        // Color pickers
        const textColorPickerEl = document.getElementById('textColorPicker');
        if (textColorPickerEl) {
            textColorPickerEl.addEventListener('input', (e) => {
                execWithRestore('foreColor', false, e.target.value);
                const ic = document.querySelector('#textColorDropdownBtn i');
                if (ic) ic.style.color = e.target.value;
            });
        }

        const bgColorPickerEl = document.getElementById('bgColorPicker');
        if (bgColorPickerEl) {
            bgColorPickerEl.addEventListener('input', (e) => {
                const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
                execWithRestore(bgCmd, false, e.target.value);
                const ic = document.querySelector('#bgColorDropdownBtn i');
                if (ic) ic.style.backgroundColor = e.target.value;
            });
        }

        // Color palettes
        document.getElementById('textColorPalette').addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                execWithRestore('foreColor', false, color);
                const p = document.getElementById('textColorPicker'); if (p) p.value = color;
                document.querySelector('#textColorDropdownBtn i').style.color = color;
                document.getElementById('textColorDropdownContent').style.display = 'none';
            }
        });

        // Text primary colors (single row)
        const textPrimary = document.getElementById('textColorPrimaryPalette');
        if (textPrimary) {
            textPrimary.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    execWithRestore('foreColor', false, color);
                    const p = document.getElementById('textColorPicker');
                    if (p) p.value = color;
                    const ic = document.querySelector('#textColorDropdownBtn i');
                    if (ic) ic.style.color = color;
                    const dd = document.getElementById('textColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

        // Text standard colors (single row)
        const textStd = document.getElementById('textColorStandardPalette');
        if (textStd) {
            textStd.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    execWithRestore('foreColor', false, color);
                    const p = document.getElementById('textColorPicker');
                    if (p) p.value = color;
                    const ic = document.querySelector('#textColorDropdownBtn i');
                    if (ic) ic.style.color = color;
                    const dd = document.getElementById('textColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

        document.getElementById('bgColorPalette').addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
                execWithRestore(bgCmd, false, color);
                const p = document.getElementById('bgColorPicker'); if (p) p.value = color;
                document.querySelector('#bgColorDropdownBtn i').style.backgroundColor = color;
                document.getElementById('bgColorDropdownContent').style.display = 'none';
            }
        });

        // Background primary colors
        const bgPrimary = document.getElementById('bgColorPrimaryPalette');
        if (bgPrimary) {
            bgPrimary.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
                    execWithRestore(bgCmd, false, color);
                    const p = document.getElementById('bgColorPicker');
                    if (p) p.value = color;
                    const ic = document.querySelector('#bgColorDropdownBtn i');
                    if (ic) ic.style.backgroundColor = color;
                    const dd = document.getElementById('bgColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

        // Background standard colors
        const bgStd = document.getElementById('bgColorStandardPalette');
        if (bgStd) {
            bgStd.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
                    execWithRestore(bgCmd, false, color);
                    const p = document.getElementById('bgColorPicker');
                    if (p) p.value = color;
                    const ic = document.querySelector('#bgColorDropdownBtn i');
                    if (ic) ic.style.backgroundColor = color;
                    const dd = document.getElementById('bgColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

        // Color dropdowns
        const textDropdownBtn = document.getElementById('textColorDropdownBtn');
        textDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const content = document.getElementById('textColorDropdownContent');
            // Flip up if not enough space below
            const dd = textDropdownBtn.closest('.dropdown');
            if (dd && content) {
                content.style.display = 'block';
                const btnRect = textDropdownBtn.getBoundingClientRect();
                const spaceBelow = (window.innerHeight - btnRect.bottom);
                const needed = content.offsetHeight + 12;
                if (spaceBelow < needed) dd.classList.add('drop-up'); else dd.classList.remove('drop-up');
                // Toggle after measurement
                content.style.display = (content.style.display === 'none' ? 'block' : content.style.display);
                if (content.style.display === 'block' && dd.classList.contains('drop-up')) {
                    // keep open; clicking again will close
                }
            } else if (content) {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            }
            document.getElementById('bgColorDropdownContent').style.display = 'none';
        });

        const bgDropdownBtn = document.getElementById('bgColorDropdownBtn');
        bgDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const content = document.getElementById('bgColorDropdownContent');
            const dd = bgDropdownBtn.closest('.dropdown');
            if (dd && content) {
                content.style.display = 'block';
                const btnRect = bgDropdownBtn.getBoundingClientRect();
                const spaceBelow = (window.innerHeight - btnRect.bottom);
                const needed = content.offsetHeight + 12;
                if (spaceBelow < needed) dd.classList.add('drop-up'); else dd.classList.remove('drop-up');
                content.style.display = (content.style.display === 'none' ? 'block' : content.style.display);
            } else if (content) {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            }
            document.getElementById('textColorDropdownContent').style.display = 'none';
        });

        // Alignment buttons
        document.getElementById('alignLeftBtn').addEventListener('click', () => {
            execWithRestore('justifyLeft');
        });

        document.getElementById('alignCenterBtn').addEventListener('click', () => {
            execWithRestore('justifyCenter');
        });

        document.getElementById('alignRightBtn').addEventListener('click', () => {
            execWithRestore('justifyRight');
        });

        document.getElementById('alignJustifyBtn').addEventListener('click', () => {
            execWithRestore('justifyFull');
        });

        // List buttons
        document.getElementById('bulletListBtn').addEventListener('click', () => {
            execWithRestore('insertUnorderedList');
        });

        document.getElementById('numberListBtn').addEventListener('click', () => {
            execWithRestore('insertOrderedList');
        });

        document.getElementById('indentBtn').addEventListener('click', () => {
            execWithRestore('indent');
        });

        document.getElementById('outdentBtn').addEventListener('click', () => {
            execWithRestore('outdent');
        });

        // Link button
        document.getElementById('linkBtn').addEventListener('click', () => {
            const url = prompt('Entrez l\'URL du lien:');
            if (url) {
                execWithRestore('createLink', false, url);
            }
        });

        // Remove format button
        document.getElementById('removeFormatBtn').addEventListener('click', () => {
            execWithRestore('removeFormat');
        });

        // Show/hide toolbar on text selection within editable area, and follow selection
        const positionRichToolbar = () => {
            const selection = window.getSelection();
            const hasText = selection && selection.rangeCount > 0 && selection.toString().length > 0;
            const inEditable = hasText && isSelectionInEditable();

            const imageTb = document.getElementById('imageToolbar');
            const sectionTb = document.getElementById('sectionToolbar');
            const videoTb = document.getElementById('videoToolbar');
            const tableTb = document.getElementById('tableToolbar');
            const anotherToolbarOpen =
                (imageTb && imageTb.style.display === 'block') ||
                (sectionTb && sectionTb.style.display === 'block') ||
                (videoTb && videoTb.style.display === 'block') ||
                (tableTb && tableTb.style.display === 'block');
            if (anotherToolbarOpen) { toolbar.style.display = 'none'; return; }

            if (!inEditable) {
                if (isActiveInToolbar() || isInteractingWithToolbar) return;
                toolbar.style.display = 'none';
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const margin = 10;
            toolbar.style.display = 'flex';

            // Prefer above; if not enough space, place below
            let top = rect.top + scrollY - toolbar.offsetHeight - margin;
            if (top < scrollY + 8) top = rect.bottom + scrollY + margin;

            // Clamp horizontally to viewport
            const vw = window.innerWidth || document.documentElement.clientWidth;
            const w = toolbar.offsetWidth || 600;
            let left = rect.left + scrollX;
            if (left < 8) left = 8;
            const maxLeft = scrollX + vw - w - 8;
            if (left > maxLeft) left = Math.max(8, maxLeft);

            toolbar.style.left = left + 'px';
            toolbar.style.top = top + 'px';
            this.saveSelection();
        };

        document.addEventListener('selectionchange', positionRichToolbar);
        window.addEventListener('scroll', positionRichToolbar, { passive: true });
        window.addEventListener('resize', positionRichToolbar);
    }

    // ===== Section Toolbar =====
    showSectionToolbar(sectionEl) {
        this.currentEditingSection = sectionEl;
        const toolbar = document.getElementById('sectionToolbar');
        const rect = sectionEl.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        toolbar.style.top = `${rect.top + scrollTop - toolbar.offsetHeight - 8}px`;
        toolbar.style.left = `${rect.left + scrollLeft}px`;
        toolbar.style.display = 'block';

        // If this section has a persisted background color, reapply it and sync the icon
        try {
            const savedColor = sectionEl && sectionEl.dataset ? sectionEl.dataset.sectionBg : '';
            if (savedColor) {
                this.reapplySectionBackground(sectionEl);
                const icon = document.querySelector('#sectionBgColorDropdownBtn i');
                if (icon) icon.style.backgroundColor = savedColor;
            }
        } catch (_) { /* no-op */ }

        // Wire once
        if (!this._sectionToolbarWired) {
            document.getElementById('sectionMoveUpBtn').addEventListener('click', () => this.moveSection(-1));
            document.getElementById('sectionMoveDownBtn').addEventListener('click', () => this.moveSection(1));
            document.getElementById('sectionWidthBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = document.getElementById('sectionWidthOptions');
                dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
            });
            document.querySelectorAll('#sectionWidthOptions .dropdown-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const size = e.currentTarget.getAttribute('data-size');
                    this.setSectionWidth(size);
                    document.getElementById('sectionWidthOptions').style.display = 'none';
                });
            });
            document.getElementById('sectionAlignLeftBtn').addEventListener('click', () => this.alignSection('left'));
            document.getElementById('sectionAlignCenterBtn').addEventListener('click', () => this.alignSection('center'));
            document.getElementById('sectionAlignRightBtn').addEventListener('click', () => this.alignSection('right'));
            document.getElementById('sectionDeleteBtn').addEventListener('click', () => this.deleteSection());
            // Section background color dropdown wiring
            const secBgBtn = document.getElementById('sectionBgColorDropdownBtn');
            const secBgDropdown = document.getElementById('sectionBgColorDropdownContent');
            const secBgPalette = document.getElementById('sectionBgColorPalette');
            const secBgPrimary = document.getElementById('sectionBgPrimaryPalette');
            const secBgIcon = document.querySelector('#sectionBgColorDropdownBtn i');

            const applySectionBg = (color) => {
                if (!this.currentEditingSection) return;
                this.currentEditingSection.style.background = '';
                this.currentEditingSection.style.backgroundColor = color;
                // Persist chosen color on the section to survive future edits
                this.currentEditingSection.dataset.sectionBg = color;
                // Apply via helper so rules are consistent
                this.reapplySectionBackground(this.currentEditingSection);
                if (secBgIcon) secBgIcon.style.backgroundColor = color;
                this.saveState();
                this.updateLastModified();
                this.autoSaveToLocalStorage();
                this.lastAction = 'Couleur de fond de section modifiée';
            };

            secBgBtn && secBgBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!secBgDropdown) return;
                secBgDropdown.style.display = secBgDropdown.style.display === 'none' ? 'block' : 'none';
            });

            secBgPalette && secBgPalette.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    applySectionBg(color);
                    if (secBgDropdown) secBgDropdown.style.display = 'none';
                }
            });
            secBgPrimary && secBgPrimary.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    applySectionBg(color);
                    if (secBgDropdown) secBgDropdown.style.display = 'none';
                }
            });
            this._sectionToolbarWired = true;
        }
    }

    hideSectionToolbar() {
        const toolbar = document.getElementById('sectionToolbar');
        if (toolbar) toolbar.style.display = 'none';
        this.currentEditingSection = null;
    }

    // ===== Table Toolbar =====
    showTableToolbar(tableEl) {
        this.currentEditingTable = tableEl;
        const toolbar = document.getElementById('tableToolbar');
        const rect = tableEl.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Position toolbar above the table with more space to avoid covering first row
        const toolbarHeight = toolbar.offsetHeight || 40; // fallback height
        const gap = 15; // increased gap
        const topPosition = rect.top + scrollTop - toolbarHeight - gap;
        
        // If toolbar would be too high (off screen), position it below the table instead
        if (topPosition < scrollTop + 10) {
            toolbar.style.top = `${rect.bottom + scrollTop + gap}px`;
        } else {
            toolbar.style.top = `${topPosition}px`;
        }
        
        toolbar.style.left = `${rect.left + scrollLeft}px`;
        toolbar.style.display = 'block';
    }

    hideTableToolbar() {
        const toolbar = document.getElementById('tableToolbar');
        if (toolbar) toolbar.style.display = 'none';
        this.currentEditingTable = null;
    }

    // ===== Webinar Toolbar =====
    showWebinarToolbar(sectionEl) {
        this.currentWebinarSection = sectionEl;
        const toolbar = document.getElementById('webinarToolbar');
        const rect = sectionEl.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        toolbar.style.top = `${rect.top + scrollTop - toolbar.offsetHeight - 8}px`;
        toolbar.style.left = `${rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
        toolbar.style.display = 'block';

        if (!this._webinarToolbarWired) {
            // Color picker + palette + dropdown (mirrors text toolbar behavior)
            const bgPicker = document.getElementById('webinarBgColorPicker');
            const bgPalette = document.getElementById('webinarBgColorPalette');
            const bgBtnIcon = document.querySelector('#webinarBgColorDropdownBtn i');
            const bgDropdown = document.getElementById('webinarBgColorDropdownContent');
            const bgBtn = document.getElementById('webinarBgColorDropdownBtn');
            const bgStdPalette = document.getElementById('webinarBgStandardPalette');
            const bgPrimaryPalette = document.getElementById('webinarBgPrimaryPalette');

            const applyWebinarBg = (color) => {
                if (!this.currentWebinarSection) return;
                this.currentWebinarSection.style.background = '';
                this.currentWebinarSection.style.backgroundColor = color;
                if (bgPicker) bgPicker.value = color;
                if (bgBtnIcon) bgBtnIcon.style.backgroundColor = color;
                this.saveState();
            };

            bgPicker && bgPicker.addEventListener('input', (e) => applyWebinarBg(e.target.value));

            bgPalette && bgPalette.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    applyWebinarBg(color);
                    if (bgDropdown) bgDropdown.style.display = 'none';
                }
            });

            // Standard colors for webinar background
            bgStdPalette && bgStdPalette.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    applyWebinarBg(color);
                    if (bgDropdown) bgDropdown.style.display = 'none';
                }
            });

            // Primary colors for webinar background
            bgPrimaryPalette && bgPrimaryPalette.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    applyWebinarBg(color);
                    if (bgDropdown) bgDropdown.style.display = 'none';
                }
            });

            bgBtn && bgBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!bgDropdown) return;
                bgDropdown.style.display = bgDropdown.style.display === 'none' ? 'block' : 'none';
            });

            document.addEventListener('click', (e) => {
                if (bgDropdown && !e.target.closest('#webinarBgColorDropdownContent') && !e.target.closest('#webinarBgColorDropdownBtn')) {
                    bgDropdown.style.display = 'none';
                }
            });

            const imgBtn = document.getElementById('webinarInsertImageBtn');
            const imgInput = document.getElementById('webinarImageInput');
            imgBtn && imgBtn.addEventListener('click', (ev) => { ev.stopPropagation(); imgInput && imgInput.click(); });
            imgInput && imgInput.addEventListener('change', async (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;

                // Capture the current mouse position for image insertion
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    this.lastMouseRange = sel.getRangeAt(0);
                }

                try {
                    const dataUrl = await this.compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.9 });
                    this.insertImage(dataUrl, file.name);
                } catch (_) {
                    const reader = new FileReader();
                    reader.onload = () => this.insertImage(reader.result, file.name);
                    reader.readAsDataURL(file);
                }
                ev.target.value = '';
            });

            const videoUrlBtn = document.getElementById('webinarInsertVideoUrlBtn');
            videoUrlBtn && videoUrlBtn.addEventListener('click', () => {
                const url = prompt('Entrez l\'URL de la vidéo (YouTube, Vimeo, MP4)');
                if (!url) return;
                if (this.currentWebinarSection) {
                    const r = document.createRange();
                    r.selectNodeContents(this.currentWebinarSection);
                    r.collapse(false);
                    this.lastMouseRange = r;
                }
                this.insertVideo(url);
            });

            const videoLocalBtn = document.getElementById('webinarInsertVideoLocalBtn');
            const videoInput = document.getElementById('webinarVideoInput');
            videoLocalBtn && videoLocalBtn.addEventListener('click', (ev) => { ev.stopPropagation(); videoInput && videoInput.click(); });
            videoInput && videoInput.addEventListener('change', (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                if (this.currentWebinarSection) {
                    const r = document.createRange();
                    r.selectNodeContents(this.currentWebinarSection);
                    r.collapse(false);
                    this.lastMouseRange = r;
                }
                this.insertVideo(url);
                ev.target.value = '';
            });

            // Delete webinar section
            const deleteBtn = document.getElementById('webinarDeleteBtn');
            deleteBtn && deleteBtn.addEventListener('click', () => {
                if (this.currentWebinarSection && confirm('Supprimer cette section Webinar ?')) {
                    this.currentWebinarSection.remove();
                    this.hideWebinarToolbar();
                    this.saveState();
                    this.updateLastModified();
                    this.autoSaveToLocalStorage();
                }
            });

            this._webinarToolbarWired = true;
        }
    }

    hideWebinarToolbar() {
        const toolbar = document.getElementById('webinarToolbar');
        if (toolbar) toolbar.style.display = 'none';
        this.currentWebinarSection = null;
    }

    moveSection(direction) {
        if (!this.currentEditingSection) return;
        const section = this.currentEditingSection;
        const isSection = (el) => !!(el && (el.classList && (el.classList.contains('newsletter-section') || el.classList.contains('gallery-section') || el.classList.contains('two-column-layout') || el.classList.contains('syc-item'))));
        const prevEligible = () => {
            let p = section.previousElementSibling;
            while (p && !isSection(p)) p = p.previousElementSibling;
            return p;
        };
        const nextEligible = () => {
            let n = section.nextElementSibling;
            while (n && !isSection(n)) n = n.nextElementSibling;
            return n;
        };

        if (direction < 0) {
            const prev = prevEligible();
            if (prev) section.parentNode.insertBefore(section, prev);
        } else if (direction > 0) {
            const next = nextEligible();
            if (next) section.parentNode.insertBefore(next, section);
        }
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Section déplacée';
        // Keep it in view after moving
        try {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {}
        this.showSectionToolbar(section);
    }

    alignSection(alignment) {
        if (!this.currentEditingSection) return;
        const section = this.currentEditingSection;
        section.style.marginLeft = '';
        section.style.marginRight = '';
        section.style.textAlign = '';

        switch (alignment) {
            case 'left':
                section.style.marginLeft = '0';
                section.style.marginRight = 'auto';
                section.style.textAlign = 'left';
                break;
            case 'center':
                section.style.marginLeft = 'auto';
                section.style.marginRight = 'auto';
                section.style.textAlign = 'center';
                break;
            case 'right':
                section.style.marginLeft = 'auto';
                section.style.marginRight = '0';
                section.style.textAlign = 'right';
                break;
        }
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Section alignée';
        this.showSectionToolbar(section);
    }

    deleteSection() {
        if (!this.currentEditingSection) return;
        if (confirm('Supprimer cette section ?')) {
            this.currentEditingSection.remove();
            this.hideSectionToolbar();
            this.saveState();
            this.updateLastModified();
            this.autoSaveToLocalStorage();
            this.lastAction = 'Section supprimée';
        }
    }

    setSectionWidth(size) {
        if (!this.currentEditingSection) return;
        const section = this.currentEditingSection;
        // preserve alignment margins; only change width/max-width
        if (size === 'auto') {
            section.style.width = '';
            section.style.maxWidth = '';
        } else {
            const pct = parseInt(size, 10);
            section.style.width = pct + '%';
            section.style.maxWidth = '100%';
        }
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Largeur de section ajustée';
        this.showSectionToolbar(section);
    }

    // ===== Video Toolbar =====
    showVideoToolbar(videoEl) {
        this.currentEditingVideo = videoEl;
        const toolbar = document.getElementById('videoToolbar');
        const rect = videoEl.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        toolbar.style.top = `${rect.top + scrollTop - toolbar.offsetHeight - 8}px`;
        toolbar.style.left = `${rect.left + scrollLeft}px`;
        toolbar.style.display = 'block';

        if (!this._videoToolbarWired) {
            document.getElementById('videoSizeBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = document.getElementById('videoSizeOptions');
                dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
            });
            document.querySelectorAll('#videoSizeOptions .dropdown-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const size = e.currentTarget.getAttribute('data-size');
                    this.setVideoSize(size);
                    document.getElementById('videoSizeOptions').style.display = 'none';
                });
            });
            document.getElementById('videoAlignLeftBtn').addEventListener('click', () => this.alignVideo('left'));
            document.getElementById('videoAlignCenterBtn').addEventListener('click', () => this.alignVideo('center'));
            document.getElementById('videoAlignRightBtn').addEventListener('click', () => this.alignVideo('right'));
            document.getElementById('videoDeleteBtn').addEventListener('click', () => this.deleteVideo());
            this._videoToolbarWired = true;
        }
    }

    hideVideoToolbar() {
        const toolbar = document.getElementById('videoToolbar');
        if (toolbar) toolbar.style.display = 'none';
        this.currentEditingVideo = null;
    }

    setVideoSize(size) {
        if (!this.currentEditingVideo) return;
        const el = this.currentEditingVideo;
        if (size === 'auto') {
            el.style.width = '';
            el.style.maxWidth = '100%';
            el.style.height = '';
        } else {
            const pct = parseInt(size, 10);
            el.style.width = pct + '%';
            el.style.height = 'auto';
            el.style.maxWidth = '100%';
        }
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Taille de vidéo ajustée';
        this.showVideoToolbar(el);
    }

    alignVideo(alignment) {
        if (!this.currentEditingVideo) return;
        const el = this.currentEditingVideo;
        const wrapper = el.parentElement && el.parentElement.classList.contains('video-align-wrapper') ? el.parentElement : null;
        let container = wrapper || el;
        container.style.display = '';
        container.style.marginLeft = '';
        container.style.marginRight = '';
        container.style.textAlign = '';

        switch (alignment) {
            case 'left':
                container.style.display = 'block';
                container.style.marginLeft = '0';
                container.style.marginRight = 'auto';
                container.style.textAlign = 'left';
                break;
            case 'center':
                container.style.display = 'block';
                container.style.marginLeft = 'auto';
                container.style.marginRight = 'auto';
                container.style.textAlign = 'center';
                break;
            case 'right':
                container.style.display = 'block';
                container.style.marginLeft = 'auto';
                container.style.marginRight = '0';
                container.style.textAlign = 'right';
                break;
        }
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Vidéo alignée';
        this.showVideoToolbar(el);
    }

    deleteVideo() {
        if (!this.currentEditingVideo) return;
        if (confirm('Supprimer cette vidéo ?')) {
            const node = this.currentEditingVideo;
            // If iframe inside a wrapper, remove wrapper; otherwise remove node
            const parent = node.parentElement;
            if (parent && parent.classList.contains('video-align-wrapper')) {
                parent.remove();
            } else {
                // Fallback: remove the image directly
                node.remove();
            }
            
            this.hideVideoToolbar();
            this.saveState();
            this.updateLastModified();
            this.autoSaveToLocalStorage();
            this.lastAction = 'Vidéo supprimée';
        }
    }

    // Selection helpers
    saveSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        this.savedSelection = selection.getRangeAt(0).cloneRange();
    }

    // Insert raw HTML at the current selection inside #editableContent
    insertHTMLAtCursor(html) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // Ensure the insertion happens inside the editor
            const node = range.startContainer;
            const host = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
            if (host && host.closest && host.closest('#editableContent')) {
                range.deleteContents();
                const div = document.createElement('div');
                div.innerHTML = html;
                const fragment = document.createDocumentFragment();
                while (div.firstChild) {
                    fragment.appendChild(div.firstChild);
                }
                range.insertNode(fragment);
                return;
            }
        }
        // Fallback append to editor
        const editable = document.getElementById('editableContent');
        editable.innerHTML += html;
    }

    // Insert a DOM element at the current cursor or last mouse position range
    insertElementAtCursor(element) {
        const selection = window.getSelection();
        const editable = document.getElementById('editableContent');
        let range = null;

        // Prefer lastMouseRange if it points inside the editor
        if (this.lastMouseRange) {
            try {
                const node = this.lastMouseRange.startContainer;
                const host = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
                if (host && host.closest && host.closest('#editableContent')) {
                    range = this.lastMouseRange.cloneRange();
                }
            } catch (_) {}
        }

        // If no saved range, try to compute from the last mouse position inside the editor
        if (!range && this.lastMousePosition && typeof this.lastMousePosition.x === 'number') {
            try {
                const r = this.computeRangeFromPoint(this.lastMousePosition.x, this.lastMousePosition.y);
                if (r) range = r.cloneRange ? r.cloneRange() : r; // support native Range
            } catch (_) {}
        }

        // Otherwise, use current selection if inside editor
        if (!range && selection && selection.rangeCount > 0) {
            const r = selection.getRangeAt(0);
            const node = r.startContainer;
            const host = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
            if (host && host.closest && host.closest('#editableContent')) {
                range = r.cloneRange();
            }
        }

        if (range) {
            range.collapse(true);
            range.insertNode(element);
            // Place caret after inserted element to keep typing natural
            const spacer = document.createElement('p');
            spacer.innerHTML = '<br>';
            element.after(spacer);
            const newRange = document.createRange();
            newRange.selectNodeContents(spacer);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.lastMouseRange = null;
        } else {
            // Append at end as a safe fallback
            editable.appendChild(element);
            const spacer = document.createElement('p');
            spacer.innerHTML = '<br>';
            editable.appendChild(spacer);
            const newRange = document.createRange();
            newRange.selectNodeContents(spacer);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.lastMouseRange = null;
        }
    }

    // Compute an insertion Range from viewport coordinates within the editor
    computeRangeFromPoint(x, y) {
        const editableEl = document.getElementById('editableContent');
        if (!editableEl) return null;
        const containerRect = editableEl.getBoundingClientRect();
        if (x < containerRect.left || x > containerRect.right || y < containerRect.top || y > containerRect.bottom) {
            return null;
        }

        const snapRangeToBlockBoundary = (node) => {
            if (!node) return null;
            let child = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            while (child && child.parentElement !== editableEl) {
                child = child.parentElement;
            }
            const range = document.createRange();
            if (!child || child === editableEl) {
                const last = editableEl.lastChild;
                if (last) range.setStartAfter(last); else range.setStart(editableEl, editableEl.childNodes.length);
                range.collapse(true);
                return range;
            }
            const childRect = child.getBoundingClientRect();
            const placeAfter = y > (childRect.top + childRect.height / 2);
            if (placeAfter) range.setStartAfter(child); else range.setStartBefore(child);
            range.collapse(true);
            return range;
        };

        if (document.caretRangeFromPoint) {
            const r = document.caretRangeFromPoint(x, y);
            if (r) return snapRangeToBlockBoundary(r.startContainer);
        }
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos && pos.offsetNode != null) {
                return snapRangeToBlockBoundary(pos.offsetNode);
            }
        }
        const target = document.elementFromPoint(x, y);
        if (!target) return null;
        const container = target.closest('#editableContent');
        if (!container) return null;
        return snapRangeToBlockBoundary(target);
    }
    restoreSelection() {
        if (!this.savedSelection) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.savedSelection);
    }

    // Reapply a section's persisted background color to itself and common inner containers.
    // Also normalize inner editable content to transparent so white inline highlights do not show as bars.
    reapplySectionBackground(sectionEl) {
        if (!sectionEl) return;
        const color = sectionEl.dataset ? sectionEl.dataset.sectionBg : '';
        if (!color) return;
        try {
            sectionEl.style.background = '';
            sectionEl.style.backgroundColor = color;
            // Apply same background to columns and image placeholders
            const innerTargets = sectionEl.querySelectorAll('.column, .image-placeholder');
            innerTargets.forEach((el) => {
                el.style.background = '';
                el.style.backgroundColor = color;
            });
            // Keep the typing surface transparent so text tools don't create white bars
            const editables = sectionEl.querySelectorAll('[contenteditable="true"]');
            editables.forEach((ed) => {
                ed.style.background = 'transparent';
                ed.style.backgroundColor = 'transparent';
                // Also clear accidental white background on immediate children/spans/paragraphs
                const descendants = ed.querySelectorAll('*');
                descendants.forEach((node) => {
                    if (node && node.style && node.style.backgroundColor) {
                        const bg = node.style.backgroundColor.trim().toLowerCase();
                        if (bg === 'white' || bg === '#fff' || bg === '#ffffff' || bg === 'rgb(255, 255, 255)') {
                            node.style.backgroundColor = 'transparent';
                        }
                    }
                });
            });
        } catch (_) { /* no-op */ }
    }

    setupTableToolbar() {
        const toolbar = document.getElementById('tableToolbar');

        // Insert row
        document.getElementById('insertRowBtn').addEventListener('click', () => {
            this.insertTableRow();
        });

        // Insert column
        document.getElementById('insertColBtn').addEventListener('click', () => {
            this.insertTableColumn();
        });

        // Delete row
        document.getElementById('deleteRowBtn').addEventListener('click', () => {
            this.deleteTableRow();
        });

        // Delete column
        document.getElementById('deleteColBtn').addEventListener('click', () => {
            this.deleteTableColumn();
        });

        // Table background color dropdown
        document.getElementById('tableBgColorDropdownBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const content = document.getElementById('tableBgColorDropdownContent');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });

        // Table background color picker
        const tableBgColorPickerEl = document.getElementById('tableBgColorPicker');
        if (tableBgColorPickerEl) {
            tableBgColorPickerEl.addEventListener('input', (e) => {
                this.changeTableBackgroundColor(e.target.value);
                const ic = document.querySelector('#tableBgColorDropdownBtn i');
                if (ic) ic.style.backgroundColor = e.target.value;
            });
        }

        // Table background color palette
        document.getElementById('tableBgColorPalette').addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                this.changeTableBackgroundColor(color);
                const p2 = document.getElementById('tableBgColorPicker'); if (p2) p2.value = color;
                document.getElementById('tableBgColorDropdownContent').style.display = 'none';
            }
        });

        // Table primary colors
        const tablePrimary = document.getElementById('tableBgPrimaryPalette');
        if (tablePrimary) {
            tablePrimary.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    this.changeTableBackgroundColor(color);
                    const p = document.getElementById('tableBgColorPicker');
                    if (p) p.value = color;
                    const dd = document.getElementById('tableBgColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

        // Table standard colors
        const tableStd = document.getElementById('tableBgStandardPalette');
        if (tableStd) {
            tableStd.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-color')) {
                    const color = e.target.dataset.color;
                    this.changeTableBackgroundColor(color);
                    const p = document.getElementById('tableBgColorPicker');
                    if (p) p.value = color;
                    const dd = document.getElementById('tableBgColorDropdownContent');
                    if (dd) dd.style.display = 'none';
                }
            });
        }

    }

    // ===== Table Operations =====
    insertTableRow() {
        if (!this.currentEditingTable) return;
        
        const selection = window.getSelection();
        let targetRow = null;
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            targetRow = range.startContainer.nodeType === Node.ELEMENT_NODE 
                ? range.startContainer.closest('tr')
                : range.startContainer.parentElement.closest('tr');
        }
        
        if (!targetRow) {
            // If no specific row selected, add to the end
            const tbody = this.currentEditingTable.querySelector('tbody') || this.currentEditingTable;
            targetRow = tbody.lastElementChild;
        }
        
        if (targetRow) {
            const newRow = targetRow.cloneNode(true);
            // Clear content of new row cells
            newRow.querySelectorAll('td, th').forEach(cell => {
                cell.innerHTML = '';
            });
            targetRow.parentNode.insertBefore(newRow, targetRow.nextSibling);
            
            this.saveState();
            this.updateLastModified();
            this.autoSaveToLocalStorage();
            this.lastAction = 'Ligne de tableau insérée';
        }
    }

    insertTableColumn() {
        if (!this.currentEditingTable) return;
        
        const selection = window.getSelection();
        let targetCell = null;
        let columnIndex = 0;
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            targetCell = range.startContainer.nodeType === Node.ELEMENT_NODE 
                ? range.startContainer.closest('td, th')
                : range.startContainer.parentElement.closest('td, th');
        }
        
        if (targetCell) {
            // Find column index
            const row = targetCell.parentElement;
            columnIndex = Array.from(row.children).indexOf(targetCell);
        }
        
        // Add column to all rows
        const rows = this.currentEditingTable.querySelectorAll('tr');
        rows.forEach(row => {
            const newCell = document.createElement(row.querySelector('th') ? 'th' : 'td');
            newCell.innerHTML = '';
            if (columnIndex < row.children.length) {
                row.insertBefore(newCell, row.children[columnIndex + 1]);
            } else {
                row.appendChild(newCell);
            }
        });
        
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Colonne de tableau insérée';
    }

    deleteTableRow() {
        if (!this.currentEditingTable) return;
        
        const selection = window.getSelection();
        let targetRow = null;
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            targetRow = range.startContainer.nodeType === Node.ELEMENT_NODE 
                ? range.startContainer.closest('tr')
                : range.startContainer.parentElement.closest('tr');
        }
        
        if (targetRow && confirm('Supprimer cette ligne ?')) {
            // Don't delete if it's the only row
            const allRows = this.currentEditingTable.querySelectorAll('tr');
            if (allRows.length > 1) {
                targetRow.remove();
                this.saveState();
                this.updateLastModified();
                this.autoSaveToLocalStorage();
                this.lastAction = 'Ligne de tableau supprimée';
            } else {
                alert('Impossible de supprimer la dernière ligne du tableau.');
            }
        }
    }

    deleteTableColumn() {
        if (!this.currentEditingTable) return;
        
        const selection = window.getSelection();
        let targetCell = null;
        let columnIndex = 0;
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            targetCell = range.startContainer.nodeType === Node.ELEMENT_NODE 
                ? range.startContainer.closest('td, th')
                : range.startContainer.parentElement.closest('td, th');
        }
        
        if (targetCell) {
            const row = targetCell.parentElement;
            columnIndex = Array.from(row.children).indexOf(targetCell);
            
            // Check if it's the only column
            if (row.children.length <= 1) {
                alert('Impossible de supprimer la dernière colonne du tableau.');
                return;
            }
            
            if (confirm('Supprimer cette colonne ?')) {
                // Remove column from all rows
                const rows = this.currentEditingTable.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.children[columnIndex]) {
                        row.children[columnIndex].remove();
                    }
                });
                
                this.saveState();
                this.updateLastModified();
                this.autoSaveToLocalStorage();
                this.lastAction = 'Colonne de tableau supprimée';
            }
        }
    }

    changeTableBackgroundColor(color) {
        if (!this.currentEditingTable) return;
        
        let targetCell = null;
        
        // First try the last clicked table cell (most precise)
        if (this.lastClickedTableCell && this.currentEditingTable.contains(this.lastClickedTableCell)) {
            targetCell = this.lastClickedTableCell;
        }
        
        // Then try the last hovered table cell
        if (!targetCell && this.lastHoveredTableCell && this.currentEditingTable.contains(this.lastHoveredTableCell)) {
            targetCell = this.lastHoveredTableCell;
        }
        
        // Fallback to current mouse position
        if (!targetCell && this.lastMousePosition) {
            const elementUnderMouse = document.elementFromPoint(this.lastMousePosition.x, this.lastMousePosition.y);
            if (elementUnderMouse) {
                targetCell = elementUnderMouse.closest('td, th');
                if (targetCell && !this.currentEditingTable.contains(targetCell)) {
                    targetCell = null;
                }
            }
        }
        
        // Fallback to selection
        if (!targetCell) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.startContainer;
                const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
                targetCell = element.closest('td, th');
                if (targetCell && !this.currentEditingTable.contains(targetCell)) {
                    targetCell = null;
                }
            }
        }
        
        // Apply color to the target cell
        if (targetCell) {
            targetCell.style.backgroundColor = color;
            // Add visual feedback
            targetCell.style.transition = 'background-color 0.2s ease';
        }
        
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Couleur de fond de tableau ajustée';
    }

    showTableProperties() {
        if (!this.currentEditingTable) return;
        
        const currentBorder = this.currentEditingTable.style.border || '1px solid #ddd';
        const currentWidth = this.currentEditingTable.style.width || '100%';
        
        const border = prompt('Bordure du tableau (ex: 1px solid #000):', currentBorder);
        const width = prompt('Largeur du tableau (ex: 100%, 500px):', currentWidth);
        
        if (border !== null) {
            this.currentEditingTable.style.border = border;
        }
        if (width !== null) {
            this.currentEditingTable.style.width = width;
        }
        
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Propriétés de tableau ajustées';
    }
    
    setupImageToolbar() {
        const toolbar = document.getElementById('imageToolbar');
        // Ensure toolbar controls display on a single line
        const tools = toolbar && toolbar.querySelector('.image-tools');
        if (tools) {
            tools.style.display = 'flex';
            tools.style.flexDirection = 'row';
            tools.style.alignItems = 'center';
            tools.style.gap = '10px';
            tools.style.flexWrap = 'nowrap';
        }
        
        // Convert toolbar controls to icon-only with tooltips, preserving behavior
        const toIconOnly = (btn, iconHtml, title) => {
            if (!btn) return;
            btn.innerHTML = iconHtml;
            if (title) {
                btn.setAttribute('title', title);
                btn.setAttribute('aria-label', title);
            }
        };
        toIconOnly(document.getElementById('cropImageBtn'), '<i class="fas fa-crop"></i>', 'Recadrer');
        toIconOnly(document.getElementById('positionBtn'), '<i class="fas fa-arrows-alt"></i> <i class="fas fa-caret-down"></i>', 'Position');
        toIconOnly(document.getElementById('resetImageBtn'), '<i class="fas fa-undo"></i>', 'Réinitialiser');
        toIconOnly(document.getElementById('deleteImageBtn'), '<i class="fas fa-trash"></i>', 'Supprimer');
        toIconOnly(document.getElementById('rotationBtn'), '<i class="fas fa-sync"></i> <i class="fas fa-caret-down"></i>', 'Rotation');
        toIconOnly(document.getElementById('changeImageBtn'), '<i class="fas fa-image"></i>', "Changer l'image");
        
        // Rotation dropdown toggle
        document.getElementById('rotationBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            const rotationOptions = document.getElementById('rotationOptions');
            rotationOptions.style.display = rotationOptions.style.display === 'none' ? 'block' : 'none';
        });
        
        // Rotate right 90 degrees
        document.getElementById('rotateRight90Btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.rotateImage(90);
                document.getElementById('rotationOptions').style.display = 'none';
            }
        });
        
        // Rotate left 90 degrees
        document.getElementById('rotateLeft90Btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.rotateImage(-90);
                document.getElementById('rotationOptions').style.display = 'none';
            }
        });
        
        // Flip vertical
        document.getElementById('flipVerticalBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.flipImage('vertical');
                document.getElementById('rotationOptions').style.display = 'none';
            }
        });
        
        // Flip horizontal
        document.getElementById('flipHorizontalBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.flipImage('horizontal');
                document.getElementById('rotationOptions').style.display = 'none';
            }
        });
        
        // Reset image button
        document.getElementById('resetImageBtn').addEventListener('click', () => {
            if (this.currentEditingImage && this.originalImageSrc) {
                // Reset to original image
                this.currentEditingImage.src = this.originalImageSrc;
                this.currentEditingImage.style.width = 'auto';
                this.currentEditingImage.style.height = 'auto';
                this.currentEditingImage.style.transform = 'none';
                
                // Store the original dimensions for future reference
                this.originalImageWidth = this.currentEditingImage.naturalWidth;
                this.originalImageHeight = this.currentEditingImage.naturalHeight;
                
                this.saveState();
                this.lastAction = 'Image réinitialisée';
            }
        });

        // Delete image button
        document.getElementById('deleteImageBtn').addEventListener('click', () => {
            if (this.currentEditingImage) {
                if (confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
                    // Find the image wrapper and remove it
                    const wrapper = this.currentEditingImage.closest('.image-wrapper');
                    if (wrapper) {
                        wrapper.remove();
                    } else {
                        // Fallback: remove the image directly
                        this.currentEditingImage.remove();
                    }
                    
                    // Hide the image toolbar
                    document.getElementById('imageToolbar').style.display = 'none';
                    
                    // Clear current editing image reference
                    this.currentEditingImage = null;
                    
                    // Save state and update
                    this.saveState();
                    this.updateLastModified();
                    this.autoSaveToLocalStorage();
                    this.lastAction = 'Image supprimée';
                }
            }
        });

        // Change image button — replace current image source without altering other tools
        const changeImageBtn = document.getElementById('changeImageBtn');
        if (changeImageBtn) {
            changeImageBtn.addEventListener('click', () => {
                if (!this.currentEditingImage) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    const applySrc = (dataUrl) => {
                        try {
                            this.currentEditingImage.src = dataUrl;
                            if (file && file.name) this.currentEditingImage.alt = file.name;
                            this.currentEditingImage.dataset.originalSrc = dataUrl;
                            this.originalImageSrc = dataUrl;
                            // Reset transforms/sizing for a clean state; user can resize again
                            this.currentEditingImage.style.transform = 'none';
                            this.currentEditingImage.style.width = 'auto';
                            this.currentEditingImage.style.height = 'auto';
                            // Update stored natural dimensions once loaded
                            const imgRef = this.currentEditingImage;
                            const onLoad = () => {
                                this.originalImageWidth = imgRef.naturalWidth;
                                this.originalImageHeight = imgRef.naturalHeight;
                                imgRef.removeEventListener('load', onLoad);
                                this.saveState();
                                this.updateLastModified();
                                this.autoSaveToLocalStorage();
                                this.lastAction = 'Image remplacée';
                            };
                            imgRef.addEventListener('load', onLoad);
                        } catch (_) { /* no-op */ }
                    };
                    try {
                        const dataUrl = await this.compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.9 });
                        applySrc(dataUrl);
                    } catch (_) {
                        const reader = new FileReader();
                        reader.onload = (ev) => applySrc(ev.target.result);
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            });
        }

        
        // Crop image button
        document.getElementById('cropImageBtn').addEventListener('click', () => {
            if (this.currentEditingImage) {
                this.startImageCropping();
            }
        });
        
        // Cancel crop button
        document.getElementById('cancelCropBtn').addEventListener('click', () => {
            this.cancelImageCropping();
        });
        
        // Apply crop button
        document.getElementById('applyCropBtn').addEventListener('click', () => {
            this.applyImageCropping();
        });
        
        // Position dropdown toggle
        document.getElementById('positionBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            const positionOptions = document.getElementById('positionOptions');
            positionOptions.style.display = positionOptions.style.display === 'none' ? 'block' : 'none';
        });
        
        // Free position
        document.getElementById('freePositionBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.setImagePosition('absolute');
                document.getElementById('positionOptions').style.display = 'none';
            }
        });
        
        // Float left
        document.getElementById('floatLeftBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.setImagePosition('float-left');
                document.getElementById('positionOptions').style.display = 'none';
            }
        });
        
        // Float right
        document.getElementById('floatRightBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.setImagePosition('float-right');
                document.getElementById('positionOptions').style.display = 'none';
            }
        });
        
        // Inline
        document.getElementById('inlineBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (this.currentEditingImage) {
                this.setImagePosition('inline');
                document.getElementById('positionOptions').style.display = 'none';
            }
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // Handle rotation dropdown
            const rotationOptions = document.getElementById('rotationOptions');
            const rotationBtn = document.getElementById('rotationBtn');
            
            if (rotationOptions && 
                rotationOptions.style.display === 'block' && 
                !rotationBtn.contains(e.target) && 
                !rotationOptions.contains(e.target)) {
                rotationOptions.style.display = 'none';
            }
            
            // Handle position dropdown
            const positionOptions = document.getElementById('positionOptions');
            const positionBtn = document.getElementById('positionBtn');
            
            if (positionOptions && 
                positionOptions.style.display === 'block' && 
                !positionBtn.contains(e.target) && 
                !positionOptions.contains(e.target)) {
                positionOptions.style.display = 'none';
            }
        });
    }
    
    rotateImage(degrees) {
        if (!this.currentEditingImage) return;
        
        // Create a canvas to perform the rotation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Make sure the image is loaded
        const img = new Image();
        img.onload = () => {
            // Get current rotation from transform style or default to 0
            let currentRotation = 0;
            const transform = this.currentEditingImage.style.transform;
            if (transform) {
                const match = transform.match(/rotate\((-?\d+)deg\)/);
                if (match) {
                    currentRotation = parseInt(match[1]);
                }
            }
            
            // Calculate new rotation
            const newRotation = (currentRotation + degrees) % 360;
            
            // Determine if we need to swap width and height (for 90/270 degrees)
            const swapDimensions = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;
            
            // Set canvas dimensions based on rotation
            if (swapDimensions) {
                canvas.width = img.height;
                canvas.height = img.width;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }
            
            // Clear the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Translate and rotate the canvas context
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(degrees * Math.PI / 180);
            
            // Draw the image centered on the canvas
            ctx.drawImage(
                img,
                -img.width / 2,
                -img.height / 2
            );
            
            ctx.restore();
            
            // Apply the rotated image
            const rotatedImageDataUrl = canvas.toDataURL('image/png');
            
            // Update the image
            this.currentEditingImage.src = rotatedImageDataUrl;
            this.currentEditingImage.style.transform = 'none'; // Reset transform as rotation is now in the image
            
            // Update dimensions if needed
            if (swapDimensions) {
                const temp = this.originalImageWidth;
                this.originalImageWidth = this.originalImageHeight;
                this.originalImageHeight = temp;
            }
            
            this.saveState();
            this.lastAction = 'Image tournée';
            
            // Refresh the resize handles
            this.removeResizeHandles();
            this.addResizeHandlesToImage(this.currentEditingImage);
        };
        
        // Set the source to trigger the onload event
        img.src = this.currentEditingImage.src;
    }
    
    // Central entry-point used by click handlers to activate the floating image tools
    selectImage(image) {
        if (!image) return;
        // If a wrapper or container is passed, resolve to the inner <img>
        try {
            if (image.tagName !== 'IMG' && image.querySelector) {
                const inner = image.querySelector('img');
                if (inner) image = inner;
            }
        } catch (_) {}
        this.showImageEditingTools(image);
    }
    
    flipImage(direction) {
        if (!this.currentEditingImage) return;
        
        // Create a canvas to perform the flip
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Make sure the image is loaded
        const img = new Image();
        img.onload = () => {
            // Set canvas dimensions
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Save the context state
            ctx.save();
            
            // Flip the context
            if (direction === 'horizontal') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            } else if (direction === 'vertical') {
                ctx.translate(0, canvas.height);
                ctx.scale(1, -1);
            }
            
            // Draw the flipped image
            ctx.drawImage(img, 0, 0);
            
            // Restore the context state
            ctx.restore();
            
            // Apply the flipped image
            const flippedImageDataUrl = canvas.toDataURL('image/png');
            this.currentEditingImage.src = flippedImageDataUrl;
            
            this.saveState();
            this.lastAction = 'Image retournée';
            
            // Refresh the resize handles
            this.removeResizeHandles();
            this.addResizeHandlesToImage(this.currentEditingImage);
        };
        
        // Set the source to trigger the onload event
        img.src = this.currentEditingImage.src;
    }
    
    showImageEditingTools(image) {
        // Store reference to the current image being edited
        this.currentEditingImage = image;
        
        // Store original dimensions for resizing
        this.originalImageWidth = image.naturalWidth;
        this.originalImageHeight = image.naturalHeight;
        
        // Store original image source for reset functionality
        if (!this.originalImageSrc) {
            // Use the data attribute if available, otherwise use current src
            this.originalImageSrc = image.dataset.originalSrc || image.src;
        }
        
        // Add a class to highlight the image being edited
        image.classList.add('image-being-edited');
        
        // Position the toolbar near the image
        const toolbar = document.getElementById('imageToolbar');
        const rect = image.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Ensure toolbar is not inside section columns (flex children)
        if (toolbar.parentElement !== document.body) {
            try { document.body.appendChild(toolbar); } catch (_) {}
        }
        // Force absolute positioning to avoid affecting layout
        toolbar.style.position = 'absolute';
        toolbar.style.zIndex = '9999';
        toolbar.style.display = 'block';
        toolbar.style.width = 'auto';
        toolbar.style.pointerEvents = 'auto';
        toolbar.style.margin = '0';
        
        // Compute centered and constrained position so it stays on-screen
        try {
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const toolbarWidth = toolbar.offsetWidth;
            const toolbarHeight = toolbar.offsetHeight;
            let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
            const minLeft = 10;
            const maxLeft = Math.max(minLeft, viewportWidth - toolbarWidth - 10);
            left = Math.min(Math.max(left, minLeft), maxLeft);

            // Prefer above image; if not enough space, place below
            let top = rect.top + scrollTop - toolbarHeight - 10;
            const minTop = scrollTop + 10;
            if (top < minTop) {
                top = rect.bottom + scrollTop + 10;
            }

            toolbar.style.left = left + 'px';
            toolbar.style.top = top + 'px';
        } catch (_) {
            // Fallback: align to left edge
            toolbar.style.left = rect.left + 'px';
            toolbar.style.top = (rect.top + scrollTop - toolbar.offsetHeight - 10) + 'px';
        }
        
        // Setup toolbar if not already done
        if (!this.imageToolbarInitialized) {
            this.setupImageToolbar();
            this.imageToolbarInitialized = true;
        }
        
        // Hide rotation dropdown initially
        document.getElementById('rotationOptions').style.display = 'none';
        
        // Hide crop-related buttons initially
        document.getElementById('cropImageBtn').style.display = 'block';
        document.getElementById('cancelCropBtn').style.display = 'none';
        document.getElementById('applyCropBtn').style.display = 'none';
        
        // Add resize handles to the image
        this.addResizeHandlesToImage(image);
        
        // Ensure proper positioning after a short delay to allow for DOM updates
        setTimeout(() => {
            this.updateResizeHandlePositions();
        }, 10);
    }
    
    addResizeHandlesToImage(image) {
        // Remove any existing resize handles first
        this.removeResizeHandles();
        
        // Get the parent wrapper or create one if it doesn't exist
        let wrapper = image.parentElement;
        const galleryContainer = image.closest && image.closest('.gallery-image-container');
        const isInGallery = !!galleryContainer;
        if (!wrapper.classList.contains('image-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            if (isInGallery) {
                // Fill the square container without changing layout
                wrapper.style.cssText = 'position: absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; display:block; margin:0;';
            } else {
                // Respect previously chosen positioning. If centered inline, keep flex centering.
                if (image.closest && image.closest('.image-wrapper.position-inline')) {
                    wrapper.style.cssText = 'position: relative; display: flex; justify-content: center; align-items: center; width:100%; margin: 10px 0;';
                } else {
                    wrapper.style.cssText = 'position: relative; display: inline-block; margin: 10px 0;';
                }
            }
            image.parentNode.insertBefore(wrapper, image);
            wrapper.appendChild(image);
        } else {
            // If wrapper exists and image is inside gallery, ensure natural flow so container height follows image
            if (isInGallery) {
                wrapper.style.position = 'relative';
                wrapper.style.top = '';
                wrapper.style.left = '';
                wrapper.style.right = '';
                wrapper.style.bottom = '';
                wrapper.style.width = '100%';
                wrapper.style.height = 'auto';
                wrapper.style.display = 'block';
                wrapper.style.margin = '0';
            }
        }

        // If this image is in inline-centered mode, keep centering styles intact when (re)adding handles
        try {
            if (!isInGallery && wrapper.classList.contains('position-inline')) {
                // Shrink wrapper to image and center it
                wrapper.style.display = 'block';
                wrapper.style.width = 'fit-content';
                wrapper.style.marginLeft = 'auto';
                wrapper.style.marginRight = 'auto';
                wrapper.style.float = 'none';
                wrapper.style.cssFloat = 'none';
                image.style.float = 'none';
                image.style.display = 'block';
                image.style.width = image.style.width || 'auto';
            }
        } catch (_) {}

        // Ensure wrapper positioning
        if (!isInGallery) {
            wrapper.style.position = 'relative';
            // Keep existing layout for absolute/float/inline modes; only default to inline-block otherwise
            const keepDisplay = wrapper.classList.contains('position-inline') ||
                                wrapper.classList.contains('position-absolute') ||
                                wrapper.classList.contains('float-left') ||
                                wrapper.classList.contains('float-right');
            if (!keepDisplay) {
                wrapper.style.display = 'inline-block';
            }
        } else {
            wrapper.style.position = 'relative';
            wrapper.style.display = 'block';
        }
        
        // Create resize handles
        const handlePositions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.position = pos;
            handle.style.position = 'absolute';
            handle.style.zIndex = '1000';
            wrapper.appendChild(handle);
            
            // Add event listeners for resizing
            this.setupResizeHandleEvents(handle, image);
        });
        
        // Create rotation handle
        const rotationHandle = document.createElement('div');
        rotationHandle.className = 'rotation-handle';
        rotationHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';
        rotationHandle.style.position = 'absolute';
        rotationHandle.style.zIndex = '1001';
        wrapper.appendChild(rotationHandle);
        
        // Add event listener for rotation
        this.setupRotationHandleEvents(rotationHandle, image);
        
        // Store reference to the wrapper
        this.currentImageWrapper = wrapper;
        
        // Update handle positions after wrapper is set up
        this.updateResizeHandlePositions();
    }
    
    updateResizeHandlePositions() {
        if (!this.currentImageWrapper) return;
        
        const handles = this.currentImageWrapper.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            // Ensure handles are properly positioned
            handle.style.position = 'absolute';
            handle.style.zIndex = '1000';
        });
    }
    
    setupRotationHandleEvents(handle, image) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Disable dragging temporarily if the image is in absolute position
            const wrapper = image.closest('.image-wrapper');
            if (wrapper && wrapper.classList.contains('position-absolute')) {
                wrapper.setAttribute('data-temp-draggable', wrapper.getAttribute('draggable') || 'false');
                wrapper.setAttribute('draggable', 'false');
            }
            
            // Get the center point of the image
            const rect = image.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate the initial angle
            const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            
            // Get current rotation from transform style or default to 0
            let currentRotation = 0;
            const transform = image.style.transform;
            if (transform) {
                const match = transform.match(/rotate\((-?\d+)deg\)/);
                if (match) {
                    currentRotation = parseInt(match[1]);
                }
            }
            
            // Mouse move handler for rotation
            const mouseMoveHandler = (e) => {
                // Calculate the new angle
                const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                
                // Calculate the angle difference in degrees
                let angleDiff = (newAngle - startAngle) * (180 / Math.PI);
                
                // Apply the new rotation
                const newRotation = currentRotation + angleDiff;
                image.style.transform = `rotate(${newRotation}deg)`;
                
                // Update the handle position
                handle.style.transform = `rotate(${newRotation}deg)`;
            };
            
            // Mouse up handler to stop rotation
            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                // Restore draggable functionality if it was temporarily disabled
                const wrapper = image.closest('.image-wrapper');
                if (wrapper && wrapper.hasAttribute('data-temp-draggable')) {
                    wrapper.setAttribute('draggable', wrapper.getAttribute('data-temp-draggable'));
                    wrapper.removeAttribute('data-temp-draggable');
                }
                
                // Apply the rotation to the image data using canvas
                this.applyRotationToImageData();
                this.saveState();
                this.lastAction = 'Image tournée';
            };
            
            // Add event listeners
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // Store references to remove later
            this.resizeEventHandlers = {
                mousemove: mouseMoveHandler,
                mouseup: mouseUpHandler
            };
        });
    }
    
    applyRotationToImageData() {
        if (!this.currentEditingImage) return;
        
        // Get the current rotation angle
        let currentRotation = 0;
        const transform = this.currentEditingImage.style.transform;
        if (transform) {
            const match = transform.match(/rotate\((-?\d+)deg\)/);
            if (match) {
                currentRotation = parseInt(match[1]);
            }
        }
        
        // Normalize the rotation angle to be between 0 and 360
        currentRotation = ((currentRotation % 360) + 360) % 360;
        
        // Only apply the rotation if it's significant (to avoid unnecessary processing)
        if (Math.abs(currentRotation) < 0.5) {
            this.currentEditingImage.style.transform = 'none';
            return;
        }
        
        // Create a canvas to perform the rotation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate the dimensions needed for the rotated image
        const angleInRadians = currentRotation * Math.PI / 180;
        const imgWidth = this.currentEditingImage.naturalWidth;
        const imgHeight = this.currentEditingImage.naturalHeight;
        
        // Calculate the dimensions of the rotated canvas
        const sin = Math.abs(Math.sin(angleInRadians));
        const cos = Math.abs(Math.cos(angleInRadians));
        const newWidth = Math.ceil(imgWidth * cos + imgHeight * sin);
        const newHeight = Math.ceil(imgWidth * sin + imgHeight * cos);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Move to the center of the canvas
        ctx.translate(newWidth / 2, newHeight / 2);
        
        // Rotate the canvas
        ctx.rotate(angleInRadians);
        
        // Draw the image centered on the canvas
        ctx.drawImage(this.currentEditingImage, -imgWidth / 2, -imgHeight / 2);
        
        // Apply the rotated image
        const rotatedImageDataUrl = canvas.toDataURL('image/png');
        this.currentEditingImage.src = rotatedImageDataUrl;
        
        // Reset the transform since the rotation is now in the image data
        this.currentEditingImage.style.transform = 'none';
        
        // Update the original dimensions
        this.originalImageWidth = newWidth;
        this.originalImageHeight = newHeight;
    }
    
    removeResizeHandles() {
        // Remove all resize handles
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.remove();
        });
        
        // Remove rotation handle
        const rotationHandle = document.querySelector('.rotation-handle');
        if (rotationHandle) {
            rotationHandle.remove();
        }
        
        // Remove event listeners
        if (this.resizeEventHandlers) {
            document.removeEventListener('mousemove', this.resizeEventHandlers.mousemove);
            document.removeEventListener('mouseup', this.resizeEventHandlers.mouseup);
            this.resizeEventHandlers = null;
        }
    }
    
    hideResizeAndRotationHandles() {
        // Hide all resize handles
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.style.display = 'none';
        });
        
        // Hide rotation handle
        const rotationHandle = document.querySelector('.rotation-handle');
        if (rotationHandle) {
            rotationHandle.style.display = 'none';
        }
    }
    
    setImagePosition(positionType) {
        if (!this.currentEditingImage) return;
        
        // Get the parent wrapper
        let wrapper = this.currentEditingImage.closest('.image-wrapper');
        if (!wrapper) {
            // If no wrapper exists, the image might be directly in the content
            wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            this.currentEditingImage.parentNode.insertBefore(wrapper, this.currentEditingImage);
            wrapper.appendChild(this.currentEditingImage);
        }
        
        // Remove any existing position classes
        wrapper.classList.remove('position-absolute', 'float-left', 'float-right', 'position-inline');
        
        // Reset common coordinates
        wrapper.style.position = '';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.zIndex = '';

        // Helper: clear flex centering and width from previous inline mode
        const resetWrapperLayout = () => {
            wrapper.style.display = '';
            wrapper.style.justifyContent = '';
            wrapper.style.alignItems = '';
            wrapper.style.textAlign = '';
            wrapper.style.float = '';
            // Do not force 100% width outside inline mode
            wrapper.style.width = '';
        };
        
        // Apply the new position type
        switch (positionType) {
            case 'absolute':
                // Set up for absolute positioning
                resetWrapperLayout();
                wrapper.classList.add('position-absolute');
                wrapper.style.position = 'absolute';
                // Make wrapper size to content for free movement
                wrapper.style.width = 'auto';

                // Ensure the editable container is the positioning context
                const editableEl = document.getElementById('editableContent');
                if (editableEl && getComputedStyle(editableEl).position === 'static') {
                    editableEl.style.position = 'relative';
                }

                // Compute position relative to the editable container so the image stays inside
                const rect = wrapper.getBoundingClientRect();
                const containerRect = editableEl ? editableEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
                const relLeft = Math.max(0, rect.left - containerRect.left);
                const relTop = Math.max(0, rect.top - containerRect.top);

                wrapper.style.left = relLeft + 'px';
                wrapper.style.top = relTop + 'px';
                wrapper.style.zIndex = '1';
                
                // Preserve any user-resized dimensions; only clear problematic 100% width
                try {
                    const img = this.currentEditingImage;
                    if (img) {
                        img.style.display = 'block';
                        // If width was forced to 100% in previous modes, clear it; otherwise keep current pixel/auto width
                        if (img.style.width && img.style.width.trim() === '100%') {
                            img.style.width = '';
                        }
                        // If no explicit size is set, freeze current rendered size to avoid snapping back
                        const hasExplicitW = !!img.style.width && img.style.width.trim() !== '';
                        const hasExplicitH = !!img.style.height && img.style.height.trim() !== '';
                        if (!hasExplicitW || !hasExplicitH) {
                            const r = img.getBoundingClientRect();
                            if (!hasExplicitW) img.style.width = Math.max(1, Math.round(r.width)) + 'px';
                            if (!hasExplicitH) img.style.height = Math.max(1, Math.round(r.height)) + 'px';
                        }
                        // Do not touch height to preserve user resizing
                        img.style.objectFit = '';
                        img.style.float = 'none';
                    }
                } catch (_) {}
                // Make the wrapper draggable
                this.makeImageDraggable(wrapper);
                break;
                
            case 'float-left':
                resetWrapperLayout();
                wrapper.classList.add('float-left');
                // Apply float styles directly so it works without CSS class definitions
                wrapper.style.cssFloat = 'left';
                wrapper.style.float = 'left';
                wrapper.style.display = 'block';
                wrapper.style.width = 'auto';
                const imgL = this.currentEditingImage; if (imgL) { imgL.style.float = 'none'; }
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                break;
                
            case 'float-right':
                resetWrapperLayout();
                wrapper.classList.add('float-right');
                wrapper.style.cssFloat = 'right';
                wrapper.style.float = 'right';
                wrapper.style.display = 'block';
                wrapper.style.width = 'auto';
                const imgR = this.currentEditingImage; if (imgR) { imgR.style.float = 'none'; }
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                break;
                
            case 'inline':
                wrapper.classList.add('position-inline');
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                // Center the WRAPPER so handles fit the image
                try {
                    const img = this.currentEditingImage;
                    if (img) {
                        // Wrapper shrinks to content and centers itself
                        wrapper.style.display = 'block';
                        wrapper.style.width = 'fit-content';
                        wrapper.style.marginLeft = 'auto';
                        wrapper.style.marginRight = 'auto';
                        wrapper.style.float = 'none';
                        wrapper.style.cssFloat = 'none';
                        // Image uses natural width so wrapper fits it
                        img.style.float = 'none';
                        img.style.display = 'block';
                        img.style.width = 'auto';
                    }
                } catch (_) {}
                // Center the image in view for better UX
                try { this.centerImageInView(this.currentEditingImage); } catch (_) {}
                break;
        }
        
        this.saveState();
        this.lastAction = 'Position de l\'image ajustée';
    }

    // Smoothly center the given element within the viewport/editor
    centerImageInView(el) {
        if (!el) return;
        try {
            // Prefer smooth center scroll when supported
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch (_) {
            // Fallback: immediate center without smooth behavior
            try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (__) {}
        }
    }
    
    makeImageDraggable(wrapper) {
        // Remove any existing drag handlers
        this.removeImageDraggable(wrapper);
        
        // Add draggable attribute
        wrapper.setAttribute('draggable', 'true');
        
        // Store initial position for drag operation
        let startX, startY, startLeft, startTop;
        
        // Add drag start event
        const dragStartHandler = (e) => {
            // Store the initial position
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(wrapper.style.left);
            startTop = parseInt(wrapper.style.top);
            e.preventDefault();
            e.stopPropagation();
        };
        
        // Add drag end event
        const dragEndHandler = (e) => {
            // Remove dragging class
            wrapper.classList.remove('dragging');
        };
        
        // Add drag event
        const dragHandler = (e) => {
            e.preventDefault();
        };
        
        // Add dragover event to the editable content area
        const dragOverHandler = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };
        
        // Add drop event to the editable content area
        const dropHandler = (e) => {
            e.preventDefault();
            
            // Calculate the new position
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            wrapper.style.left = (startLeft + dx) + 'px';
            wrapper.style.top = (startTop + dy) + 'px';
            
            this.saveState();
            this.lastAction = 'Image déplacée';
        };
        
        // Add mouse events for more precise dragging
        const mouseDownHandler = (e) => {
            // Only handle primary button (left-click)
            if (e.button !== 0) return;
            
            // Check if the click is on the image itself (not on a handle)
            if (e.target.tagName === 'IMG' || e.target === wrapper) {
                // Prevent default to avoid text selection
                e.preventDefault();
                
                // Store the initial position
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseInt(wrapper.style.left);
                startTop = parseInt(wrapper.style.top);
                
                // Add a class to indicate dragging
                wrapper.classList.add('dragging');
                
                // Add temporary event listeners for mouse move and up
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            }
        };
        
        const mouseMoveHandler = (e) => {
            // Calculate the new position
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let nextLeft = startLeft + dx;
            let nextTop = startTop + dy;

            // Constrain to editable content if in absolute mode
            const editableEl = document.getElementById('editableContent');
            if (wrapper.classList.contains('position-absolute') && editableEl) {
                const maxLeft = Math.max(0, editableEl.clientWidth - wrapper.offsetWidth);
                const maxTop = Math.max(0, editableEl.clientHeight - wrapper.offsetHeight);
                nextLeft = Math.min(Math.max(0, nextLeft), maxLeft);
                nextTop = Math.min(Math.max(0, nextTop), maxTop);
            }

            wrapper.style.left = nextLeft + 'px';
            wrapper.style.top = nextTop + 'px';
        };
        
        const mouseUpHandler = (e) => {
            // Remove dragging class
            wrapper.classList.remove('dragging');
            
            // Remove temporary event listeners
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            
            this.saveState();
            this.lastAction = 'Image déplacée';
        };
        
        // Add event listeners
        wrapper.addEventListener('dragstart', dragStartHandler);
        wrapper.addEventListener('dragend', dragEndHandler);
        wrapper.addEventListener('drag', dragHandler);
        document.addEventListener('dragover', dragOverHandler);
        document.addEventListener('drop', dropHandler);
        
        // Add mouse event listeners for more precise dragging
        wrapper.addEventListener('mousedown', mouseDownHandler);
        
        // Store the event handlers for later removal
        wrapper.dragHandlers = {
            dragstart: dragStartHandler,
            dragend: dragEndHandler,
            drag: dragHandler,
            dragover: dragOverHandler,
            drop: dropHandler,
            mousedown: mouseDownHandler,
            mousemove: mouseMoveHandler,
            mouseup: mouseUpHandler
        };
    }
    
    removeImageDraggable(wrapper) {
        // Remove draggable attribute
        wrapper.removeAttribute('draggable');
        
        // Remove event listeners if they exist
        if (wrapper.dragHandlers) {
            wrapper.removeEventListener('dragstart', wrapper.dragHandlers.dragstart);
            wrapper.removeEventListener('dragend', wrapper.dragHandlers.dragend);
            wrapper.removeEventListener('drag', wrapper.dragHandlers.drag);
            document.removeEventListener('dragover', wrapper.dragHandlers.dragover);
            document.removeEventListener('drop', wrapper.dragHandlers.drop);
            wrapper.removeEventListener('mousedown', wrapper.dragHandlers.mousedown);
            document.removeEventListener('mousemove', wrapper.dragHandlers.mousemove);
            document.removeEventListener('mouseup', wrapper.dragHandlers.mouseup);
            
            // Clear the handlers
            wrapper.dragHandlers = null;
        }
    }
    
    showResizeAndRotationHandles() {
        // Show all resize handles
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.style.display = 'block';
        });
        
        // Show rotation handle
        const rotationHandle = document.querySelector('.rotation-handle');
        if (rotationHandle) {
            rotationHandle.style.display = 'block';
        }
    }
    
    setupResizeHandleEvents(handle, image) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const position = handle.dataset.position;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = image.offsetWidth;
            const startHeight = image.offsetHeight;
            const aspectRatio = startWidth / startHeight;
            const keepAspectRatio = document.getElementById('keepAspectRatio').checked;
            
            // Mouse move handler for resizing
            const mouseMoveHandler = (e) => {
                let newWidth = startWidth;
                let newHeight = startHeight;
                
                // Calculate new dimensions based on handle position and mouse movement
                switch (position) {
                    case 'e':
                        newWidth = startWidth + (e.clientX - startX);
                        if (keepAspectRatio) {
                            newHeight = newWidth / aspectRatio;
                        }
                        break;
                    case 'w':
                        newWidth = startWidth - (e.clientX - startX);
                        if (keepAspectRatio) {
                            newHeight = newWidth / aspectRatio;
                        }
                        break;
                    case 's':
                        newHeight = startHeight + (e.clientY - startY);
                        if (keepAspectRatio) {
                            newWidth = newHeight * aspectRatio;
                        }
                        break;
                    case 'n':
                        newHeight = startHeight - (e.clientY - startY);
                        if (keepAspectRatio) {
                            newWidth = newHeight * aspectRatio;
                        }
                        break;
                    case 'se':
                        newWidth = startWidth + (e.clientX - startX);
                        newHeight = startHeight + (e.clientY - startY);
                        if (keepAspectRatio) {
                            // Use the larger change to determine the new size
                            const widthChange = (e.clientX - startX) / startWidth;
                            const heightChange = (e.clientY - startY) / startHeight;
                            if (Math.abs(widthChange) > Math.abs(heightChange)) {
                                newHeight = newWidth / aspectRatio;
                            } else {
                                newWidth = newHeight * aspectRatio;
                            }
                        }
                        break;
                    case 'sw':
                        newWidth = startWidth - (e.clientX - startX);
                        newHeight = startHeight + (e.clientY - startY);
                        if (keepAspectRatio) {
                            // Use the larger change to determine the new size
                            const widthChange = (e.clientX - startX) / startWidth;
                            const heightChange = (e.clientY - startY) / startHeight;
                            if (Math.abs(widthChange) > Math.abs(heightChange)) {
                                newHeight = newWidth / aspectRatio;
                            } else {
                                newWidth = newHeight * aspectRatio;
                            }
                        }
                        break;
                    case 'ne':
                        newWidth = startWidth + (e.clientX - startX);
                        newHeight = startHeight - (e.clientY - startY);
                        if (keepAspectRatio) {
                            // Use the larger change to determine the new size
                            const widthChange = (e.clientX - startX) / startWidth;
                            const heightChange = (e.clientY - startY) / startHeight;
                            if (Math.abs(widthChange) > Math.abs(heightChange)) {
                                newHeight = newWidth / aspectRatio;
                            } else {
                                newWidth = newHeight * aspectRatio;
                            }
                        }
                        break;
                    case 'nw':
                        newWidth = startWidth - (e.clientX - startX);
                        newHeight = startHeight - (e.clientY - startY);
                        if (keepAspectRatio) {
                            // Use the larger change to determine the new size
                            const widthChange = (e.clientX - startX) / startWidth;
                            const heightChange = (e.clientY - startY) / startHeight;
                            if (Math.abs(widthChange) > Math.abs(heightChange)) {
                                newHeight = newWidth / aspectRatio;
                            } else {
                                newWidth = newHeight * aspectRatio;
                            }
                        }
                        break;
                }
                
                // Ensure minimum size
                newWidth = Math.max(20, newWidth);
                newHeight = Math.max(20, newHeight);
                
                // Apply new dimensions
                image.style.width = newWidth + 'px';
                image.style.height = newHeight + 'px';
                
                // Update the slider to reflect the new size (if present)
                const newPercentage = Math.round((newWidth / this.originalImageWidth) * 100);
                const resizeSlider = document.getElementById('resizeSlider');
                const resizePercentage = document.getElementById('resizePercentage');
                if (resizeSlider) resizeSlider.value = newPercentage;
                if (resizePercentage) resizePercentage.textContent = newPercentage + '%';
            };
            
            // Mouse up handler to stop resizing
            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                this.saveState();
                this.lastAction = 'Taille de l\'image ajustée';
            };
            
            // Add event listeners
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // Store references to remove later
            this.resizeEventHandlers = {
                mousemove: mouseMoveHandler,
                mouseup: mouseUpHandler
            };
        });
    }
    
    hideImageEditingTools() {
        const toolbar = document.getElementById('imageToolbar');
        toolbar.style.display = 'none';
        
        if (this.currentEditingImage) {
            this.currentEditingImage.classList.remove('image-being-edited');
            this.currentEditingImage = null;
        }
        
        // Reset original image source reference
        this.originalImageSrc = null;
        
        // Remove resize handles
        this.removeResizeHandles();
        
        this.cancelImageCropping();
    }
    
    startImageCropping() {
        if (!this.currentEditingImage) return;
        
        // Hide resize and rotation handles when cropping
        this.hideResizeAndRotationHandles();
        
        // Temporarily disable dragging if the image is in absolute position
        const wrapper = this.currentEditingImage.closest('.image-wrapper');
        if (wrapper && wrapper.classList.contains('position-absolute')) {
            wrapper.setAttribute('data-temp-draggable', wrapper.getAttribute('draggable') || 'false');
            wrapper.setAttribute('draggable', 'false');
            
            // Also remove mousedown handler temporarily
            if (wrapper.dragHandlers && wrapper.dragHandlers.mousedown) {
                wrapper.removeEventListener('mousedown', wrapper.dragHandlers.mousedown);
            }
        }
        
        // Create crop overlay
        const overlay = document.createElement('div');
        overlay.className = 'crop-overlay';
        
        // Position the overlay over the image
        const rect = this.currentEditingImage.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Ensure we're using absolute positioning with correct coordinates
        overlay.style.position = 'absolute';
        overlay.style.left = Math.round(rect.left + scrollLeft) + 'px';
        overlay.style.top = Math.round(rect.top + scrollTop) + 'px';
        overlay.style.width = Math.round(rect.width) + 'px';
        overlay.style.height = Math.round(rect.height) + 'px';
        overlay.style.zIndex = '1002';
        overlay.style.pointerEvents = 'auto';
        
        // Create resize handles
        const handles = ['tl', 'tr', 'bl', 'br'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `crop-handle ${pos}`;
            handle.style.position = 'absolute';
            handle.style.width = '10px';
            handle.style.height = '10px';
            handle.style.backgroundColor = '#007bff';
            handle.style.border = '2px solid #ffffff';
            handle.style.borderRadius = '50%';
            handle.style.zIndex = '1003';
            overlay.appendChild(handle);
        });
        
        // Add the overlay to the document
        document.body.appendChild(overlay);
        this.cropOverlay = overlay;
        
        // Show crop control buttons
        document.getElementById('cropImageBtn').style.display = 'none';
        document.getElementById('cancelCropBtn').style.display = 'block';
        document.getElementById('applyCropBtn').style.display = 'block';
        
        // Setup drag and resize events
        this.setupCropEvents(overlay);
    }
    
    setupCropEvents(overlay) {
        let isDragging = false;
        let isResizing = false;
        let currentHandle = null;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        
        // Mouse down on overlay (for moving)
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseInt(overlay.style.left);
                startTop = parseInt(overlay.style.top);
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Mouse down on handle (for resizing)
        const handles = overlay.querySelectorAll('.crop-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentHandle = handle;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(overlay.style.width);
                startHeight = parseInt(overlay.style.height);
                startLeft = parseInt(overlay.style.left);
                startTop = parseInt(overlay.style.top);
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Mouse move (for both moving and resizing)
        const mouseMoveHandler = (e) => {
            if (isDragging) {
                // Move the overlay, constrained to image bounds
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Get image bounds to constrain movement
                const imgRect = this.currentEditingImage.getBoundingClientRect();
                const imgScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const imgScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                const imgLeft = imgRect.left + imgScrollLeft;
                const imgTop = imgRect.top + imgScrollTop;
                const imgRight = imgLeft + imgRect.width;
                const imgBottom = imgTop + imgRect.height;
                
                const overlayWidth = parseInt(overlay.style.width);
                const overlayHeight = parseInt(overlay.style.height);
                
                const newLeft = Math.max(imgLeft, Math.min(startLeft + dx, imgRight - overlayWidth));
                const newTop = Math.max(imgTop, Math.min(startTop + dy, imgBottom - overlayHeight));
                
                overlay.style.left = newLeft + 'px';
                overlay.style.top = newTop + 'px';
            } else if (isResizing && currentHandle) {
                // Resize the overlay based on which handle is being dragged
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Get image bounds to constrain crop area
                const imgRect = this.currentEditingImage.getBoundingClientRect();
                const imgScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const imgScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                const imgLeft = imgRect.left + imgScrollLeft;
                const imgTop = imgRect.top + imgScrollTop;
                const imgRight = imgLeft + imgRect.width;
                const imgBottom = imgTop + imgRect.height;
                
                if (currentHandle.classList.contains('br')) {
                    const newWidth = Math.max(20, Math.min(startWidth + dx, imgRight - startLeft));
                    const newHeight = Math.max(20, Math.min(startHeight + dy, imgBottom - startTop));
                    overlay.style.width = newWidth + 'px';
                    overlay.style.height = newHeight + 'px';
                } else if (currentHandle.classList.contains('bl')) {
                    const newLeft = Math.max(imgLeft, Math.min(startLeft + dx, startLeft + startWidth - 20));
                    const newWidth = startLeft + startWidth - newLeft;
                    const newHeight = Math.max(20, Math.min(startHeight + dy, imgBottom - startTop));
                    overlay.style.width = newWidth + 'px';
                    overlay.style.left = newLeft + 'px';
                    overlay.style.height = newHeight + 'px';
                } else if (currentHandle.classList.contains('tr')) {
                    const newWidth = Math.max(20, Math.min(startWidth + dx, imgRight - startLeft));
                    const newTop = Math.max(imgTop, Math.min(startTop + dy, startTop + startHeight - 20));
                    const newHeight = startTop + startHeight - newTop;
                    overlay.style.width = newWidth + 'px';
                    overlay.style.height = newHeight + 'px';
                    overlay.style.top = newTop + 'px';
                } else if (currentHandle.classList.contains('tl')) {
                    const newLeft = Math.max(imgLeft, Math.min(startLeft + dx, startLeft + startWidth - 20));
                    const newTop = Math.max(imgTop, Math.min(startTop + dy, startTop + startHeight - 20));
                    const newWidth = startLeft + startWidth - newLeft;
                    const newHeight = startTop + startHeight - newTop;
                    overlay.style.width = newWidth + 'px';
                    overlay.style.left = newLeft + 'px';
                    overlay.style.height = newHeight + 'px';
                    overlay.style.top = newTop + 'px';
                }
            }
        };
        
        // Mouse up (end drag/resize)
        const mouseUpHandler = () => {
            isDragging = false;
            isResizing = false;
            currentHandle = null;
        };
        
        // Add event listeners to document
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        
        // Store references to remove later
        this.cropEventHandlers = {
            mousemove: mouseMoveHandler,
            mouseup: mouseUpHandler
        };
    }
    
    cancelImageCropping() {
        if (this.cropOverlay) {
            document.body.removeChild(this.cropOverlay);
            this.cropOverlay = null;
        }
        
        // Remove event listeners
        if (this.cropEventHandlers) {
            document.removeEventListener('mousemove', this.cropEventHandlers.mousemove);
            document.removeEventListener('mouseup', this.cropEventHandlers.mouseup);
            this.cropEventHandlers = null;
        }
        
        // Reset UI
        document.getElementById('cropImageBtn').style.display = 'block';
        document.getElementById('cancelCropBtn').style.display = 'none';
        document.getElementById('applyCropBtn').style.display = 'none';
        
        // Restore draggable functionality if it was temporarily disabled
        if (this.currentEditingImage) {
            const wrapper = this.currentEditingImage.closest('.image-wrapper');
            if (wrapper && wrapper.hasAttribute('data-temp-draggable')) {
                wrapper.setAttribute('draggable', wrapper.getAttribute('data-temp-draggable'));
                wrapper.removeAttribute('data-temp-draggable');
                
                // Re-add mousedown handler if it exists
                if (wrapper.dragHandlers && wrapper.dragHandlers.mousedown) {
                    wrapper.addEventListener('mousedown', wrapper.dragHandlers.mousedown);
                }
            }
        }
        
        // Show resize and rotation handles again
        this.showResizeAndRotationHandles();
    }
    
    applyImageCropping() {
        if (!this.currentEditingImage || !this.cropOverlay) return;
        
        // Get the crop dimensions
        const imgRect = this.currentEditingImage.getBoundingClientRect();
        const cropRect = this.cropOverlay.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Validate that we have valid dimensions
        if (imgRect.width <= 0 || imgRect.height <= 0 || cropRect.width <= 0 || cropRect.height <= 0) {
            alert('Dimensions de recadrage invalides. Veuillez réessayer.');
            this.cancelImageCropping();
            return;
        }
        
        // Calculate crop coordinates relative to the image
        // We need to scale the coordinates based on the actual image dimensions vs displayed dimensions
        const scaleX = this.currentEditingImage.naturalWidth / imgRect.width;
        const scaleY = this.currentEditingImage.naturalHeight / imgRect.height;
        
        const cropLeft = Math.max(0, (cropRect.left - imgRect.left) * scaleX);
        const cropTop = Math.max(0, (cropRect.top - imgRect.top) * scaleY);
        const cropWidth = Math.min(cropRect.width * scaleX, this.currentEditingImage.naturalWidth - cropLeft);
        const cropHeight = Math.min(cropRect.height * scaleY, this.currentEditingImage.naturalHeight - cropTop);
        
        // Validate crop dimensions
        if (cropWidth <= 0 || cropHeight <= 0) {
            alert('Zone de recadrage trop petite. Veuillez sélectionner une zone plus grande.');
            this.cancelImageCropping();
            return;
        }
        
        // Create a canvas to perform the crop
        const canvas = document.createElement('canvas');
        // Ensure we have positive dimensions for the canvas
        canvas.width = Math.max(1, Math.round(cropWidth));
        canvas.height = Math.max(1, Math.round(cropHeight));
        const ctx = canvas.getContext('2d');
        
        // Draw the cropped portion of the image onto the canvas
        try {
            // Ensure all parameters are valid numbers
            const sourceX = Math.max(0, Math.round(cropLeft));
            const sourceY = Math.max(0, Math.round(cropTop));
            const sourceWidth = Math.min(Math.round(cropWidth), this.currentEditingImage.naturalWidth - sourceX);
            const sourceHeight = Math.min(Math.round(cropHeight), this.currentEditingImage.naturalHeight - sourceY);
            
            // Only proceed if we have valid dimensions
            if (sourceWidth > 0 && sourceHeight > 0 && sourceX < this.currentEditingImage.naturalWidth && sourceY < this.currentEditingImage.naturalHeight) {
                ctx.drawImage(
                    this.currentEditingImage,
                    sourceX, sourceY, sourceWidth, sourceHeight,
                    0, 0, canvas.width, canvas.height
                );
            } else {
                throw new Error('Invalid crop dimensions or position');
            }
            
            // Replace the original image with the cropped version
            const croppedImageDataUrl = canvas.toDataURL('image/png');
            
            // Store the new image as the original for future resizing
            const newImg = new Image();
            newImg.onload = () => {
                this.originalImageWidth = newImg.width;
                this.originalImageHeight = newImg.height;
                
                // Update the resize slider to 100% since we're starting fresh with the cropped image (if present)
                const resizeSlider = document.getElementById('resizeSlider');
                const resizePercentage = document.getElementById('resizePercentage');
                if (resizeSlider) resizeSlider.value = 100;
                if (resizePercentage) resizePercentage.textContent = '100%';
            };
            newImg.src = croppedImageDataUrl;
            
            // Apply the cropped image to the current image
            this.currentEditingImage.src = croppedImageDataUrl;
            
            // Clean up
            this.cancelImageCropping();
            
            // Show resize and rotation handles again
            this.showResizeAndRotationHandles();
            
            this.saveState();
            this.lastAction = 'Image recadrée';
        } catch (error) {
            console.error('Error during image cropping:', error);
            alert('Une erreur est survenue lors du recadrage de l\'image. Veuillez réessayer.');
            this.cancelImageCropping();
        }
    }

    openImageSelector(targetContainer) {
        console.log('openImageSelector called with:', targetContainer);
        this.currentTargetContainer = targetContainer;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            console.log('File selected:', e.target.files[0]);
            const file = e.target.files[0];
            if (file) {
                try {
                    const dataUrl = await this.compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.9 });
                    console.log('File loaded, calling insertImageIntoColumn');
                    this.insertImageIntoColumn(dataUrl, file.name, targetContainer);
                } catch (err) {
                    const reader = new FileReader();
                    reader.onload = (ev) => this.insertImageIntoColumn(ev.target.result, file.name, targetContainer);
                    reader.readAsDataURL(file);
                }
            }
        };
        console.log('Triggering file input click');
        input.click();
    }

    insertImageIntoColumn(src, altText, targetContainer) {
        console.log('insertImageIntoColumn called with:', { src: src.substring(0, 50) + '...', altText, targetContainer });
        const img = document.createElement('img');
        img.src = src;
        img.alt = altText;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = '400px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        
        // Replace the placeholder content with the image
        console.log('Replacing placeholder content with image');
        targetContainer.innerHTML = '';
        targetContainer.appendChild(img);
        
        // Make the image clickable for editing
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectImage(img);
        });
        
        console.log('Image inserted successfully');
        this.saveState();
        this.updateLastModified();
        this.autoSaveToLocalStorage();
        this.lastAction = 'Image insérée';
    }

    insertImage(src, altText) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = altText;
        
        // Apply default image styles
        img.style.cssText = 'max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
        
        // Store original image source for reset functionality
        img.dataset.originalSrc = src;
        
        // Create a wrapper for the image to contain resize handles and delete button
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper position-inline';
        wrapper.style.cssText = 'position: relative; display: block; margin: 15px auto;';
        
        // Add mouse position tracking for the wrapper
        wrapper.addEventListener('mousedown', (e) => {
            // Store the mouse position when clicking on the image
            this.lastMousePosition = { x: e.clientX, y: e.clientY };
            e.stopPropagation();
        });
        wrapper.appendChild(img);
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.title = 'Supprimer l\'image';
        deleteBtn.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #dc3545;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            display: none;
            z-index: 1000;
            font-size: 12px;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        
        // Add delete button click event
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
                wrapper.remove();
                this.saveState();
                this.updateLastModified();
                this.autoSaveToLocalStorage();
                this.lastAction = 'Image supprimée';
            }
        });
        
        wrapper.appendChild(deleteBtn);
        
        // Show/hide delete button on hover
        wrapper.addEventListener('mouseenter', () => {
            deleteBtn.style.display = 'block';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            deleteBtn.style.display = 'none';
        });
        
        // Add click event to make the image editable (disabled for gallery images)
        img.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (img.closest && img.closest('.gallery-section')) {
                return; // gallery images managed by gallery tools only
            }
            const rich = document.getElementById('richTextToolbar');
            if (rich) rich.style.display = 'none';
            const tableTb = document.getElementById('tableToolbar');
            if (tableTb) tableTb.style.display = 'none';
            this.showImageEditingTools(img);
        });
        
        // Add keyboard support for deletion
        wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
                    wrapper.remove();
                    this.saveState();
                    this.updateLastModified();
                    this.autoSaveToLocalStorage();
                    this.lastAction = 'Image supprimée';
                }
            }
        });
        
        // Make wrapper focusable for keyboard events
        wrapper.setAttribute('tabindex', '0');
        
        this.insertElementAtCursor(wrapper);
        this.saveState();
        this.lastAction = 'Image insérée';
    }

    insertVideo(url) {
        let embedCode = '';
        
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = this.extractYouTubeId(url);
            embedCode = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="width:70%; margin: 10px auto; display:block; height:auto; aspect-ratio:16/9;"></iframe>`;
        } else if (url.includes('vimeo.com')) {
            const videoId = this.extractVimeoId(url);
            embedCode = `<iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allowfullscreen style="width:70%; margin: 10px auto; display:block; height:auto; aspect-ratio:16/9;"></iframe>`;
        } else {
            embedCode = `<video controls style="max-width: 100%; margin: 10px 0;"><source src="${url}" type="video/mp4">Votre navigateur ne supporte pas la vidéo.</video>`;
        }
        
        this.insertHTMLAtCursor(embedCode);
        this.saveState();
        this.lastAction = 'Vidéo insérée';
    }

    insertLocalVideo(src, name) {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.style.cssText = 'max-width: 100%; margin: 10px 0;';
        
        this.insertElementAtCursor(video);
        this.saveState();
        this.lastAction = 'Vidéo insérée';
    }

    // Normalize all embedded videos/iframes to be 70% width, centered, with proper height
    normalizeVideoStyles(root) {
        const host = root || document.getElementById('editableContent');
        if (!host) return;
        const nodes = host.querySelectorAll('iframe, video');
        nodes.forEach((n) => {
            try {
                // Remove fixed attributes that might constrain responsive layout
                if (n.hasAttribute('width')) n.removeAttribute('width');
                if (n.hasAttribute('height')) n.removeAttribute('height');
                // Apply consistent sizing and centering
                n.style.width = '70%';
                n.style.margin = '10px auto';
                n.style.display = 'block';
                // Ensure proper height behavior
                n.style.height = 'auto';
                // Help browsers maintain aspect ratio (works for iframes and videos in modern browsers)
                try { n.style.aspectRatio = '16 / 9'; } catch (_) {}
            } catch (_) {}
        });
    }

    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    extractVimeoId(url) {
        const regExp = /vimeo.com\/(\d+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }

    insertTable() {
        const rows = prompt('Nombre de lignes:', '3');
        const cols = prompt('Nombre de colonnes:', '3');
        
        if (rows && cols) {
            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse; margin: 20px 0;';
            
            for (let i = 0; i < parseInt(rows); i++) {
                const row = document.createElement('tr');
                for (let j = 0; j < parseInt(cols); j++) {
                    const cell = document.createElement(i === 0 ? 'th' : 'td');
                    cell.contentEditable = true;
                    cell.style.cssText = 'border: 1px solid #ddd; padding: 8px; text-align: left;';
                    cell.textContent = i === 0 ? `En-tête ${j + 1}` : `Cellule ${i},${j + 1}`;
                    row.appendChild(cell);
                }
                table.appendChild(row);
            }
            
            this.insertElementAtCursor(table);
            this.saveState();
            this.lastAction = 'Tableau inséré';
        }
    }

    insertArticleSection() {
        const articleSection = document.createElement('div');
        articleSection.className = 'newsletter-section article-section';
        articleSection.style.cssText = 'margin: 30px 0; padding: 25px; background-color: #ffffff; border-left: 4px solid #007bff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        
        articleSection.innerHTML = `
            <div class="article-header" style="margin-bottom: 20px;">
                <h2 contenteditable="true" style="color: #333; margin: 0 0 10px 0; font-size: 24px;">Titre de l'article</h2>
                <div class="article-meta" style="color: #666; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                    <span contenteditable="true">Par: Nom de l'auteur</span> | 
                    <span contenteditable="true">Catégorie: Actualités</span> | 
                    <span>${new Date().toLocaleDateString('fr-FR')}</span>
                </div>
            </div>
            <div class="article-content" style="line-height: 1.8;">
                <p contenteditable="true" style="margin-bottom: 15px;">Cliquez ici pour écrire le contenu de votre article. Vous pouvez ajouter plusieurs paragraphes, des images et du formatage.</p>
                <p contenteditable="true" style="margin-bottom: 15px;">Deuxième paragraphe de votre article. Continuez à développer votre contenu ici.</p>
            </div>
            <div class="article-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                <p contenteditable="true" style="color: #888; font-size: 14px;">Publié le: <span style="font-weight: bold;">${new Date().toLocaleDateString('fr-FR')}</span></p>
            </div>
        `;
        
        this.insertElementAtCursor(articleSection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section article insérée';
    }

    insertGallerySection() {
        const gallerySection = document.createElement('div');
        gallerySection.className = 'gallery-section';
        
        gallerySection.innerHTML = `
            <h3 class="gallery-title" contenteditable="true">Galerie d'images</h3>
            <div class="gallery-grid">
                <div class="gallery-item add-image-placeholder">
                    <i class="fas fa-plus"></i>
                    <p contenteditable="false">Cliquez pour ajouter des images</p>
                </div>
            </div>
            <input type="file" class="gallery-upload" multiple accept="image/*" style="display: none;">
            <button class="add-more-btn" style="display: none; margin-top: 10px; padding: 8px 16px; background: #0a9bcd; color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-plus"></i> Ajouter plus d'images
            </button>
        `;
        
        const galleryGrid = gallerySection.querySelector('.gallery-grid');
        const addImagePlaceholder = gallerySection.querySelector('.add-image-placeholder');
        const fileInput = gallerySection.querySelector('.gallery-upload');
        
        const addMoreBtn = gallerySection.querySelector('.add-more-btn');
        
        // Function to handle adding images
        const handleAddImage = () => {
            fileInput.click();
        };
        
        // Click handler for adding images (initial add button)
        addImagePlaceholder.addEventListener('click', handleAddImage);
        
        // Click handler for the "add more" button
        addMoreBtn.addEventListener('click', handleAddImage);
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                // Hide the initial add button and show the "add more" button
                addImagePlaceholder.style.display = 'none';
                addMoreBtn.style.display = 'block';
                
                files.forEach(file => {
                    if (file.type.startsWith('image/')) {
                        this.addImageToGallery(file, galleryGrid);
                    }
                });
                // Reset file input
                fileInput.value = '';
            }
        });
        
        this.insertElementAtCursor(gallerySection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section galerie insérée';
    }

    addImageToGallery(file, galleryGrid) {
        const handleLoaded = (dataUrl) => {
            // Create image container with proper classes for editing
            const imageContainer = document.createElement('div');
            imageContainer.className = 'gallery-item';
            imageContainer.contentEditable = false;
            imageContainer.style.position = 'relative';
            
            // Create image element with same properties as regular images
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = file.name || 'Gallery Image';
            img.draggable = false;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.borderRadius = '8px';
            // Enable standard image tools on click (floating, inline, absolute, etc.)
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                try { this.showImageEditingTools(img); } catch (_) {}
            });
            
            // Add image to container only (no overlay)
            imageContainer.appendChild(img);
            
            // Remove old hover overlay behavior (no-op)
            
            // Remove custom delete/replace overlay controls (standard image toolbar will handle actions)
            
            // Allow clicks to propagate to image tools via img handler above
            
            // Add drag and drop for reordering
            imageContainer.draggable = true;
            imageContainer.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', '');
                imageContainer.classList.add('dragging');
                setTimeout(() => {
                    imageContainer.style.opacity = '0.4';
                }, 0);
            });
            
            imageContainer.addEventListener('dragend', () => {
                imageContainer.classList.remove('dragging');
                imageContainer.style.opacity = '1';
            });
            
            // Create image wrapper
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'gallery-image-wrapper';
            imageWrapper.style.position = 'relative';
            imageWrapper.style.flex = '1';
            imageWrapper.style.display = 'flex';
            imageWrapper.style.flexDirection = 'column';
            
            // Add image to wrapper
            const imageContainerInner = document.createElement('div');
            imageContainerInner.className = 'gallery-image-container';
            imageContainerInner.style.position = 'relative';
            imageContainerInner.style.width = '100%';
            // Keep original image aspect ratio: no forced square
            imageContainerInner.style.paddingBottom = '';
            imageContainerInner.style.overflow = 'hidden';
            
            // Style the image to preserve aspect ratio
            img.style.position = 'static';
            img.style.top = '';
            img.style.left = '';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.objectFit = 'contain';
            
            // Add image to container
            imageContainerInner.appendChild(img);
            // No overlay appended
            
            // Create description area
            const description = document.createElement('div');
            description.className = 'gallery-description';
            description.contentEditable = true;
            description.setAttribute('data-placeholder', 'Cliquez pour ajouter une description');
            description.style.userSelect = 'text';
            description.style.pointerEvents = 'auto';
            
            // Add focus/blur handlers for the description
            const handleFocus = (e) => {
                e.stopPropagation();
                if (description.textContent === 'Cliquez pour ajouter une description') {
                    description.textContent = '';
                }
                // Prevent the gallery item click handler from firing
                e.stopImmediatePropagation();
            };
            
            const handleBlur = (e) => {
                e.stopPropagation();
                if (!description.textContent.trim()) {
                    description.textContent = 'Cliquez pour ajouter une description';
                } else {
                    this.saveState();
                    this.lastAction = 'Description de galerie modifiée';
                }
            };
            
            // Prevent Enter key from creating new lines
            const handleKeyDown = (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    description.blur();
                }
            };
            
            // Add event listeners
            const stopProp = (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            };
            
            description.addEventListener('mousedown', stopProp, true);
            description.addEventListener('click', stopProp, true);
            description.addEventListener('dblclick', stopProp, true);
            description.addEventListener('focus', handleFocus, true);
            description.addEventListener('blur', handleBlur, true);
            description.addEventListener('keydown', handleKeyDown, true);
            
            // Set initial text
            description.textContent = 'Cliquez pour ajouter une description';
            
            // Add elements to container
            imageWrapper.appendChild(imageContainerInner);
            imageWrapper.appendChild(description);
            imageContainer.appendChild(imageWrapper);
            
            // Remove overlay-related pointer events and hover behavior
            
            // Insert before the add image placeholder
            const addButton = galleryGrid.querySelector('.add-image-placeholder');
            if (addButton) {
                galleryGrid.insertBefore(imageContainer, addButton);
            } else {
                galleryGrid.appendChild(imageContainer);
            }
            
            this.saveState();
            this.lastAction = 'Image de galerie ajoutée';
        };

        // Load original image data without compression for gallery inserts
        const reader = new FileReader();
        reader.onload = (e) => handleLoaded(e.target.result);
        reader.readAsDataURL(file);
    }
    
    // Helper method to handle drag over for gallery items
    handleGalleryDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            draggable.parentNode.appendChild(draggable);
        } else {
            draggable.parentNode.insertBefore(draggable, afterElement);
        }
    }
    
    // Helper method to get the element after which to place the dragged item
    getDragAfterElement(y) {
        const draggableElements = [...document.querySelectorAll('.gallery-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    showImageModal(src, alt) {
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;
        
        // Create image
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
            cursor: default;
        `;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 30px;
            background: none;
            border: none;
            color: white;
            font-size: 40px;
            cursor: pointer;
            z-index: 10001;
        `;
        
        // Close modal events
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        modal.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        img.addEventListener('click', (e) => e.stopPropagation());
        
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
    }

    insertQuoteSection() {
        const quoteSection = document.createElement('div');
        quoteSection.className = 'newsletter-section quote-section';
        quoteSection.style.cssText = 'margin: 30px 0; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; position: relative;';
        
        quoteSection.innerHTML = `
            <div style="position: absolute; top: 15px; left: 25px; font-size: 48px; opacity: 0.3;">
                <i class="fas fa-tags"></i>
            </div>
            <blockquote style="margin: 0; padding-left: 60px; font-size: 18px; line-height: 1.6; font-style: italic;">
                <p contenteditable="true" style="margin-bottom: 20px; color: white;">Mettez en avant votre promotion ici. Décrivez l'offre, les dates et les conditions principales.</p>
            </blockquote>
            <footer style="text-align: right; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
                <p contenteditable="true" style="color: rgba(255,255,255,0.9); font-size: 16px;">— Conditions</p>
            </footer>
        `;
        
        this.insertElementAtCursor(quoteSection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section citation insérée';
    }

    insertCTASection() {
        const ctaSection = document.createElement('div');
        ctaSection.className = 'newsletter-section cta-section';
        ctaSection.style.cssText = 'margin: 30px 0; padding: 40px; background: linear-gradient(135deg, #ff6b6b, #ee5a24); border-radius: 12px; text-align: center; color: white;';
        
        ctaSection.innerHTML = `
            <div style="margin-bottom: 20px;">
                <i class="fas fa-bullhorn" style="font-size: 48px; margin-bottom: 20px; opacity: 0.9;"></i>
            </div>
            <h3 contenteditable="true" style="color: white; margin: 0 0 15px 0; font-size: 28px; font-weight: bold;">Annonce</h3>
            <p contenteditable="true" style="color: rgba(255,255,255,0.9); font-size: 18px; margin-bottom: 25px; line-height: 1.6;">Publiez ici une annonce importante. Modifiez ce texte selon votre besoin.</p>
            <a href="inscription.html" class="webinar-button" style="display: inline-block !important; background: white !important; color: #ee5a24 !important; padding: 15px 30px !important; border-radius: 50px !important; text-decoration: none !important; font-weight: bold !important; font-size: 16px !important; transition: transform 0.3s ease !important; box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important; border: none !important;">En savoir plus</a>
        `;
        
        this.insertElementAtCursor(ctaSection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section CTA insérée';
    }

    insertContactSection() {
        const contactSection = document.createElement('div');
        contactSection.className = 'newsletter-section contact-section';
        contactSection.style.cssText = 'margin: 30px 0; padding: 30px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;';
        
        contactSection.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <i class="fas fa-address-card" style="font-size: 36px; color: #6c757d; margin-bottom: 15px;"></i>
                <h3 contenteditable="true" style="color: #333; margin: 0; font-size: 24px;">Contactez-nous</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-envelope" style="font-size: 24px; color: #007bff; margin-bottom: 10px;"></i>
                    <h4 style="margin: 0 0 5px 0; color: #333;">Email</h4>
                    <p contenteditable="true" style="margin: 0; color: #666;">contact@exemple.com</p>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-phone" style="font-size: 24px; color: #28a745; margin-bottom: 10px;"></i>
                    <h4 style="margin: 0 0 5px 0; color: #333;">Téléphone</h4>
                    <p contenteditable="true" style="margin: 0; color: #666;">+33 1 23 45 67 89</p>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-map-marker-alt" style="font-size: 24px; color: #dc3545; margin-bottom: 10px;"></i>
                    <h4 style="margin: 0 0 5px 0; color: #333;">Adresse</h4>
                    <p contenteditable="true" style="margin: 0; color: #666;">123 Rue Exemple<br>75000 Paris, France</p>
                </div>
            </div>
        `;
        
        this.insertElementAtCursor(contactSection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section contact insérée';
    }

    insertTwoColumnSection() {
        const twoColumnSection = document.createElement('div');
        twoColumnSection.className = 'newsletter-section two-column-layout syc-item';
        twoColumnSection.style.cssText = 'display: flex; gap: 20px; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;';

        twoColumnSection.innerHTML = `
            <div class="column" style="flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div contenteditable="true">
                    <h3>Titre 1</h3>
                    <p>Contenu de l'élément 1. Ajoutez du texte, des images et d'autres éléments ici.</p>
                </div>
            </div>
            <div class="column" style="flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div class="image-placeholder" contenteditable="false" style="border: 2px dashed #ccc; padding: 40px; text-align: center; cursor: pointer; border-radius: 8px;">
                    <i class="fas fa-image" style="font-size: 24px; color: #6c757d; margin-bottom: 10px;"></i>
                    <p style="color: #6c757d; margin: 0;">Cliquez pour ajouter une image</p>
                </div>
            </div>
        `;

        // Disappearing notice text for left column: clear on first focus/click if unchanged
        try {
            const leftColumn = twoColumnSection.querySelector('.column');
            const leftEditable = leftColumn && leftColumn.querySelector('[contenteditable="true"]');
            if (leftEditable) {
                const defaultTextMatcher = () => (leftEditable.textContent || '').trim().startsWith('Titre 1')
                    && (leftEditable.textContent || '').includes("Contenu de l'élément 1");
                const clearIfDefault = () => {
                    if (!leftEditable.dataset.cleared && defaultTextMatcher()) {
                        // Replace with a blank paragraph to retain height and caret
                        leftEditable.innerHTML = '<p><br></p>';
                        leftEditable.dataset.cleared = '1';
                        try {
                            // Place caret inside the blank paragraph
                            const p = leftEditable.querySelector('p');
                            if (p) {
                                const range = document.createRange();
                                range.selectNodeContents(p);
                                range.collapse(true);
                                const sel = window.getSelection();
                                sel.removeAllRanges();
                                sel.addRange(range);
                                leftEditable.focus();
                            }
                        } catch (_) {}
                    }
                };
                // Prevent bubbling so clicks/keys in left text do not trigger image/section handlers
                ['mousedown','click','keydown','keyup'].forEach(evt => {
                    leftEditable.addEventListener(evt, (e) => {
                        e.stopPropagation();
                    });
                });
                leftEditable.addEventListener('focus', clearIfDefault);
                leftEditable.addEventListener('click', clearIfDefault);
            }
        } catch (_) {}

        const imagePlaceholder = twoColumnSection.querySelector('.image-placeholder');
        imagePlaceholder.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';

            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = document.createElement('img');
                        img.src = event.target.result;
                        img.alt = 'Image';
                        img.setAttribute('contenteditable', 'false');
                        img.style.cssText = 'width:100%;height:auto;border-radius:8px;display:block;';
                        // Make the image clickable for editing later
                        img.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            try { this.selectImage(img); } catch (_) {}
                        });
                        // Remove any element(s) under the placeholder in the right column (text blocks, wrappers, etc.)
                        // This avoids leaving misleading default text below the image
                        try {
                            let sib = imagePlaceholder.nextElementSibling;
                            while (sib) {
                                const next = sib.nextElementSibling;
                                sib.remove();
                                sib = next;
                            }
                        } catch (_) {}
                        imagePlaceholder.replaceWith(img);
                        // Safety pass: remove any elements below the image in the same right column
                        try {
                            const column = img.closest('.column');
                            if (column) {
                                const children = Array.from(column.children);
                                let imgSeen = false;
                                for (const child of children) {
                                    if (child === img || (child.querySelector && child.querySelector('img') === img)) {
                                        imgSeen = true;
                                        continue;
                                    }
                                    if (imgSeen) {
                                        try { child.remove(); } catch (_) {}
                                    }
                                }
                            }
                        } catch (_) {}
                        // Do not auto-open image tools. They will open on user click, preserving expected UX.
                        this.saveState();
                        this.lastAction = 'Image ajoutée';
                    };
                    reader.readAsDataURL(file);
                }
            };
            fileInput.click();
        });

        this.insertElementAtCursor(twoColumnSection);
        this.saveState();
        document.getElementById('sectionOptions').style.display = 'none';
        this.lastAction = 'Section deux colonnes insérée';
    }

    saveState() {
        // Create a temporary div to manipulate the content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = document.getElementById('editableContent').innerHTML;
        
        // Remove all add buttons from the gallery sections before saving
        const gallerySections = tempDiv.querySelectorAll('.gallery-section');
        gallerySections.forEach(section => {
            const addButton = section.querySelector('.add-image-placeholder');
            if (addButton) {
                addButton.remove();
            }
            const addMoreBtn = section.querySelector('.add-more-btn');
            if (addMoreBtn) {
                addMoreBtn.remove();
            }
            // Also remove the file input
            const fileInput = section.querySelector('.gallery-upload');
            if (fileInput) {
                fileInput.remove();
            }
        });
        
        const content = tempDiv.innerHTML;
        
        // Remove future history if we're not at the end
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        }
        
        // Add new state
        this.history.push(content);
        this.currentHistoryIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentHistoryIndex--;
        }
    }

    // Cleans editor-only markup and converts blob: media to persistent data URLs
    async sanitizeForExport(container) {
        // Remove editor-only wrappers/buttons
        container.querySelectorAll('.image-wrapper').forEach(wrapper => {
            const img = wrapper.querySelector('img');
            if (img) {
                wrapper.replaceWith(img);
            } else {
                wrapper.remove();
            }
        });
        container.querySelectorAll('.image-delete-btn, .crop-overlay').forEach(el => el.remove());

        // Remove contenteditable attributes
        container.querySelectorAll('[contenteditable]')
            .forEach(el => el.removeAttribute('contenteditable'));

        // Convert blob: URLs on img/video/source to data URLs, so saved file doesn't depend on runtime blobs
        const mediaNodes = Array.from(container.querySelectorAll('img, video, source'));
        for (const node of mediaNodes) {
            const srcAttr = node.tagName === 'SOURCE' ? 'src' : 'src';
            const src = node.getAttribute(srcAttr);
            if (!src || !src.startsWith('blob:')) continue;
            try {
                const fetched = await fetch(src);
                if (!fetched.ok) throw new Error('HTTP ' + fetched.status);
                const blob = await fetched.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                node.setAttribute(srcAttr, dataUrl);
            } catch (err) {
                console.warn('Failed to inline blob media, removing src to avoid 404:', src, err);
                node.removeAttribute(srcAttr);
            }
        }
    }

    undo() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            document.getElementById('editableContent').innerHTML = this.history[this.currentHistoryIndex];
            this.updateLastModified();
            this.lastAction = 'Édition annulée';
        }
    }

    redo() {
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.currentHistoryIndex++;
            document.getElementById('editableContent').innerHTML = this.history[this.currentHistoryIndex];
            this.updateLastModified();
            this.lastAction = 'Édition rétablie';
        }
    }

    refresh() {
        location.reload();
    }

    clear() {
        if (confirm('Êtes-vous sûr de vouloir effacer tout le contenu ?')) {
            document.getElementById('editableContent').innerHTML = '';
            this.saveState();
            this.updateLastModified();
            this.lastAction = 'Contenu effacé';
        }
    }

    async save() {
        try {
            console.log('Save method called');
            const editableContent = document.getElementById('editableContent');
            if (!editableContent) {
                throw new Error('Éditeur de contenu introuvable');
            }
            
            // Get the content from the editor
            let content = editableContent.innerHTML;
            // Get the title from the HTML page's title element or use a default name
            const pageTitle = document.title.trim() || 
                             document.querySelector('h1, h2, h3')?.textContent.trim() || 
                             'newsletter_sans_titre';
            const fileName = pageTitle.replace(/[\\/:*?"<>|]/g, '_'); // Remove invalid filename characters
            
            // Create a temporary div to clean up the content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            console.log('Content extracted for saving');
            
            // Remove all editor-specific elements before saving
            const elementsToRemove = [
                '.add-image-placeholder',
                '.add-more-btn',
                '.image-toolbar',
                '.resize-handle',
                '.rotation-handle'
            ];
            
            elementsToRemove.forEach(selector => {
                tempDiv.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // Remove ALL contenteditable attributes to make content completely non-editable
            tempDiv.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
            });
            
            // Remove any remaining editor-specific attributes and classes
            tempDiv.querySelectorAll('[data-placeholder]').forEach(el => {
                el.removeAttribute('data-placeholder');
            });
            
            // Get the cleaned content
            const cleanedContent = tempDiv.innerHTML;
            
            // Indicate manual save as the last action
            this.lastAction = 'Sauvegarde manuelle';

            // Save to history first with the cleaned content
            const historyItem = this.saveToHistory(fileName, cleanedContent);
            if (historyItem) {
                console.log('Saved to history:', historyItem);
            } else {
                console.warn('Failed to save to history');
            }
            
            // Create a complete HTML document with the cleaned content
            const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .newsletter-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        img {
            max-width: 100%;
            height: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        table, th, td {
            border: 1px solid #ddd;
        }
        th, td {
            padding: 10px;
            text-align: left;
        }
        .newsletter-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 5px;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 10px;
            margin: 15px 0;
        }
        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 5px;
        }
        .gallery-item img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            transition: transform 0.3s ease;
        }
        .gallery-item:hover img {
            transform: scale(1.05);
        }
        .two-column-layout {
            display: flex;
            gap: 20px;
        }
        .column {
            flex: 1;
        }
        @media (max-width: 768px) {
            .two-column-layout {
                flex-direction: column;
            }
        }
        /* Ensure images maintain their aspect ratio */
        img {
            max-width: 100%;
            height: auto;
        }
        /* Make sure tables are responsive */
        table {
            width: 100% !important;
            max-width: 100%;
            table-layout: fixed;
        }
    </style>
</head>
<body>
    <div class="newsletter-container">
        ${cleanedContent}
    </div>
</body>
</html>`;

            // Try to use the File System Access API (modern browsers)
            if (window.showSaveFilePicker) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: `${fileName.replace(/[^\w\-.]/g, '_')}.html`,
                        types: [{
                            description: 'Fichier HTML',
                            accept: { 'text/html': ['.html'] }
                        }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(fullHTML);
                    await writable.close();
                    
                    alert('Newsletter sauvegardée avec succès !');
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error saving file:', err);
                        // Fall through to the download method
                    } else {
                        // User cancelled the save dialog
                        return;
                    }
                }
            }
            
            // Fallback for older browsers
            try {
                const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileName.replace(/[^\w\-.]/g, '_')}.html`;
                
                // Add to document, trigger click, then remove
                document.body.appendChild(a);
                a.click();
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log('Newsletter saved successfully');
            } catch (error) {
                console.error('Error during save:', error);
                alert('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Error in save process:', error);
        }
    }

    // Persist a snapshot to localStorage 'newsletterHistory'
    saveToHistory(fileName, content) {
        try {
            // Generate unique ID
            const id = Date.now().toString();

            // By default, keep the ORIGINAL content so restoring from history is lossless
            let contentForHistory = content || '';

            // Compute preview from the original HTML
            const previewText = (content || '').replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';

            // Derive a meaningful title from content using inline font-size:52px, then H1/H2/H3, then text
            let computedName = '';
            try {
                const temp = document.createElement('div');
                temp.innerHTML = content || '';
                const all = temp.querySelectorAll('*');
                let found = null;
                for (const el of all) {
                    const styleAttr = (el.getAttribute && el.getAttribute('style')) || '';
                    if (styleAttr && /font-size\s*:\s*52px/i.test(styleAttr)) { found = el; break; }
                    if (el.style && (el.style.fontSize || '').toLowerCase() === '52px') { found = el; break; }
                }
                if (found && found.textContent) computedName = found.textContent.trim();
                if (!computedName) {
                    const heading = temp.querySelector('h1, h2, h3');
                    if (heading) computedName = (heading.textContent || '').trim();
                }
                if (!computedName) computedName = (temp.textContent || '').trim().substring(0, 80);
            } catch (_) {}
            if (!computedName) computedName = fileName || 'Sans nom';

            // Prepare item
            const historyItem = {
                id,
                name: computedName,
                content: contentForHistory,
                date: new Date().toLocaleString('fr-FR'),
                preview: previewText,
                timestamp: Date.now(),
                lastAction: this.lastAction || 'Action inconnue'
            };

            // Read existing, push to front, clamp to 200 and save
            let history = [];
            try {
                const raw = localStorage.getItem('newsletterHistory');
                history = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(history)) history = [];
            } catch (_) { history = []; }

            history.unshift(historyItem);
            if (history.length > 200) history = history.slice(0, 200);
            // Try to persist; if quota exceeded, trim and/or slim down content
            try {
                localStorage.setItem('newsletterHistory', JSON.stringify(history));
            } catch (e) {
                if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                    // Remove oldest items until it fits
                    let saved = false;
                    while (history.length > 0 && !saved) {
                        history.pop();
                        try {
                            localStorage.setItem('newsletterHistory', JSON.stringify(history));
                            saved = true;
                        } catch (_) { /* keep trimming */ }
                    }
                    if (!saved) {
                        // Last resort: create a sanitized "slim" copy only for storage purposes
                        let slim = { ...historyItem };
                        try {
                            // Start from original content and sanitize heavy sources
                            let slimContent = (content || '');
                            // Remove data: URIs (images/video/audio) and blob: URIs
                            slimContent = slimContent.replace(/\s+src=\"data:[^\"]+\"/gi, '');
                            slimContent = slimContent.replace(/\s+src=\"blob:[^\"]+\"/gi, '');
                            // Remove <source src="..."> attributes
                            slimContent = slimContent.replace(/<source([^>]*)src=\"[^\"]+\"([^>]*)>/gi, '<source$1$2>');
                            // Collapse heavy <video> blocks
                            slimContent = slimContent.replace(/<video[\s\S]*?<\/video>/gi, '<div class="video-placeholder" data-omitted="true"></div>');
                            // Guard overall size
                            slimContent = slimContent.slice(0, 200000); // ~200KB
                            slim.content = slimContent;
                        } catch(_) { slim.content = ''; }
                        try {
                            localStorage.setItem('newsletterHistory', JSON.stringify([slim]));
                        } catch(_) {
                            // Give up but avoid throwing; history won't be updated this round
                            console.warn('History not saved due to storage quota, even after slimming');
                        }
                    }
                } else {
                    throw e;
                }
            }

            return historyItem;
        } catch (error) {
            console.error('Error saving to history:', error);
            return null;
        }
    }

    showHistory() {
        console.log('showHistory method called');
        
        try {
            // Get history from localStorage
            let history = [];
            try {
                const historyData = localStorage.getItem('newsletterHistory');
                history = historyData ? JSON.parse(historyData) : [];
                console.log('Loaded history from localStorage:', history);
            } catch (e) {
                console.error('Error parsing history from localStorage:', e);
                history = [];
            }
            
            // Clean up invalid entries and sort by timestamp (newest first)
            history = history
                .filter(item => {
                    const isValid = item && 
                                  typeof item === 'object' && 
                                  item.name && 
                                  item.content && 
                                  typeof item.name === 'string' && 
                                  typeof item.content === 'string';
                    if (!isValid) {
                        console.warn('Removing invalid history item:', item);
                    }
                    return isValid;
                })
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            // Update localStorage with cleaned history
            localStorage.setItem('newsletterHistory', JSON.stringify(history));
            
            console.log('Processed history data:', history);
            
            const historyList = document.getElementById('historyList');
            console.log('History list element:', historyList);
            
            if (!historyList) {
                throw new Error('historyList element not found');
            }
            
            if (history.length === 0) {
                historyList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-inbox" style="font-size: 48px; opacity: 0.5; margin-bottom: 10px;"></i>
                        <p>Aucun historique disponible</p>
                    </div>
                `;
            } else {
                // Create a document fragment for better performance
                const fragment = document.createDocumentFragment();
                
                // Add a title
                const title = document.createElement('h3');
                title.textContent = 'Historique des sauvegardes';
                title.style.margin = '0 0 15px 0';
                title.style.color = '#333';
                title.style.borderBottom = '1px solid #eee';
                title.style.paddingBottom = '10px';
                fragment.appendChild(title);
                
                // Add each history item
                history.forEach(item => {
                    if (!item || !item.name || !item.content) {
                        console.warn('Skipping invalid history item:', item);
                        return;
                    }
                    
                    const itemElement = document.createElement('div');
                    itemElement.className = 'history-item';
                    itemElement.style.cssText = `
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 12px 15px;
                        margin-bottom: 10px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background: white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    `;
                    
                    // Add hover effect
                    itemElement.onmouseover = () => {
                        itemElement.style.borderColor = '#0a9bcd';
                        itemElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    };
                    itemElement.onmouseout = () => {
                        itemElement.style.borderColor = '#e0e0e0';
                        itemElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    };
                    
                    // Format the date
                    let formattedDate = 'Date inconnue';
                    try {
                        const date = item.date ? new Date(item.date) : new Date(item.timestamp);
                        if (!isNaN(date.getTime())) {
                            formattedDate = date.toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                    } catch (e) {
                        console.warn('Error formatting date:', e);
                    }
                    
                    // Create the item content
                    itemElement.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0 0 5px 0; color: #0a9bcd; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">
                                ${item.name || 'Sans nom'}
                            </h4>
                            <span style="color: #888; font-size: 12px;">${formattedDate}</span>
                        </div>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${item.preview || 'Aperçu non disponible'}
                        </p>
                    `;
                    
                    // Add click handler
                    itemElement.onclick = () => {
                        this.loadFromHistory(item.name, item.content);
                    };
                    
                    fragment.appendChild(itemElement);
                });
                
                // Clear and append the fragment
                historyList.innerHTML = '';
                historyList.appendChild(fragment);
            }
            
            // Show the modal
            const modal = document.getElementById('historyModal');
            if (!modal) {
                throw new Error('historyModal element not found');
            }
            
            // Add close button if not exists
            if (!document.getElementById('closeHistoryModal')) {
                const closeBtn = document.createElement('button');
                closeBtn.id = 'closeHistoryModal';
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                `;
                closeBtn.onclick = () => {
                    // Fade out the modal content first
                    const modalContent = modal.querySelector('.history-modal');
                    if (modalContent) {
                        modalContent.style.opacity = '0';
                        modalContent.style.transform = 'translateY(-20px)';
                    }
                    
                    // Then fade out the overlay
                    modal.style.opacity = '0';
                    
                    // Hide everything after animation completes
                    setTimeout(() => {
                        modal.style.display = 'none';
                        modal.style.pointerEvents = 'none';
                    }, 300);
                };
                
                // Add close button to modal header
                const modalHeader = modal.querySelector('.modal-header');
                if (modalHeader) {
                    modalHeader.appendChild(closeBtn);
                }
            }
            
            // Show the modal with animation
            modal.style.display = 'flex';
            modal.style.pointerEvents = 'auto';
            
            // Force reflow
            void modal.offsetWidth;
            
            // Fade in the overlay
            modal.style.opacity = '1';
            
            // Get the modal content
            const modalContent = modal.querySelector('.history-modal');
            if (modalContent) {
                // Reset and animate the modal content
                modalContent.style.opacity = '0';
                modalContent.style.transform = 'translateY(-20px)';
                
                // Animate in
                setTimeout(() => {
                    modalContent.style.opacity = '1';
                    modalContent.style.transform = 'translateY(0)';
                }, 10);
            }
            
            console.log('History modal displayed');
            
        } catch (error) {
            console.error('Error in showHistory:', error);
            alert('Erreur lors de l\'affichage de l\'historique: ' + (error.message || 'Erreur inconnue'));
        }
    }

    loadFromHistory(name, content) {
        try {
            if (confirm(`Charger "${name}" ? Le contenu actuel sera remplacé.`)) {
                // Unescape the content if it's a string with escape sequences
                let unescapedContent = content;
                if (typeof content === 'string') {
                    unescapedContent = content
                        .replace(/\\'/g, "'")
                        .replace(/\\"/g, '"')
                        .replace(/\\n/g, '\n')
                        .replace(/\\r/g, '\r');
                }
                
                // Update the editor content
                document.getElementById('editableContent').innerHTML = unescapedContent;
                // Apply standard video sizing to history-loaded content
                try { this.normalizeVideoStyles(); } catch (_) {}
                
                // Update the title if available in the history item
                if (name && name !== 'newsletter_sans_titre') {
                    const titleInput = document.getElementById('newsletterTitle');
                    if (titleInput) {
                        titleInput.value = name;
                    }
                }
                
                // Save the current state
                this.saveState();
                this.updateLastModified();
                this.autoSaveToLocalStorage();
                
                // Close the history modal
                const modal = document.getElementById('historyModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                console.log('Content loaded and restored from history:', name);
                alert(`Contenu "${name}" chargé avec succès !`);
            }
        } catch (error) {
            console.error('Error loading from history:', error);
            alert('Erreur lors du chargement de l\'historique: ' + error.message);
        }
    }

    updateLastModified() {
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('fr-FR');
    }

    // Restore function to recover from localStorage if page is refreshed
    restoreFromLocalStorage() {
        try {
            // Only restore if versions match
            const lsVersion = localStorage.getItem('currentNewsletterVersion');
            const ssVersion = sessionStorage.getItem('currentNewsletterVersion');
            let savedContent = null;
            if (lsVersion === this.storageVersion) {
                savedContent = localStorage.getItem('currentNewsletterContent');
            }
            if (!savedContent && ssVersion === this.storageVersion) {
                savedContent = sessionStorage.getItem('currentNewsletterContentSession');
                if (savedContent) this._autosaveUsingSession = true;
            }
            if (!savedContent) {
                // Clear incompatible old autosave to prevent future overwrites
                localStorage.removeItem('currentNewsletterContent');
                sessionStorage.removeItem('currentNewsletterContentSession');
                localStorage.removeItem('currentNewsletterVersion');
                sessionStorage.removeItem('currentNewsletterVersion');
            }
            const savedFileName = localStorage.getItem('currentNewsletterFileName');
            
            if (savedContent) {
                document.getElementById('editableContent').innerHTML = savedContent;
                console.log('Content restored from local/session storage');
                // Apply standard video sizing to restored content
                try { this.normalizeVideoStyles(); } catch (_) {}
            }
            
            // File name functionality removed
        } catch (error) {
            console.error('Error restoring from storage:', error);
        }
    }

    // Auto-save current content to localStorage with sessionStorage fallback
    autoSaveToLocalStorage() {
        const content = document.getElementById('editableContent').innerHTML;
        if (this._autosaveUsingSession) {
            try {
                sessionStorage.setItem('currentNewsletterContentSession', content);
                sessionStorage.setItem('currentNewsletterVersion', this.storageVersion);
            } catch (_) {}
            return;
        }
        try {
            localStorage.setItem('currentNewsletterContent', content);
            localStorage.setItem('currentNewsletterVersion', this.storageVersion);
        } catch (error) {
            const message = (error && (error.name || '')).toString();
            if (message.includes('QuotaExceededError') || message.includes('QUOTA') || message.includes('NS_ERROR_DOM_QUOTA_REACHED')) {
                try {
                    sessionStorage.setItem('currentNewsletterContentSession', content);
                    sessionStorage.setItem('currentNewsletterVersion', this.storageVersion);
                    this._autosaveUsingSession = true;
                    console.info('Autosave switched to sessionStorage due to quota. Manual Save unaffected.');
                } catch (_) {
                    console.info('Autosave paused: both localStorage and sessionStorage quotas exceeded. Manual Save still works.');
                }
            } else {
                console.error('Error auto-saving to localStorage:', error);
            }
        }
    }

    // Utility: compress an image File to a DataURL
    compressImageFile(file, { maxWidth = 1600, maxHeight = 1200, quality = 0.9 } = {}) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;
                        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.round(width * ratio);
                        canvas.height = Math.round(height * ratio);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const mime = file.type && file.type.startsWith('image/') ? (file.type.includes('png') ? 'image/png' : 'image/jpeg') : 'image/jpeg';
                        const dataUrl = canvas.toDataURL(mime, quality);
                        resolve(dataUrl);
                    };
                    img.onerror = () => reject(new Error('Image load failed'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('File read failed'));
                reader.readAsDataURL(file);
            } catch (err) {
                reject(err);
            }
        });
    }
}

// Initialize the editor when the page loads
let editor;
document.addEventListener('DOMContentLoaded', () => {
    editor = new NewsletterEditor();
    // Expose globally for inline modal to access lastAction and saveToHistory
    try { window.editor = editor; } catch (_) {}
});