/* 
   Interactive Building Map widget
   - Hover an area  -> tooltip with the area name
   - Click a pod    -> popup with that pod's map (blurred bg)
   - Side arrows    -> move between floors
   */
(function () {
  "use strict";

  // Pull floor data and the container element from the page
  var DATA = window.FLOOR_MAPS;
  var stage = document.getElementById("bmStage");
  if (!DATA || !stage) return; // abort if the page doesn't have the map widget

  var order = DATA.order;          // ["bottom","f1","f2","f3"]
  var floors = DATA.floors;        // {bottom:{name,svg}, ...}
  var POD_COUNT = 7;               // total number of pods in the building

  var floorIndex = 1;              // start on the 1st Floor (has pods 1 & 2)
  var currentPod = 1;              // which pod is open in the popup

  // ----- elements built once -----
  var labelEl = document.getElementById("bmFloorLabel"); // displays current floor name
  var prevBtn = document.getElementById("bmPrev");       // left arrow button
  var nextBtn = document.getElementById("bmNext");       // right arrow button
  var tabsEl  = document.getElementById("bmTabs");       // floor-tab strip
  var tooltip = document.getElementById("bmTooltip");    // hover label that follows the cursor

  // ----- floor tabs -----
  // Create one tab button per floor and append it to the tab strip
  order.forEach(function (key, i) {
    var b = document.createElement("button");
    b.className = "bm-tab";
    b.type = "button";
    b.textContent = floors[key].name;
    b.addEventListener("click", function () { goToFloor(i); }); // clicking a tab navigates to that floor
    tabsEl.appendChild(b);
  });

  // Renders the SVG for the current floor, updates labels/buttons, and wires hotspots
  function renderFloor() {
    var key = order[floorIndex];
    stage.innerHTML = floors[key].svg;      // inject the floor's SVG markup
    labelEl.textContent = floors[key].name; // update the displayed floor name

    // Make the SVG accessible to screen readers
    var svgEl = stage.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("role", "group");
      svgEl.setAttribute("aria-label", floors[key].name + " interactive map");
    }

    // Disable prev/next arrows at the first and last floors
    prevBtn.disabled = floorIndex === 0;
    nextBtn.disabled = floorIndex === order.length - 1;

    // Mark the active tab so it can be styled differently
    Array.prototype.forEach.call(tabsEl.children, function (t, i) {
      t.classList.toggle("active", i === floorIndex);
    });

    wireHotspots(); // attach mouse/keyboard listeners to all clickable regions
    resetZoom();    // reset any pan/zoom state from the previous floor
  }

  // Attaches tooltip, click, and keyboard listeners to every .hot element in the current floor SVG
  function wireHotspots() {
    var hots = stage.querySelectorAll(".hot"); // all interactive regions on this floor
    Array.prototype.forEach.call(hots, function (h) {
      var name = h.getAttribute("data-name"); // human-readable area label
      var pod  = h.getAttribute("data-pod");  // pod number, present only for pod hotspots

      // Show/move/hide the floating tooltip on hover
      h.addEventListener("mouseenter", function () { showTip(name); });
      h.addEventListener("mousemove", moveTip);
      h.addEventListener("mouseleave", hideTip);

      if (pod) {
        // Pod regions open the pod popup when clicked/activated
        h.classList.add("is-pod");
        h.setAttribute("tabindex", "0");
        h.setAttribute("role", "button");
        h.setAttribute("aria-label", "Open " + name + " map");
        h.addEventListener("click", function () { openPod(parseInt(pod, 10), h); });
        h.addEventListener("keydown", function (e) {
          // Enter or Space triggers the pod popup (keyboard accessibility)
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPod(parseInt(pod, 10), h); }
        });
      } else if (!h.classList.contains("hot-hall") &&
                 !h.classList.contains("hot-stairs") &&
                 !h.classList.contains("hot-restroom")) {
        // click a room/area to filter the gallery to items found there
        h.classList.add("is-clickable");
        h.setAttribute("tabindex", "0");
        h.setAttribute("role", "button");
        h.setAttribute("aria-label", "Show items found in " + name);
        h.addEventListener("click", function () {
          if (window.filterGalleryByRoom) window.filterGalleryByRoom(name, name); // filter gallery by this area name
        });
        h.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (window.filterGalleryByRoom) window.filterGalleryByRoom(name, name);
          }
        });
      }
    });
  }

  // ----- tooltip -----
  // Display the tooltip with the given text
  function showTip(text) { tooltip.textContent = text; tooltip.classList.add("show"); }

  // Reposition the tooltip to follow the mouse, flipping it if it would overflow the viewport
  function moveTip(e) {
    var pad = 14;
    var x = e.clientX + pad, y = e.clientY + pad;
    var w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    if (x + w > window.innerWidth)  x = e.clientX - w - pad;  // flip left if clipped on the right
    if (y + h > window.innerHeight) y = e.clientY - h - pad;  // flip up if clipped at the bottom
    tooltip.style.left = x + "px";
    tooltip.style.top  = y + "px";
  }

  // Hide the tooltip
  function hideTip() { tooltip.classList.remove("show"); }

  // ----- floor navigation -----
  // Navigate to floor at index i, ignoring out-of-range values
  function goToFloor(i) {
    if (i < 0 || i > order.length - 1) return;
    floorIndex = i;
    hideTip();       // dismiss any open tooltip before switching floors
    renderFloor();
  }
  prevBtn.addEventListener("click", function () { goToFloor(floorIndex - 1); }); // go one floor down
  nextBtn.addEventListener("click", function () { goToFloor(floorIndex + 1); }); // go one floor up

  // ----- pod popup -----
  var modal      = document.getElementById("podModal");    // overlay dialog containing the pod map
  var podWrap    = document.getElementById("podImgWrap");  // container for the pod's SVG
  var podTitle   = document.getElementById("podTitle");    // heading that shows "Pod N"
  var podFallback = document.getElementById("podFallback"); // shown when no SVG is available
  var POD_MAPS   = window.POD_MAPS || {};  // map of pod number -> { svg } data
  var lastFocused = null; // element to return focus to when the modal closes

  // Returns all focusable elements currently visible inside the modal (used for focus trapping)
  function getFocusable() {
    return Array.prototype.slice.call(
      modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return el.offsetParent !== null; }); // exclude hidden elements
  }

  var pendingPodHighlight = null; // room name to pulse-highlight after the pod map loads

  // Opens the pod popup for pod n, optionally highlighting a specific room inside it
  function openPod(n, trigger, highlightRoom) {
    pendingPodHighlight = highlightRoom ? String(highlightRoom).toLowerCase() : null;
    lastFocused = trigger || document.activeElement; // remember where focus was before opening
    currentPod = n;
    loadPod();                              // render the pod's SVG
    modal.classList.add("open");            // make the overlay visible
    document.body.style.overflow = "hidden"; // prevent page scrolling while modal is open
    hideTip();
    document.getElementById("podClose").focus(); // move focus into the dialog immediately
  }

  // Loads (or refreshes) the current pod's SVG into the popup and wires its hotspots
  function loadPod() {
    podTitle.textContent = "Pod " + currentPod;
    var data = POD_MAPS[currentPod];
    if (data && data.svg) {
      podFallback.style.display = "none";
      podWrap.style.display = "block";
      podWrap.innerHTML = data.svg; // inject pod SVG
      wirePodHotspots();
      if (pendingPodHighlight) {
        // Pulse-animate the target room to draw the user's eye to it
        var rooms = podWrap.querySelectorAll(".pod-hot");
        for (var i = 0; i < rooms.length; i++) {
          if ((rooms[i].getAttribute("data-name") || "").toLowerCase() === pendingPodHighlight) {
            (function (el) {
              el.classList.add("locate-pulse");
              setTimeout(function () { el.classList.remove("locate-pulse"); }, 3200); // remove after animation
            })(rooms[i]);
            break;
          }
        }
        pendingPodHighlight = null; // clear so it doesn't re-trigger on the next loadPod call
      }
    } else {
      // No SVG data available — show a placeholder message instead
      podWrap.style.display = "none";
      podWrap.innerHTML = "";
      podFallback.style.display = "flex";
    }
  }

  // Attaches tooltip and gallery-filter listeners to every .pod-hot element inside the pod popup
  function wirePodHotspots() {
    var hots = podWrap.querySelectorAll(".pod-hot");
    Array.prototype.forEach.call(hots, function (h) {
      var name   = h.getAttribute("data-name");
      var isRoom = !h.classList.contains("commons"); // commons areas are not individual rooms
      var label  = isRoom ? "Room " + name : name;
      h.setAttribute("tabindex", "0");
      h.setAttribute("role", "img");
      h.setAttribute("aria-label", label);

      // Show tooltip on hover and keyboard focus
      h.addEventListener("mouseenter", function () { showTip(label); });
      h.addEventListener("mousemove",  moveTip);
      h.addEventListener("mouseleave", hideTip);
      h.addEventListener("focus",      function () { showTip(label); });
      h.addEventListener("blur",       hideTip);

      if (isRoom) {
        // click a pod room to filter the gallery to items found there
        h.classList.add("is-clickable");
        h.setAttribute("role", "button");
        h.setAttribute("aria-label", "Show items found in Room " + name);
        var filterRoom = function () {
          if (window.filterGalleryByRoom) { window.filterGalleryByRoom(name, "Room " + name); closePod(); }
        };
        h.addEventListener("click", filterRoom);
        h.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filterRoom(); }
        });
      }
    });
  }

  // Closes the pod popup and restores page scroll and keyboard focus
  function closePod() {
    modal.classList.remove("open");
    document.body.style.overflow = ""; // re-enable page scrolling
    hideTip();
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus(); // return focus to the trigger element
  }

  // Moves to the next (+1) or previous (-1) pod, wrapping around at both ends
  function stepPod(d) {
    currentPod = ((currentPod - 1 + d + POD_COUNT) % POD_COUNT) + 1; // modular arithmetic keeps it in [1, POD_COUNT]
    loadPod();
  }

  // Wire up the pod popup's control buttons
  document.getElementById("podClose").addEventListener("click", closePod);
  document.getElementById("podPrev").addEventListener("click", function () { stepPod(-1); }); // previous pod
  document.getElementById("podNext").addEventListener("click", function () { stepPod(+1); }); // next pod
  modal.addEventListener("click", function (e) { if (e.target === modal) closePod(); }); // click outside closes modal

  // Keyboard navigation while the pod modal is open
  document.addEventListener("keydown", function (e) {
    if (!modal.classList.contains("open")) return; // ignore if modal isn't visible
    if (e.key === "Escape")     { closePod();   return; }
    if (e.key === "ArrowLeft")  { stepPod(-1);  return; }
    if (e.key === "ArrowRight") { stepPod(+1);  return; }
    if (e.key === "Tab") {
      // focus trap inside the dialog
      var f = getFocusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();  // wrap backwards from first to last
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus(); // wrap forwards from last to first
      } else if (!modal.contains(document.activeElement)) {
        e.preventDefault(); first.focus(); // pull stray focus back into the dialog
      }
    }
  });

  // ===== Locate-on-map (called from item cards / modal in script.js) =====
  // Build lookups: area/classroom name -> floor index, pod number -> floor index,
  // pod room number -> pod number.
  var NAME_TO_FLOOR = {}, POD_FLOOR = {}, ROOM_TO_POD = {};

  // Scan each floor's SVG to populate NAME_TO_FLOOR and POD_FLOOR lookup tables
  order.forEach(function (key, fi) {
    var svg = floors[key].svg, m;
    var reN = /data-name="([^"]+)"/g; // regex to find all named hotspots
    while ((m = reN.exec(svg))) {
      var nm = m[1].toLowerCase();
      if (!(nm in NAME_TO_FLOOR)) NAME_TO_FLOOR[nm] = fi; // first occurrence wins
    }
    var reP = /data-pod="(\d+)"/g; // regex to find all pod hotspots
    while ((m = reP.exec(svg))) { POD_FLOOR[m[1]] = fi; } // record which floor each pod is on
  });

  // Scan each pod's SVG to build a room-name -> pod-number lookup
  Object.keys(POD_MAPS).forEach(function (pn) {
    var svg = POD_MAPS[pn].svg, m;
    var re = /class="pod-hot" data-name="([^"]+)"/g; // rooms only (commons carry an extra class)
    while ((m = re.exec(svg))) { ROOM_TO_POD[m[1].toLowerCase()] = pn; }
  });

  // Scrolls the map section into view smoothly so the user can see the highlight
  function scrollMapIntoView() {
    var sec = document.getElementById("map-section") ||
              document.querySelector(".building-map-section");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Adds the locate-pulse CSS animation to an element, then removes it after 3.2 s
  function pulseEl(el) {
    if (!el) return;
    el.classList.remove("locate-pulse");
    void el.getBoundingClientRect(); // force a reflow to restart the animation even if already pulsing
    el.classList.add("locate-pulse");
    setTimeout(function () { el.classList.remove("locate-pulse"); }, 3200);
  }

  // Runs predicate against every .hot element on the current floor and pulses those that match
  function highlightOnFloor(predicate) {
    var hots  = stage.querySelectorAll(".hot");
    var found = false;
    for (var i = 0; i < hots.length; i++) {
      if (predicate(hots[i])) { pulseEl(hots[i]); found = true; }
    }
    return found; // true if at least one element was highlighted
  }

  // Shows a transient toast notification that auto-dismisses after ~3.4 s
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "bm-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); }); // trigger CSS enter transition
    setTimeout(function () {
      t.classList.remove("show"); // trigger CSS exit transition
      setTimeout(function () { t.remove(); }, 300); // remove from DOM after fade-out
    }, 3400);
  }

  // Turn a free-text location into a canonical target. Shared by locate-on-map
  // (item -> map) and the gallery filter (map -> items) so both stay in sync.
  function resolveTarget(rawLoc) {
    // Normalise the input: strip "Room " prefix, lowercase, and alias "library" to "media center"
    var loc = (rawLoc == null ? "" : String(rawLoc)).trim().toLowerCase().replace(/^room\s+/, "");
    loc = loc.replace(/\blibrar(?:y|ies)\b/g, "media center").trim(); // library == Media Center
    if (!loc) return null;

    // Exact match: room inside a pod
    if (ROOM_TO_POD[loc]) return { type: "pod", key: loc, pod: ROOM_TO_POD[loc], floor: POD_FLOOR[ROOM_TO_POD[loc]] };
    // Exact match: named area on a floor
    if (loc in NAME_TO_FLOOR) return { type: "floor", key: loc, floor: NAME_TO_FLOOR[loc] };

    // Fuzzy match: find the longest area name that contains or is contained by the query
    var best = null;
    Object.keys(NAME_TO_FLOOR).forEach(function (nm) {
      if (nm.length < 3) return; // skip very short keys to avoid false positives
      if (loc.indexOf(nm) !== -1 || nm.indexOf(loc) !== -1) { if (!best || nm.length > best.length) best = nm; }
    });
    if (best) return { type: "floor", key: best, floor: NAME_TO_FLOOR[best] };
    return null; // location could not be matched
  }

  // Exposed: free-text location -> canonical key (or null). Used by the gallery.
  window.resolveLocation = function (raw) { var t = resolveTarget(raw); return t ? t.key : null; };

  // Exposed: scrolls to the map, navigates to the correct floor, and highlights the matching area
  window.locateOnMap = function (rawLoc) {
    var loc = (rawLoc == null ? "" : String(rawLoc)).trim();
    if (!loc) { toast("No location was recorded for this item."); return false; }
    scrollMapIntoView();
    var t = resolveTarget(loc);
    if (!t) { toast('Couldn’t find “' + loc + '” on the map.'); return false; }
    if (t.type === "pod") {
      if (t.floor != null) {
        goToFloor(t.floor); // switch to the floor that contains this pod
        highlightOnFloor(function (h) { return h.getAttribute("data-pod") === t.pod; }); // pulse the pod hotspot
      }
      setTimeout(function () { openPod(parseInt(t.pod, 10), null, t.key); }, 450); // slight delay lets the floor transition settle
      return true;
    }
    goToFloor(t.floor); // switch to the floor containing this named area
    highlightOnFloor(function (h) { return (h.getAttribute("data-name") || "").toLowerCase() === t.key; }); // pulse the matching area
    return true;
  };

  // ===== Map zoom & pan (scales only the map, not the page) =====
  var zScale = 1, zTx = 0, zTy = 0; // current zoom scale and translation offsets

  // Applies the current zScale/zTx/zTy to the SVG via a CSS transform
  function applyZoom() {
    var s = stage.querySelector("svg");
    if (!s) return;
    s.style.transformOrigin = "0 0"; // scale from the top-left corner
    s.style.transform = "translate(" + zTx + "px," + zTy + "px) scale(" + zScale + ")";
    stage.style.touchAction = zScale > 1 ? "none" : "pan-y"; // disable native scroll when panning
  }

  // Clamps zTx/zTy so the zoomed SVG never leaves a gap at any edge of the stage
  function clampPan() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (zScale <= 1) { zTx = 0; zTy = 0; return; } // no pan needed at 1× zoom
    zTx = Math.min(0, Math.max(w - w * zScale, zTx)); // clamp horizontal translation
    zTy = Math.min(0, Math.max(h - h * zScale, zTy)); // clamp vertical translation
  }

  // Zooms by factor around the point (clientX, clientY); defaults to the stage center
  function zoomAt(factor, clientX, clientY) {
    var r  = stage.getBoundingClientRect();
    var cx = (clientX == null ? r.width  / 2 : clientX - r.left); // pivot x relative to stage
    var cy = (clientY == null ? r.height / 2 : clientY - r.top);  // pivot y relative to stage
    var ns = Math.min(5, Math.max(1, zScale * factor));  // clamp new scale to [1, 5]
    if (ns === zScale) return;
    // Adjust translation so the pivot point stays fixed on screen
    zTx = cx - (ns / zScale) * (cx - zTx);
    zTy = cy - (ns / zScale) * (cy - zTy);
    zScale = ns;
    clampPan();
    applyZoom();
  }

  // Resets zoom and pan back to the default 1× state
  function resetZoom() { zScale = 1; zTx = 0; zTy = 0; applyZoom(); }

  // Wire up the zoom control buttons
  document.getElementById("bmZoomIn").addEventListener("click",    function () { zoomAt(1.4); });      // zoom in 40%
  document.getElementById("bmZoomOut").addEventListener("click",   function () { zoomAt(1 / 1.4); }); // zoom out 40%
  document.getElementById("bmZoomReset").addEventListener("click", resetZoom);

  // State variables for touch pinch-to-zoom and drag-to-pan
  var panning = false, sx = 0, sy = 0, tx0 = 0, ty0 = 0, pinchD = 0;

  // Touch start: begin a pinch gesture (2 fingers) or a pan gesture (1 finger while zoomed)
  stage.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      var a = e.touches[0], b = e.touches[1];
      pinchD = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); // initial finger distance
      panning = false;
      e.preventDefault();
    } else if (e.touches.length === 1 && zScale > 1) {
      panning = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tx0 = zTx; ty0 = zTy; // record start position
    }
  }, { passive: false });

  // Touch move: handle pinch zoom or single-finger pan
  stage.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && pinchD) {
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1];
      var d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); // current finger distance
      zoomAt(d / pinchD, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2); // zoom relative to midpoint
      pinchD = d; // update reference distance for next move event
    } else if (panning && e.touches.length === 1) {
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) e.preventDefault(); // suppress scroll once intentional pan is detected
      zTx = tx0 + dx; zTy = ty0 + dy; clampPan(); applyZoom();
    }
  }, { passive: false });

  // Touch end: reset pinch distance and panning flag when fingers lift
  stage.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) pinchD = 0;
    if (e.touches.length === 0) panning = false;
  });

  // mouse drag-to-pan when zoomed (desktop)
  var dragMoved = false; // tracks whether the mouse has moved enough to be a drag vs. a click
  stage.addEventListener("mousedown", function (e) {
    if (zScale <= 1) return; // only pan when zoomed in
    panning = true; dragMoved = false; sx = e.clientX; sy = e.clientY; tx0 = zTx; ty0 = zTy; e.preventDefault();
  });
  window.addEventListener("mousemove", function (e) {
    if (!panning) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) dragMoved = true; // mark as a drag after 4 px of movement
    zTx = tx0 + (e.clientX - sx); zTy = ty0 + (e.clientY - sy); clampPan(); applyZoom();
  });
  window.addEventListener("mouseup", function () { panning = false; });

  // swallow the click that ends a drag so it doesn't open a pod / filter
  stage.addEventListener("click", function (e) {
    if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; }
  }, true);

  // Initial render on page load
  renderFloor();
})();
