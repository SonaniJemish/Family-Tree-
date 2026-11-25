/*
 * Automatic tree layout. Nobody places nodes by hand.
 *
 * Every person gets a "slot" as wide as their whole family below them,
 * the parent sits in the middle above the children. Nodes never overlap.
 *
 * Output positions: x = centre of the node, y = top of the node (top-down tree).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FT = root.FT || {};
  root.FT.layout = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function approxMeasure(name) {
    return Math.max(96, Array.from(String(name)).length * 13 + 40);
  }

  function buildTree(people) {
    var nodes = {};
    var roots = [];
    people.forEach(function (p) {
      nodes[p.id] = { id: p.id, name: p.name, parent: p.parent, children: [] };
    });
    people.forEach(function (p) {
      var n = nodes[p.id];
      if (p.parent && nodes[p.parent]) nodes[p.parent].children.push(n);
      else roots.push(n);
    });
    return { nodes: nodes, roots: roots };
  }

  /**
   * opts: measure(name)->width, nodeH, gapX, rootGapX, levelGap
   * returns { pos: {id:{x,y,w,h,depth,desc}}, rootIds, bbox, maxDepth }
   */
  function computeLayout(people, opts) {
    var o = {
      measure: approxMeasure,
      nodeH: 52,
      gapX: 28,
      rootGapX: 64,
      levelGap: 64
    };
    if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k) && opts[k] !== undefined) o[k] = opts[k];

    var tree = buildTree(people);
    var pos = {};
    var maxDepth = 0;

    function measureNode(n) {
      n.w = o.measure(n.name);
      var cw = 0;
      var desc = 0;
      for (var i = 0; i < n.children.length; i++) {
        measureNode(n.children[i]);
        cw += n.children[i].sub + (i ? o.gapX : 0);
        desc += 1 + n.children[i].desc;
      }
      n.cw = cw;
      n.desc = desc;
      n.sub = Math.max(n.w, cw);
    }

    function place(n, left, depth) {
      n.depth = depth;
      if (depth > maxDepth) maxDepth = depth;
      var x = left + (n.sub - n.cw) / 2;
      for (var i = 0; i < n.children.length; i++) {
        place(n.children[i], x, depth + 1);
        x += n.children[i].sub + o.gapX;
      }
      var cx;
      if (n.children.length) {
        cx = (n.children[0].cx + n.children[n.children.length - 1].cx) / 2;
        cx = Math.max(left + n.w / 2, Math.min(left + n.sub - n.w / 2, cx));
      } else {
        cx = left + n.sub / 2;
      }
      n.cx = cx;
      pos[n.id] = { x: cx, y: depth * (o.nodeH + o.levelGap), w: n.w, h: o.nodeH, depth: depth, desc: n.desc };
    }

    var cursor = 0;
    tree.roots.forEach(function (r, i) {
      measureNode(r);
      if (i) cursor += o.rootGapX;
      place(r, cursor, 0);
      cursor += r.sub;
    });

    var bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    var first = true;
    Object.keys(pos).forEach(function (id) {
      var p = pos[id];
      var l = p.x - p.w / 2, r = p.x + p.w / 2, t = p.y, b = p.y + p.h;
      if (first) { bbox = { minX: l, minY: t, maxX: r, maxY: b }; first = false; }
      else {
        bbox.minX = Math.min(bbox.minX, l); bbox.maxX = Math.max(bbox.maxX, r);
        bbox.minY = Math.min(bbox.minY, t); bbox.maxY = Math.max(bbox.maxY, b);
      }
    });

    return {
      pos: pos,
      rootIds: tree.roots.map(function (r) { return r.id; }),
      bbox: bbox,
      maxDepth: maxDepth,
      options: o
    };
  }

  var FONT = '"Noto Sans Gujarati","Nirmala UI","Shruti","Lohit Gujarati","Segoe UI",system-ui,sans-serif';

  /** Browser only: measures the real text width with the real font. */
  function makeMeasure(fontCss, extra, min, max) {
    var ctx = null;
    try {
      ctx = document.createElement('canvas').getContext('2d');
      ctx.font = fontCss;
    } catch (e) { ctx = null; }
    return function (name) {
      var w = ctx ? ctx.measureText(String(name)).width : Array.from(String(name)).length * 13;
      return Math.min(max, Math.max(min, Math.ceil(w + extra)));
    };
  }

  return {
    computeLayout: computeLayout,
    buildTree: buildTree,
    approxMeasure: approxMeasure,
    makeMeasure: makeMeasure,
    FONT: FONT
  };
});
