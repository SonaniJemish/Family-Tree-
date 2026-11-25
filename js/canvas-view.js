/*
 * Canvas (flowchart) view: boxes + lines, positions come from the auto layout.
 * New boxes grow out of their parent, everything glides to its new place.
 */
(function (root, factory) {
  var api = factory();
  root.FT = root.FT || {};
  root.FT.CanvasView = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var FT = (typeof self !== 'undefined' ? self : globalThis).FT;
  var COLORS = ['#2563eb', '#0d9488', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d'];
  var NODE_H = 52;
  var LEVEL_GAP = 70;

  function CanvasView(layer) {
    this.layer = layer;
    layer.innerHTML =
      '<svg class="edges" width="1" height="1" xmlns="http://www.w3.org/2000/svg"><path class="edge-path" d=""></path></svg>' +
      '<div class="nodes"></div>';
    this.edgePath = layer.querySelector('.edge-path');
    this.nodesEl = layer.querySelector('.nodes');
    this.els = {};
    this.disp = {};
    this.layout = null;
    this.people = [];
    this.raf = 0;
    this.onDraw = null;
    this.measure = FT.layout.makeMeasure('600 18px ' + FT.layout.FONT, 44, 96, 300);
  }

  CanvasView.prototype.render = function (people, selectedId, animate) {
    var self = this;
    var L = FT.layout.computeLayout(people, {
      measure: this.measure, nodeH: NODE_H, gapX: 28, rootGapX: 70, levelGap: LEVEL_GAP
    });
    this.layout = L;
    this.people = people;

    var seen = {};
    people.forEach(function (p) {
      seen[p.id] = true;
      var el = self.els[p.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'node';
        el.setAttribute('data-id', p.id);
        el.innerHTML = '<span class="nm"></span>';
        self.nodesEl.appendChild(el);
        self.els[p.id] = el;
      }
      var pos = L.pos[p.id];
      el.firstChild.textContent = p.name;
      el.style.width = pos.w + 'px';
      el.style.height = pos.h + 'px';
      el.style.setProperty('--c', COLORS[pos.depth % COLORS.length]);
      el.classList.toggle('selected', p.id === selectedId);
    });
    Object.keys(this.els).forEach(function (id) {
      if (!seen[id]) { self.els[id].remove(); delete self.els[id]; delete self.disp[id]; }
    });

    var from = {}, to = {};
    people.forEach(function (p) {
      var t = L.pos[p.id];
      to[p.id] = { x: t.x, y: t.y };
      var cur = self.disp[p.id];
      if (cur) from[p.id] = { x: cur.x, y: cur.y };
      else {
        var par = p.parent && self.disp[p.parent];
        from[p.id] = par ? { x: par.x, y: par.y } : { x: t.x, y: t.y };
      }
    });

    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }

    var reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var moving = people.some(function (p) { return from[p.id].x !== to[p.id].x || from[p.id].y !== to[p.id].y; });
    if (!animate || reduce || !moving) {
      this.disp = to;
      this.draw();
      return;
    }

    var t0 = null;
    var ms = 320;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / ms);
      var e = 1 - Math.pow(1 - t, 3);
      var d = {};
      people.forEach(function (p) {
        var a = from[p.id], b = to[p.id];
        d[p.id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      });
      self.disp = d;
      self.draw();
      self.raf = t < 1 ? requestAnimationFrame(step) : 0;
    }
    this.raf = requestAnimationFrame(step);
  };

  CanvasView.prototype.draw = function () {
    var L = this.layout;
    var self = this;
    if (!L) return;
    var d = '';
    this.people.forEach(function (p) {
      var pos = self.disp[p.id];
      if (!pos) return;
      var el = self.els[p.id];
      el.style.transform = 'translate(' + (pos.x - L.pos[p.id].w / 2) + 'px,' + pos.y + 'px)';
      if (p.parent && self.disp[p.parent]) {
        var a = self.disp[p.parent];
        var y1 = a.y + L.pos[p.parent].h;
        var y2 = pos.y;
        var mid = y1 + (y2 - y1) / 2;
        d += 'M' + a.x + ' ' + y1 + 'V' + mid + 'H' + pos.x + 'V' + y2;
      }
    });
    this.edgePath.setAttribute('d', d);
    if (this.onDraw) this.onDraw();
  };

  CanvasView.prototype.setSelected = function (id) {
    for (var k in this.els) {
      if (Object.prototype.hasOwnProperty.call(this.els, k)) this.els[k].classList.toggle('selected', k === id);
    }
  };

  CanvasView.prototype.getBBox = function () {
    return this.layout && Object.keys(this.layout.pos).length ? this.layout.bbox : { minX: 0, minY: 0, maxX: 400, maxY: 200 };
  };

  /** World rectangle where the person will end up (after the animation). */
  CanvasView.prototype.targetRect = function (id) {
    var p = this.layout && this.layout.pos[id];
    return p ? { x: p.x - p.w / 2, y: p.y, w: p.w, h: p.h } : null;
  };

  return CanvasView;
});
