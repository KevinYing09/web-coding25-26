/* ============================================================
   Interactive Building Map widget
   - Hover an area  -> tooltip with the area name
   - Click a pod    -> popup with that pod's map (blurred bg)
   - Side arrows    -> move between floors
   ============================================================ */
(function () {
  "use strict";

  var DATA = window.FLOOR_MAPS;
  var stage = document.getElementById("bmStage");
  if (!DATA || !stage) return;

  var order = DATA.order;          // ["bottom","f1","f2","f3"]
  var floors = DATA.floors;        // {bottom:{name,svg}, ...}
  var POD_COUNT = 7;

  var floorIndex = 1;              // start on the 1st Floor (has pods 1 & 2)
  var currentPod = 1;

  // ----- elements built once -----
  var labelEl = document.getElementById("bmFloorLabel");
  var prevBtn = document.getElementById("bmPrev");
  var nextBtn = document.getElementById("bmNext");
  var tabsEl  = document.getElementById("bmTabs");
  var tooltip = document.getElementById("bmTooltip");

  // ----- floor tabs -----
  order.forEach(function (key, i) {
    var b = document.createElement("button");
    b.className = "bm-tab";
    b.type = "button";
    b.textContent = floors[key].name;
    b.addEventListener("click", function () { goToFloor(i); });
    tabsEl.appendChild(b);
  });

  function renderFloor() {
    var key = order[floorIndex];
    stage.innerHTML = floors[key].svg;
    labelEl.textContent = floors[key].name;

    var svgEl = stage.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("role", "group");
      svgEl.setAttribute("aria-label", floors[key].name + " interactive map");
    }

    prevBtn.disabled = floorIndex === 0;
    nextBtn.disabled = floorIndex === order.length - 1;

    Array.prototype.forEach.call(tabsEl.children, function (t, i) {
      t.classList.toggle("active", i === floorIndex);
    });

    wireHotspots();
    resetZoom();
  }

  function wireHotspots() {
    var hots = stage.querySelectorAll(".hot");
    Array.prototype.forEach.call(hots, function (h) {
      var name = h.getAttribute("data-name");
      var pod = h.getAttribute("data-pod");

      h.addEventListener("mouseenter", function () { showTip(name); });
      h.addEventListener("mousemove", moveTip);
      h.addEventListener("mouseleave", hideTip);

      if (pod) {
        h.classList.add("is-pod");
        h.setAttribute("tabindex", "0");
        h.setAttribute("role", "button");
        h.setAttribute("aria-label", "Open " + name + " map");
        h.addEventListener("click", function () { openPod(parseInt(pod, 10), h); });
        h.addEventListener("keydown", function (e) {
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
          if (window.filterGalleryByRoom) window.filterGalleryByRoom(name, name);
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
  function showTip(text) { tooltip.textContent = text; tooltip.classList.add("show"); }
  function moveTip(e) {
    var pad = 14;
    var x = e.clientX + pad, y = e.clientY + pad;
    var w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    if (x + w > window.innerWidth) x = e.clientX - w - pad;
    if (y + h > window.innerHeight) y = e.clientY - h - pad;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }
  function hideTip() { tooltip.classList.remove("show"); }

  // ----- floor navigation -----
  function goToFloor(i) {
    if (i < 0 || i > order.length - 1) return;
    floorIndex = i;
    hideTip();
    renderFloor();
  }
  prevBtn.addEventListener("click", function () { goToFloor(floorIndex - 1); });
  nextBtn.addEventListener("click", function () { goToFloor(floorIndex + 1); });

  // ----- pod popup -----
  var modal = document.getElementById("podModal");
  var podWrap = document.getElementById("podImgWrap");
  var podTitle = document.getElementById("podTitle");
  var podFallback = document.getElementById("podFallback");
  var POD_MAPS = window.POD_MAPS || {};
  var lastFocused = null;

  function getFocusable() {
    return Array.prototype.slice.call(
      modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return el.offsetParent !== null; });
  }

  var pendingPodHighlight = null;

  function openPod(n, trigger, highlightRoom) {
    pendingPodHighlight = highlightRoom ? String(highlightRoom).toLowerCase() : null;
    lastFocused = trigger || document.activeElement;
    currentPod = n;
    loadPod();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    hideTip();
    document.getElementById("podClose").focus();
  }
  function loadPod() {
    podTitle.textContent = "Pod " + currentPod;
    var data = POD_MAPS[currentPod];
    if (data && data.svg) {
      podFallback.style.display = "none";
      podWrap.style.display = "block";
      podWrap.innerHTML = data.svg;
      wirePodHotspots();
      if (pendingPodHighlight) {
        var rooms = podWrap.querySelectorAll(".pod-hot");
        for (var i = 0; i < rooms.length; i++) {
          if ((rooms[i].getAttribute("data-name") || "").toLowerCase() === pendingPodHighlight) {
            (function (el) {
              el.classList.add("locate-pulse");
              setTimeout(function () { el.classList.remove("locate-pulse"); }, 3200);
            })(rooms[i]);
            break;
          }
        }
        pendingPodHighlight = null;
      }
    } else {
      podWrap.style.display = "none";
      podWrap.innerHTML = "";
      podFallback.style.display = "flex";
    }
  }

  function wirePodHotspots() {
    var hots = podWrap.querySelectorAll(".pod-hot");
    Array.prototype.forEach.call(hots, function (h) {
      var name = h.getAttribute("data-name");
      var isRoom = !h.classList.contains("commons");
      var label = isRoom ? "Room " + name : name;
      h.setAttribute("tabindex", "0");
      h.setAttribute("role", "img");
      h.setAttribute("aria-label", label);
      h.addEventListener("mouseenter", function () { showTip(label); });
      h.addEventListener("mousemove", moveTip);
      h.addEventListener("mouseleave", hideTip);
      h.addEventListener("focus", function () { showTip(label); });
      h.addEventListener("blur", hideTip);

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

  function closePod() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    hideTip();
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }
  function stepPod(d) {
    currentPod = ((currentPod - 1 + d + POD_COUNT) % POD_COUNT) + 1;
    loadPod();
  }

  document.getElementById("podClose").addEventListener("click", closePod);
  document.getElementById("podPrev").addEventListener("click", function () { stepPod(-1); });
  document.getElementById("podNext").addEventListener("click", function () { stepPod(1); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closePod(); });
  document.addEventListener("keydown", function (e) {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") { closePod(); return; }
    if (e.key === "ArrowLeft") { stepPod(-1); return; }
    if (e.key === "ArrowRight") { stepPod(1); return; }
    if (e.key === "Tab") {
      // focus trap inside the dialog
      var f = getFocusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      } else if (!modal.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
    }
  });

  // ===== Locate-on-map (called from item cards / modal in script.js) =====
  // Build lookups: area/classroom name -> floor index, pod number -> floor index,
  // pod room number -> pod number.
  var NAME_TO_FLOOR = {}, POD_FLOOR = {}, ROOM_TO_POD = {};
  order.forEach(function (key, fi) {
    var svg = floors[key].svg, m;
    var reN = /data-name="([^"]+)"/g;
    while ((m = reN.exec(svg))) {
      var nm = m[1].toLowerCase();
      if (!(nm in NAME_TO_FLOOR)) NAME_TO_FLOOR[nm] = fi;
    }
    var reP = /data-pod="(\d+)"/g;
    while ((m = reP.exec(svg))) { POD_FLOOR[m[1]] = fi; }
  });
  Object.keys(POD_MAPS).forEach(function (pn) {
    var svg = POD_MAPS[pn].svg, m;
    var re = /class="pod-hot" data-name="([^"]+)"/g; // rooms only (commons carry an extra class)
    while ((m = re.exec(svg))) { ROOM_TO_POD[m[1].toLowerCase()] = pn; }
  });

  function scrollMapIntoView() {
    var sec = document.getElementById("map-section") ||
              document.querySelector(".building-map-section");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function pulseEl(el) {
    if (!el) return;
    el.classList.remove("locate-pulse");
    void el.getBoundingClientRect(); // restart the animation
    el.classList.add("locate-pulse");
    setTimeout(function () { el.classList.remove("locate-pulse"); }, 3200);
  }

  function highlightOnFloor(predicate) {
    var hots = stage.querySelectorAll(".hot");
    var found = false;
    for (var i = 0; i < hots.length; i++) {
      if (predicate(hots[i])) { pulseEl(hots[i]); found = true; }
    }
    return found;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "bm-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 300);
    }, 3400);
  }

  // Turn a free-text location into a canonical target. Shared by locate-on-map
  // (item -> map) and the gallery filter (map -> items) so both stay in sync.
  function resolveTarget(rawLoc) {
    var loc = (rawLoc == null ? "" : String(rawLoc)).trim().toLowerCase().replace(/^room\s+/, "");
    loc = loc.replace(/\blibrar(?:y|ies)\b/g, "media center").trim(); // library == Media Center
    if (!loc) return null;
    if (ROOM_TO_POD[loc]) return { type: "pod", key: loc, pod: ROOM_TO_POD[loc], floor: POD_FLOOR[ROOM_TO_POD[loc]] };
    if (loc in NAME_TO_FLOOR) return { type: "floor", key: loc, floor: NAME_TO_FLOOR[loc] };
    var best = null;
    Object.keys(NAME_TO_FLOOR).forEach(function (nm) {
      if (nm.length < 3) return;
      if (loc.indexOf(nm) !== -1 || nm.indexOf(loc) !== -1) { if (!best || nm.length > best.length) best = nm; }
    });
    if (best) return { type: "floor", key: best, floor: NAME_TO_FLOOR[best] };
    return null;
  }

  // Exposed: free-text location -> canonical key (or null). Used by the gallery.
  window.resolveLocation = function (raw) { var t = resolveTarget(raw); return t ? t.key : null; };

  window.locateOnMap = function (rawLoc) {
    var loc = (rawLoc == null ? "" : String(rawLoc)).trim();
    if (!loc) { toast("No location was recorded for this item."); return false; }
    scrollMapIntoView();
    var t = resolveTarget(loc);
    if (!t) { toast('Couldn’t find "' + loc + '" on the map.'); return false; }
    if (t.type === "pod") {
      if (t.floor != null) {
        goToFloor(t.floor);
        highlightOnFloor(function (h) { return h.getAttribute("data-pod") === t.pod; });
      }
      setTimeout(function () { openPod(parseInt(t.pod, 10), null, t.key); }, 450);
      return true;
    }
    goToFloor(t.floor);
    highlightOnFloor(function (h) { return (h.getAttribute("data-name") || "").toLowerCase() === t.key; });
    return true;
  };

  // ===== Map zoom & pan (scales only the map, not the page) =====
  var zScale = 1, zTx = 0, zTy = 0;

  function applyZoom() {
    var s = stage.querySelector("svg");
    if (!s) return;
    s.style.transformOrigin = "0 0";
    s.style.transform = "translate(" + zTx + "px," + zTy + "px) scale(" + zScale + ")";
    stage.style.touchAction = zScale > 1 ? "none" : "pan-y";
  }
  function clampPan() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (zScale <= 1) { zTx = 0; zTy = 0; return; }
    zTx = Math.min(0, Math.max(w - w * zScale, zTx));
    zTy = Math.min(0, Math.max(h - h * zScale, zTy));
  }
  function zoomAt(factor, clientX, clientY) {
    var r = stage.getBoundingClientRect();
    var cx = (clientX == null ? r.width / 2 : clientX - r.left);
    var cy = (clientY == null ? r.height / 2 : clientY - r.top);
    var ns = Math.min(5, Math.max(1, zScale * factor));
    if (ns === zScale) return;
    zTx = cx - (ns / zScale) * (cx - zTx);
    zTy = cy - (ns / zScale) * (cy - zTy);
    zScale = ns;
    clampPan();
    applyZoom();
  }
  function resetZoom() { zScale = 1; zTx = 0; zTy = 0; applyZoom(); }

  document.getElementById("bmZoomIn").addEventListener("click", function () { zoomAt(1.4); });
  document.getElementById("bmZoomOut").addEventListener("click", function () { zoomAt(1 / 1.4); });
  document.getElementById("bmZoomReset").addEventListener("click", resetZoom);

  var panning = false, sx = 0, sy = 0, tx0 = 0, ty0 = 0, pinchD = 0;
  stage.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      var a = e.touches[0], b = e.touches[1];
      pinchD = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      panning = false;
      e.preventDefault();
    } else if (e.touches.length === 1 && zScale > 1) {
      panning = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tx0 = zTx; ty0 = zTy;
    }
  }, { passive: false });
  stage.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && pinchD) {
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1];
      var d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      zoomAt(d / pinchD, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      pinchD = d;
    } else if (panning && e.touches.length === 1) {
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) e.preventDefault();
      zTx = tx0 + dx; zTy = ty0 + dy; clampPan(); applyZoom();
    }
  }, { passive: false });
  stage.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) pinchD = 0;
    if (e.touches.length === 0) panning = false;
  });

  // mouse drag-to-pan when zoomed (desktop)
  var dragMoved = false;
  stage.addEventListener("mousedown", function (e) {
    if (zScale <= 1) return;
    panning = true; dragMoved = false; sx = e.clientX; sy = e.clientY; tx0 = zTx; ty0 = zTy; e.preventDefault();
  });
  window.addEventListener("mousemove", function (e) {
    if (!panning) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) dragMoved = true;
    zTx = tx0 + (e.clientX - sx); zTy = ty0 + (e.clientY - sy); clampPan(); applyZoom();
  });
  window.addEventListener("mouseup", function () { panning = false; });
  // swallow the click that ends a drag so it doesn't open a pod / filter
  stage.addEventListener("click", function (e) {
    if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; }
  }, true);

  renderFloor();
})();
