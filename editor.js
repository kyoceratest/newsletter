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
        // Increment this when autosave schema/behavior changes to avoid restoring stale content
        this.storageVersion = '2';
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
        
        // Column image placeholder click handler - using gallery section logic
        const columnImagePlaceholder = document.getElementById('columnImagePlaceholder');
        if (columnImagePlaceholder) {
            console.log('Column image placeholder found, adding click handler');
            columnImagePlaceholder.addEventListener('click', () => {
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
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const dataUrl = await this.compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.9 });
                        this.insertImage(dataUrl, file.name);
                    } catch (err) {
                        const reader = new FileReader();
                        reader.onload = (ev) => this.insertImage(ev.target.result, file.name);
                        reader.readAsDataURL(file);
                    }
                }
            };
            input.click();
            document.getElementById('imageOptions').style.display = 'none';
        });

        // URL image button
        document.getElementById('urlImageBtn').addEventListener('click', () => {
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
            const url = prompt('Entrez l\'URL de la vidéo (YouTube, Vimeo, etc.):');
            if (url) {
                this.insertVideo(url);
            }
            document.getElementById('videoOptions').style.display = 'none';
        });

        // Local video button
        document.getElementById('localVideoBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.insertLocalVideo(e.target.result, file.name);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
            document.getElementById('videoOptions').style.display = 'none';
        });

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
        } else {
            console.error('historyBtn not found');
        }

        // Preview button: open preview.html in a new tab without altering existing UI/logic
        const previewBtn = document.getElementById('previewBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                window.open('preview.html', '_blank');
            });
        } else {
            console.error('previewBtn not found');
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
        });

        // Track selection inside editable content to keep toolbar actions working
        const editable = document.getElementById('editableContent');
        editable.addEventListener('mouseup', () => this.saveSelection());
        editable.addEventListener('keyup', () => this.saveSelection());

        // Show Section/Video toolbars on click
        editable.addEventListener('click', (e) => {
            const sectionEl = e.target.closest('.newsletter-section, .gallery-section, .two-column-layout, .syc-item');
            const videoEl = e.target.closest('video, iframe');

            if (sectionEl) {
                this.showSectionToolbar(sectionEl);
            } else {
                this.hideSectionToolbar();
            }

            if (videoEl) {
                this.showVideoToolbar(videoEl);
            } else if (!e.target.closest('#videoToolbar')) {
                this.hideVideoToolbar();
            }
        });

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
        // While starting a new drag selection inside the editor, hide the toolbar to avoid interference
        editable.addEventListener('mousedown', () => {
            const toolbar = document.getElementById('richTextToolbar');
            if (toolbar) toolbar.style.display = 'none';
            this.hideSectionToolbar();
            this.hideVideoToolbar();
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
            sidebarHamburger.addEventListener('click', () => {
                // Only display overlay on small screens per CSS rules
                sidebarOverlay.classList.add('active');
                document.body.classList.add('sidebar-open'); // for potential scroll lock if styled
            });
            sidebarOverlay.addEventListener('click', () => {
                sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
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
        });
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
        document.getElementById('textColorPicker').addEventListener('input', (e) => {
            execWithRestore('foreColor', false, e.target.value);
            document.querySelector('#textColorDropdownBtn i').style.color = e.target.value;
        });

        document.getElementById('bgColorPicker').addEventListener('input', (e) => {
            const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
            execWithRestore(bgCmd, false, e.target.value);
            document.querySelector('#bgColorDropdownBtn i').style.backgroundColor = e.target.value;
        });

        // Color palettes
        document.getElementById('textColorPalette').addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                execWithRestore('foreColor', false, color);
                document.getElementById('textColorPicker').value = color;
                document.querySelector('#textColorDropdownBtn i').style.color = color;
                document.getElementById('textColorDropdownContent').style.display = 'none';
            }
        });

        document.getElementById('bgColorPalette').addEventListener('click', (e) => {
            if (e.target.classList.contains('palette-color')) {
                const color = e.target.dataset.color;
                const bgCmd = document.queryCommandSupported && document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor';
                execWithRestore(bgCmd, false, color);
                document.getElementById('bgColorPicker').value = color;
                document.querySelector('#bgColorDropdownBtn i').style.backgroundColor = color;
                document.getElementById('bgColorDropdownContent').style.display = 'none';
            }
        });

        // Color dropdowns
        document.getElementById('textColorDropdownBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const content = document.getElementById('textColorDropdownContent');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
            document.getElementById('bgColorDropdownContent').style.display = 'none';
        });

        document.getElementById('bgColorDropdownBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const content = document.getElementById('bgColorDropdownContent');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
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

        // Show/hide toolbar on text selection within editable area
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            const hasText = selection && selection.rangeCount > 0 && selection.toString().length > 0;
            const inEditable = hasText && isSelectionInEditable();

            // If any other floating toolbars are open (image/section/video), suppress the rich text toolbar
            const imageTb = document.getElementById('imageToolbar');
            const sectionTb = document.getElementById('sectionToolbar');
            const videoTb = document.getElementById('videoToolbar');
            const anotherToolbarOpen =
                (imageTb && imageTb.style.display === 'block') ||
                (sectionTb && sectionTb.style.display === 'block') ||
                (videoTb && videoTb.style.display === 'block');
            if (anotherToolbarOpen) {
                toolbar.style.display = 'none';
                return;
            }

            // If user is interacting with toolbar controls (e.g., font size select), don't hide it
            if (!inEditable) {
                if (isActiveInToolbar() || isInteractingWithToolbar) {
                    return;
                }
                toolbar.style.display = 'none';
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            toolbar.style.display = 'flex';
            toolbar.style.left = (rect.left + scrollX) + 'px';
            toolbar.style.top = (rect.top + scrollY - toolbar.offsetHeight - 10) + 'px';
            // Only save when there is an actual selection inside the editor
            this.saveSelection();
        });
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
            this._sectionToolbarWired = true;
        }
    }

    hideSectionToolbar() {
        const toolbar = document.getElementById('sectionToolbar');
        if (toolbar) toolbar.style.display = 'none';
        this.currentEditingSection = null;
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
                node.remove();
            }
            this.hideVideoToolbar();
            this.saveState();
            this.updateLastModified();
            this.autoSaveToLocalStorage();
        }
    }

    // Selection helpers
    saveSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        this.savedSelection = selection.getRangeAt(0).cloneRange();
    }

    restoreSelection() {
        if (!this.savedSelection) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.savedSelection);
    }

    setupTableToolbar() {
        const toolbar = document.getElementById('tableToolbar');

        // Insert row
        document.getElementById('insertRowBtn').addEventListener('click', () => {
            // Implementation for inserting table row
        });

        // Insert column
        document.getElementById('insertColBtn').addEventListener('click', () => {
            // Implementation for inserting table column
        });

        // Delete row
        document.getElementById('deleteRowBtn').addEventListener('click', () => {
            // Implementation for deleting table row
        });

        // Delete column
        document.getElementById('deleteColBtn').addEventListener('click', () => {
            // Implementation for deleting table column
        });

        // Table background color
        document.getElementById('tableBgColor').addEventListener('change', (e) => {
            // Implementation for changing table background color
        });

        // Table properties
        document.getElementById('tablePropsBtn').addEventListener('click', () => {
            // Implementation for table properties dialog
        });
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
                }
            }
        });
        
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
            
            // Refresh the resize handles
            this.removeResizeHandles();
            this.addResizeHandlesToImage(this.currentEditingImage);
        };
        
        // Set the source to trigger the onload event
        img.src = this.currentEditingImage.src;
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
            
            // Refresh the resize handles
            this.removeResizeHandles();
            this.addResizeHandlesToImage(this.currentEditingImage);
        };
        
        // Set the source to trigger the onload event
        img.src = this.currentEditingImage.src;
    }
    
    showImageEditingTools(image) {
        // Do not allow image editing inside gallery sections
        if (image && image.closest && image.closest('.gallery-section')) {
            return;
        }
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
        
        toolbar.style.display = 'block';
        toolbar.style.left = rect.left + 'px';
        toolbar.style.top = (rect.top + scrollTop - toolbar.offsetHeight - 10) + 'px';
        
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
        if (!wrapper.classList.contains('image-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            wrapper.style.cssText = 'position: relative; display: inline-block; margin: 10px 0;';
            image.parentNode.insertBefore(wrapper, image);
            wrapper.appendChild(image);
        }
        
        // Ensure wrapper has proper positioning
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        
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
            };
            
            // Add event listeners
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
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
        
        // Reset styles
        wrapper.style.position = '';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.zIndex = '';
        
        // Apply the new position type
        switch (positionType) {
            case 'absolute':
                // Set up for absolute positioning
                wrapper.classList.add('position-absolute');
                wrapper.style.position = 'absolute';

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
                
                // Make the wrapper draggable
                this.makeImageDraggable(wrapper);
                break;
                
            case 'float-left':
                wrapper.classList.add('float-left');
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                break;
                
            case 'float-right':
                wrapper.classList.add('float-right');
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                break;
                
            case 'inline':
                wrapper.classList.add('position-inline');
                // Remove draggable functionality
                this.removeImageDraggable(wrapper);
                break;
        }
        
        this.saveState();
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
            startLeft = parseInt(wrapper.style.left) || 0;
            startTop = parseInt(wrapper.style.top) || 0;
            
            // Set data for drag operation
            e.dataTransfer.setData('text/plain', 'dragging-image');
            e.dataTransfer.effectAllowed = 'move';
            
            // Add a class to indicate dragging
            wrapper.classList.add('dragging');
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
                startLeft = parseInt(wrapper.style.left) || 0;
                startTop = parseInt(wrapper.style.top) || 0;
                
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
        img.style.objectFit = 'cover';
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
    }

    insertImage(src, altText) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = altText;
        img.style.cssText = 'max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
        
        // Store original image source for reset functionality
        img.dataset.originalSrc = src;
        
        // Create a wrapper for the image to contain resize handles and delete button
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper position-inline';
        wrapper.style.cssText = 'position: relative; display: block; margin: 15px auto;';
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
                }
            }
        });
        
        // Make wrapper focusable for keyboard events
        wrapper.setAttribute('tabindex', '0');
        
        this.insertElementAtCursor(wrapper);
        this.saveState();
    }

    insertVideo(url) {
        let embedCode = '';
        
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = this.extractYouTubeId(url);
            embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="max-width: 100%; margin: 10px 0;"></iframe>`;
        } else if (url.includes('vimeo.com')) {
            const videoId = this.extractVimeoId(url);
            embedCode = `<iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allowfullscreen style="max-width: 100%; margin: 10px 0;"></iframe>`;
        } else {
            embedCode = `<video controls style="max-width: 100%; margin: 10px 0;"><source src="${url}" type="video/mp4">Votre navigateur ne supporte pas la vidéo.</video>`;
        }
        
        this.insertHTMLAtCursor(embedCode);
        this.saveState();
    }

    insertLocalVideo(src, name) {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.style.cssText = 'max-width: 100%; margin: 10px 0;';
        
        this.insertElementAtCursor(video);
        this.saveState();
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
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            
            // Create overlay with controls
            const overlay = document.createElement('div');
            overlay.className = 'gallery-item-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                border-radius: 8px;
                cursor: pointer;
            `;
            
            // Create controls container
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '10px';
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'gallery-control-btn';
            deleteBtn.title = 'Supprimer l\'image';
            
            // Create replace button
            const replaceBtn = document.createElement('button');
            replaceBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            replaceBtn.className = 'gallery-control-btn';
            replaceBtn.title = 'Remplacer l\'image';
            
            // Add buttons to controls
            controls.appendChild(replaceBtn);
            controls.appendChild(deleteBtn);
            overlay.appendChild(controls);
            
            // Add elements to container
            imageContainer.appendChild(img);
            imageContainer.appendChild(overlay);
            
            // Add hover effects like gallery
            imageContainer.addEventListener('mouseenter', () => {
                overlay.style.opacity = '1';
            });
            
            imageContainer.addEventListener('mouseleave', () => {
                overlay.style.opacity = '0';
            });
            
            // Delete functionality
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Voulez-vous vraiment supprimer cette image ?')) {
                    imageContainer.remove();
                    this.saveState();
                }
            });
            
            // Replace functionality
            replaceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (ev) => {
                    const file = ev.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        const r = new FileReader();
                        r.onload = (re) => {
                            img.src = re.target.result;
                            this.saveState();
                        };
                        r.readAsDataURL(file);
                    }
                };
                input.click();
            });
            
            // Disable click-to-edit for gallery images
            imageContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
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
            imageContainerInner.style.paddingBottom = '100%'; // 1:1 aspect ratio
            imageContainerInner.style.overflow = 'hidden';
            
            // Style the image
            img.style.position = 'absolute';
            img.style.top = '0';
            img.style.left = '0';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            // Add image to container
            imageContainerInner.appendChild(img);
            imageContainerInner.appendChild(overlay);
            
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
            
            // Make sure overlay doesn't block clicks on description
            overlay.style.pointerEvents = 'none';
            
            // Add click handler to the image to show overlay
            imageWrapper.addEventListener('mouseenter', () => {
                overlay.style.opacity = '1';
            });
            
            imageWrapper.addEventListener('mouseleave', () => {
                overlay.style.opacity = '0';
            });
            
            // Insert before the add image placeholder
            const addButton = galleryGrid.querySelector('.add-image-placeholder');
            if (addButton) {
                galleryGrid.insertBefore(imageContainer, addButton);
            } else {
                galleryGrid.appendChild(imageContainer);
            }
            
            this.saveState();
        };

        this.compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.9 })
            .then(handleLoaded)
            .catch(() => {
                const reader = new FileReader();
                reader.onload = (e) => handleLoaded(e.target.result);
                reader.readAsDataURL(file);
            });
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
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }