/*
 * "Ped" view: the same family data drawn as a real, round, leafy tree.
 *
 *  - a thick trunk with bark and a wide foot (the oldest people sit on the trunk)
 *  - from the first fork the family spreads like a round crown (see layout.computeFan)
 *  - branches are thicker where a bigger family grows from them
 *  - dense foliage, sun, clouds, hills, grass and flowers
 *
 * Everything is generated from the data, so it re-grows by itself.
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
  var LEAF_COLORS = ['#3f7a34', '#4f8f3a', '#62a043', '#78b34a', '#93c250', '#b3d05a'];
  var MID_CANOPY = ['#4a8c3c', '#5a9c42', '#3f8236'];
  var LIGHT_CANOPY = ['#7bb84e', '#8cc455', '#6aa845'];
  var FLOWERS = ['#f48fb1', '#ffd54f', '#ffffff', '#ce93d8', '#ff8a65'];

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
  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }

  function bez(p0, c1, c2, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
    };
  }

  function cloud(cx, cy, s) {
    return '<g fill="#fff" opacity="0.82">' +
      '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(78 * s) + '" ry="' + r1(24 * s) + '"/>' +
      '<ellipse cx="' + r1(cx + 46 * s) + '" cy="' + r1(cy - 15 * s) + '" rx="' + r1(50 * s) + '" ry="' + r1(29 * s) + '"/>' +
      '<ellipse cx="' + r1(cx - 44 * s) + '" cy="' + r1(cy - 9 * s) + '" rx="' + r1(42 * s) + '" ry="' + r1(23 * s) + '"/></g>';
  }

  /** Returns { svg, width, height } for a data object { title, people }. */
  function build(data) {
    var people = data.people || [];
    var n = people.length;
    var has = n > 0;
    var TAGH = 46;
    var measure = FT.layout.makeMeasure('700 26px ' + FT.layout.FONT, 42, 96, 360);
    var F = FT.layout.computeFan(people, { measure: measure, nodeH: TAGH });

    var bb = has ? F.bbox : { minX: -260, maxX: 260, minY: 100, maxY: 420 };
    var padX = 210, padTop = 330, padBot = 210;
    var half = Math.max(Math.abs(bb.minX), Math.abs(bb.maxX));
    var W = Math.max(1300, Math.ceil(half * 2 + padX * 2));
    var ox = W / 2;
    var Yg = padTop + bb.maxY;      // ground line in picture coordinates
    var H = Math.ceil(Yg + padBot);
    function SX(x) { return ox + x; }
    function SY(y) { return Yg - y; }

    var scene = rng(hash('scene'));
    var trunkW = Math.max(150, Math.min(330, 12 + 22 * Math.sqrt(n)));
    var C = has ? { x: SX(F.center.x), y: SY(F.center.y) } : null;

    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT_ATTR + '">');

    /* ---------- definitions ---------- */
    out.push('<defs>' +
      '<linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9e0ee"/><stop offset="0.55" stop-color="#e3f3ec"/><stop offset="1" stop-color="#f6f9e6"/></linearGradient>' +
      '<radialGradient id="ft-sun"><stop offset="0" stop-color="#fff7c4" stop-opacity="0.95"/><stop offset="1" stop-color="#fff7c4" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="ft-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc26b"/><stop offset="1" stop-color="#5a9446"/></linearGradient>' +
      '<linearGradient id="ft-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#46301a"/><stop offset="0.2" stop-color="#6c4524"/>' +
      '<stop offset="0.48" stop-color="#9c6b39"/><stop offset="0.64" stop-color="#7f5529"/><stop offset="1" stop-color="#46301a"/></linearGradient>' +
      '<g id="ft-lf1"><path d="M0 0C5 -10 20 -11 32 0C20 11 5 10 0 0Z"/><path d="M2 0L27 0" fill="none" stroke="#2f5a25" stroke-width="0.9" stroke-opacity="0.7"/></g>' +
      '<g id="ft-lf2"><path d="M0 0C3 -13 22 -14 28 0C22 14 3 13 0 0Z"/><path d="M2 0L23 0" fill="none" stroke="#2f5a25" stroke-width="0.9" stroke-opacity="0.7"/></g>' +
      '</defs>');

    /* ---------- sky, sun, clouds, birds ---------- */
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#ft-sky)"/>');
    out.push('<circle cx="' + r1(W * 0.86) + '" cy="190" r="210" fill="url(#ft-sun)"/><circle cx="' + r1(W * 0.86) + '" cy="190" r="56" fill="#fff4b4"/>');
    out.push(cloud(W * 0.13, 210, 1.15), cloud(W * 0.30, 118, 0.8), cloud(W * 0.70, 250, 0.95), cloud(W * 0.93, 110, 0.7));
    var birds = '';
    for (var bI = 0; bI < 4; bI++) {
      var bx = W * (0.62 + scene() * 0.28), by = 120 + scene() * 150;
      birds += 'M' + r1(bx) + ' ' + r1(by) + 'q9 -10 18 0q9 -10 18 0';
    }
    out.push('<path d="' + birds + '" fill="none" stroke="#4b5563" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>');

    /* ---------- far mountains and hills ---------- */
    var mt = 'M0 ' + (Yg - 60);
    var peaks = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1];
    peaks.forEach(function (p, i) { mt += 'L' + r1(W * p) + ' ' + r1(Yg - (i % 2 ? 110 : 250) - scene() * 40); });
    mt += 'V' + H + 'H0Z';
    out.push('<path d="' + mt + '" fill="#a9c6d2" opacity="0.55"/>');
    out.push('<path d="M0 ' + (Yg - 50) + 'C' + (W * 0.2) + ' ' + (Yg - 200) + ' ' + (W * 0.38) + ' ' + (Yg - 70) + ' ' + (W * 0.55) + ' ' + (Yg - 130) +
      'S' + (W * 0.88) + ' ' + (Yg - 210) + ' ' + W + ' ' + (Yg - 80) + 'V' + H + 'H0Z" fill="#b6d9a4" opacity="0.8"/>');
    out.push('<path d="M0 ' + (Yg - 20) + 'C' + (W * 0.15) + ' ' + (Yg - 100) + ' ' + (W * 0.35) + ' ' + (Yg - 30) + ' ' + (W * 0.5) + ' ' + (Yg - 62) +
      'S' + (W * 0.85) + ' ' + (Yg - 110) + ' ' + W + ' ' + (Yg - 30) + 'V' + H + 'H0Z" fill="#9dcb83" opacity="0.9"/>');
    // near hill (the ground the tree stands on)
    out.push('<path d="M0 ' + (Yg + 10) + 'C' + (W * 0.25) + ' ' + (Yg - 56) + ' ' + (W * 0.75) + ' ' + (Yg - 56) + ' ' + W + ' ' + (Yg + 10) +
      'V' + H + 'H0Z" fill="url(#ft-hill)"/>');
    // soft shadow under the crown
    var shadowRx = Math.min(half * 0.95, 900);
    out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 24) + '" rx="' + r1(shadowRx) + '" ry="30" fill="#2f5d27" opacity="0.22"/>');

    /* ---------- the tree ---------- */
    var P = {};
    var tags = [];
    people.forEach(function (p) {
      var q = F.pos[p.id];
      P[p.id] = { x: SX(q.x), y: SY(q.y), a: q.angle, chain: q.chain, desc: q.desc, parent: q.parent, w: q.w };
    });

    var darks = [], mids = [], lights = [], bark = [];
    var anchors = [];                       // places where foliage grows: {x, y, r, leaves}
    var nodeLeaves = Math.max(8, Math.min(46, Math.round(46 - n * 0.12)));
    var maxMid = n > 600 ? 0 : (n > 150 ? 2 : 6);

    if (has) {
      people.forEach(function (p) {
        var q = P[p.id];
        var rnd = rng(hash(p.id));

        if (q.chain) {
          for (var c = 0; c < 6; c++) {
            anchors.push({ x: q.x + (rnd() - 0.5) * (trunkW + 90), y: q.y + (rnd() - 0.5) * 90, r: 0, leaves: 1, small: true });
          }
          return;
        }

        var par = q.parent && P[q.parent] ? P[q.parent] : C;
        var parentIsFan = q.parent && P[q.parent] && !P[q.parent].chain;
        var uP = parentIsFan ? { x: Math.sin(par.a), y: -Math.cos(par.a) } : { x: 0, y: -1 };
        var uQ = { x: Math.sin(q.a), y: -Math.cos(q.a) };
        var d = Math.sqrt((q.x - par.x) * (q.x - par.x) + (q.y - par.y) * (q.y - par.y));
        var k = d * 0.42;
        var p0 = { x: par.x, y: par.y };
        var c1 = { x: par.x + uP.x * k, y: par.y + uP.y * k };
        var c2 = { x: q.x - uQ.x * k, y: q.y - uQ.y * k };
        var p3 = { x: q.x, y: q.y };
        var dPath = 'M' + r1(p0.x) + ' ' + r1(p0.y) + 'C' + r1(c1.x) + ' ' + r1(c1.y) + ' ' + r1(c2.x) + ' ' + r1(c2.y) + ' ' + r1(p3.x) + ' ' + r1(p3.y);

        var w = Math.min(trunkW * 0.62, 5 + 12 * Math.sqrt(q.desc));
        darks.push('<path d="' + dPath + '" stroke-width="' + r1(w + 5) + '"/>');
        mids.push('<path d="' + dPath + '" stroke-width="' + r1(w) + '"/>');
        lights.push('<path d="' + dPath + '" stroke-width="' + r1(Math.max(1.2, w * 0.26)) + '"/>');
        if (w >= 24) bark.push('<path d="' + dPath + '" stroke-width="' + r1(w * 0.82) + '"/>');

        // foliage along the branch and at its end
        var steps = Math.min(maxMid, Math.floor(d / 150));
        for (var s = 1; s <= steps; s++) {
          var pt = bez(p0, c1, c2, p3, s / (steps + 1));
          anchors.push({ x: pt.x, y: pt.y, r: 62 + rnd() * 34, leaves: Math.round(nodeLeaves * 0.5) });
        }
        anchors.push({ x: q.x, y: q.y, r: 88 + rnd() * 40, leaves: nodeLeaves });
      });

      /* trunk: thick, wide foot, tapering up to the fork */
      var wb = trunkW, wt = trunkW * 0.8, fl = trunkW * 0.4;
      var yb = Yg + 24, yt = C.y;
      var L1 = ox - wb / 2, R1 = ox + wb / 2;
      var trunkD = 'M' + r1(L1 - fl) + ' ' + r1(yb) +
        'C' + r1(L1 - fl * 0.12) + ' ' + r1(yb - 22) + ' ' + r1(L1) + ' ' + r1(yb - 36) + ' ' + r1(L1 + 2) + ' ' + r1(yb - 110) +
        'L' + r1(ox - wt / 2) + ' ' + r1(yt) + 'L' + r1(ox + wt / 2) + ' ' + r1(yt) +
        'L' + r1(R1 - 2) + ' ' + r1(yb - 110) +
        'C' + r1(R1) + ' ' + r1(yb - 36) + ' ' + r1(R1 + fl * 0.12) + ' ' + r1(yb - 22) + ' ' + r1(R1 + fl) + ' ' + r1(yb) + 'Z';
      var trunk = [];
      trunk.push('<path d="' + trunkD + '" fill="url(#ft-trunk)" stroke="#3b2511" stroke-width="3" stroke-linejoin="round"/>');
      trunk.push('<circle cx="' + r1(ox) + '" cy="' + r1(yt) + '" r="' + r1(wt / 2) + '" fill="#7f5529" stroke="#3b2511" stroke-width="3"/>');
      // bark lines
      var rb = rng(hash('bark'));
      var barkLines = '';
      for (var bl = 0; bl < 9; bl++) {
        var off = (rb() - 0.5) * wb * 0.74;
        var y0 = yb - 50 - rb() * 40, y1 = yt + 20 + rb() * 60;
        var wob = (rb() - 0.5) * 14;
        barkLines += 'M' + r1(ox + off) + ' ' + r1(y0) + 'Q' + r1(ox + off + wob) + ' ' + r1((y0 + y1) / 2) + ' ' + r1(ox + off * 0.82) + ' ' + r1(y1);
      }
      trunk.push('<path d="' + barkLines + '" fill="none" stroke="#2e1c0b" stroke-opacity="0.32" stroke-width="2.6" stroke-linecap="round"/>');
      // knots
      for (var kn = 0; kn < 2; kn++) {
        var kx = ox + (rb() - 0.5) * wb * 0.5, ky = yt + (yb - yt) * (0.35 + rb() * 0.4);
        trunk.push('<ellipse cx="' + r1(kx) + '" cy="' + r1(ky) + '" rx="9" ry="15" fill="#5d3a1c" stroke="#2e1c0b" stroke-width="2" stroke-opacity="0.6"/>');
      }
      // roots on the ground
      var roots = '';
      [-1, 1].forEach(function (sd) {
        roots += 'M' + r1(ox + sd * (wb / 2 + fl * 0.8)) + ' ' + r1(yb - 4) + 'q' + r1(sd * 40) + ' 6 ' + r1(sd * 90) + ' 4';
      });
      trunk.push('<path d="' + roots + '" fill="none" stroke="#4a2f16" stroke-width="9" stroke-linecap="round"/>');

      /* ---- dark foliage behind the branches (makes the crown thick and round) ---- */
      var back = '<g fill="#33702f">';
      anchors.forEach(function (a) { if (!a.small) back += '<circle cx="' + r1(a.x) + '" cy="' + r1(a.y) + '" r="' + r1(a.r * 1.05) + '"/>'; });
      back += '</g>';
      out.push(back);

      out.push(trunk.join(''));
      out.push('<g fill="none" stroke-linecap="round" stroke="#3f2a15">' + darks.join('') + '</g>');
      out.push('<g fill="none" stroke-linecap="round" stroke="#7a4f27">' + mids.join('') + '</g>');
      out.push('<g fill="none" stroke-linecap="butt" stroke="#2a1809" stroke-opacity="0.26" stroke-dasharray="3 12">' + bark.join('') + '</g>');
      out.push('<g fill="none" stroke-linecap="round" stroke="#b08550" stroke-opacity="0.55">' + lights.join('') + '</g>');

      /* ---- lighter, see-through foliage in front ---- */
      var front = '<g opacity="0.5">';
      anchors.forEach(function (a, i) {
        if (a.small) return;
        var ra = rng(hash('f' + i));
        front += '<circle cx="' + r1(a.x + (ra() - 0.5) * 50) + '" cy="' + r1(a.y + (ra() - 0.5) * 40 - 10) + '" r="' + r1(a.r * (0.55 + ra() * 0.3)) +
          '" fill="' + pick(i % 3 === 0 ? LIGHT_CANOPY : MID_CANOPY, ra) + '"/>';
      });
      front += '</g>';
      out.push(front);

      /* ---- leaves ---- */
      var leaves = [];
      anchors.forEach(function (a, i) {
        var rl = rng(hash('l' + i));
        for (var j = 0; j < a.leaves; j++) {
          var ang = rl() * Math.PI * 2;
          var rad = a.small ? 0 : Math.sqrt(rl()) * a.r * 1.1;
          var lx = a.x + (a.small ? 0 : Math.cos(ang) * rad * 1.25);
          var ly = a.y + (a.small ? 0 : Math.sin(ang) * rad * 0.95 - 4);
          var sc = 0.75 + rl() * 0.85;
          leaves.push('<use href="#ft-lf' + (rl() < 0.6 ? 1 : 2) + '" xlink:href="#ft-lf' + (rl() < 0.6 ? 1 : 2) + '" transform="translate(' + r1(lx) + ' ' + r1(ly) +
            ') rotate(' + Math.round(rl() * 360) + ') scale(' + r1(sc) + ')" fill="' + pick(LEAF_COLORS, rl) + '"/>');
        }
      });
      out.push('<g stroke="#2f5a25" stroke-width="0.7" stroke-opacity="0.7">' + leaves.join('') + '</g>');
    }

    /* ---------- ground details drawn in front of the foot of the trunk ---------- */
    out.push('<ellipse cx="' + r1(ox) + '" cy="' + r1(Yg + 26) + '" rx="' + r1(trunkW * 0.78) + '" ry="15" fill="#4f8a3a"/>');
    var tufts = '';
    var tuftCount = Math.min(170, Math.round(W / 14));
    for (var tI = 0; tI < tuftCount; tI++) {
      var tx = scene() * W, ty = Yg + 4 + scene() * 110;
      if (scene() < 0.5) { tx = ox + (scene() - 0.5) * trunkW * 3.2; ty = Yg + 12 + scene() * 40; }
      var hh = 14 + scene() * 14;
      tufts += 'M' + r1(tx) + ' ' + r1(ty) + 'q-4 ' + r1(-hh * 0.6) + ' -8 ' + r1(-hh) +
        'M' + r1(tx) + ' ' + r1(ty) + 'q0 ' + r1(-hh * 0.7) + ' 1 ' + r1(-hh * 1.2) +
        'M' + r1(tx) + ' ' + r1(ty) + 'q4 ' + r1(-hh * 0.55) + ' 9 ' + r1(-hh * 0.95);
    }
    out.push('<path d="' + tufts + '" fill="none" stroke="#468437" stroke-width="2.6" stroke-linecap="round"/>');
    var flowers = '';
    for (var fI = 0; fI < 34; fI++) {
      var fx = ox + (scene() - 0.5) * Math.min(W * 0.8, trunkW * 7), fy = Yg + 14 + scene() * 100;
      var fr = 3.5 + scene() * 3;
      flowers += '<g><path d="M' + r1(fx) + ' ' + r1(fy) + 'v' + r1(fr * 3) + '" stroke="#3f7a34" stroke-width="2"/>' +
        '<circle cx="' + r1(fx) + '" cy="' + r1(fy) + '" r="' + r1(fr) + '" fill="' + pick(FLOWERS, scene) + '"/>' +
        '<circle cx="' + r1(fx) + '" cy="' + r1(fy) + '" r="' + r1(fr * 0.35) + '" fill="#ffb300"/></g>';
    }
    out.push(flowers);

    /* ---------- name tags ---------- */
    people.forEach(function (p) {
      var q = P[p.id];
      var tw = q.w, tx = q.x - tw / 2, ty = q.y - TAGH / 2;
      tags.push('<g><rect x="' + r1(tx + 2) + '" y="' + r1(ty + 3) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#000" opacity="0.2"/>' +
        '<rect x="' + r1(tx) + '" y="' + r1(ty) + '" width="' + tw + '" height="' + TAGH + '" rx="12" fill="#f8e7c3" stroke="#4b3019" stroke-width="2"/>' +
        '<text x="' + r1(q.x) + '" y="' + r1(q.y + 1) + '" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="#2f1d0c">' +
        esc(p.name) + '</text></g>');
    });
    out.push(tags.join(''));

    /* ---------- title ---------- */
    var title = String(data.title || '');
    var fs = Math.max(30, 64 - Math.max(0, Array.from(title).length - 14) * 1.6);
    var tcx = W / 2;
    out.push('<text x="' + r1(tcx) + '" y="100" text-anchor="middle" dominant-baseline="central" font-size="' + r1(fs) +
      '" font-weight="800" fill="#3a2714">' + esc(title) + '</text>');
    var span = Math.min(420, Math.max(220, Array.from(title).length * fs * 0.36));
    out.push('<path d="M' + r1(tcx - span) + ' 150Q' + r1(tcx) + ' 176 ' + r1(tcx + span) + ' 150" fill="none" stroke="#7a4f27" stroke-width="4" stroke-linecap="round"/>');
    [-1, 1].forEach(function (sd) {
      out.push('<use href="#ft-lf1" xlink:href="#ft-lf1" transform="translate(' + r1(tcx + sd * (span + 6)) + ' 150) rotate(' + (sd < 0 ? 200 : -20) + ') scale(1.3)" fill="#62a043" stroke="#2f5a25" stroke-width="0.8"/>');
    });

    out.push('</svg>');
    return { svg: out.join(''), width: W, height: H };
  }

  return { build: build };
});
