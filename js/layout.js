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

  /*
   * Round "fan" layout for the tree (ped) view.
   *
   * A single oldest person (and anyone who has only one child) forms the trunk: they are
   * stacked straight up from the ground. The first person with 2+ children is the fork.
   * From the fork every generation sits on a bigger circle, children share the angle of
   * their parent, so the whole family spreads like a round crown.
   *
   * Coordinates: x to the right, y UP, the ground is y = 0, the trunk is at x = 0.
   * Returns { pos, chain, forkId, virtual, center, bbox, rings }.
   */
  function computeFan(people, opts) {
    var o = {
      measure: approxMeasure, nodeH: 40, pad: 16, gapW: 22,
      chainStep: 112, trunkLen: 190, ringMin: 138, maxAngleDeg: 100
    };
    if (opts) for (var key in opts) if (Object.prototype.hasOwnProperty.call(opts, key) && opts[key] !== undefined) o[key] = opts[key];

    var out = {
      pos: {}, chain: [], forkId: null, virtual: false,
      center: { x: 0, y: 0 }, bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0 }, rings: [0]
    };
    if (!people.length) return out;

    var tree = buildTree(people);

    function prep(nd) {
      nd.w = o.measure(nd.name);
      nd.desc = 0;
      nd.wt = 0;
      nd.leaves = 0;
      for (var i = 0; i < nd.children.length; i++) {
        prep(nd.children[i]);
        nd.desc += 1 + nd.children[i].desc;
        nd.wt += nd.children[i].wt;
        nd.leaves += nd.children[i].leaves;
      }
      if (!nd.children.length) { nd.wt = nd.w + o.gapW; nd.leaves = 1; }
    }
    tree.roots.forEach(prep);

    var virtual = tree.roots.length !== 1;
    var chain = [];
    var forkChildren;
    var forkNode = null;
    if (virtual) {
      forkChildren = tree.roots;
    } else {
      var cur = tree.roots[0];
      chain.push(cur);
      while (cur.children.length === 1) { cur = cur.children[0]; chain.push(cur); }
      forkNode = cur;
      forkChildren = cur.children;
    }
    var centerY = virtual ? o.trunkLen : chain.length * o.chainStep;

    var leafCount = 0;
    forkChildren.forEach(function (c) { leafCount += c.leaves; });
    var maxA = Math.min(o.maxAngleDeg, 40 + 12 * leafCount) * Math.PI / 180;

    var items = [];
    var byRing = [];
    function assign(nodes, a0, a1, ring, parentId) {
      var total = 0;
      nodes.forEach(function (x) { total += x.wt; });
      var at = a0;
      nodes.forEach(function (nd) {
        var span = (a1 - a0) * nd.wt / total;
        nd.angle = at + span / 2;
        nd.ring = ring;
        nd.parentId = parentId;
        (byRing[ring] = byRing[ring] || []).push(nd);
        items.push(nd);
        var s0 = at;
        at += span;
        assign(nd.children, s0, at, ring + 1, nd.id);
      });
    }
    assign(forkChildren, -maxA, maxA, 1, forkNode ? forkNode.id : null);

    // radius of every ring: big enough that neighbours on the ring do not touch
    var R = [0];
    for (var k = 1; k < byRing.length; k++) {
      var list = (byRing[k] || []).slice().sort(function (a, b) { return a.angle - b.angle; });
      var need = 0;
      for (var i = 1; i < list.length; i++) {
        var a = list[i - 1], b = list[i];
        var X = (a.w + b.w) / 2 + o.pad, Y = o.nodeH + o.pad;
        var ds = Math.abs(Math.sin(b.angle) - Math.sin(a.angle));
        var dc = Math.abs(Math.cos(b.angle) - Math.cos(a.angle));
        var rx = ds > 1e-9 ? X / ds : Infinity;
        var ry = dc > 1e-9 ? Y / dc : Infinity;
        var r = Math.min(rx, ry);
        if (isFinite(r)) need = Math.max(need, r);
      }
      R[k] = Math.max(R[k - 1] + o.ringMin, need);
    }

    function place(scale) {
      var arr = [];
      chain.forEach(function (nd, i) { arr.push({ nd: nd, x: 0, y: (i + 1) * o.chainStep }); });
      items.forEach(function (nd) {
        var r = R[nd.ring] * scale;
        arr.push({ nd: nd, x: r * Math.sin(nd.angle), y: centerY + r * Math.cos(nd.angle) });
      });
      return arr;
    }

    // safety net: if anything still touches (different rings near the sides), open the crown a bit
    function touching(arr) {
      if (arr.length > 2500) return false;
      var s = arr.slice().sort(function (p, q) { return (p.x - p.nd.w / 2) - (q.x - q.nd.w / 2); });
      for (var i = 0; i < s.length; i++) {
        var right = s[i].x + s[i].nd.w / 2 + 6;
        for (var j = i + 1; j < s.length; j++) {
          if (s[j].x - s[j].nd.w / 2 >= right) break;
          if (Math.abs(s[j].y - s[i].y) < o.nodeH + 6) return true;
        }
      }
      return false;
    }

    var scale = 1;
    var placed = place(scale);
    for (var guard = 0; guard < 60 && touching(placed); guard++) {
      scale *= 1.06;
      placed = place(scale);
    }

    var minY = Infinity;
    placed.forEach(function (p) { minY = Math.min(minY, p.y - o.nodeH / 2); });
    var lift = Math.max(0, 80 - minY);

    var bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    placed.forEach(function (p) {
      var nd = p.nd;
      var isChain = chain.indexOf(nd) !== -1;
      var depthIdx = isChain ? chain.indexOf(nd) : (virtual ? nd.ring - 1 : chain.length - 1 + nd.ring);
      var y = p.y + lift;
      out.pos[nd.id] = {
        x: p.x, y: y, w: nd.w, h: o.nodeH,
        depth: depthIdx, ring: isChain ? 0 : nd.ring,
        angle: isChain ? 0 : nd.angle,
        desc: nd.desc, parent: nd.parent || null,
        chain: isChain
      };
      bb.minX = Math.min(bb.minX, p.x - nd.w / 2);
      bb.maxX = Math.max(bb.maxX, p.x + nd.w / 2);
      bb.minY = Math.min(bb.minY, y - o.nodeH / 2);
      bb.maxY = Math.max(bb.maxY, y + o.nodeH / 2);
    });

    out.chain = chain.map(function (c) { return c.id; });
    out.forkId = forkNode ? forkNode.id : null;
    out.virtual = virtual;
    out.center = { x: 0, y: centerY + lift };
    out.bbox = bb;
    out.rings = R.map(function (r) { return r * scale; });
    return out;
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
    computeFan: computeFan,
    buildTree: buildTree,
    approxMeasure: approxMeasure,
    makeMeasure: makeMeasure,
    FONT: FONT
  };
});
