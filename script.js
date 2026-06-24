// ─── 0. AI SIMILARITY MATCHING ──────────────────────────────────────────────
const AI_MATCH_URL = 'https://ai-key.kevin-ying-ut.workers.dev/';

// Stores the IDs returned by the last AI search (null = no AI search active)
let aiMatchResults = null; // [{ id, reason }] or null

async function findAIMatches() {
    const descInput = document.getElementById('aiDescInput');
    const resultsDiv = document.getElementById('aiResults');
    const findBtn = document.getElementById('aiFindBtn');
    const description = descInput.value.trim();

    if (!description) {
        descInput.focus();
        return;
    }

    if (AI_MATCH_URL === 'YOUR_WORKER_URL_HERE') {
        resultsDiv.innerHTML = '<p style="color:#e74c3c;"><i class="fa fa-exclamation-triangle"></i> Please deploy the Cloudflare Worker and update AI_MATCH_URL in script.js.</p>';
        return;
    }

    findBtn.disabled = true;
    findBtn.textContent = 'Searching…';
    resultsDiv.innerHTML = '<p style="color:#888; font-style:italic;"><i class="fa fa-spinner fa-spin"></i> Comparing your description against current items…</p>';

    try {
        // Fetch all approved items from Firestore
        const snapshot = await db.collection('items').where('status', '==', 'approved').get();
        if (snapshot.empty) {
            resultsDiv.innerHTML = '<p style="color:#888;">No items are currently listed.</p>';
            return;
        }

        const items = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            items.push({
                id: doc.id,
                name: d.name || '',
                category: d.category || '',
                description: d.description || '',
                location: d.location || ''
            });
        });

        // Call our Firebase proxy — API key stays server-side
        const response = await fetch(AI_MATCH_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ description, items })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Function request failed');
        }

        const data = await response.json();
        // Strip markdown code fences if present
        const raw = data.result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const matches = JSON.parse(raw);

        if (!Array.isArray(matches) || matches.length === 0) {
            aiMatchResults = null;
            resultsDiv.innerHTML = '<p style="color:#888;">No strong matches found. Try a more detailed description.</p>';
            refreshCardVisibility();
            return;
        }

        aiMatchResults = matches;
        refreshCardVisibility();

        // Show match summary
        resultsDiv.innerHTML = `<p style="color:#27ae60; font-weight:bold;"><i class="fa fa-check-circle"></i> Found ${matches.length} possible match${matches.length > 1 ? 'es' : ''} — highlighted below.</p>`;

    } catch (err) {
        console.error('AI match error:', err);
        resultsDiv.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
        aiMatchResults = null;
    } finally {
        findBtn.disabled = false;
        findBtn.textContent = 'Find Matches';
    }
}

function clearAISearch() {
    aiMatchResults = null;
    document.getElementById('aiDescInput').value = '';
    document.getElementById('aiResults').innerHTML = '';
    refreshCardVisibility();
    // Collapse the panel
    const panel = document.getElementById('aiSearchPanel');
    if (panel) panel.style.display = 'none';
    const toggle = document.getElementById('aiToggleBtn');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleAIPanel() {
    const panel = document.getElementById('aiSearchPanel');
    const btn = document.getElementById('aiToggleBtn');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) document.getElementById('aiDescInput').focus();
}

// Applies AI match highlighting on top of the regular filter
function refreshCardVisibility() {
    const searchTerm       = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    const selectedCategory = document.getElementById('categoryFilter') ? document.getElementById('categoryFilter').value : 'all';

    document.querySelectorAll('.card').forEach(card => {
        const itemName        = card.querySelector('h3') ? card.querySelector('h3').textContent.toLowerCase() : '';
        const itemCategory    = card.dataset.category || '';
        const matchesSearch   = itemName.includes(searchTerm);
        const matchesCategory = (selectedCategory === 'all' || itemCategory === selectedCategory);
        const passesFilter    = matchesSearch && matchesCategory;

        if (!passesFilter) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';

        if (aiMatchResults) {
            const match = aiMatchResults.find(m => m.id === card.dataset.itemId);
            if (match) {
                card.style.outline = '3px solid #27ae60';
                card.style.opacity = '1';
                // Add or update reason badge
                let badge = card.querySelector('.ai-match-badge');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'ai-match-badge';
                    badge.style.cssText = 'background:#27ae60; color:white; font-size:0.78rem; padding:5px 10px; line-height:1.3;';
                    card.prepend(badge);
                }
                badge.innerHTML = '<i class="fa fa-magic" style="margin-right:5px;"></i>';
                badge.appendChild(document.createTextNode(match.reason));
            } else {
                card.style.outline = 'none';
                card.style.opacity = '0.35';
                const badge = card.querySelector('.ai-match-badge');
                if (badge) badge.remove();
            }
        } else {
            card.style.outline = 'none';
            card.style.opacity = ''; // remove inline — CSS .in-view class controls fade
            const badge = card.querySelector('.ai-match-badge');
            if (badge) badge.remove();
        }
    });

    // Show / hide "no results" empty state when search or filter hides everything
    const allCards = Array.from(document.querySelectorAll('.card'));
    let noResultsEl = document.getElementById('noResultsMsg');

    if (allCards.length > 0) {
        const anyVisible = allCards.some(c => c.style.display !== 'none');

        if (!anyVisible) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.id = 'noResultsMsg';
                noResultsEl.className = 'empty-state';
                if (itemsGrid) itemsGrid.appendChild(noResultsEl);
            }

            const icon = document.createElement('i');
            icon.className = 'fa fa-search';

            const heading = document.createElement('h3');
            heading.textContent = 'No items found';

            const msg = document.createElement('p');
            if (searchTerm) {
                msg.appendChild(document.createTextNode('No results for “'));
                const strong = document.createElement('strong');
                strong.textContent = searchTerm;
                msg.appendChild(strong);
                msg.appendChild(document.createTextNode('”. Try different keywords.'));
            } else {
                msg.textContent = 'No items match the selected category.';
            }

            noResultsEl.innerHTML = '';
            noResultsEl.append(icon, heading, msg);

        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    }
}

// ─── 1. FIREBASE CONFIGURATION ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBPfaUczJPKQQ-WYpDNWuoDC4h_7TQbzRQ",
    authDomain: "school-lost-and-found-43b02.firebaseapp.com",
    projectId: "school-lost-and-found-43b02",
    storageBucket: "school-lost-and-found-43b02.firebasestorage.app",
    messagingSenderId: "511480295301",
    appId: "1:511480295301:web:e397b7537f9e7ad06b5eec"
};

firebase.initializeApp(firebaseConfig);
const db      = firebase.firestore();
const storage = firebase.storage();

// ─── 2. ADMIN SECURITY — Firebase Auth ──────────────────────────────────────
function checkAdminPass() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass  = document.getElementById('adminPass').value;

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(() => {
            sessionStorage.setItem('isAdmin', 'true');
            showAdminPanel();
        })
        .catch(() => {
            document.getElementById('loginError').style.display = 'block';
        });
}

function showAdminPanel() {
    const authOverlay  = document.getElementById('adminAuth');
    const adminContent = document.getElementById('adminContent');
    if (authOverlay && adminContent) {
        authOverlay.style.display  = 'none';
        adminContent.style.display = 'block';
        renderAdminTable();
        renderRequestsTable();
    }
}

// ─── 3. REPORT FORM — multi-photo upload (up to 5) ──────────────────────────

// Resize + compress a File to max 1200px wide at 85% JPEG quality.
// Reduces a typical phone photo from ~4 MB to ~200 KB before uploading.
function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve) => {
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width  = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(blobUrl);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = blobUrl;
    });
}
const reportForm  = document.getElementById('reportForm');
const fileInput   = document.getElementById('photoFile');
const fileLabel   = document.querySelector('.custom-file-upload');
const previewGrid = document.getElementById('photoPreviewGrid');

// Tracks the selected File objects so we can upload them all on submit
let selectedFiles = [];

if (fileInput) {
    fileInput.addEventListener('change', function () {
        const newFiles  = Array.from(this.files);
        const combined  = [...selectedFiles, ...newFiles];
        const MAX       = 5;

        if (combined.length > MAX) {
            alert('You can upload a maximum of ' + MAX + ' photos.');
            selectedFiles = combined.slice(0, MAX);
        } else {
            selectedFiles = combined;
        }

        // Reset the input so the same file can be re-added after removal
        fileInput.value = '';

        updateFileLabel();
        renderPhotoPreviews();
    });
}

function updateFileLabel() {
    if (!fileLabel) return;
    if (selectedFiles.length === 0) {
        fileLabel.innerHTML             = '<i class="fa fa-camera"></i> Upload Photos (up to 5)';
        fileLabel.style.backgroundColor = '#3498db';
    } else {
        fileLabel.innerHTML             = '<i class="fa fa-camera"></i> ' + selectedFiles.length + ' photo' + (selectedFiles.length > 1 ? 's' : '') + ' selected — add more?';
        fileLabel.style.backgroundColor = '#2ecc71';
    }
}

function renderPhotoPreviews() {
    if (!previewGrid) return;
    previewGrid.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative; display:inline-block;';

            const img = document.createElement('img');
            img.src   = e.target.result;
            img.style.cssText = 'width:80px; height:80px; object-fit:cover; border-radius:6px; border:2px solid #ddd;';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fa fa-times"></i>';
            removeBtn.type        = 'button';
            removeBtn.setAttribute('aria-label', 'Remove photo ' + (index + 1));
            removeBtn.style.cssText = 'position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:#e74c3c; color:white; border:none; font-size:10px; cursor:pointer; padding:0; line-height:20px; text-align:center;';
            removeBtn.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updateFileLabel();
                renderPhotoPreviews();
            });

            wrapper.append(img, removeBtn);
            previewGrid.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    });
}

if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedFiles.length === 0) return alert('Please select at least one photo.');

        const submitBtn = reportForm.querySelector('button[type="submit"]');
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Uploading…';

        try {
            // Generate a 400px thumbnail AND 1200px full version for each photo, upload both
            const uploadPromises = selectedFiles.map(async (file) => {
                const base = Date.now() + '_' + Math.random().toString(36).slice(2);
                const [thumb, full] = await Promise.all([
                    compressImage(file, 400,  0.80),
                    compressImage(file, 1200, 0.85)
                ]);
                const [thumbSnap, fullSnap] = await Promise.all([
                    storage.ref('item_images/thumbs/' + base + '.jpg').put(thumb),
                    storage.ref('item_images/full/'   + base + '.jpg').put(full)
                ]);
                return {
                    thumb: await thumbSnap.ref.getDownloadURL(),
                    full:  await fullSnap.ref.getDownloadURL()
                };
            });

            const results   = await Promise.all(uploadPromises);
            const thumbURLs = results.map(r => r.thumb);
            const fullURLs  = results.map(r => r.full);

            await db.collection('items').add({
                name:        document.getElementById('itemName').value,
                location:    document.getElementById('location').value,
                category:    document.getElementById('itemCategory').value,
                description: document.getElementById('description').value,
                // Keep legacy `image` field (first photo) so old records still work
                image:       thumbURLs[0],
                images:      thumbURLs,  // 400px thumbnails — used in gallery cards
                imagesFull:  fullURLs,   // 1200px — used in modal carousel
                status:      'pending',
                timestamp:   firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Item reported successfully!');
            reportForm.reset();
            selectedFiles = [];
            updateFileLabel();
            renderPhotoPreviews();

        } catch (error) {
            console.error('Upload Error:', error);
            alert('Error: ' + error.message);
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Submit Item';
        }
    });
}

// ─── 4. PUBLIC GALLERY ──────────────────────────────────────────────────────
const itemsGrid = document.getElementById('itemsGrid');

// Fade cards in when they enter the viewport, out when they leave
const cardObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            } else {
                entry.target.classList.remove('in-view');
            }
        });
    },
    { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
);

if (itemsGrid) {
    // Show shimmer placeholders while Firebase loads
    for (let i = 0; i < 6; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        skel.innerHTML = '<div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-btn"></div>';
        itemsGrid.appendChild(skel);
    }

    db.collection('items')
      .where('status', '==', 'approved')
      .onSnapshot((snapshot) => {
          itemsGrid.innerHTML = '';

          if (snapshot.empty) {
              const empty = document.createElement('div');
              empty.className = 'empty-state';
              empty.innerHTML = '<i class="fa fa-inbox"></i><h3>Nothing here yet</h3><p>No lost items have been reported. Check back soon!</p>';
              itemsGrid.appendChild(empty);
              return;
          }

          snapshot.forEach((doc) => {
              const item       = doc.data();
              // Support both multi-image and legacy single-image records
              const images     = item.images     && item.images.length     ? item.images     : [item.image];
              // imagesFull: high-res versions; fall back to images for old records
              const imagesFull = item.imagesFull && item.imagesFull.length ? item.imagesFull : images;

              const card = document.createElement('div');
              card.className = 'card';
              card.tabIndex  = 0;
              card.setAttribute('role', 'button');
              card.setAttribute('aria-label', 'View details for ' + item.name);
              card.dataset.category = item.category;
              card.dataset.itemId   = doc.id;

              // Category colour map
              const categoryColors = {
                  'electronics':   '#3498db',
                  'clothing':      '#9b59b6',
                  'water bottles': '#1abc9c',
                  'other':         '#95a5a6'
              };

              // Show first photo on the card; badge shows count if >1
              const imgWrapper = document.createElement('div');
              imgWrapper.style.cssText = 'position:relative; overflow:hidden;';

              const img = document.createElement('img');
              img.src      = images[0];
              img.alt      = 'Photo of ' + item.name;
              img.loading  = 'lazy';
              img.decoding = 'async';

              if (images.length > 1) {
                  const badge = document.createElement('span');
                  badge.innerHTML = '<i class="fa fa-camera"></i> ' + images.length;
                  badge.style.cssText = 'position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.6); color:white; border-radius:12px; padding:2px 8px; font-size:0.8rem; pointer-events:none;';
                  imgWrapper.append(img, badge);
              } else {
                  imgWrapper.appendChild(img);
              }

              // Category badge — bottom-left of image
              const catBadge = document.createElement('span');
              catBadge.className = 'category-badge';
              catBadge.textContent = item.category || 'other';
              catBadge.style.background = categoryColors[item.category] || '#95a5a6';
              imgWrapper.appendChild(catBadge);

              // "NEW" badge — top-left, shown for items added in the last 48 hours
              const isNew = item.timestamp &&
                  (Date.now() - item.timestamp.toDate().getTime()) < 48 * 60 * 60 * 1000;
              if (isNew) {
                  const newBadge = document.createElement('span');
                  newBadge.className = 'new-badge';
                  newBadge.textContent = 'New';
                  imgWrapper.appendChild(newBadge);
              }

              const cardContent = document.createElement('div');
              cardContent.className = 'card-content';

              const h3 = document.createElement('h3');
              h3.textContent = item.name;

              const loc = document.createElement('p');
              loc.innerHTML = '<i class="fa fa-map-marker"></i> ' + item.location;

              const btn = document.createElement('button');
              btn.textContent = 'Inquire / Claim';
              btn.setAttribute('aria-label', 'Inquire about ' + item.name);
              btn.addEventListener('click', (ev) => { ev.stopPropagation(); claimItem(doc.id); });

              cardContent.append(h3, loc, btn);
              card.append(imgWrapper, cardContent);

              card.addEventListener('click', () => openModal(images, item.name, item.location, item.description, doc.id, imagesFull));
              card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') card.click(); });

              itemsGrid.appendChild(card);
              cardObserver.observe(card);
          });
      });
}

// ─── SEARCH & CATEGORY FILTER ───────────────────────────────────────────────
function applyFilters() {
    refreshCardVisibility();
}

if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
}

// ─── MODAL with photo carousel ───────────────────────────────────────────────
function openModal(images, name, loc, desc, id, imagesFull) {
    if (!Array.isArray(images)) images = [images]; // backwards compat
    // imagesFull: 1200px versions for carousel; fall back to images for old records
    if (!Array.isArray(imagesFull) || !imagesFull.length) imagesFull = images;
    const modal = document.getElementById('itemModal');
    modal.innerHTML = '';

    let currentIndex = 0;

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'modalTitle');
    content.addEventListener('click', (e) => e.stopPropagation());

    // ── Carousel ──────────────────────────────────────────────────
    // role="region" + aria-label lets screen readers announce "Photo carousel"
    const carouselWrapper = document.createElement('div');
    carouselWrapper.setAttribute('role', 'region');
    carouselWrapper.setAttribute('aria-label', 'Photo carousel');
    carouselWrapper.style.cssText = 'position:relative; background:#000; overflow:hidden;';

    const mainImg = document.createElement('img');
    mainImg.src      = imagesFull[0];
    mainImg.alt      = 'Photo 1 of ' + imagesFull.length + ' for ' + name;
    mainImg.decoding = 'async';
    mainImg.style.cssText = 'width:100%; max-height:350px; object-fit:contain; display:block; transition:opacity 0.2s ease;';

    // Live region so screen readers announce photo changes
    const srAnnounce = document.createElement('span');
    srAnnounce.setAttribute('aria-live', 'polite');
    srAnnounce.setAttribute('aria-atomic', 'true');
    srAnnounce.style.cssText = 'position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap;';

    carouselWrapper.append(mainImg, srAnnounce);

    if (images.length > 1) {
        const counterBadge = document.createElement('span');
        counterBadge.style.cssText = 'position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.6); color:white; border-radius:12px; padding:3px 10px; font-size:0.85rem; pointer-events:none;';
        counterBadge.setAttribute('aria-hidden', 'true'); // screen reader uses srAnnounce instead
        counterBadge.textContent = '1 / ' + imagesFull.length;

        // Arrow button shared styles — use flexbox to perfectly centre the glyph,
        // and override the global :focus outline so it sits flush on the circle.
        const arrowStyle = [
            'position:absolute',
            'top:50%',
            'transform:translateY(-50%)',
            'background:rgba(0,0,0,0.55)',
            'color:white',
            'border:none',
            'border-radius:50%',
            'width:36px',
            'height:36px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:1.5rem',
            'line-height:1',
            'cursor:pointer',
            'outline-offset:3px',  // keeps the focus ring tight around the circle
            'transition:background 0.2s',
        ].join(';');

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '&#8249;';
        prevBtn.setAttribute('aria-label', 'Previous photo');
        prevBtn.setAttribute('type', 'button');
        prevBtn.style.cssText = arrowStyle + ';left:8px;';

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '&#8250;';
        nextBtn.setAttribute('aria-label', 'Next photo');
        nextBtn.setAttribute('type', 'button');
        nextBtn.style.cssText = arrowStyle + ';right:8px;';

        // Thumbnail strip — built first so goTo() can reference it
        const thumbStrip = document.createElement('div');
        thumbStrip.setAttribute('role', 'tablist');
        thumbStrip.setAttribute('aria-label', 'Photo thumbnails');
        thumbStrip.style.cssText = 'display:flex; gap:6px; padding:8px; background:#111; overflow-x:auto; justify-content:center;';

        function goTo(index) {
            currentIndex = (index + imagesFull.length) % imagesFull.length;
            mainImg.style.opacity = '0';
            setTimeout(() => {
                mainImg.src = imagesFull[currentIndex];
                mainImg.alt = 'Photo ' + (currentIndex + 1) + ' of ' + imagesFull.length + ' for ' + name;
                mainImg.style.opacity = '1';
                counterBadge.textContent = (currentIndex + 1) + ' / ' + imagesFull.length;
                srAnnounce.textContent   = 'Photo ' + (currentIndex + 1) + ' of ' + imagesFull.length;
                // Update thumbnail highlight + ARIA
                thumbStrip.querySelectorAll('button').forEach((t, i) => {
                    const isActive = i === currentIndex;
                    t.setAttribute('aria-selected', String(isActive));
                    t.style.outline = isActive ? '2px solid #3498db' : 'none';
                    t.querySelector('img').style.opacity = isActive ? '1' : '0.55';
                });
            }, 150);
        }

        prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
        nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

        // Build thumbnails as focusable buttons (not bare imgs) for keyboard access
        images.forEach((url, i) => {
            const thumbBtn = document.createElement('button');
            thumbBtn.setAttribute('role', 'tab');
            thumbBtn.setAttribute('aria-label', 'View photo ' + (i + 1));
            thumbBtn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            thumbBtn.setAttribute('type', 'button');
            thumbBtn.style.cssText = [
                'background:none',
                'border:none',
                'padding:0',
                'cursor:pointer',
                'border-radius:4px',
                'flex-shrink:0',
                'outline:' + (i === 0 ? '2px solid #3498db' : 'none'),
                'outline-offset:2px',
            ].join(';');

            const thumb = document.createElement('img');
            thumb.src      = url;
            thumb.alt      = '';          // decorative — button label covers it
            thumb.decoding = 'async';
            thumb.style.cssText = 'width:50px; height:50px; object-fit:cover; border-radius:4px; display:block; opacity:' + (i === 0 ? '1' : '0.55') + ';';

            thumbBtn.appendChild(thumb);
            thumbBtn.addEventListener('click', () => goTo(i));
            thumbStrip.appendChild(thumbBtn);
        });

        carouselWrapper.append(prevBtn, nextBtn, counterBadge);
        content.append(carouselWrapper, thumbStrip);

        // ── Keyboard: Left/Right arrows navigate carousel while modal is open ──
        content.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(currentIndex - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex + 1); }
        });

    } else {
        content.appendChild(carouselWrapper);
    }

    // ── Details ───────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'padding:25px; text-align:left;';

    const title = document.createElement('h2');
    title.id          = 'modalTitle';
    title.textContent = name;
    title.style.cssText = 'margin-top:0; color:#2c3e50;';

    const details = document.createElement('p');
    const locStrong = document.createElement('strong');
    locStrong.innerHTML = '<i class="fa fa-map-marker"></i> Location: ';
    details.append(locStrong, document.createTextNode(loc), document.createElement('br'), document.createElement('br'), document.createTextNode(desc || ''));

    const hr = document.createElement('hr');
    hr.style.cssText = 'border:0; border-top:1px solid #eee; margin:20px 0;';

    const claimBtn = document.createElement('button');
    claimBtn.id          = 'claim-btn-large';
    claimBtn.textContent = 'Inquire / Claim';
    claimBtn.setAttribute('aria-label', 'Inquire or Claim ' + name);
    claimBtn.style.cssText = 'width:100%; padding:15px; color:white; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer;';
    claimBtn.addEventListener('click', () => claimItem(id));

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fa fa-times"></i> Close';
    closeBtn.setAttribute('aria-label', 'Close modal');
    closeBtn.style.cssText = 'width:100%; padding:10px; margin-top:10px; background:#95a5a6; color:white; border:none; border-radius:8px; font-size:1rem; cursor:pointer;';
    closeBtn.addEventListener('click', closeModal);

    body.append(title, details, hr, claimBtn, closeBtn);
    content.appendChild(body);
    modal.appendChild(content);

    modal.style.display = 'flex';

    // Store previously focused element so we can return focus on close
    modalPreviousFocus = document.activeElement;

    // Set up focus trap and move focus into the modal
    setTimeout(() => {
        modalTrapHandler = trapFocus(content);
        if (modalTrapHandler) modal.addEventListener('keydown', modalTrapHandler);
        claimBtn.focus();
    }, 100);
}

// Tracks the element focused before a modal opened, so we can restore it on close
let modalPreviousFocus = null;
let modalTrapHandler   = null;

function trapFocus(container) {
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const elements  = Array.from(container.querySelectorAll(FOCUSABLE));
    if (!elements.length) return null;

    const first = elements[0];
    const last  = elements[elements.length - 1];

    return function handler(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
    };
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    if (modal) {
        modal.style.display = 'none';
        if (modalTrapHandler) {
            modal.removeEventListener('keydown', modalTrapHandler);
            modalTrapHandler = null;
        }
        if (modalPreviousFocus) {
            modalPreviousFocus.focus();
            modalPreviousFocus = null;
        }
    }
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('itemModal');
    if (modal && e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('itemModal');
        if (modal && modal.style.display === 'flex') closeModal();
    }
});

// ─── 5. ADMIN MANAGEMENT ────────────────────────────────────────────────────
function renderAdminTable() {
    const adminTable = document.getElementById('adminTable');
    if (!adminTable) return;

    db.collection('items').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        adminTable.innerHTML = '';
        snapshot.forEach((doc) => {
            const item         = doc.data();
            const itemCategory = item.category || 'Uncategorized';
            const images       = item.images && item.images.length ? item.images : [item.image];

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            // Photo thumbnail strip (up to 3 shown)
            const tdImg = document.createElement('td');
            const thumbRow = document.createElement('div');
            thumbRow.style.cssText = 'display:flex; gap:4px; align-items:center;';
            images.slice(0, 3).forEach((url, i) => {
                const img = document.createElement('img');
                img.src      = url;
                img.loading  = 'lazy';
                img.decoding = 'async';
                img.style.cssText = 'width:44px; height:44px; object-fit:cover; border-radius:4px;';
                thumbRow.appendChild(img);
            });
            if (images.length > 3) {
                const more = document.createElement('span');
                more.textContent  = '+' + (images.length - 3);
                more.style.cssText = 'font-size:0.8rem; color:#888;';
                thumbRow.appendChild(more);
            }
            tdImg.appendChild(thumbRow);

            // Name
            const tdName = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = item.name;
            tdName.appendChild(strong);

            // Category
            const tdCat = document.createElement('td');
            const badge = document.createElement('span');
            badge.className        = 'type-badge';
            badge.textContent      = itemCategory;
            badge.style.background = '#95a5a6';
            tdCat.appendChild(badge);

            // Status
            const tdStatus = document.createElement('td');
            tdStatus.textContent = item.status === 'approved' ? 'Approved' : 'Pending';

            // Actions
            const tdActions = document.createElement('td');
            if (item.status === 'pending') {
                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Approve';
                approveBtn.style.cssText = 'background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; margin-right:5px; cursor:pointer;';
                approveBtn.addEventListener('click', () => approveItem(doc.id));
                tdActions.appendChild(approveBtn);
            }
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.cssText = 'background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;';
            deleteBtn.addEventListener('click', () => deleteItem(doc.id));
            tdActions.appendChild(deleteBtn);

            tr.append(tdImg, tdName, tdCat, tdStatus, tdActions);
            adminTable.appendChild(tr);
        });
    });
}

async function approveItem(id) {
    try {
        await db.collection('items').doc(id).update({ status: 'approved' });
        alert('Item approved and added to the public gallery!');
    } catch (error) {
        console.error('Error approving item:', error);
        alert('Failed to approve item.');
    }
}

async function deleteItem(id) {
    if (confirm('Are you sure you want to remove this listing?')) {
        await db.collection('items').doc(id).delete();
    }
}

// ─── 6. CLAIM / INQUIRY ─────────────────────────────────────────────────────
function claimItem(id) {
    window.location.href = 'claim.html?id=' + id;
}

async function loadClaimPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId    = urlParams.get('id');
    if (!itemId) return;

    try {
        const doc = await db.collection('items').doc(itemId).get();
        if (doc.exists) {
            const item    = doc.data();
            const images  = item.images && item.images.length ? item.images : [item.image];
            const preview = document.getElementById('itemPreview');

            const img = document.createElement('img');
            img.src = images[0];
            img.style.cssText = 'width:150px; height:150px; object-fit:cover; border-radius:10px; margin-bottom:10px;';

            const h3 = document.createElement('h3');
            h3.textContent = 'Claiming: ' + item.name;

            const p = document.createElement('p');
            p.innerHTML = '<i class="fa fa-map-marker"></i> Found at: ' + item.location;

            preview.innerHTML = '';
            preview.append(img, h3, p);

            setupClaimSubmission(itemId, item.name);
        }
    } catch (error) {
        console.error('Error loading item:', error);
    }
}

function setupClaimSubmission(itemId, itemName) {
    const btn = document.getElementById('submitClaim');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const name    = document.getElementById('studentName').value.trim();
        const contact = document.getElementById('studentContact').value.trim();
        if (!name || !contact) {
            alert('Please fill in your name and contact info.');
            return;
        }

        const type = document.querySelector('input[name="requestType"]:checked').value;
        btn.disabled    = true;
        btn.textContent = 'Sending Request…';

        try {
            await db.collection('requests').add({
                itemId:      itemId,
                itemName:    itemName,
                studentName: name,
                contact:     contact,
                type:        type,
                message:     document.getElementById('claimMessage').value,
                status:      'unread',
                timestamp:   firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Your ' + type + ' has been sent successfully!');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Submission Error:', error);
            alert('Error sending request: ' + error.message);
            btn.disabled    = false;
            btn.textContent = 'Send Request';
        }
    });
}

// ─── 7. ADMIN REQUESTS VIEWER ───────────────────────────────────────────────
function renderRequestsTable() {
    const requestsTable = document.getElementById('requestsTable');
    if (!requestsTable) return;

    db.collection('requests').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        requestsTable.innerHTML = '';

        if (snapshot.empty) {
            requestsTable.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No claims or inquiries yet.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const req  = doc.data();
            const date = req.timestamp ? req.timestamp.toDate().toLocaleDateString() : 'Just now';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            const fields = [req.itemName, req.studentName, req.contact, null, req.message || 'No message', date, null];

            fields.forEach((text, i) => {
                const td = document.createElement('td');
                td.style.padding = '12px';

                if (i === 3) {
                    const badge = document.createElement('span');
                    badge.className   = 'type-badge';
                    badge.textContent = req.type;
                    td.appendChild(badge);
                } else if (i === 6) {
                    const btn = document.createElement('button');
                    btn.textContent   = 'Remove';
                    btn.style.cssText = 'background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;';
                    btn.addEventListener('click', () => deleteRequest(doc.id));
                    td.appendChild(btn);
                } else if (i === 0) {
                    const s = document.createElement('strong');
                    s.textContent = text;
                    td.appendChild(s);
                } else {
                    td.textContent = text;
                    if (i === 4) td.style.fontStyle = 'italic';
                }

                tr.appendChild(td);
            });

            requestsTable.appendChild(tr);
        });
    });
}

async function deleteRequest(id) {
    if (confirm('Are you sure you want to remove this request?')) {
        try {
            await db.collection('requests').doc(id).delete();
        } catch (error) {
            console.error('Error deleting request:', error);
        }
    }
}

// ─── 8. PAGE INIT ────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    const path = window.location.pathname;

    if (path.includes('admin.html')) {
        if (sessionStorage.getItem('isAdmin') === 'true') showAdminPanel();
    }

    if (path.includes('claim.html')) {
        loadClaimPage();
    }
});

// ─── 9. HAMBURGER MENU ───────────────────────────────────────────────────────
(function () {
    const hamburger = document.querySelector('.hamburger');
    const navbar    = document.querySelector('.navbar');
    if (!hamburger || !navbar) return;

    hamburger.addEventListener('click', () => {
        const isOpen = navbar.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', String(isOpen));
        hamburger.querySelector('i').className = isOpen ? 'fa fa-times' : 'fa fa-bars';
    });

    // Close the menu when any nav link is clicked
    navbar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navbar.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.querySelector('i').className = 'fa fa-bars';
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navbar.contains(e.target)) {
            navbar.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.querySelector('i').className = 'fa fa-bars';
        }
    });
}());

// Reuses the same in-view fade pattern as your existing .card elements

const introRows = document.querySelectorAll('.intro-row');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
        }
    });
}, { threshold: 0.15 });

introRows.forEach(row => observer.observe(row));
