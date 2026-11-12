(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  var MIN_SCALE = 0.18;
  var MAX_SCALE = 2.8;

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function create(options) {
    var viewport = options.viewport;
    var stage = options.stage;
    var onChange = options.onChange || function () {};

    var scale = 1;
    var tx = 0;
    var ty = 0;
    var world = { w: 1000, h: 1000 };
    var frameRequest = null;
    var reduced =
      global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function snapshot() {
      return { scale: scale, tx: tx, ty: ty, world: { w: world.w, h: world.h } };
    }

    function apply() {
      stage.style.transform =
        'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
      onChange(snapshot());
    }

    function clampPan() {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var w = world.w * scale;
      var h = world.h * scale;

      // Keep at least a quarter of the tree reachable instead of snapping the
      // world back to the middle: force-centering breaks "fly to this person"
      // whenever the tree is narrower than the window.
      var keepX = Math.min(w, vw) * 0.25;
      var keepY = Math.min(h, vh) * 0.25;

      tx = clamp(tx, keepX - w, vw - keepX);
      ty = clamp(ty, keepY - h, vh - keepY);
    }

    function setWorld(w, h) {
      world = { w: Math.max(1, w), h: Math.max(1, h) };
      clampPan();
      apply();
    }

    function fitScale(padding) {
      var pad = padding == null ? 64 : padding;
      var vw = viewport.clientWidth || 1;
      var vh = viewport.clientHeight || 1;
      return Math.min((vw - pad * 2) / world.w, (vh - pad * 2) / world.h);
    }

    function fit(padding) {
      var pad = padding == null ? 64 : padding;
      var vw = viewport.clientWidth || 1;
      var vh = viewport.clientHeight || 1;

      scale = clamp(fitScale(pad), MIN_SCALE, 1);
      tx = (vw - world.w * scale) / 2;
      ty = (vh - world.h * scale) / 2;
      apply();
    }

    function zoomAt(factor, clientX, clientY) {
      var rect = viewport.getBoundingClientRect();
      var px = clientX - rect.left;
      var py = clientY - rect.top;
      var wx = (px - tx) / scale;
      var wy = (py - ty) / scale;
      var next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);

      if (next === scale) return;
      scale = next;
      tx = px - wx * scale;
      ty = py - wy * scale;
      clampPan();
      apply();
    }

    function zoomCenter(factor) {
      var rect = viewport.getBoundingClientRect();
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function panBy(dx, dy) {
      tx += dx;
      ty += dy;
      clampPan();
      apply();
    }

    function centerOn(x, y, targetScale) {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      if (targetScale) scale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
      tx = vw / 2 - x * scale;
      ty = vh / 2 - y * scale;
      apply();
    }

    function cancelAnim() {
      if (frameRequest) {
        global.cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
    }

    function animateTo(x, y, targetScale, duration) {
      cancelAnim();
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var s1 = clamp(targetScale || scale, MIN_SCALE, MAX_SCALE);
      var tx1 = vw / 2 - x * s1;
      var ty1 = vh / 2 - y * s1;

      if (reduced) {
        scale = s1;
        tx = tx1;
        ty = ty1;
        apply();
        return;
      }

      var s0 = scale;
      var tx0 = tx;
      var ty0 = ty;
      var t0 = global.performance ? global.performance.now() : Date.now();
      var dur = duration || 520;

      function ease(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        var e = ease(t);
        scale = s0 + (s1 - s0) * e;
        tx = tx0 + (tx1 - tx0) * e;
        ty = ty0 + (ty1 - ty0) * e;
        apply();
        if (t < 1) frameRequest = global.requestAnimationFrame(step);
        else frameRequest = null;
      }

      frameRequest = global.requestAnimationFrame(step);
    }

    function worldToScreen(x, y) {
      return { x: x * scale + tx, y: y * scale + ty };
    }

    function get() {
      return { scale: scale, tx: tx, ty: ty };
    }

    function set(value) {
      if (!value) return;
      if (Number.isFinite(value.scale)) scale = clamp(value.scale, MIN_SCALE, MAX_SCALE);
      if (Number.isFinite(value.tx)) tx = value.tx;
      if (Number.isFinite(value.ty)) ty = value.ty;
      apply();
    }

    function scaleForViewport() {
      return scale;
    }

    function bind() {
      var pointers = new Map();
      var dragging = false;
      var moved = false;
      var startX = 0;
      var startY = 0;
      var lastX = 0;
      var lastY = 0;
      var pinchDistance = 0;
      var isPanning = false;

      function distance() {
        var items = Array.from(pointers.values());
        return Math.hypot(items[0].clientX - items[1].clientX, items[0].clientY - items[1].clientY);
      }

      function midpoint() {
        var items = Array.from(pointers.values());
        return {
          x: (items[0].clientX + items[1].clientX) / 2,
          y: (items[0].clientY + items[1].clientY) / 2
        };
      }

      viewport.addEventListener('pointerdown', function (event) {
        if (event.button != null && event.button !== 0) return;
        if (
          event.target.closest(
            '.node, button, input, textarea, select, a, .panel, .zoom-dock, .story-card, .lightbox, .toast, .modal'
          )
        ) {
          return;
        }

        pointers.set(event.pointerId, event);
        cancelAnim();

        if (pointers.size === 2) pinchDistance = distance();

        dragging = true;
        moved = false;
        startX = lastX = event.clientX;
        startY = lastY = event.clientY;

        if (viewport.setPointerCapture) viewport.setPointerCapture(event.pointerId);
      });

      viewport.addEventListener('pointermove', function (event) {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, event);

        if (pointers.size === 2) {
          var next = distance();
          if (pinchDistance > 0 && next > 0) {
            var center = midpoint();
            zoomAt(next / pinchDistance, center.x, center.y);
          }
          pinchDistance = next;
          isPanning = true;
          return;
        }

        if (!dragging) return;

        var dx = event.clientX - lastX;
        var dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;

        if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 4) {
          moved = true;
          isPanning = true;
        }

        if (moved) {
          tx += dx;
          ty += dy;
          clampPan();
          apply();
        }
      });

      function release(event) {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchDistance = 0;
        if (!pointers.size) {
          dragging = false;
          global.setTimeout(function () {
            isPanning = false;
          }, 0);
        }
      }

      viewport.addEventListener('pointerup', release);
      viewport.addEventListener('pointercancel', release);
      viewport.addEventListener('pointerleave', function (event) {
        if (dragging && !pointers.size) release(event);
      });

      viewport.addEventListener(
        'wheel',
        function (event) {
          event.preventDefault();
          zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
        },
        { passive: false }
      );

      viewport.addEventListener('dblclick', function (event) {
        if (event.target.closest('.node, button')) return;
        zoomAt(1.4, event.clientX, event.clientY);
      });

      return {
        wasPanning: function () {
          return isPanning;
        }
      };
    }

    return {
      bind: bind,
      setWorld: setWorld,
      fit: fit,
      fitScale: fitScale,
      zoomAt: zoomAt,
      zoomCenter: zoomCenter,
      panBy: panBy,
      centerOn: centerOn,
      animateTo: animateTo,
      cancelAnim: cancelAnim,
      worldToScreen: worldToScreen,
      get: get,
      set: set,
      apply: apply,
      getScale: scaleForViewport,
      MIN_SCALE: MIN_SCALE,
      MAX_SCALE: MAX_SCALE
    };
  }

  FT.camera = { create: create, MIN_SCALE: MIN_SCALE, MAX_SCALE: MAX_SCALE };
})(typeof window !== 'undefined' ? window : globalThis);
