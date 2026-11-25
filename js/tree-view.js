/*
 * "Ped" view: the same family data drawn as a real tree.
 * Trunk at the bottom, every child is a branch going up, names sit on tags.
 * Branch thickness follows how big the family below is.
 * Everything is generated from the data, so it re-grows by itself.
 *
 * Later this default drawing can be swapped for your own illustration / Figma design.
 */
(function (root, factory) {
  var api = factory();
  root.FT = root.FT || {};
  root.FT.TreeView = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var FT = (typeof self !== 'undefined' ? self : globalThis).FT;
  var FONT_ATTR = 'Noto Sans Gujarati, Nirmala UI, Shruti, Lohit Gujarati, Segoe UI, sans-serif';
  var LEAF_COLORS = ['#4f8433', '#6fa03e', '#8bb445', '#a9c24a', '#c2cd50', '#5f9238'];
  var CANOPY_COLORS = ['#6c9a43', '#7fae4a', '#5b8a3c', '#8fb94f'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  function branch(x1, y1, x2, y2) {
    var d = (y1 - y2) * 0.5;
    return 'M' + r1(x1) + ' ' + r1(y1) + 'C' + r1(x1) + ' ' + r1(y1 - d) + ' ' + r1(x2) + ' ' + r1(y2 + d) + ' ' + r1(x2) + ' ' + r1(y2);
  }

  /** Returns { svg, width, height } for a data object { title, people }. */
  function build(data) {
    var people = data.people || [];
    var TAGH = 40, GAP = 90;
    var measure = FT.layout.makeMeasure('700 22px ' + FT.layout.FONT, 38, 84, 320);
    var L = FT.layout.computeLayout(people, { measure: measure, nodeH: TAGH, gapX: 30, rootGapX: 90, levelGap: GAP });
    var step = TAGH + GAP;
    var maxD = L.maxDepth;
    var has = people.length > 0;

    var padX = 190, top = 180;
    var bw = has ? L.bbox.maxX - L.bbox.minX : 0;
    var W = Math.max(1100, Math.ceil(bw + padX * 2));
    var ox = (W - bw) / 2 - (has ? L.bbox.minX : 0);
    var rootsY = top + maxD * step;
    var By = rootsY + TAGH + 180;
    var H = Math.ceil(By + 150);

    function X(id) { return L.pos[id].x + ox; }
    function Ty(id) { return top + (maxD - L.pos[id].depth) * step; }
    function Cy(id) { return Ty(id) + TAGH / 2; }

    var Bx = W / 2;
    if (has) {
      var rx = L.rootIds.map(X);
      Bx = (Math.min.apply(null, rx) + Math.max.apply(null, rx)) / 2;
    }

    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT_ATTR + '">');
    out.push('<defs>' +
      '<linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ecee"/><stop offset="1" stop-color="#f3f8e6"/></linearGradient>' +
      '<linearGradient id="ft-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dbd6b"/><stop offset="1" stop-color="#5f9648"/></linearGradient>' +
      '<path id="ft-lf" d="M0 0C6 -9 20 -9 30 0C20 9 6 9 0 0Z"/>' +
      '</defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#ft-sky)"/>');

    // far hills
    out.push('<path d="M0 ' + (By - 40) + 'C' + (W * 0.2) + ' ' + (By - 190) + ' ' + (W * 0.38) + ' ' + (By - 60) + ' ' + (W * 0.55) + ' ' + (By - 120) +
      'S' + (W * 0.88) + ' ' + (By - 200) + ' ' + W + ' ' + (By - 70) + 'V' + H + 'H0Z" fill="#b9d6a8" opacity="0.75"/>');

    // canopy (soft green clouds behind the branches)
    var canopy = [];
    var leaves = [];
    var darks = [], mids = [], lights = [];
    var tags = [];

    people.forEach(function (p) {
      var cx = X(p.id), cy = Cy(p.id);
      var rnd = rng(hash(p.id));
      for (var i = 0; i < 3; i++) {
        var rr = 46 + rnd() * 40;
        canopy.push('<circle cx="' + r1(cx + (rnd() - 0.5) * 100) + '" cy="' + r1(cy + (rnd() - 0.5) * 70 - 8) + '" r="' + r1(rr) +
          '" fill="' + CANOPY_COLORS[Math.floor(rnd() * CANOPY_COLORS.length)] + '" opacity="0.28"/>');
      }
      for (var j = 0; j < 8; j++) {
        var ang = rnd() * Math.PI * 2;
        var dist = 34 + rnd() * 70;
        var lx = cx + Math.cos(ang) * dist * 1.5;
        var ly = cy + Math.sin(ang) * dist * 0.9 - 6;
        leaves.push('<use href="#ft-lf" xlink:href="#ft-lf" transform="translate(' + r1(lx) + ' ' + r1(ly) + ') rotate(' + Math.round(rnd() * 360) +
          ') scale(' + r1(0.75 + rnd() * 0.9) + ')" fill="' + LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)] + '" stroke="#3f6a2c" stroke-width="0.8"/>');
      }

      // branch that leads into this person
      var w, d;
      var desc = L.pos[p.id].desc;
      if (p.parent && L.pos[p.parent]) {
        w = Math.min(46, 3 + 3.2 * Math.sqrt(desc + 1));
        d = branch(X(p.parent), Cy(p.parent), cx, cy);
      } else {
        w = Math.min(84, 9 + 4.2 * Math.sqrt(desc + 1));
        d = branch(Bx, By, cx, cy);
      }
      darks.push('<path d="' + d + '" stroke-width="' + r1(w + 5) + '"/>');
      mids.push('<path d="' + d + '" stroke-width="' + r1(w) + '"/>');
      lights.push('<path d="' + d + '" stroke-width="' + r1(Math.max(1.2, w * 0.26)) + '"/>');

      var tw = L.pos[p.id].w;
      var tx = cx - tw / 2, ty = Ty(p.id);
      tags.push('<g><rect x="' + r1(tx + 2) + '" y="' + r1(ty + 3) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#000" opacity="0.18"/>' +
        '<rect x="' + r1(tx) + '" y="' + r1(ty) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#f7e6c1" stroke="#4b3019" stroke-width="2"/>' +
        '<text x="' + r1(cx) + '" y="' + r1(ty + TAGH / 2 + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="#2f1d0c">' +
        esc(p.name) + '</text></g>');
    });

    out.push(canopy.join(''));
    out.push('<g fill="none" stroke-linecap="round" stroke="#4b3019">' + darks.join('') + '</g>');
    out.push('<g fill="none" stroke-linecap="round" stroke="#7a4f27">' + mids.join('') + '</g>');
    out.push('<g fill="none" stroke-linecap="round" stroke="#a87b44" opacity="0.6">' + lights.join('') + '</g>');

    // near hill covers the foot of the trunk
    out.push('<path d="M0 ' + (By + 14) + 'C' + (W * 0.25) + ' ' + (By - 48) + ' ' + (W * 0.75) + ' ' + (By - 48) + ' ' + W + ' ' + (By + 14) +
      'V' + H + 'H0Z" fill="url(#ft-hill)"/>');

    out.push(leaves.join(''));
    out.push(tags.join(''));

    var title = String(data.title || '');
    var fs = Math.max(30, 62 - Math.max(0, Array.from(title).length - 14) * 1.6);
    out.push('<text x="' + W / 2 + '" y="96" text-anchor="middle" dominant-baseline="central" font-size="' + r1(fs) +
      '" font-weight="800" fill="#3a2714">' + esc(title) + '</text>');
    out.push('</svg>');

    return { svg: out.join(''), width: W, height: H };
  }

  return { build: build };
});
