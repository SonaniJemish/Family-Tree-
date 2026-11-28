/*
 * Pan (drag) and zoom (mouse wheel, two-finger pinch) for the big canvas.
 */
(function (root, factory) {
  var api = factory();
  root.FT = root.FT || {};
  root.FT.PanZoom = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function PanZoom(stage, world, opts) {
    opts = opts || {};
    this.stage = stage;
    this.world = world;
    this.ignore = opts.ignore || '';
    this.minK = opts.minK || 0.05;
    this.maxK = opts.maxK || 3;
    this.s = { x: 0, y: 0, k: 1 };
    this.listeners = [];
    this.drag = null;
    this.justDragged = false;
    this.raf = 0;
    this._bind();
    this._apply();
  }

  PanZoom.prototype.onChange = function (fn) { this.listeners.push(fn); };

  PanZoom.prototype._apply = function () {
    this.world.style.transform = 'translate(' + this.s.x + 'px,' + this.s.y + 'px) scale(' + this.s.k + ')';
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](this.s);
  };

  PanZoom.prototype._cancelAnim = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  PanZoom.prototype._bind = function () {
    var self = this;
    var stage = this.stage;

    // every finger that is touching the stage: id -> {x, y}
    var pts = {};
    var pinch = null;
    function count() { return Object.keys(pts).length; }
    function two() {
      var ids = Object.keys(pts);
      var a = pts[ids[0]], b = pts[ids[1]];
      return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }
    function startDrag(id) {
      var p = pts[id];
      self.drag = { sx: p.x, sy: p.y, ox: self.s.x, oy: self.s.y, moved: false, id: id };
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // a finger that lands on a name box starts nothing, but a second finger may always join a pinch
      if (!count() && self.ignore && e.target.closest && e.target.closest(self.ignore)) return;
      self._cancelAnim();
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (count() === 1) {
        startDrag(e.pointerId);
        stage.classList.add('panning');
      } else if (count() === 2) {
        // second finger: stop dragging, start pinching
        self.drag = null;
        var t = two();
        var rect = stage.getBoundingClientRect();
        pinch = { d0: t.d, k0: self.s.k, wx: (t.cx - rect.left - self.s.x) / self.s.k, wy: (t.cy - rect.top - self.s.y) / self.s.k };
        stage.classList.add('panning');
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId].x = e.clientX;
      pts[e.pointerId].y = e.clientY;
      if (pinch && count() >= 2) {
        // keep the point between the fingers under the fingers: zoom by finger distance, pan by finger centre
        var t = two();
        var rect = stage.getBoundingClientRect();
        var k = clamp(pinch.k0 * t.d / pinch.d0, self.minK, self.maxK);
        self.s.k = k;
        self.s.x = t.cx - rect.left - pinch.wx * k;
        self.s.y = t.cy - rect.top - pinch.wy * k;
        pinch.moved = true;
        self._apply();
        return;
      }
      var d = self.drag;
      if (!d || d.id !== e.pointerId) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      self.s.x = d.ox + dx;
      self.s.y = d.oy + dy;
      self._apply();
    });

    function end(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var moved = (self.drag && self.drag.moved) || (pinch && pinch.moved);
      if (pinch) {
        pinch = null;
        self.drag = null;
        var left = Object.keys(pts);
        if (left.length === 1) startDrag(left[0]);   // one finger stays: carry on as a normal drag
        if (left.length === 1) self.drag.moved = true;
      } else {
        self.drag = null;
      }
      if (!count()) stage.classList.remove('panning');
      if (moved) {
        self.justDragged = true;
        setTimeout(function () { self.justDragged = false; }, 0);
      }
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._cancelAnim();
      var rect = stage.getBoundingClientRect();
      var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var f = Math.exp(-delta * (e.ctrlKey ? 0.012 : 0.0015));
      self.zoomAt(e.clientX - rect.left, e.clientY - rect.top, f);
    }, { passive: false });
  };

  PanZoom.prototype.zoomAt = function (cx, cy, factor) {
    var k = clamp(this.s.k * factor, this.minK, this.maxK);
    var f = k / this.s.k;
    this.s.x = cx - (cx - this.s.x) * f;
    this.s.y = cy - (cy - this.s.y) * f;
    this.s.k = k;
    this._apply();
  };

  PanZoom.prototype.zoomBy = function (factor) {
    this._cancelAnim();
    this.zoomAt(this.stage.clientWidth / 2, this.stage.clientHeight / 2, factor);
  };

  PanZoom.prototype.getState = function () { return { x: this.s.x, y: this.s.y, k: this.s.k }; };

  PanZoom.prototype.setState = function (st) {
    this._cancelAnim();
    this.s = { x: st.x, y: st.y, k: st.k };
    this._apply();
  };

  PanZoom.prototype.animateTo = function (target, ms) {
    var self = this;
    this._cancelAnim();
    var from = this.getState();
    var t0 = null;
    ms = ms || 280;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / ms);
      var e = ease(t);
      self.s = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e
      };
      self._apply();
      self.raf = t < 1 ? requestAnimationFrame(step) : 0;
    }
    this.raf = requestAnimationFrame(step);
  };

  /** State that fits bbox {minX,minY,maxX,maxY} inside the stage. */
  PanZoom.prototype.fitState = function (bbox, margin, maxK) {
    margin = margin === undefined ? 70 : margin;
    maxK = maxK || 1.1;
    var w = this.stage.clientWidth, h = this.stage.clientHeight;
    var bw = Math.max(1, bbox.maxX - bbox.minX), bh = Math.max(1, bbox.maxY - bbox.minY);
    var k = clamp(Math.min((w - margin * 2) / bw, (h - margin * 2) / bh, maxK), this.minK, this.maxK);
    return {
      k: k,
      x: (w - bw * k) / 2 - bbox.minX * k,
      y: (h - bh * k) / 2 - bbox.minY * k
    };
  };

  PanZoom.prototype.fit = function (bbox, animate, margin, maxK) {
    var st = this.fitState(bbox, margin, maxK);
    if (animate) this.animateTo(st); else this.setState(st);
  };

  /** Pan (keeping zoom) so that a world rectangle is visible; no move if already visible. */
  PanZoom.prototype.reveal = function (rect, animate) {
    var w = this.stage.clientWidth, h = this.stage.clientHeight;
    var m = 90;
    var k = this.s.k;
    var l = this.s.x + rect.x * k, t = this.s.y + rect.y * k;
    var r = l + rect.w * k, b = t + rect.h * k;
    var dx = 0, dy = 0;
    if (l < m) dx = m - l; else if (r > w - m) dx = (w - m) - r;
    if (t < m) dy = m - t; else if (b > h - m - 50) dy = (h - m - 50) - b;
    if (!dx && !dy) return;
    var target = { x: this.s.x + dx, y: this.s.y + dy, k: k };
    if (animate) this.animateTo(target); else this.setState(target);
  };

  return PanZoom;
});
